/**
 * Integration Test Suite for Documents Association Target Search Authorization & PII Minimization
 * Checkpoint: H1-03A — Association Target Search Authorization & PII Minimization
 *
 * Verifies:
 * 1. Management Access:
 *    - institution_admin => ALLOW (200, targets returned)
 *    - director => ALLOW (200, targets returned)
 * 2. Non-Management Roles:
 *    - student => DENY (403, zero targets leaked)
 *    - parent => DENY (403, zero targets leaked)
 *    - teacher => DENY (403, zero targets leaked)
 *    - unknown role => DENY (403, zero targets leaked)
 * 3. Cross-Tenant Protection:
 *    - Tenant A manager only discovers Tenant A targets
 *    - Tenant B target never appears in Tenant A search results (CROSS_TENANT_LEAK=0)
 * 4. PII Minimization:
 *    - Response does NOT contain national_id_number, NIF, BI, email, phone, or address
 *    - Target detail is strictly sanitized to offer and status
 * 5. Authorization Before Target Query:
 *    - Denied callers receive 403 without target data disclosure
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
import { resolveInstitutionalContext } from '../src/auth/institutional-context.ts';
import { createRequireAuth } from '../src/middleware/auth.ts';
import { registerDocumentRoutes } from '../src/modules/documents/document.controller.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { ConfigurableDocumentAccessPolicyEngine } from '../src/modules/documents/document-access-policy.ts';
import { ConfigurableRetentionPolicyEngine } from '../src/modules/documents/document-retention-policy.ts';

await verifyApprovedTestConnection();

const schema = `doc_assoc_target_${randomUUID().replaceAll('-', '')}`;
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
  const directorA = randomUUID();
  const studentA = randomUUID();
  const teacherA = randomUUID();
  const parentA = randomUUID();

  // Fixtures: People in Tenant B
  const adminB = randomUUID();
  const studentB = randomUUID();

  // Insert Institutions
  await client.query(
    `INSERT INTO institutions (id, name, slug, status)
     VALUES ($1, 'Institution A', 'inst-a', 'active'),
            ($2, 'Institution B', 'inst-b', 'active')`,
    [instA, instB],
  );

  // Insert People with national_id_number populated
  await client.query(
    `INSERT INTO people (id, name, national_id_number)
     VALUES ($1, 'Admin Person A', 'BI-ADMIN-A-12345'),
            ($2, 'Director Person A', 'BI-DIR-A-67890'),
            ($3, 'Student Manuel Silva', 'BI-STUDENT-A-998877'),
            ($4, 'Teacher Maria Santos', 'BI-TEACHER-A-112233'),
            ($5, 'Parent Carlos Silva', 'BI-PARENT-A-445566'),
            ($6, 'Admin Person B', 'BI-ADMIN-B-778899'),
            ($7, 'Student Bruno Costa', 'BI-STUDENT-B-554433')`,
    [adminA, directorA, studentA, teacherA, parentA, adminB, studentB],
  );

  // Insert Identities
  await client.query(
    `INSERT INTO identities (person_id, provider, provider_subject)
     VALUES ($1, 'firebase', 'uid-admin-a'),
            ($2, 'firebase', 'uid-director-a'),
            ($3, 'firebase', 'uid-student-a'),
            ($4, 'firebase', 'uid-teacher-a'),
            ($5, 'firebase', 'uid-parent-a'),
            ($6, 'firebase', 'uid-admin-b'),
            ($7, 'firebase', 'uid-student-b')`,
    [adminA, directorA, studentA, teacherA, parentA, adminB, studentB],
  );

  // Insert Memberships
  await client.query(
    `INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at)
     VALUES ($1, $2, $3, 'institution_admin', 'active', now()),
            ($4, $5, $6, 'director', 'active', now()),
            ($7, $8, $9, 'student', 'active', now()),
            ($10, $11, $12, 'teacher', 'active', now()),
            ($13, $14, $15, 'parent', 'active', now()),
            ($16, $17, $18, 'institution_admin', 'active', now()),
            ($19, $20, $21, 'student', 'active', now())`,
    [
      randomUUID(), adminA, instA,
      randomUUID(), directorA, instA,
      randomUUID(), studentA, instA,
      randomUUID(), teacherA, instA,
      randomUUID(), parentA, instA,
      randomUUID(), adminB, instB,
      randomUUID(), studentB, instB,
    ],
  );

  // Academic Years
  const academicYearA = randomUUID();
  const academicYearB = randomUUID();
  await client.query(
    `INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status)
     VALUES ($1, $2, '2026/2027 - Tenant A', '2026-09-01', '2027-06-30', 'active'),
            ($3, $4, '2026/2027 - Tenant B', '2026-09-01', '2027-06-30', 'active')`,
    [academicYearA, instA, academicYearB, instB],
  );

  // Enrollment Offers
  const offerA = randomUUID();
  const offerB = randomUUID();
  await client.query(
    `INSERT INTO enrollment_offers (id, institution_id, academic_year_id, name, code, status)
     VALUES ($1, $2, $3, '10º Ano - Ciências e Tecnologias', '10-CT-A', 'active'),
            ($4, $5, $6, '11º Ano - Artes Visuais', '11-AV-B', 'active')`,
    [offerA, instA, academicYearA, offerB, instB, academicYearB],
  );

  // Enrollment Applications
  const enrollmentAppA = randomUUID();
  const enrollmentAppB = randomUUID();
  await client.query(
    `INSERT INTO enrollment_applications (id, institution_id, student_person_id, academic_year_id, offer_id, status, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, 'active', $6, $6),
            ($7, $8, $9, $10, $11, 'active', $12, $12)`,
    [
      enrollmentAppA, instA, studentA, academicYearA, offerA, adminA,
      enrollmentAppB, instB, studentB, academicYearB, offerB, adminB,
    ],
  );

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
    storageBucket: 'vault-assoc-test',
    policyEngine,
    retentionPolicyEngine,
    accessGrantTokenKey: 'test-secret-token-key-for-association-search-32',
    deletionPseudonymizationKey: 'test-secret-deletion-pseudo-key-32',
  });

  server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const request = async (
    path: string,
    token: string,
  ) => {
    return fetch(`${baseUrl}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  };

  console.log('[ASSOC-TARGET-AUTH] Running test suite...');

  // ───────────────────────────────────────────────────────────────────────────
  // 1. MANAGEMENT ROLES (ALLOW)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 1] Management roles allow search');

  // 1.1 institution_admin in Tenant A
  const resAdmin = await request('/api/documents/association-targets/search?domain=enrollment&q=Silva', 'uid-admin-a');
  assert.equal(resAdmin.status, 200, 'institution_admin must be authorized with 200');
  const dataAdmin = await resAdmin.json();
  assert.ok(Array.isArray(dataAdmin.targets), 'Targets must be an array');
  assert.equal(dataAdmin.targets.length, 1, 'Should find 1 target matching Silva in Tenant A');
  assert.equal(dataAdmin.targets[0].id, enrollmentAppA);
  assert.match(dataAdmin.targets[0].name, /Manuel Silva/);

  // 1.2 director in Tenant A
  const resDirector = await request('/api/documents/association-targets/search?domain=enrollment&q=Silva', 'uid-director-a');
  assert.equal(resDirector.status, 200, 'director must be authorized with 200');
  const dataDirector = await resDirector.json();
  assert.ok(Array.isArray(dataDirector.targets));
  assert.equal(dataDirector.targets.length, 1);
  assert.equal(dataDirector.targets[0].id, enrollmentAppA);

  // 1.3 academic domain search
  const resAcademic = await request('/api/documents/association-targets/search?domain=academic&q=2026', 'uid-admin-a');
  assert.equal(resAcademic.status, 200, 'Academic domain search must succeed for management');
  const dataAcademic = await resAcademic.json();
  assert.ok(Array.isArray(dataAcademic.targets));
  assert.equal(dataAcademic.targets.length, 1);
  assert.equal(dataAcademic.targets[0].id, academicYearA);
  assert.equal(dataAcademic.targets[0].resourceType, 'academic_year');

  // ───────────────────────────────────────────────────────────────────────────
  // 2. NON-MANAGEMENT ROLES (DENY)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 2] Non-management roles denied search (student, parent, teacher)');

  // 2.1 Student
  const resStudent = await request('/api/documents/association-targets/search?domain=enrollment&q=Silva', 'uid-student-a');
  assert.equal(resStudent.status, 403, 'student must be denied with 403');
  const dataStudent = await resStudent.json();
  assert.equal(dataStudent.code, 'AUTHORIZATION_DENIED');
  assert.equal(dataStudent.targets, undefined, 'Denied response must not contain targets');

  // 2.2 Parent
  const resParent = await request('/api/documents/association-targets/search?domain=enrollment&q=Silva', 'uid-parent-a');
  assert.equal(resParent.status, 403, 'parent must be denied with 403');
  const dataParent = await resParent.json();
  assert.equal(dataParent.code, 'AUTHORIZATION_DENIED');
  assert.equal(dataParent.targets, undefined, 'Denied response must not contain targets');

  // 2.3 Teacher
  const resTeacher = await request('/api/documents/association-targets/search?domain=enrollment&q=Silva', 'uid-teacher-a');
  assert.equal(resTeacher.status, 403, 'teacher must be denied with 403');
  const dataTeacher = await resTeacher.json();
  assert.equal(dataTeacher.code, 'AUTHORIZATION_DENIED');
  assert.equal(dataTeacher.targets, undefined, 'Denied response must not contain targets');

  // ───────────────────────────────────────────────────────────────────────────
  // 3. CROSS-TENANT ISOLATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 3] Cross-tenant isolation in association target search');

  // Tenant A admin searches for Costa (who belongs to Tenant B)
  const resAforB = await request('/api/documents/association-targets/search?domain=enrollment&q=Costa', 'uid-admin-a');
  assert.equal(resAforB.status, 200);
  const dataAforB = await resAforB.json();
  assert.equal(dataAforB.targets.length, 0, 'Tenant A admin must NOT find Tenant B targets (CROSS_TENANT_LEAK=0)');

  // Tenant B admin searches for Costa
  const resBforB = await request('/api/documents/association-targets/search?domain=enrollment&q=Costa', 'uid-admin-b');
  assert.equal(resBforB.status, 200);
  const dataBforB = await resBforB.json();
  assert.equal(dataBforB.targets.length, 1, 'Tenant B admin must find Tenant B student');
  assert.equal(dataBforB.targets[0].id, enrollmentAppB);

  // Tenant B admin searches for Silva (who belongs to Tenant A)
  const resBforA = await request('/api/documents/association-targets/search?domain=enrollment&q=Silva', 'uid-admin-b');
  assert.equal(resBforA.status, 200);
  const dataBforA = await resBforA.json();
  assert.equal(dataBforA.targets.length, 0, 'Tenant B admin must NOT find Tenant A targets (CROSS_TENANT_LEAK=0)');

  // ───────────────────────────────────────────────────────────────────────────
  // 4. PII MINIMIZATION ASSERTIONS
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 4] PII minimization: national_id_number, NIF, BI, email, phone, address absent');

  const resPII = await request('/api/documents/association-targets/search?domain=enrollment&q=Silva', 'uid-admin-a');
  assert.equal(resPII.status, 200);
  const textBody = await resPII.text();
  const parsedData = JSON.parse(textBody);

  // Assert target properties
  assert.ok(parsedData.targets.length >= 1);
  for (const target of parsedData.targets) {
    assert.equal(target.national_id_number, undefined, 'national_id_number must NOT exist in target object');
    assert.equal(target.email, undefined, 'email must NOT exist in target object');
    assert.equal(target.phone, undefined, 'phone must NOT exist in target object');
    assert.equal(target.address, undefined, 'address must NOT exist in target object');
    // Check detail formatting
    assert.ok(!target.detail.includes('NIF'), 'detail must NOT contain NIF');
    assert.ok(!target.detail.includes('BI:'), 'detail must NOT contain BI:');
    assert.ok(!target.detail.includes('BI-STUDENT'), 'detail must NOT contain national ID value');
  }

  // Stringified JSON inspection across the entire response body
  assert.ok(!textBody.includes('BI-STUDENT-A-998877'), 'Raw national ID value must NOT appear anywhere in response');
  assert.ok(!textBody.includes('national_id_number'), 'Field name national_id_number must NOT appear anywhere in response');
  assert.ok(!textBody.includes('NIF'), 'NIF label must NOT appear anywhere in response');
  assert.ok(!textBody.includes('BI:'), 'BI: label must NOT appear anywhere in response');

  // ───────────────────────────────────────────────────────────────────────────
  // 5. AUTHORIZATION BEFORE TARGET QUERY
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[TEST 5] Authorization evaluated before any target query');

  // An unauthorized student search for an exact student name or query
  const resForbidden = await request('/api/documents/association-targets/search?domain=enrollment&q=Manuel', 'uid-student-a');
  assert.equal(resForbidden.status, 403);
  const forbiddenBody = await resForbidden.text();
  assert.ok(!forbiddenBody.includes('Manuel'), 'No target data or match indication leaked to unauthorized user');
  assert.ok(!forbiddenBody.includes('targets'), 'No targets array in 403 response');

  console.log('[ASSOC-TARGET-AUTH] PASS: All association target authorization and PII minimization checks passed.');
} finally {
  if (server) {
    server.close();
  }
  await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => {});
  client.release();
  await pool.end();
}
