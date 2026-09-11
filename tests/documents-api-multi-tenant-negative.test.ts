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
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import { PostgresRetentionAssignmentRepository } from '../src/modules/documents/document-retention-repository.ts';
import { PostgresRetentionHoldRepository } from '../src/modules/documents/document-retention-repository.ts';

await verifyApprovedTestConnection();

const schema = `doc_api_mt_${randomUUID().replaceAll('-', '')}`;
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

  const instA = randomUUID();
  const instB = randomUUID();
  const adminA = randomUUID();
  const adminB = randomUUID();
  const membershipA = randomUUID();
  const membershipB = randomUUID();

  await client.query(
    `INSERT INTO institutions (id, name, slug, status)
     VALUES ($1, 'Institution A', 'inst-a', 'active'),
            ($2, 'Institution B', 'inst-b', 'active')`,
    [instA, instB],
  );
  await client.query(
    `INSERT INTO people (id, name)
     VALUES ($1, 'Admin A'), ($2, 'Admin B')`,
    [adminA, adminB],
  );
  await client.query(
    `INSERT INTO identities (person_id, provider, provider_subject)
     VALUES ($1, 'firebase', 'uid-admin-a'), ($2, 'firebase', 'uid-admin-b')`,
    [adminA, adminB],
  );
  await client.query(
    `INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at)
     VALUES ($1, $2, $3, 'institution_admin', 'active', now()),
            ($4, $5, $6, 'institution_admin', 'active', now())`,
    [membershipA, adminA, instA, membershipB, adminB, instB],
  );

  const storageProvider = new MemoryObjectStorageProvider();
  const policyEngine = new ConfigurableDocumentAccessPolicyEngine([
    { role: 'institution_admin', category: '*', allowedActions: ['open_content', 'download_content'] },
  ]);

  const retentionPolicyEngine = new ConfigurableRetentionPolicyEngine([
    {
      policyId: 'retention-policy-1',
      policyVersion: '1.0',
      jurisdictionProfileId: 'AO-STD',
      jurisdictionProfileVersion: '1.0',
      category: 'identification',
      clockTriggerType: 'enrollment_completed',
      retentionDurationDays: 365,
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
    const { method = 'GET', token = 'uid-admin-a', body, headers = {} } = options;
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

  // Create document in Institution A
  const docRepo = new PostgresDocumentRepository();
  const retentionRepo = new PostgresRetentionAssignmentRepository();
  const holdRepo = new PostgresRetentionHoldRepository();

  let docAId: string;
  let versionAId: string;
  let holdAId: string;

  const docA = await docRepo.createDocument(client, {
    institutionId: instA,
    category: 'identification',
    classification: 'passport',
    createdByPersonId: adminA,
  });
  docAId = docA.id;

  const fileContent = Buffer.from('Confidential Tenant A Document Content');
  const hashA = createHash('sha256').update(fileContent).digest('hex');

  const vRes = await docRepo.createNextVersion(client, {
    institutionId: instA,
    documentId: docAId,
    mimeType: 'application/pdf',
    byteSize: fileContent.length,
    sha256Hash: hashA,
    status: 'available',
    createdByPersonId: adminA,
    provenance: {
      originType: 'user_upload',
      actorPersonId: adminA,
      sourceDomain: 'portal.admin',
      method: 'direct_seed',
    },
    storageReference: {
      storageProvider: 'memory_test_provider',
      storageBucket: 'vault-a',
      storageKey: `tenants/${instA}/docs/${docAId}/v1.pdf`,
    },
  });
  versionAId = vRes.version.id;

  await storageProvider.simulateDirectUpload({
    storageBucket: 'vault-a',
    storageKey: `tenants/${instA}/docs/${docAId}/v1.pdf`,
    content: fileContent,
    mimeType: 'application/pdf',
  });

  const assignmentA = await retentionRepo.insert(client, {
    institutionId: instA,
    documentId: docAId,
    versionId: versionAId,
    policyId: 'retention-policy-1',
    policyVersion: '1.0',
    jurisdictionProfileId: 'AO-STD',
    jurisdictionProfileVersion: '1.0',
    category: 'identification',
    purpose: 'multi_tenant_test',
    clockTriggerType: 'enrollment_completed',
    clockTriggerEventAt: new Date(),
    retainUntil: new Date(Date.now() + 365 * 86400000),
    assignedByPersonId: adminA,
    correlationId: randomUUID(),
  });

  const holdA = await holdRepo.insert(client, {
    institutionId: instA,
    documentId: docAId,
    versionId: versionAId,
    holdType: 'legal',
    authority: 'Authority A',
    reason: 'Audit A',
    createdByPersonId: adminA,
    correlationId: randomUUID(),
  });
  holdAId = holdA.id;

  // 1. INSTITUTION_B_LISTS_A_DOCUMENTS -> ZERO RESULTS
  console.log('[MULTI-TENANT 1] Institution B lists documents');
  const listBRes = await request('/api/documents', { token: 'uid-admin-b' });
  assert.equal(listBRes.status, 200);
  const listBBody = (await listBRes.json()) as any;
  assert.equal(listBBody.total, 0, 'Institution B list must return 0 documents');
  assert.equal(listBBody.items.length, 0);

  // 2. INSTITUTION_B_FETCHES_A_DOCUMENT -> 404 (tenant-hidden)
  console.log('[MULTI-TENANT 2] Institution B fetches Tenant A document');
  const getDocBRes = await request(`/api/documents/${docAId}`, { token: 'uid-admin-b' });
  assert.equal(getDocBRes.status, 404, 'Fetching cross-tenant document must return 404');

  // 3. INSTITUTION_B_FETCHES_A_ACTIVITY -> 404 (tenant-hidden)
  console.log('[MULTI-TENANT 3] Institution B fetches Tenant A document activity');
  const getActivityBRes = await request(`/api/documents/${docAId}/activity`, { token: 'uid-admin-b' });
  assert.equal(getActivityBRes.status, 404, 'Fetching cross-tenant activity must return 404');

  // 4. INSTITUTION_B_CREATES_VERSION_UPLOAD_SESSION_FOR_A -> 404 / 400
  console.log('[MULTI-TENANT 4] Institution B creates upload session for Tenant A document');
  const uploadSessBRes = await request(`/api/documents/${docAId}/versions/upload-sessions`, {
    method: 'POST',
    token: 'uid-admin-b',
    body: {
      declaredFilename: 'injected.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 1024,
    },
  });
  assert.equal(uploadSessBRes.status, 404, 'Creating upload session for cross-tenant document must be denied');

  // 5. INSTITUTION_B_AUTHORIZES_A_ACCESS -> 404
  console.log('[MULTI-TENANT 5] Institution B authorizes access to Tenant A document');
  const authAccessBRes = await request(`/api/documents/${docAId}/access`, {
    method: 'POST',
    token: 'uid-admin-b',
    body: {
      versionId: versionAId,
      action: 'open',
    },
  });
  assert.equal(authAccessBRes.status, 404, 'Authorizing access for cross-tenant document must return 404');

  // 6. INSTITUTION_B_EXCHANGES_A_TOKEN -> 404 / 403 DENIED
  console.log('[MULTI-TENANT 6] Institution B exchanges Tenant A grant token');
  // First obtain valid grant token in Institution A
  const authAccessARes = await request(`/api/documents/${docAId}/access`, {
    method: 'POST',
    token: 'uid-admin-a',
    body: { versionId: versionAId, action: 'open' },
  });
  assert.equal(authAccessARes.status, 201);
  const rawTokenA = ((await authAccessARes.json()) as any).rawAccessToken;

  // Now Institution B attempts to exchange Tenant A's token
  const exchangeCrossRes = await request('/api/documents/access/exchange', {
    method: 'POST',
    token: 'uid-admin-b',
    body: { rawAccessToken: rawTokenA },
  });
  assert.equal(
    exchangeCrossRes.status === 403 || exchangeCrossRes.status === 404,
    true,
    'Cross-tenant token exchange must be denied with 403/404',
  );

  // 7. INSTITUTION_B_MUTATES_A_HOLD -> 404
  console.log('[MULTI-TENANT 7] Institution B places hold on Tenant A document');
  const placeHoldBRes = await request(`/api/documents/${docAId}/holds`, {
    method: 'POST',
    token: 'uid-admin-b',
    body: {
      versionId: versionAId,
      holdType: 'legal',
      authority: 'Attacker Authority',
      reason: 'Cross-tenant interference',
    },
  });
  assert.equal(placeHoldBRes.status, 404, 'Placing hold across tenants must return 404');

  // 8. INSTITUTION_B_RELEASES_A_HOLD -> 404
  console.log('[MULTI-TENANT 8] Institution B releases Tenant A hold');
  const releaseHoldBRes = await request(`/api/documents/${docAId}/holds/${holdAId}/release`, {
    method: 'POST',
    token: 'uid-admin-b',
    body: {
      versionId: versionAId,
      releaseReason: 'Unauthorized cross-tenant release',
    },
  });
  assert.equal(releaseHoldBRes.status, 404, 'Releasing cross-tenant hold must return 404');

  // 9. INSTITUTION_B_DELETES_A_DOCUMENT -> 404
  console.log('[MULTI-TENANT 9] Institution B authorizes deletion on Tenant A document');
  const authDelBRes = await request(`/api/documents/${docAId}/deletion/authorize`, {
    method: 'POST',
    token: 'uid-admin-b',
    body: { versionId: versionAId },
  });
  assert.equal(authDelBRes.status, 404, 'Authorizing deletion across tenants must return 404');

  console.log('[DOCUMENTS-API-MULTI-TENANT] All multi-tenant negative assertions PASSED.');
} finally {
  client.release();
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
  await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined);
  await pool.end();
}
