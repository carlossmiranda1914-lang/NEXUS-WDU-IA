/**
 * Integration Test Suite for Documents Metadata Authorization Enforcement
 * Checkpoint: H1-02A — Metadata Authorization Enforcement
 *
 * Verifies:
 * 1. Manager Access:
 *    - list_metadata => ALLOW (lists authorized documents with valid counts)
 *    - view_metadata => ALLOW (200 with document detail safe DTO)
 *    - view_versions => ALLOW (200 with versions history)
 *    - view_activity => ALLOW (200 with audit activities)
 * 2. Non-Management Roles without verified relationship (Student, Teacher, Parent/Guardian):
 *    - list_metadata => FILTERED / DENIED (total: 0, items: [], hasMore: false)
 *    - view_metadata => 404 (Anti-enumeration defense)
 *    - view_versions => 404 (Anti-enumeration defense)
 *    - view_activity => 404 (Anti-enumeration defense)
 * 3. Cross-Tenant Protection:
 *    - Tenant B accessing Tenant A document => 404, 0 data leakage
 * 4. Anti-Enumeration Invariant:
 *    - Existing unauthorized document vs non-existent document yield identical responses
 * 5. List Leak Invariant:
 *    - Unauthorized documents never leak in items, total, hasMore, or IDs
 */

import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { once } from 'node:events';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.test.local'), override: true });
process.env.TEST_DATABASE_LOCAL_AUTHORIZED = 'true';
process.env.TEST_DATABASE_CONFIRMATION = 'NEXUS_TEST_DATABASE';

import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { resolveInstitutionalContext } from '../src/auth/institutional-context.ts';
import { createRequireAuth } from '../src/middleware/auth.ts';
import { registerDocumentRoutes } from '../src/modules/documents/document.controller.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { ConfigurableDocumentAccessPolicyEngine } from '../src/modules/documents/document-access-policy.ts';
import { ConfigurableRetentionPolicyEngine } from '../src/modules/documents/document-retention-policy.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import { PostgresDocumentAuditRepository } from '../src/modules/documents/document-audit.ts';

await verifyApprovedTestConnection();

