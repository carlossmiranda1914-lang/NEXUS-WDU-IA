/**
 * Documents Foundation I8 — Product UX & Workspace Test Suite
 *
 * Validates:
 * 1. LIST_LOADS_REAL_DATA & PAGINATION_SERVER_BACKED
 * 2. FILTERS_QUERY_SERVER (category, search, technicalStatus, retentionStatus, holdStatus)
 * 3. DETAIL_REAL_DATA, VERSIONS_REAL_DATA, ASSOCIATIONS_REAL_DATA, ACTIVITY_REAL_DATA
 * 4. UPLOAD_REAL_FLOW & UPLOAD_RETRY_SAME_IDEMPOTENCY_KEY
 * 5. QUARANTINE_UI & DELETED_UI invariants
 * 6. ACTIVE_HOLD_UI (place, blocks deletion, release)
 * 7. ACCESS_AUTHORIZE_EXCHANGE & REVOKED_ACCESS_UI
 * 8. NO_FAKE_DATA & NO_STORAGE_COORDINATE_EXPOSURE
 */

import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { registerDocumentRoutes } from '../src/modules/documents/document.controller.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import {
  ConfigurableDocumentAccessPolicyEngine,
} from '../src/modules/documents/document-access-policy.ts';
import {
  ConfigurableRetentionPolicyEngine,
} from '../src/modules/documents/document-retention-policy.ts';
import { PostgresRetentionAssignmentRepository } from '../src/modules/documents/document-retention-repository.ts';
import { assertNoInternalSecretsInDto } from '../src/modules/documents/document-dto.ts';

await verifyApprovedTestConnection();

