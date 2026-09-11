import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { once } from 'node:events';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { resolveInstitutionalContext } from '../src/auth/institutional-context.ts';
import { createRequireAuth } from '../src/middleware/auth.ts';
import { registerDocumentRoutes } from '../src/modules/documents/document.controller.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import {
  ConfigurableDocumentAccessPolicyEngine,
} from '../src/modules/documents/document-access-policy.ts';
import {
  ConfigurableRetentionPolicyEngine,
} from '../src/modules/documents/document-retention-policy.ts';
import { assertNoInternalSecretsInDto } from '../src/modules/documents/document-dto.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import { PostgresRetentionAssignmentRepository } from '../src/modules/documents/document-retention-repository.ts';

await verifyApprovedTestConnection();

const schema = `doc_api_int_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

let server: http.Server | undefined;

const client = await pool.connect();
try {
  await client.query(`CREATE SCHEMA ${quote(schema)}`);
  await client.query(`SET search_path TO ${quote(schema)}, public`);

  const migrations = await discoverMigrations(migrationsDir);
  await runMigrations(client, migrations);

  const institutionId = randomUUID();
  const adminPersonId = randomUUID();
  const teacherPersonId = randomUUID();
  const membershipAdminId = randomUUID();
  const membershipTeacherId = randomUUID();

  await client.query(
    `INSERT INTO institutions (id, name, slug, status) VALUES ($1, 'Documents Test Inst', 'doc-test-inst', 'active')`,
    [institutionId],
  );
  await client.query(
    `INSERT INTO people (id, name) VALUES ($1, 'Admin User'), ($2, 'Teacher User')`,
    [adminPersonId, teacherPersonId],
  );
  await client.query(
    `INSERT INTO identities (person_id, provider, provider_subject)
     VALUES ($1, 'firebase', 'doc-admin-uid'), ($2, 'firebase', 'doc-teacher-uid')`,
    [adminPersonId, teacherPersonId],
  );
  await client.query(
    `INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at)
     VALUES ($1, $2, $3, 'institution_admin', 'active', now()),
            ($4, $5, $3, 'teacher', 'active', now())`,
    [membershipAdminId, adminPersonId, institutionId, membershipTeacherId, teacherPersonId],
  );

  const storageProvider = new MemoryObjectStorageProvider();
  const policyEngine = new ConfigurableDocumentAccessPolicyEngine([
    { role: 'institution_admin', category: '*', allowedActions: ['open_content', 'download_content'] },
    { role: 'teacher', category: '*', allowedActions: ['open_content', 'download_content'] },
  ]);

  const retentionPolicyEngine = new ConfigurableRetentionPolicyEngine([
    {
      policyId: 'retention-policy-1',
      policyVersion: '1.0',
      jurisdictionProfileId: 'AO-STD',
      jurisdictionProfileVersion: '1.0',
      category: 'identification',
      clockTriggerType: 'enrollment_completed',
      retentionDurationDays: 0, // Instant expiry for testing deletion eligibility
      allowedHoldTypes: ['legal', 'administrative'],
      allowedDeletionAuthorityScopePatterns: ['institution_admin', 'admin'],
    },
  ]);

  const app = express();
  app.use(express.json());
  const auth = createRequireAuth({
    verifyIdToken: async (token) => ({ uid: token }),
    pool: pool as any,
    resolveInstitutionalContext,
  });

  registerDocumentRoutes(app, {
    pool: pool as any,
    requireAuth: auth,
    storageProvider,
    policyEngine,
    retentionPolicyEngine,
    accessGrantTokenKey: 'synthetic-test-token-key-minimum-32-chars-long-secret',
    deletionPseudonymizationKey: 'synthetic-test-deletion-pseudonymization-key-32',
  });

  server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const request = async (
    path: string,
    options: {
      method?: string;
      token?: string;
      body?: unknown;
      headers?: Record<string, string>;
    } = {},
  ) => {
    const { method = 'GET', token = 'doc-admin-uid', body, headers = {} } = options;
    const reqHeaders: Record<string, string> = {
      ...headers,
    };
    if (token) {
      reqHeaders.Authorization = `Bearer ${token}`;
    }
    if (body !== undefined) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    return fetch(`${baseUrl}${path}`, {
      method,
      headers: reqHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  console.log('[TEST 1] Upload Session Lifecycle & Status');
  // 1. POST /api/documents/upload-sessions
  const createSessionRes = await request('/api/documents/upload-sessions', {
    method: 'POST',
    body: {
      category: 'identification',
      classification: 'bi',
      declaredFilename: 'id_card_scan.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 1024,
    },
  });

  assert.equal(createSessionRes.status, 201, 'Upload session creation must succeed with 201');
  const sessionBody = (await createSessionRes.json()) as any;
  assert.ok(sessionBody.documentId, 'Response must include documentId');
  assert.ok(sessionBody.sessionId, 'Response must include sessionId');
  assert.ok(sessionBody.rawToken, 'Response must include ephemeral rawToken');
  assert.equal(sessionBody.session.declaredFilename, 'id_card_scan.pdf');
  assert.equal(sessionBody.session.status, 'authorized');
  assertNoInternalSecretsInDto(sessionBody);

  const documentId = sessionBody.documentId;
  const sessionId = sessionBody.sessionId;
  const rawUploadToken = sessionBody.rawToken;

  // Simulate client direct storage upload
  const fileBytes = Buffer.from('%PDF-1.4 Mock PDF Content For Test');
  const fileHash = createHash('sha256').update(fileBytes).digest('hex');

  // Obtain storage coordinates internally for memory provider mock upload
  const sessionRow = (
    await pool.query<{ storage_bucket: string; storage_key: string }>(
      `SELECT storage_bucket, storage_key FROM document_upload_sessions WHERE id = $1`,
      [sessionId],
    )
  ).rows[0];

  await storageProvider.simulateDirectUpload({
    storageBucket: sessionRow.storage_bucket,
    storageKey: sessionRow.storage_key,
    content: fileBytes,
    mimeType: 'application/pdf',
  });

  // 2. Complete upload session
  const completeRes = await request(`/api/documents/upload-sessions/${sessionId}/complete`, {
    method: 'POST',
    body: { rawToken: rawUploadToken },
  });

  assert.equal(completeRes.status, 200, 'Complete upload session must succeed with 200');
  const completeBody = (await completeRes.json()) as any;
  assert.equal(completeBody.success, true);
  assert.equal(completeBody.version.status, 'content_received', 'Initial version status MUST be content_received');
  assert.equal(completeBody.version.byteSize, fileBytes.length);
  assert.equal(completeBody.version.sha256Hash, fileHash);
  assertNoInternalSecretsInDto(completeBody);

  const versionId = completeBody.versionId;

  console.log('[TEST 2] Query Endpoints: Detail, List & Activity');
  // 3. GET /api/documents/:id
  const detailRes = await request(`/api/documents/${documentId}`);
  assert.equal(detailRes.status, 200, 'Document detail must return 200');
  const detailBody = (await detailRes.json()) as any;
  assert.equal(detailBody.id, documentId);
  assert.equal(detailBody.category, 'identification');
  assert.equal(detailBody.classification, 'bi');
  assert.equal(detailBody.versionCount, 1);
  assert.equal(detailBody.currentVersion.status, 'content_received');
  assert.equal(detailBody.capabilities.canOpen, false, 'content_received version cannot be opened yet');
  assertNoInternalSecretsInDto(detailBody);

  // 4. GET /api/documents (List with filters and pagination)
  const listRes = await request(`/api/documents?category=identification&limit=10&page=1`);
  assert.equal(listRes.status, 200);
  const listBody = (await listRes.json()) as any;
  assert.equal(listBody.total, 1);
  assert.equal(listBody.items.length, 1);
  assert.equal(listBody.items[0].id, documentId);
  assert.equal(listBody.page, 1);
  assert.equal(listBody.limit, 10);
  assert.equal(listBody.hasMore, false);
  assertNoInternalSecretsInDto(listBody);

  // 5. GET /api/documents/:id/activity
  const activityRes = await request(`/api/documents/${documentId}/activity`);
  assert.equal(activityRes.status, 200);
  const activityBody = (await activityRes.json()) as any;
  assert.ok(activityBody.items.length >= 2, 'Activity must include document creation and upload completed');
  assertNoInternalSecretsInDto(activityBody);

  console.log('[TEST 3] Secure Access Two-Stage Flow (Authorize -> Exchange Stream -> Revoke)');
  // Transition version status to 'available' to simulate passing technical verification
  await pool.query(
    `UPDATE document_versions SET status = 'available' WHERE id = $1`,
    [versionId],
  );

  // Authorize content access (Stage 1)
  const accessAuthRes = await request(`/api/documents/${documentId}/access`, {
    method: 'POST',
    body: {
      versionId,
      action: 'open',
    },
  });

  assert.equal(accessAuthRes.status, 201, 'Access authorization must return 201');
  const accessAuthBody = (await accessAuthRes.json()) as any;
  assert.ok(accessAuthBody.grantId);
  assert.ok(accessAuthBody.rawAccessToken);
  assert.equal(accessAuthBody.action, 'open');
  assert.equal(typeof accessAuthBody.expiresInSeconds, 'number');
  assertNoInternalSecretsInDto(accessAuthBody);

  const rawAccessToken = accessAuthBody.rawAccessToken;
  const grantId = accessAuthBody.grantId;

  // Exchange grant token for content stream (Stage 2)
  const exchangeRes = await request('/api/documents/access/exchange', {
    method: 'POST',
    body: {
      rawAccessToken,
      displayFilename: 'safe_preview.pdf',
    },
  });

  assert.equal(exchangeRes.status, 200, 'Exchange grant must return 200 content stream');
  assert.equal(exchangeRes.headers.get('content-type'), 'application/pdf');
  assert.equal(exchangeRes.headers.get('content-length'), String(fileBytes.length));
  assert.equal(exchangeRes.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(exchangeRes.headers.get('content-disposition')?.includes('safe_preview.pdf'));

  const streamBuffer = Buffer.from(await exchangeRes.arrayBuffer());
  assert.deepEqual(streamBuffer, fileBytes, 'Streamed content must match original bytes exactly');

  // Stolen token rejection: Teacher attempts to exchange Admin's token
  const stolenRes = await request('/api/documents/access/exchange', {
    method: 'POST',
    token: 'doc-teacher-uid',
    body: { rawAccessToken },
  });
  assert.equal(stolenRes.status, 403, 'Stolen token must be rejected with 403');

  // Revoke grant
  const revokeRes = await request(`/api/documents/access/${grantId}/revoke`, {
    method: 'POST',
    body: { reason: 'Security routine revocation test' },
  });
  assert.equal(revokeRes.status, 200);

  // Exchange after revocation must fail
  const exchangeRevokedRes = await request('/api/documents/access/exchange', {
    method: 'POST',
    body: { rawAccessToken },
  });
  assert.equal(exchangeRevokedRes.status, 409, 'Exchange of revoked grant must be rejected with 409');

  console.log('[TEST 4] Retention, Holds & Deletion State Machine');
  // Assign retention assignment
  const retentionRepo = new PostgresRetentionAssignmentRepository();
  const client2 = await pool.connect();
  try {
    await retentionRepo.insert(client2, {
      institutionId,
      documentId,
      versionId,
      policyId: 'retention-policy-1',
      policyVersion: '1.0',
      jurisdictionProfileId: 'AO-STD',
      jurisdictionProfileVersion: '1.0',
      category: 'identification',
      purpose: 'Identity verification',
      clockTriggerType: 'enrollment_completed',
      clockTriggerEventAt: new Date(),
      retainUntil: new Date(Date.now() - 1000), // In the past -> retention expired
      assignedByPersonId: adminPersonId,
      correlationId: randomUUID(),
    });
  } finally {
    client2.release();
  }

  // Place Hold: POST /api/documents/:id/holds
  const placeHoldRes = await request(`/api/documents/${documentId}/holds`, {
    method: 'POST',
    body: {
      versionId,
      holdType: 'legal',
      authority: 'Court Order AO-2026',
      reason: 'Audit investigation hold',
    },
  });

  assert.equal(placeHoldRes.status, 201);
  const holdBody = (await placeHoldRes.json()) as any;
  assert.equal(holdBody.hold.holdStatus, 'active');
  assert.equal(holdBody.hold.authority, 'Court Order AO-2026');
  assertNoInternalSecretsInDto(holdBody);
  const holdId = holdBody.hold.id;

  // Deletion Authorization while hold is active MUST FAIL WITH 409
  const authDelBlockedRes = await request(`/api/documents/${documentId}/deletion/authorize`, {
    method: 'POST',
    body: { versionId },
  });
  assert.equal(authDelBlockedRes.status, 409, 'Deletion authorization must be blocked when hold is active');

  // Release Hold: POST /api/documents/:id/holds/:holdId/release
  const releaseHoldRes = await request(`/api/documents/${documentId}/holds/${holdId}/release`, {
    method: 'POST',
    body: {
      versionId,
      releaseReason: 'Investigation concluded with clear outcome',
    },
  });
  assert.equal(releaseHoldRes.status, 200);
  const releaseBody = (await releaseHoldRes.json()) as any;
  assert.equal(releaseBody.hold.holdStatus, 'released');
  assertNoInternalSecretsInDto(releaseBody);

  // Authorize Deletion: POST /api/documents/:id/deletion/authorize
  const authDelRes = await request(`/api/documents/${documentId}/deletion/authorize`, {
    method: 'POST',
    body: { versionId },
  });
  assert.equal(authDelRes.status, 201);
  const authDelBody = (await authDelRes.json()) as any;
  assert.ok(authDelBody.authorizationId);
  assert.equal(authDelBody.authorizationStatus, 'authorized');
  assertNoInternalSecretsInDto(authDelBody);
  const deletionAuthorizationId = authDelBody.authorizationId;

  // Execute Deletion: POST /api/documents/:id/deletion/execute
  const execDelRes = await request(`/api/documents/${documentId}/deletion/execute`, {
    method: 'POST',
    body: { deletionAuthorizationId },
  });
  assert.equal(execDelRes.status, 200);
  const execDelBody = (await execDelRes.json()) as any;
  assert.equal(execDelBody.success, true);
  assert.equal(execDelBody.reconciliationRequired, false);
  assert.ok(execDelBody.deletionRecord);
  assert.equal(execDelBody.deletionRecord.storageDeletionConfirmed, true);
  assertNoInternalSecretsInDto(execDelBody);

  // Verify deleted version status in DB
  const deletedVersionRow = (
    await pool.query<{ status: string }>(
      `SELECT status FROM document_versions WHERE id = $1`,
      [versionId],
    )
  ).rows[0];
  assert.equal(deletedVersionRow.status, 'deleted', 'Version status must be terminal "deleted"');

  // Content access to deleted version MUST be denied (422 technical state rejection)
  const accessDeletedRes = await request(`/api/documents/${documentId}/access`, {
    method: 'POST',
    body: { versionId, action: 'open' },
  });
  assert.equal(accessDeletedRes.status, 422, 'Access to deleted version must be denied with 422');

  console.log('[DOCUMENTS-API-INTEGRATION] All integration scenarios PASSED.');
} finally {
  client.release();
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
  await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined);
  await pool.end();
}