const schema = `doc_meta_auth_${randomUUID().replaceAll('-', '')}`;
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

  // Fixtures: Institutions A and B
  const instA = randomUUID();
  const instB = randomUUID();

  // Fixtures: People in Tenant A
  const managerA = randomUUID();
  const studentA = randomUUID();
  const teacherA = randomUUID();
  const parentA = randomUUID();

  // Fixtures: People in Tenant B
  const managerB = randomUUID();

  await client.query(
    `INSERT INTO institutions (id, name, slug, status)
     VALUES ($1, 'Institution A', 'inst-a', 'active'),
            ($2, 'Institution B', 'inst-b', 'active')`,
    [instA, instB],
  );

  await client.query(
    `INSERT INTO people (id, name)
     VALUES ($1, 'Manager A'),
            ($2, 'Student A'),
            ($3, 'Teacher A'),
            ($4, 'Parent A'),
            ($5, 'Manager B')`,
    [managerA, studentA, teacherA, parentA, managerB],
  );

  await client.query(
    `INSERT INTO identities (person_id, provider, provider_subject)
     VALUES ($1, 'firebase', 'uid-manager-a'),
            ($2, 'firebase', 'uid-student-a'),
            ($3, 'firebase', 'uid-teacher-a'),
            ($4, 'firebase', 'uid-parent-a'),
            ($5, 'firebase', 'uid-manager-b')`,
    [managerA, studentA, teacherA, parentA, managerB],
  );

  // Memberships
  await client.query(
    `INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at)
     VALUES ($1, $2, $3, 'institution_admin', 'active', now()),
            ($4, $5, $6, 'student', 'active', now()),
            ($7, $8, $9, 'teacher', 'active', now()),
            ($10, $11, $12, 'parent', 'active', now()),
            ($13, $14, $15, 'institution_admin', 'active', now())`,
    [
      randomUUID(), managerA, instA,
      randomUUID(), studentA, instA,
      randomUUID(), teacherA, instA,
      randomUUID(), parentA, instA,
      randomUUID(), managerB, instB,
    ],
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
    storageBucket: 'vault-a',
    uploadPolicyConfig: {
      globalMaxByteSize: 50 * 1024 * 1024,
      institutionMaxByteSize: 25 * 1024 * 1024,
    },
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
    } = {},
  ) => {
    const { method = 'GET', token = 'uid-manager-a', body } = options;
    const reqHeaders: Record<string, string> = {};
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

  // Seed sample documents in Institution A
  const docRepo = new PostgresDocumentRepository();
  const auditRepo = new PostgresDocumentAuditRepository();

  const doc1 = await docRepo.createDocument(client, {
    institutionId: instA,
    category: 'identification',
    classification: 'passport',
    createdByPersonId: managerA,
  });

  const fileBytes = Buffer.from('Sample Confidential Content for Document A');
  const fileHash = createHash('sha256').update(fileBytes).digest('hex');

  const { version: ver1 } = await docRepo.createNextVersion(client, {
    institutionId: instA,
    documentId: doc1.id,
    mimeType: 'application/pdf',
    byteSize: fileBytes.length,
    sha256Hash: fileHash,
    status: 'available',
    createdByPersonId: managerA,
    provenance: {
      originType: 'user_upload',
      actorPersonId: managerA,
      sourceDomain: 'portal.admin',
      method: 'direct_seed',
    },
    storageReference: {
      storageProvider: 'memory_test_provider',
      storageBucket: 'vault-a',
      storageKey: `tenants/${instA}/docs/${doc1.id}/v1.pdf`,
      contentAvailability: 'available',
    },
  });

  // Seed audit activity
  await auditRepo.recordAuditEvent(client, {
    institutionId: instA,
    documentId: doc1.id,
    versionId: ver1.id,
    actorPersonId: managerA,
    action: 'document.created',
    outcome: 'success',
    details: { note: 'Initial test document creation' },
  });

  console.log('[METADATA-AUTH] Running test suite...');

  // ───────────────────────────────────────────────────────────────────────────
  // 1. MANAGER METADATA ACCESS (ALLOW)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 1] Manager reads metadata, versions, and activity (ALLOW)');

  // 1A: List documents
  const mgrListRes = await request('/api/documents', { token: 'uid-manager-a' });
  assert.equal(mgrListRes.status, 200);
  const mgrListBody = (await mgrListRes.json()) as any;
  assert.equal(mgrListBody.total, 1, 'Manager must see the created document in total count');
  assert.equal(mgrListBody.items.length, 1);
  assert.equal(mgrListBody.items[0].id, doc1.id);
  assert.equal(mgrListBody.items[0].category, 'identification');

  // 1B: Document detail
  const mgrDetailRes = await request(`/api/documents/${doc1.id}`, { token: 'uid-manager-a' });
  assert.equal(mgrDetailRes.status, 200);
  const mgrDetailBody = (await mgrDetailRes.json()) as any;
  assert.equal(mgrDetailBody.id, doc1.id);
  assert.equal(mgrDetailBody.category, 'identification');

  // 1C: Versions
  const mgrVersionsRes = await request(`/api/documents/${doc1.id}/versions`, { token: 'uid-manager-a' });
  assert.equal(mgrVersionsRes.status, 200);
  const mgrVersionsBody = (await mgrVersionsRes.json()) as any;
  assert.equal(mgrVersionsBody.items.length, 1);
  assert.equal(mgrVersionsBody.items[0].id, ver1.id);

  // 1D: Activity
  const mgrActivityRes = await request(`/api/documents/${doc1.id}/activity`, { token: 'uid-manager-a' });
  assert.equal(mgrActivityRes.status, 200);
  const mgrActivityBody = (await mgrActivityRes.json()) as any;
  assert.ok(mgrActivityBody.items.length >= 1);
  assert.equal(mgrActivityBody.items[0].eventType, 'document.created');

  // ───────────────────────────────────────────────────────────────────────────
  // 2. STUDENT WITHOUT VERIFIED RELATIONSHIP (DENIED / FILTERED)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 2] Student without verified relationship (DENIED / FILTERED)');

  // 2A: List documents returns 0 items, 0 total, false hasMore
  const studentListRes = await request('/api/documents', { token: 'uid-student-a' });
  assert.equal(studentListRes.status, 200);
  const studentListBody = (await studentListRes.json()) as any;
  assert.equal(studentListBody.total, 0, 'Unauthorized student must see total === 0');
  assert.equal(studentListBody.items.length, 0, 'Unauthorized student must see 0 items');
  assert.equal(studentListBody.hasMore, false, 'hasMore must be false for unauthorized actor');

  // 2B: Detail access denied with anti-enumeration 404
  const studentDetailRes = await request(`/api/documents/${doc1.id}`, { token: 'uid-student-a' });
  assert.equal(studentDetailRes.status, 404, 'Detail must return 404 for unauthorized student');

  // 2C: Versions access denied with anti-enumeration 404
  const studentVersionsRes = await request(`/api/documents/${doc1.id}/versions`, { token: 'uid-student-a' });
  assert.equal(studentVersionsRes.status, 404, 'Versions must return 404 for unauthorized student');

  // 2D: Activity access denied with anti-enumeration 404
  const studentActivityRes = await request(`/api/documents/${doc1.id}/activity`, { token: 'uid-student-a' });
  assert.equal(studentActivityRes.status, 404, 'Activity must return 404 for unauthorized student');

  // ───────────────────────────────────────────────────────────────────────────
  // 3. TEACHER WITHOUT VERIFIED RELATIONSHIP (DENIED)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 3] Teacher without verified relationship (DENIED)');

  const teacherDetailRes = await request(`/api/documents/${doc1.id}`, { token: 'uid-teacher-a' });
  assert.equal(teacherDetailRes.status, 404, 'Detail must return 404 for unrelated teacher');

  const teacherListRes = await request('/api/documents', { token: 'uid-teacher-a' });
  const teacherListBody = (await teacherListRes.json()) as any;
  assert.equal(teacherListBody.total, 0);
  assert.equal(teacherListBody.items.length, 0);

  // ───────────────────────────────────────────────────────────────────────────
  // 4. GUARDIAN / PARENT WITHOUT VERIFIED RELATIONSHIP (DENIED)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 4] Parent/Guardian without verified relationship (DENIED)');

  const parentDetailRes = await request(`/api/documents/${doc1.id}`, { token: 'uid-parent-a' });
  assert.equal(parentDetailRes.status, 404, 'Detail must return 404 for unrelated guardian');

  const parentListRes = await request('/api/documents', { token: 'uid-parent-a' });
  const parentListBody = (await parentListRes.json()) as any;
  assert.equal(parentListBody.total, 0);
  assert.equal(parentListBody.items.length, 0);

  // ───────────────────────────────────────────────────────────────────────────
  // 5. CROSS-TENANT NEGATIVE ISOLATION (ZERO LEAKAGE)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 5] Cross-tenant isolation: Tenant B accessing Tenant A document');

  const crossDetailRes = await request(`/api/documents/${doc1.id}`, { token: 'uid-manager-b' });
  assert.equal(crossDetailRes.status, 404, 'Cross-tenant document fetch must return 404');

  const crossListRes = await request('/api/documents', { token: 'uid-manager-b' });
  const crossListBody = (await crossListRes.json()) as any;
  assert.equal(crossListBody.total, 0, 'Tenant B manager must see 0 documents from Tenant A');
  assert.equal(crossListBody.items.length, 0);

  // ───────────────────────────────────────────────────────────────────────────
  // 6. ANTI-ENUMERATION COMPARISON INVARIANT
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 6] Anti-enumeration invariant: existing unauthorized vs non-existent document');

  const nonExistentId = randomUUID();
  const studentUnauthorizedRes = await request(`/api/documents/${doc1.id}`, { token: 'uid-student-a' });
  const studentNonExistentRes = await request(`/api/documents/${nonExistentId}`, { token: 'uid-student-a' });

  assert.equal(studentUnauthorizedRes.status, 404);
  assert.equal(studentNonExistentRes.status, 404);

  const unauthorizedBody = await studentUnauthorizedRes.json();
  const nonExistentBody = await studentNonExistentRes.json();

  assert.deepEqual(
    unauthorizedBody,
    nonExistentBody,
    'Unauthorized existing document response must be strictly identical to non-existent document response',
  );

  // ───────────────────────────────────────────────────────────────────────────
  // 7. LIST LEAKAGE DEFENSE INVARIANT
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 7] List leakage defense: unauthorized actor payload inspection');

  const studentInspectRes = await request('/api/documents', { token: 'uid-student-a' });
  const studentInspectBody = (await studentInspectRes.json()) as any;

  assert.equal(studentInspectBody.total, 0);
  assert.equal(studentInspectBody.items.length, 0);
  assert.equal(studentInspectBody.hasMore, false);

  const rawJson = JSON.stringify(studentInspectBody);
  assert.ok(!rawJson.includes(doc1.id), 'Document ID must never appear in response for unauthorized actor');
  assert.ok(!rawJson.includes('passport'), 'Classification must not leak in unauthorized response');
  assert.ok(!rawJson.includes('identification'), 'Category must not leak in unauthorized response');

  console.log('[METADATA-AUTH] PASS: All metadata authorization checks verified successfully.');
} finally {
  if (server) {
    server.close();
  }
  try {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } finally {
    client.release();
    await pool.end();
  }
}
