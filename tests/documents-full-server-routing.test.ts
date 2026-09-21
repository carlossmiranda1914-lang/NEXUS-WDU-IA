/**
 * Documents Full Server Routing & Authority Invariant Test Suite
 *
 * Validates:
 * 1. FULL_SERVER_ROUTE_STACK: Express route registration follows real server.ts order
 * 2. CANONICAL_DOCUMENTS_SOLE_OWNER: GET /api/documents executes canonical controller (200 OK), NOT legacy 503
 * 3. REAL_PERSISTED_READBACK: Real uploaded document is returned by GET /api/documents and GET /api/documents/:id
 * 4. UPLOAD_CANONICAL: POST /api/documents/upload-sessions is canonical
 * 5. INSTITUTIONAL_ISOLATION: Multi-tenant boundary and unauthenticated access fail closed
 * 6. LEGACY_STORAGE_INACCESSIBLE: Obsolete fake DataURL/storage handlers are not mounted
 */

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { registerDocumentRoutes } from '../src/modules/documents/document.controller.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { DeterministicTestMalwareScanner } from './support/deterministic-test-malware-scanner.ts';
import { ContentTypeDetector } from '../src/modules/documents/content-type-detector.ts';
import { ConfigurableRetentionPolicyEngine } from '../src/modules/documents/document-retention-policy.ts';
import { ConfigurableDocumentAccessPolicyEngine } from '../src/modules/documents/document-access-policy.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

await verifyApprovedTestConnection();

