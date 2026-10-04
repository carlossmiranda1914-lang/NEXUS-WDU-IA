/**
 * Integration Test Suite for Documents Association Mutation Authorization & Consistency
 * Checkpoint: H1-03B — Association Mutation Authorization
 *
 * Verifies:
 * 1. Controller Authorization:
 *    - manager create association => ALLOW (201)
 *    - manager remove association => ALLOW (200)
 *    - student create => DENY (403)
 *    - student remove => DENY (403)
 *    - parent create => DENY (403)
 *    - parent remove => DENY (403)
 *    - teacher create => DENY (403)
 *    - teacher remove => DENY (403)
 * 2. Direct Command Boundary Defense:
 *    - student direct create command => DENY (ACTION_NOT_PERMITTED)
 *    - parent direct create command => DENY (ACTION_NOT_PERMITTED)
 *    - teacher direct create command => DENY (ACTION_NOT_PERMITTED)
 *    - student direct remove command => DENY (ACTION_NOT_PERMITTED)
 *    - parent direct remove command => DENY (ACTION_NOT_PERMITTED)
 *    - teacher direct remove command => DENY (ACTION_NOT_PERMITTED)
 * 3. Cross-Tenant Protection:
 *    - Tenant A manager + Tenant B document => 404 Not Found
 *    - Tenant A manager + Tenant B association => 404 Not Found
 * 4. Document / Association Mismatch:
 *    - DELETE /documents/:docA/associations/:assocB (where assocB belongs to docB) => 404 Not Found
 * 5. Idempotency & Audit:
 *    - Replay returns exact same association
 *    - Audit logs recorded for created and withdrawn
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
import { resolveInstitutionalContext, type InstitutionalContext } from '../src/auth/institutional-context.ts';
import { createRequireAuth } from '../src/middleware/auth.ts';
import { registerDocumentRoutes } from '../src/modules/documents/document.controller.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { ConfigurableDocumentAccessPolicyEngine } from '../src/modules/documents/document-access-policy.ts';
import { ConfigurableRetentionPolicyEngine } from '../src/modules/documents/document-retention-policy.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import {
  createDocumentAssociationCommand,
  transitionAssociationStatusCommand,
} from '../src/modules/documents/document-association-command.ts';

await verifyApprovedTestConnection();

const schema = `doc_assoc_mut_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/db/migrations',
);

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
  const adminA = randomUUID();
  const studentA = randomUUID();
  const teacherA = randomUUID();
  const parentA = randomUUID();

  // Fixtures: People in Tenant B
  const adminB = randomUUID();

  await client.query(
    `INSERT INTO institutions (id, name, slug, status)
     VALUES ($1, 'Institution A', 'inst-a', 'active'),
            ($2, 'Institution B', 'inst-b', 'active')`,
    [instA, instB],
  );

  await client.query(
    `INSERT INTO people (id, name)
     VALUES ($1, 'Admin Person A'),
            ($2, 'Student Manuel Silva'),
            ($3, 'Teacher Maria Santos'),
            ($4, 'Parent Carlos Silva'),
            ($5, 'Admin Person B')`,
    [adminA, studentA, teacherA, parentA, adminB],
  );

  await client.query(
    `INSERT INTO identities (person_id, provider, provider_subject)
     VALUES ($1, 'firebase', 'uid-admin-a'),
            ($2, 'firebase', 'uid-student-a'),
            ($3, 'firebase', 'uid-teacher-a'),
            ($4, 'firebase', 'uid-parent-a'),
            ($5, 'firebase', 'uid-admin-b')`,
    [adminA, studentA, teacherA, parentA, adminB],
  );

  await client.query(
    `INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at)
     VALUES ($1, $2, $3, 'institution_admin', 'active', now()),
            ($4, $5, $6, 'student', 'active', now()),
            ($7, $8, $9, 'teacher', 'active', now()),
            ($10, $11, $12, 'parent', 'active', now()),
            ($13, $14, $15, 'institution_admin', 'active', now())`,
    [
      randomUUID(), adminA, instA,
      randomUUID(), studentA, instA,
      randomUUID(), teacherA, instA,
      randomUUID(), parentA, instA,
      randomUUID(), adminB, instB,
    ],
  );

  // Seed academic years, offers, and enrollment applications for targets
  const academicYearA = randomUUID();
  const offerA = randomUUID();
  const appA = randomUUID();

  await client.query(
    `INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status)
     VALUES ($1, $2, '2026/2027 - Tenant A', '2026-09-01', '2027-06-30', 'active')`,
    [academicYearA, instA],
  );
  await client.query(
    `INSERT INTO enrollment_offers (id, institution_id, academic_year_id, name, code, status)
     VALUES ($1, $2, $3, '10-CT-A', '10-CT-A', 'active')`,
    [offerA, instA, academicYearA],
  );
  await client.query(
    `INSERT INTO enrollment_applications (id, institution_id, student_person_id, academic_year_id, offer_id, status, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, 'active', $6, $6)`,
    [appA, instA, studentA, academicYearA, offerA, adminA],
  );

  // Seed Documents in Tenant A and Tenant B
  const docRepo = new PostgresDocumentRepository();
  const docA1 = await docRepo.createDocument(client, {
    institutionId: instA,
    category: 'identification',
    classification: 'id_card',
    createdByPersonId: adminA,
  });
  const docA2 = await docRepo.createDocument(client, {
    institutionId: instA,
    category: 'academic_transcript',
    classification: 'diploma',
    createdByPersonId: adminA,
  });
  const docB1 = await docRepo.createDocument(client, {
    institutionId: instB,
    category: 'identification',
    classification: 'passport',
    createdByPersonId: adminB,
  });

  // App & Controller Setup
  const app = express();
  app.use(express.json());
  const auth = createRequireAuth({
    verifyIdToken: async (token) => ({ uid: token }),
    pool: pool as any,
    resolveInstitutionalContext,
  });

  const storageProvider = new MemoryObjectStorageProvider();
  const policyEngine = new ConfigurableDocumentAccessPolicyEngine([]);
  const retentionPolicyEngine = new ConfigurableRetentionPolicyEngine([]);

  registerDocumentRoutes(app, {
    pool: pool as any,
    requireAuth: auth,
    storageProvider,
    storageBucket: 'vault-assoc-mut-test',
    policyEngine,
    retentionPolicyEngine,
    accessGrantTokenKey: 'test-secret-token-key-for-mutation-test-32',
    deletionPseudonymizationKey: 'test-secret-deletion-pseudo-key-32',
  });

  server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const request = async (
    urlPath: string,
    options: { method: string; token: string; body?: unknown; headers?: Record<string, string> },
  ) => {
    return fetch(`${baseUrl}${urlPath}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  };

  console.log('[ASSOC-MUT-AUTH] Running test suite...');

  // ───────────────────────────────────────────────────────────────────────────
  // 1. CONTROLLER AUTHORIZATION: CREATE & REMOVE
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 1] Controller: Manager create/remove allowed; Non-manager denied');

  // 1.1 Manager A creates association on docA1
  const createRes1 = await request(`/api/documents/${docA1.id}/associations`, {
    method: 'POST',
    token: 'uid-admin-a',
    headers: { 'Idempotency-Key': 'idemp-mgr-create-001' },
    body: {
      targetDomain: 'enrollment',
      targetResourceType: 'enrollment_application',
      targetResourceId: appA,
      purpose: 'Enrollment verification',
    },
  });
  assert.equal(createRes1.status, 201, 'Manager create association must return 201');
  const createData1 = await createRes1.json();
  assert.equal(createData1.success, true);
  const assocId1 = createData1.association.id;
  assert.ok(assocId1, 'Association ID must be returned');

  // 1.2 Student A attempts to create association on docA1 => DENY (403)
  const studentCreateRes = await request(`/api/documents/${docA1.id}/associations`, {
    method: 'POST',
    token: 'uid-student-a',
    headers: { 'Idempotency-Key': 'idemp-stu-create-001' },
    body: {
      targetDomain: 'enrollment',
      targetResourceType: 'enrollment_application',
      targetResourceId: appA,
      purpose: 'Student forged association',
    },
  });
  assert.equal(studentCreateRes.status, 403, 'Student create association must return 403');
  const studentCreateData = await studentCreateRes.json();
  assert.equal(studentCreateData.code, 'AUTHORIZATION_DENIED');

  // 1.3 Parent A attempts to create association on docA1 => DENY (403)
  const parentCreateRes = await request(`/api/documents/${docA1.id}/associations`, {
    method: 'POST',
    token: 'uid-parent-a',
    headers: { 'Idempotency-Key': 'idemp-par-create-001' },
    body: {
      targetDomain: 'enrollment',
      targetResourceType: 'enrollment_application',
      targetResourceId: appA,
      purpose: 'Parent forged association',
    },
  });
  assert.equal(parentCreateRes.status, 403, 'Parent create association must return 403');

  // 1.4 Teacher A attempts to create association on docA1 => DENY (403)
  const teacherCreateRes = await request(`/api/documents/${docA1.id}/associations`, {
    method: 'POST',
    token: 'uid-teacher-a',
    headers: { 'Idempotency-Key': 'idemp-tch-create-001' },
    body: {
      targetDomain: 'enrollment',
      targetResourceType: 'enrollment_application',
      targetResourceId: appA,
      purpose: 'Teacher forged association',
    },
  });
  assert.equal(teacherCreateRes.status, 403, 'Teacher create association must return 403');

  // 1.5 Student A attempts to remove association => DENY (403)
  const studentRemoveRes = await request(`/api/documents/${docA1.id}/associations/${assocId1}`, {
    method: 'DELETE',
    token: 'uid-student-a',
    headers: { 'Idempotency-Key': 'idemp-stu-delete-001' },
  });
  assert.equal(studentRemoveRes.status, 403, 'Student delete association must return 403');

  // 1.6 Parent A attempts to remove association => DENY (403)
  const parentRemoveRes = await request(`/api/documents/${docA1.id}/associations/${assocId1}`, {
    method: 'DELETE',
    token: 'uid-parent-a',
    headers: { 'Idempotency-Key': 'idemp-par-delete-001' },
  });
  assert.equal(parentRemoveRes.status, 403, 'Parent delete association must return 403');

  // 1.7 Teacher A attempts to remove association => DENY (403)
  const teacherRemoveRes = await request(`/api/documents/${docA1.id}/associations/${assocId1}`, {
    method: 'DELETE',
    token: 'uid-teacher-a',
    headers: { 'Idempotency-Key': 'idemp-tch-delete-001' },
  });
  assert.equal(teacherRemoveRes.status, 403, 'Teacher delete association must return 403');

  // 1.8 Manager A removes association on docA1 => ALLOW (200)
  const removeRes1 = await request(`/api/documents/${docA1.id}/associations/${assocId1}`, {
    method: 'DELETE',
    token: 'uid-admin-a',
    headers: { 'Idempotency-Key': 'idemp-mgr-delete-001' },
    body: { reason: 'Enrollment process completed' },
  });
  assert.equal(removeRes1.status, 200, 'Manager delete association must return 200');
  const removeData1 = await removeRes1.json();
  assert.equal(removeData1.success, true);
  assert.equal(removeData1.association.status, 'withdrawn');

  // ───────────────────────────────────────────────────────────────────────────
  // 2. DIRECT COMMAND BOUNDARY DEFENSE (NO HTTP)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 2] Direct command boundary bypass defense');

  const makeCtx = (role: 'student' | 'parent' | 'teacher' | 'institution_admin', personId: string): InstitutionalContext => ({
    institutionId: instA,
    institutionName: 'Institution A',
    institutionSlug: 'inst-a',
    personId,
    personName: 'Person',
    identityEmail: null,
    membershipId: randomUUID(),
    role,
  });

  const studentCtx = makeCtx('student', studentA);
  const parentCtx = makeCtx('parent', parentA);
  const teacherCtx = makeCtx('teacher', teacherA);

  // Direct create command by student => REJECT
  await assert.rejects(
    async () => {
      await createDocumentAssociationCommand({
        pool: pool as any,
        context: studentCtx,
        idempotencyKey: 'idemp-direct-stu-create',
        input: {
          documentId: docA1.id,
          targetDomain: 'enrollment',
          targetResourceType: 'enrollment_application',
          targetResourceId: appA,
          purpose: 'direct bypass attempt',
        },
      });
    },
    /ACTION_NOT_PERMITTED/,
    'Direct command create by student must throw ACTION_NOT_PERMITTED',
  );

  // Direct create command by parent => REJECT
  await assert.rejects(
    async () => {
      await createDocumentAssociationCommand({
        pool: pool as any,
        context: parentCtx,
        idempotencyKey: 'idemp-direct-par-create',
        input: {
          documentId: docA1.id,
          targetDomain: 'enrollment',
          targetResourceType: 'enrollment_application',
          targetResourceId: appA,
          purpose: 'direct bypass attempt',
        },
      });
    },
    /ACTION_NOT_PERMITTED/,
    'Direct command create by parent must throw ACTION_NOT_PERMITTED',
  );

  // Direct create command by teacher => REJECT
  await assert.rejects(
    async () => {
      await createDocumentAssociationCommand({
        pool: pool as any,
        context: teacherCtx,
        idempotencyKey: 'idemp-direct-tch-create',
        input: {
          documentId: docA1.id,
          targetDomain: 'enrollment',
          targetResourceType: 'enrollment_application',
          targetResourceId: appA,
          purpose: 'direct bypass attempt',
        },
      });
    },
    /ACTION_NOT_PERMITTED/,
    'Direct command create by teacher must throw ACTION_NOT_PERMITTED',
  );

  // Direct remove command by student => REJECT
  await assert.rejects(
    async () => {
      await transitionAssociationStatusCommand({
        pool: pool as any,
        context: studentCtx,
        idempotencyKey: 'idemp-direct-stu-del',
        expectedDocumentId: docA1.id,
        input: {
          associationId: assocId1,
          targetStatus: 'withdrawn',
        },
      });
    },
    /ACTION_NOT_PERMITTED/,
    'Direct command remove by student must throw ACTION_NOT_PERMITTED',
  );

  // Direct remove command by parent => REJECT
  await assert.rejects(
    async () => {
      await transitionAssociationStatusCommand({
        pool: pool as any,
        context: parentCtx,
        idempotencyKey: 'idemp-direct-par-del',
        expectedDocumentId: docA1.id,
        input: {
          associationId: assocId1,
          targetStatus: 'withdrawn',
        },
      });
    },
    /ACTION_NOT_PERMITTED/,
    'Direct command remove by parent must throw ACTION_NOT_PERMITTED',
  );

  // Direct remove command by teacher => REJECT
  await assert.rejects(
    async () => {
      await transitionAssociationStatusCommand({
        pool: pool as any,
        context: teacherCtx,
        idempotencyKey: 'idemp-direct-tch-del',
        expectedDocumentId: docA1.id,
        input: {
          associationId: assocId1,
          targetStatus: 'withdrawn',
        },
      });
    },
    /ACTION_NOT_PERMITTED/,
    'Direct command remove by teacher must throw ACTION_NOT_PERMITTED',
  );

  // ───────────────────────────────────────────────────────────────────────────
  // 3. CROSS-TENANT SAFETY
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 3] Cross-tenant safety in association mutation');

  // Tenant A manager attempts to create association on Tenant B document docB1 => 404
  const crossDocRes = await request(`/api/documents/${docB1.id}/associations`, {
    method: 'POST',
    token: 'uid-admin-a',
    headers: { 'Idempotency-Key': 'idemp-cross-doc-001' },
    body: {
      targetDomain: 'enrollment',
      targetResourceType: 'enrollment_application',
      targetResourceId: appA,
      purpose: 'Cross-tenant attack',
    },
  });
  assert.equal(crossDocRes.status, 404, 'Cross-tenant document must return 404');

  // Tenant B manager attempts to delete Tenant A association assocId1 => 404
  const crossAssocRes = await request(`/api/documents/${docB1.id}/associations/${assocId1}`, {
    method: 'DELETE',
    token: 'uid-admin-b',
    headers: { 'Idempotency-Key': 'idemp-cross-assoc-001' },
  });
  assert.equal(crossAssocRes.status, 404, 'Cross-tenant association must return 404');

  // ───────────────────────────────────────────────────────────────────────────
  // 4. DOCUMENT / ASSOCIATION MISMATCH
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 4] Association ownership and document consistency');

  // Create an association on docA2
  const createResA2 = await request(`/api/documents/${docA2.id}/associations`, {
    method: 'POST',
    token: 'uid-admin-a',
    headers: { 'Idempotency-Key': 'idemp-doca2-assoc-001' },
    body: {
      targetDomain: 'enrollment',
      targetResourceType: 'enrollment_application',
      targetResourceId: appA,
      purpose: 'Transcript association',
    },
  });
  assert.equal(createResA2.status, 201);
  const assocIdA2 = (await createResA2.json()).association.id;

  // Attempt to delete assocIdA2 under docA1 route: DELETE /documents/docA1/associations/assocIdA2 => 404
  const mismatchRes = await request(`/api/documents/${docA1.id}/associations/${assocIdA2}`, {
    method: 'DELETE',
    token: 'uid-admin-a',
    headers: { 'Idempotency-Key': 'idemp-mismatch-delete-001' },
  });
  assert.equal(mismatchRes.status, 404, 'Document/association mismatch must return 404');

  // Verify status of assocIdA2 was NOT changed
  const checkStatusRes = await client.query(
    `SELECT status FROM document_associations WHERE id = $1`,
    [assocIdA2],
  );
  assert.equal(checkStatusRes.rows[0].status, 'active', 'Association must remain active after mismatch rejection');

  // ───────────────────────────────────────────────────────────────────────────
  // 5. IDEMPOTENCY & AUDIT
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 5] Idempotency replay and audit trail');

  // Replay create association with same key
  const replayCreateRes = await request(`/api/documents/${docA2.id}/associations`, {
    method: 'POST',
    token: 'uid-admin-a',
    headers: { 'Idempotency-Key': 'idemp-doca2-assoc-001' },
    body: {
      targetDomain: 'enrollment',
      targetResourceType: 'enrollment_application',
      targetResourceId: appA,
      purpose: 'Transcript association',
    },
  });
  assert.equal(replayCreateRes.status, 201);
  const replayCreateData = await replayCreateRes.json();
  assert.equal(replayCreateData.replayed, true, 'Replayed call must have replayed: true');
  assert.equal(replayCreateData.association.id, assocIdA2);

  // Audit event checks
  const auditEvents = await client.query(
    `SELECT action, outcome FROM document_audit_events WHERE document_id = $1 ORDER BY occurred_at ASC`,
    [docA1.id],
  );
  const actions = auditEvents.rows.map((r: any) => r.action);
  assert.ok(actions.includes('association.created'), 'Audit must contain association.created');
  assert.ok(actions.includes('association.withdrawn'), 'Audit must contain association.withdrawn');

  console.log('[ASSOC-MUT-AUTH] PASS: All association mutation authorization and consistency checks passed.');
} finally {
  if (server) {
    server.close();
  }
  await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => {});
  client.release();
  await pool.end();
}
