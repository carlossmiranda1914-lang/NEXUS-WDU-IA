import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readdir, readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pg from 'pg';
import { readApprovedTestTarget } from '../scripts/nexus-test-db-safety.mjs';
import { resolveInstitutionalContext } from '../src/auth/institutional-context.ts';
import { createRequireAuth } from '../src/middleware/auth.ts';
import { loadStudentContext, StudentContextError } from '../src/modules/student-context/student-context-api.ts';
import { registerStudentContextRoutes } from '../src/modules/student-context/student-context.controller.ts';

const { connectionString } = readApprovedTestTarget();
const schema = `student_public_ref_${Date.now()}`;
const setup = new pg.Pool({ connectionString });
let service: pg.Pool | undefined;
let server: http.Server | undefined;

async function applyMigrations(client: pg.PoolClient, through = '9999', after = '0000') {
  const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
  for (const filename of (await readdir(directory)).filter((name) => /^\d{4}_.+\.sql$/.test(name) && name.slice(0, 4) <= through && name.slice(0, 4) > after).sort()) {
    await client.query(`SET search_path TO "${schema}"; ${await readFile(path.join(directory, filename), 'utf8')}`);
  }
}

try {
  await setup.query(`CREATE SCHEMA "${schema}"`);
  const client = await setup.connect();
  try { await applyMigrations(client, '0023'); } finally { client.release(); }
  service = new pg.Pool({ connectionString, options: `-c search_path=${schema}` });

  const [institutionA, institutionB, adminA, adminB, studentA, studentB, futureStudent, membershipA, membershipB] = Array.from({ length: 9 }, randomUUID);
  await service.query(
    "INSERT INTO institutions(id,name,slug,status) VALUES($1,'A','student-ref-a','active'),($2,'B','student-ref-b','active')",
    [institutionA, institutionB],
  );
  await service.query(
    "INSERT INTO people(id,name,email) VALUES($1,'Admin A','admin-a@example.test'),($2,'Admin B','admin-b@example.test'),($3,'Student A','student-a@example.test'),($4,'Student B','student-b@example.test'),($5,'Future Student','future@example.test')",
    [adminA, adminB, studentA, studentB, futureStudent],
  );
  await service.query(
    "INSERT INTO identities(person_id,provider,provider_subject) VALUES($1,'firebase','student-ref-admin-a'),($2,'firebase','student-ref-admin-b')",
    [adminA, adminB],
  );
  await service.query(
    "INSERT INTO memberships(id,person_id,institution_id,role,status,approved_at) VALUES($1,$2,$3,'institution_admin','active',now()),($4,$5,$6,'institution_admin','active',now())",
    [membershipA, adminA, institutionA, membershipB, adminB, institutionB],
  );
  await service.query(
    "INSERT INTO student_profiles(institution_id,person_id,student_number,status) VALUES($1,$2,'NUM-A-001','active'),($3,$4,'NUM-B-002','active')",
    [institutionA, studentA, institutionB, studentB],
  );

  const migrationClient = await setup.connect();
  try { await applyMigrations(migrationClient, '0024', '0023'); } finally { migrationClient.release(); }

  const publicRefColumn = await service.query<{ is_nullable: string; column_default: string | null }>(
    "SELECT is_nullable,column_default FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='student_profiles' AND column_name='public_ref'",
  );
  assert.equal(publicRefColumn.rowCount, 1, 'student_profiles.public_ref must be migration-owned');
  assert.equal(publicRefColumn.rows[0].is_nullable, 'NO', 'public_ref must be mandatory');
  assert.match(publicRefColumn.rows[0].column_default ?? '', /stu_/, 'new profiles must receive a server-side public reference');
  await service.query("INSERT INTO student_profiles(institution_id,person_id,student_number,status) VALUES($1,$2,'NUM-F-003','active')", [institutionA, futureStudent]);

  const profiles = await service.query<{ institution_id: string; person_id: string; public_ref: string }>(
    'SELECT institution_id,person_id,public_ref FROM student_profiles ORDER BY institution_id',
  );
  assert.equal(profiles.rowCount, 3);
  const profileA = profiles.rows.find((profile) => profile.institution_id === institutionA)!;
  const profileB = profiles.rows.find((profile) => profile.institution_id === institutionB)!;
  assert.match(profileA.public_ref, /^stu_[A-Za-z0-9_-]{22}$/);
  assert.match(profileB.public_ref, /^stu_[A-Za-z0-9_-]{22}$/);
  assert.notEqual(profileA.public_ref, profileB.public_ref, 'different students require distinct public references');
  assert.equal(profileA.public_ref.includes(studentA), false, 'public_ref must not encode person_id');
  assert.equal(profileA.public_ref.includes('Student A'), false, 'public_ref must not contain PII');
  assert.equal(profileA.public_ref.includes('NUM-A-001'), false, 'public_ref must not contain student_number');
  assert.equal(profileA.public_ref.includes('student-a@example.test'), false, 'public_ref must not contain email');

  const uniqueConstraint = await service.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND tablename='student_profiles' AND indexname='student_profiles_institution_public_ref_unique'",
  );
  assert.equal(uniqueConstraint.rowCount, 1, 'institution/public_ref uniqueness must be migration-owned');

  const contextA = { institutionId: institutionA, personId: adminA, membershipId: membershipA, role: 'institution_admin' as const, personName: 'Admin A', identityEmail: null, institutionName: 'A', institutionSlug: 'student-ref-a' };
  const direct = await loadStudentContext(service as any, contextA, profileA.public_ref);
  assert.equal(direct.student.displayName, 'Student A');
  await assert.rejects(() => loadStudentContext(service as any, contextA, studentA), (error: unknown) => error instanceof StudentContextError && error.code === 'NOT_FOUND');
  await assert.rejects(() => loadStudentContext(service as any, { ...contextA, institutionId: institutionB, personId: adminB, membershipId: membershipB }, profileA.public_ref), (error: unknown) => error instanceof StudentContextError && error.code === 'NOT_FOUND');
  await assert.rejects(() => loadStudentContext(service as any, contextA, `stu_${'A'.repeat(22)}`), (error: unknown) => error instanceof StudentContextError && error.code === 'NOT_FOUND');

  const app = express();
  registerStudentContextRoutes(app, { pool: service as any, requireAuth: createRequireAuth({ verifyIdToken: async (token) => ({ uid: token }), pool: service as any, resolveInstitutionalContext }) });
  server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/student-context`;
  const request = (ref: string, token?: string) => fetch(`${base}/${ref}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  const success = await request(profileA.public_ref, 'student-ref-admin-a');
  assert.equal(success.status, 200);
  const body = await success.text();
  assert.equal(body.includes(studentA), false, 'HTTP response must not expose person_id');
  assert.equal(body.includes(profileA.person_id), false, 'HTTP response must not expose student_profile.person_id');
  assert.equal((await request(studentA, 'student-ref-admin-a')).status, 404, 'the legacy raw person_id contract must not remain as a fallback');
  assert.equal((await request(profileA.public_ref, 'student-ref-admin-b')).status, 404, 'cross-tenant refs must be non-disclosing');
  assert.equal((await request(`stu_${'B'.repeat(22)}`, 'student-ref-admin-a')).status, 404);
  assert.equal((await request(profileA.public_ref)).status, 401);
  console.log('[STUDENT-EXPERIENCE-01-P0] public student references: migration, CSPRNG shape, tenant resolution and HTTP privacy: PASS.');
} finally {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  if (service) await service.end();
  await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
  await setup.end();
}