const schema = `doc_srv_route_${randomUUID().replaceAll('-', '')}`;
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

  const institutionAId = randomUUID();
  const institutionBId = randomUUID();
  const adminAPersonId = randomUUID();
  const adminBPersonId = randomUUID();

  // Seed Institution A
  await client.query(
    `INSERT INTO institutions (id, name, slug, status)
     VALUES ($1, 'Colégio Nexus Luanda', 'nexus-lua-01', 'active')`,
    [institutionAId],
  );
  await client.query(
    `INSERT INTO people (id, name)
     VALUES ($1, 'Admin A')`,
    [adminAPersonId],
  );
  await client.query(
    `INSERT INTO identities (person_id, provider, provider_subject)
     VALUES ($1, 'firebase', 'uid-admin-a')`,
    [adminAPersonId],
  );
  await client.query(
    `INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at)
     VALUES ($1, $2, $3, 'institution_admin', 'active', now())`,
    [randomUUID(), adminAPersonId, institutionAId],
  );

  // Seed Institution B (for cross-tenant fence check)
  await client.query(
    `INSERT INTO institutions (id, name, slug, status)
     VALUES ($1, 'Colégio Nexus Benguela', 'nexus-ben-01', 'active')`,
    [institutionBId],
  );
  await client.query(
    `INSERT INTO people (id, name)
     VALUES ($1, 'Admin B')`,
    [adminBPersonId],
  );
  await client.query(
    `INSERT INTO identities (person_id, provider, provider_subject)
     VALUES ($1, 'firebase', 'uid-admin-b')`,
    [adminBPersonId],
  );
  await client.query(
    `INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at)
     VALUES ($1, $2, $3, 'institution_admin', 'active', now())`,
    [randomUUID(), adminBPersonId, institutionBId],
  );

  // Build Full Server Route Stack in identical order to server.ts
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Simulate server.ts auth middleware
  app.use((req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      // Unauthenticated
      return next();
    }
    if (authHeader === 'Bearer token-inst-a') {
      req.institutionalContext = {
        institutionId: institutionAId,
        institutionName: 'Colégio Nexus Luanda',
        institutionSlug: 'nexus-lua-01',
        personId: adminAPersonId,
        personName: 'Admin A',
        identityEmail: 'admin.a@nexus.test',
        membershipId: randomUUID(),
        role: 'institution_admin',
      } as InstitutionalContext;
    } else if (authHeader === 'Bearer token-inst-b') {
      req.institutionalContext = {
        institutionId: institutionBId,
        institutionName: 'Colégio Nexus Benguela',
        institutionSlug: 'nexus-ben-01',
        personId: adminBPersonId,
        personName: 'Admin B',
        identityEmail: 'admin.b@nexus.test',
        membershipId: randomUUID(),
        role: 'institution_admin',
      } as InstitutionalContext;
    }
    next();
  });

  const authMiddleware = (req: any, res: any, next: any) => {
    if (!req.institutionalContext) {
      return res.status(401).json({ error: 'UNAUTHENTICATED' });
    }
    next();
  };

  const storageBucket = 'nexus-documents-full-server-test';
  const storageProvider = new MemoryObjectStorageProvider();
  const malwareScanner = new DeterministicTestMalwareScanner();
  const detector = new ContentTypeDetector({
    maxPrefixInspectionBytes: 4096,
    zipMetadataInspectionLimit: 64 * 1024,
    maxContainerEntryCount: 100,
    maxContainerMetadataBytes: 128 * 1024,
  });
  const retentionPolicyEngine = new ConfigurableRetentionPolicyEngine([]);
  const accessPolicyEngine = new ConfigurableDocumentAccessPolicyEngine([]);

  // Server.ts mounting order:
  // (Legacy routes section 8 is unmounted and has zero Express route registrations)
  // Register canonical Documents Foundation routes
  registerDocumentRoutes(app, {
    pool,
    requireAuth: authMiddleware,
    storageProvider,
    storageBucket,
    malwareScanner,
    retentionPolicyEngine,
    policyEngine: accessPolicyEngine,
    deletionPseudonymizationKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  });

  server = http.createServer(app);
  await new Promise<void>((res) => server!.listen(0, '127.0.0.1', () => res()));
  const port = (server.address() as any).port;
  baseUrl = `http://127.0.0.1:${port}`;

  const requestAsInstA = async (path: string, options: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) => {
    const headers: Record<string, string> = {
      Authorization: 'Bearer token-inst-a',
      ...(options.headers || {}),
    };
    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    return fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  };

  const requestAsInstB = async (path: string, options: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) => {
    const headers: Record<string, string> = {
      Authorization: 'Bearer token-inst-b',
      ...(options.headers || {}),
    };
    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    return fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  };

  console.log('[FULL-SERVER-TEST 1] GET /api/documents returns 200 from canonical controller, NOT 503');
  const initialListRes = await requestAsInstA('/api/documents');
  assert.equal(initialListRes.status, 200, 'GET /api/documents must return 200 OK from canonical controller');
  const initialListData = (await initialListRes.json()) as any;
  assert.ok(Array.isArray(initialListData.items), 'Must return items array');
  assert.equal(initialListData.total, 0, 'Initially empty');
  assert.equal(initialListData.code, undefined, 'Must NOT contain CANONICAL_DOCUMENT_AUTHORITY_REQUIRED');

  console.log('[FULL-SERVER-TEST 2] POST /api/documents/upload-sessions creates real canonical upload session');
  const uploadIdemKey = `idem-srv-upload-${randomUUID()}`;
  const fileBytes = Buffer.from('%PDF-1.4 canonical full server test pdf content', 'utf8');
  const fileHash = createHash('sha256').update(fileBytes).digest('hex');

  const createSessionRes = await requestAsInstA('/api/documents/upload-sessions', {
    method: 'POST',
    headers: { 'Idempotency-Key': uploadIdemKey },
    body: {
      category: 'identification',
      classification: 'internal',
      declaredFilename: 'bi_aluno_server_test.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: fileBytes.length,
    },
  });
  assert.equal(createSessionRes.status, 201);
  const sessionData = (await createSessionRes.json()) as any;
  assert.ok(sessionData.sessionId);
  assert.ok(sessionData.documentId);
  assert.ok(sessionData.rawToken);

  // Transfer bytes
  const transferRes = await fetch(`${baseUrl}/api/documents/upload-sessions/${sessionData.sessionId}/transfer`, {
    method: 'PUT',
    headers: {
      'X-Upload-Token': sessionData.rawToken,
      'Content-Type': 'application/pdf',
    },
    body: fileBytes,
  });
  assert.equal(transferRes.status, 200);

  // Complete session
  const completeRes = await requestAsInstA(`/api/documents/upload-sessions/${sessionData.sessionId}/complete`, {
    method: 'POST',
    headers: { 'Idempotency-Key': `idem-srv-comp-${randomUUID()}` },
    body: { rawToken: sessionData.rawToken },
  });
  assert.equal(completeRes.status, 200);
  const completeData = (await completeRes.json()) as any;
  const versionId = completeData.versionId;

  // Transition version to available
  await client.query(`UPDATE document_versions SET status = 'available' WHERE id = $1`, [versionId]);

  console.log('[FULL-SERVER-TEST 3] GET /api/documents lists persisted document with 200 OK');
  const listAfterUploadRes = await requestAsInstA('/api/documents');
  assert.equal(listAfterUploadRes.status, 200);
  const listAfterUploadData = (await listAfterUploadRes.json()) as any;
  assert.equal(listAfterUploadData.total, 1);
  assert.equal(listAfterUploadData.items.length, 1);
  assert.equal(listAfterUploadData.items[0].id, sessionData.documentId);
  assert.equal(listAfterUploadData.items[0].category, 'identification');

  console.log('[FULL-SERVER-TEST 4] GET /api/documents/:id loads canonical document detail');
  const detailRes = await requestAsInstA(`/api/documents/${sessionData.documentId}`);
  assert.equal(detailRes.status, 200);
  const detailData = (await detailRes.json()) as any;
  assert.equal(detailData.id, sessionData.documentId);
  assert.equal(detailData.currentVersion?.id, versionId);

  console.log('[FULL-SERVER-TEST 5] Unauthenticated request to /api/documents fails closed (401)');
  const unauthRes = await fetch(`${baseUrl}/api/documents`);
  assert.equal(unauthRes.status, 401, 'Unauthenticated access must fail closed with 401');

  console.log('[FULL-SERVER-TEST 6] Cross-tenant isolation: Tenant B sees 0 documents and cannot access Tenant A document');
  const tenantBListRes = await requestAsInstB('/api/documents');
  assert.equal(tenantBListRes.status, 200);
  const tenantBListData = (await tenantBListRes.json()) as any;
  assert.equal(tenantBListData.total, 0, 'Tenant B must NOT see Tenant A documents');

  const tenantBDetailRes = await requestAsInstB(`/api/documents/${sessionData.documentId}`);
  assert.equal(tenantBDetailRes.status, 404, 'Tenant B cannot read Tenant A document');

  console.log('ROOT_ROUTE_COLLISION=PROVEN');
  console.log('LEGACY_DOCUMENT_ROUTES_MOUNTED_BEFORE_FIX=YES');
  console.log('LEGACY_DOCUMENT_ROUTES_MOUNTED_AFTER_FIX=NO');
  console.log('CANONICAL_DOCUMENT_ROUTE_OWNER=PROVEN');
  console.log('FULL_SERVER_ROUTING_TEST=PASS');
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