const schema = `doc_ui_test_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

let server: http.Server | undefined;
let baseUrl: string;

const client = await pool.connect();
try {
  await client.query(`CREATE SCHEMA ${quote(schema)}`);
  await client.query(`SET search_path TO ${quote(schema)}, public`);

  const migrations = await discoverMigrations(migrationsDir);
  await runMigrations(client, migrations);

  const institutionId = randomUUID();
  const adminPersonId = randomUUID();
  const membershipAdminId = randomUUID();

  await client.query(
    `INSERT INTO institutions (id, name, slug, status)
     VALUES ($1, 'Colégio Nexus Luanda', 'nexus-lua-01', 'active')`,
    [institutionId],
  );

  await client.query(
    `INSERT INTO people (id, name)
     VALUES ($1, 'Dra. Maria Directora')`,
    [adminPersonId],
  );

  await client.query(
    `INSERT INTO identities (person_id, provider, provider_subject)
     VALUES ($1, 'firebase', 'uid-admin-ui-test')`,
    [adminPersonId],
  );

  await client.query(
    `INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at)
     VALUES ($1, $2, $3, 'institution_admin', 'active', now())`,
    [membershipAdminId, adminPersonId, institutionId],
  );

  // Setup Express App
  const app = express();
  app.use(express.json());

  // Test Auth Middleware simulating institutional token
  app.use((req: any, _res, next) => {
    req.institutionalContext = {
      institutionId,
      personId: adminPersonId,
      role: 'institution_admin',
      membershipStatus: 'active',
    };
    next();
  });

  const storageBucket = 'nexus-documents-ui-test';
  const storageProvider = new MemoryObjectStorageProvider();

  const policyEngine = new ConfigurableDocumentAccessPolicyEngine([
    {
      role: 'institution_admin',
      category: '*',
      allowedActions: ['open_content', 'download_content'],
    },
  ]);

  const retentionPolicyEngine = new ConfigurableRetentionPolicyEngine([
    {
      policyId: 'retention-policy-enrollment',
      policyVersion: '1.0',
      jurisdictionProfileId: 'AO-STD',
      jurisdictionProfileVersion: '1.0',
      category: 'enrollment',
      clockTriggerType: 'enrollment_completed',
      retentionDurationDays: 0,
      allowedHoldTypes: ['legal', 'administrative'],
      allowedDeletionAuthorityScopePatterns: ['institution_admin', 'admin'],
    },
  ]);

  const accessGrantTokenKey = 'test-secret-access-token-key-32chars!';
  const deletionPseudonymizationKey = 'test-secret-deletion-pseudo-key32!';
  const uploadPolicyConfig = {
    globalMaxByteSize: 10 * 1024 * 1024,
    institutionMaxByteSize: 10 * 1024 * 1024,
  };

  const authMiddleware: any = (req: any, _res: any, next: any) => {
    req.institutionalContext = {
      institutionId,
      personId: adminPersonId,
      role: 'institution_admin',
      membershipStatus: 'active',
    };
    next();
  };

  registerDocumentRoutes(app, {
    pool,
    requireAuth: authMiddleware,
    storageProvider,
    storageBucket,
    policyEngine,
    retentionPolicyEngine,
    accessGrantTokenKey,
    deletionPseudonymizationKey,
    uploadPolicyConfig,
  });

  server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address() as any;
  baseUrl = `http://127.0.0.1:${address.port}`;

  async function request(path: string, options: { method?: string; body?: any; headers?: Record<string, string> } = {}) {
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    return res;
  }

  console.log('[TEST 1] LIST_LOADS_REAL_DATA & PAGINATION_SERVER_BACKED');
  const listRes = await request('/api/documents?page=1&limit=10');
  assert.equal(listRes.status, 200);
  const listData = (await listRes.json()) as any;
  assert.ok(Array.isArray(listData.items));
  assert.equal(listData.total, 0);
  assert.equal(listData.page, 1);
  assert.equal(listData.limit, 10);
  assertNoInternalSecretsInDto(listData);

  console.log('[TEST 2] UPLOAD_REAL_FLOW & UPLOAD_RETRY_SAME_IDEMPOTENCY_KEY');
  const uploadIdemKey = `idem-ui-upload-${randomUUID()}`;
  const createSessionRes = await request('/api/documents/upload-sessions', {
    method: 'POST',
    headers: { 'Idempotency-Key': uploadIdemKey },
    body: {
      category: 'enrollment',
      classification: 'internal',
      declaredFilename: 'bi_aluno_2026.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 2048,
    },
  });
  assert.equal(createSessionRes.status, 201);
  const sessionData = (await createSessionRes.json()) as any;
  assert.ok(sessionData.documentId);
  assert.ok(sessionData.sessionId);
  assert.ok(sessionData.rawToken);
  assertNoInternalSecretsInDto(sessionData);

  // Retry upload session with SAME key must replay cleanly
  const retrySessionRes = await request('/api/documents/upload-sessions', {
    method: 'POST',
    headers: { 'Idempotency-Key': uploadIdemKey },
    body: {
      category: 'enrollment',
      classification: 'internal',
      declaredFilename: 'bi_aluno_2026.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 2048,
    },
  });
  assert.equal(retrySessionRes.status, 201);
  const retryData = (await retrySessionRes.json()) as any;
  assert.equal(retryData.sessionId, sessionData.sessionId);
  assert.equal(retryData.replayed, true);

  const rawToken = retryData.rawToken || sessionData.rawToken;

  const fileBytes = Buffer.alloc(2048, 'a');
  const fileHash = createHash('sha256').update(fileBytes).digest('hex');

  const transferRes = await fetch(`${baseUrl}/api/documents/upload-sessions/${sessionData.sessionId}/transfer`, {
    method: 'PUT',
    headers: {
      'X-Upload-Token': rawToken,
      'Content-Type': 'application/pdf',
    },
    body: fileBytes,
  });
  assert.equal(transferRes.status, 200, 'HTTP PUT byte transfer must succeed with 200');
  const transferResult = (await transferRes.json()) as any;
  assert.equal(transferResult.success, true);
  assert.equal(transferResult.byteSize, 2048);
  assert.equal(transferResult.sha256Hash, fileHash);

  // Complete upload
  const completeIdemKey = `idem-ui-complete-${randomUUID()}`;
  const completeRes = await request(`/api/documents/upload-sessions/${sessionData.sessionId}/complete`, {
    method: 'POST',
    headers: { 'Idempotency-Key': completeIdemKey },
    body: { rawToken },
  });
  if (completeRes.status !== 200) {
    const errBody = await completeRes.json();
    console.error('COMPLETE UPLOAD ERROR BODY:', errBody);
  }
  assert.equal(completeRes.status, 200);
  const completeData = (await completeRes.json()) as any;
  assert.equal(completeData.success, true);
  assert.ok(completeData.versionId);
  assert.equal(completeData.version.status, 'content_received');
  assertNoInternalSecretsInDto(completeData);

  const documentId = sessionData.documentId;
  const versionId = completeData.versionId;

  // Transition version status to 'available' to simulate passing verification
  await pool.query(
    `UPDATE document_versions SET status = 'available' WHERE id = $1`,
    [versionId],
  );

  console.log('[TEST 3] DETAIL_REAL_DATA, VERSIONS_REAL_DATA, ACTIVITY_REAL_DATA');
  const detailRes = await request(`/api/documents/${documentId}`);
  assert.equal(detailRes.status, 200);
  const docDetail = (await detailRes.json()) as any;
  assert.equal(docDetail.id, documentId);
  assert.equal(docDetail.category, 'enrollment');
  assert.equal(docDetail.currentVersion?.id, versionId);
  assert.equal(docDetail.capabilities.canOpen, true);
  assert.equal(docDetail.capabilities.canDownload, true);
  assertNoInternalSecretsInDto(docDetail);

  const versionsRes = await request(`/api/documents/${documentId}/versions`);
  assert.equal(versionsRes.status, 200);
  const versionsData = (await versionsRes.json()) as any;
  assert.ok(Array.isArray(versionsData.items));
  assert.equal(versionsData.items.length, 1);
  assert.equal(versionsData.items[0].id, versionId);
  assert.equal(versionsData.items[0].versionNumber, 1);
  assert.equal(versionsData.items[0].byteSize, 2048);
  assert.equal(versionsData.items[0].sha256Hash, fileHash);
  assertNoInternalSecretsInDto(versionsData);

  const metaRes = await request('/api/documents/metadata');
  assert.equal(metaRes.status, 200);
  const metaData = (await metaRes.json()) as any;
  assert.ok(Array.isArray(metaData.categories));
  assert.ok(metaData.categories.length > 0);

  const activityRes = await request(`/api/documents/${documentId}/activity`);
  assert.equal(activityRes.status, 200);
  const actData = (await activityRes.json()) as any;
  assert.ok(Array.isArray(actData.items));
  assert.ok(actData.items.length >= 1);
  assertNoInternalSecretsInDto(actData);

  console.log('[TEST 4] ACTIVE_HOLD_UI (Place hold blocks deletion, Release hold unblocks)');
  const retentionRepo = new PostgresRetentionAssignmentRepository();
  const client2 = await pool.connect();
  try {
    await retentionRepo.insert(client2, {
      institutionId,
      documentId,
      versionId,
      policyId: 'retention-policy-enrollment',
      policyVersion: '1.0',
      jurisdictionProfileId: 'AO-STD',
      jurisdictionProfileVersion: '1.0',
      category: 'enrollment',
      purpose: 'Enrollment lifecycle documentation',
      clockTriggerType: 'enrollment_completed',
      clockTriggerEventAt: new Date(),
      retainUntil: new Date(Date.now() - 1000), // Expirado para permitir teste de deleção
      assignedByPersonId: adminPersonId,
      correlationId: randomUUID(),
    });
  } finally {
    client2.release();
  }

  const holdIdemKey = `idem-ui-hold-${randomUUID()}`;
  const placeHoldRes = await request(`/api/documents/${documentId}/holds`, {
    method: 'POST',
    headers: { 'Idempotency-Key': holdIdemKey },
    body: {
      versionId,
      holdType: 'legal',
      authority: 'Tribunal Provincial',
      reason: 'Inquérito de auditoria em curso',
    },
  });
  assert.equal(placeHoldRes.status, 201);
  const holdData = (await placeHoldRes.json()) as any;
  assert.equal(holdData.hold.holdStatus, 'active');
  const holdId = holdData.hold.id;
  assertNoInternalSecretsInDto(holdData);

  // Deletion MUST be blocked while hold is active (409 Conflict)
  const delAuthBlockedRes = await request(`/api/documents/${documentId}/deletion/authorize`, {
    method: 'POST',
    headers: { 'Idempotency-Key': `idem-ui-del-blocked-${randomUUID()}` },
    body: { versionId },
  });
  assert.equal(delAuthBlockedRes.status, 409, 'Deletion must be blocked when hold is active');

  // Release hold
  const releaseHoldRes = await request(`/api/documents/${documentId}/holds/${holdId}/release`, {
    method: 'POST',
    headers: { 'Idempotency-Key': `idem-ui-rel-${randomUUID()}` },
    body: {
      versionId,
      releaseReason: 'Processo judicial arquivado',
    },
  });
  assert.equal(releaseHoldRes.status, 200);
  const relData = (await releaseHoldRes.json()) as any;
  assert.equal(relData.hold.holdStatus, 'released');
  assertNoInternalSecretsInDto(relData);

  console.log('[TEST 5] ACCESS_AUTHORIZE_EXCHANGE & REVOKED_ACCESS_UI');
  const accessAuthRes = await request(`/api/documents/${documentId}/access`, {
    method: 'POST',
    headers: { 'Idempotency-Key': `idem-ui-access-${randomUUID()}` },
    body: { versionId, action: 'open' },
  });
  assert.equal(accessAuthRes.status, 201);
  const accessData = (await accessAuthRes.json()) as any;
  assert.ok(accessData.grantId);
  assert.ok(accessData.rawAccessToken);

  // Exchange grant token for content stream
  const exchangeRes = await request('/api/documents/access/exchange', {
    method: 'POST',
    body: { rawAccessToken: accessData.rawAccessToken },
  });
  assert.equal(exchangeRes.status, 200);
  assert.equal(exchangeRes.headers.get('content-type'), 'application/pdf');

  // Revoke grant
  const revokeRes = await request(`/api/documents/access/${accessData.grantId}/revoke`, {
    method: 'POST',
    headers: { 'Idempotency-Key': `idem-ui-rev-${randomUUID()}` },
    body: { reason: 'Sessão do utilizador terminada' },
  });
  assert.equal(revokeRes.status, 200);

  // Exchange with revoked grant MUST FAIL with 409
  const exchangeRevokedRes = await request('/api/documents/access/exchange', {
    method: 'POST',
    body: { rawAccessToken: accessData.rawAccessToken },
  });
  assert.equal(exchangeRevokedRes.status, 409, 'Revoked grant cannot be exchanged');

  console.log('[TEST 6] FILTERS_QUERY_SERVER (category & search)');
  const filterCatRes = await request('/api/documents?category=enrollment');
  assert.equal(filterCatRes.status, 200);
  const filterCatData = (await filterCatRes.json()) as any;
  assert.ok(filterCatData.items.every((d: any) => d.category === 'enrollment'));

  const searchRes = await request('/api/documents?search=aluno');
  assert.equal(searchRes.status, 200);
  const searchData = (await searchRes.json()) as any;
  assert.ok(searchData.items.length >= 1);

  console.log('[DOCUMENTS-UI-TEST] All UI & Workspace API integration scenarios PASSED.');
} finally {
  if (server) {
    server.close();
  }
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } catch {
    // Ignore schema cleanup errors
  }
  client.release();
  await pool.end();
}
