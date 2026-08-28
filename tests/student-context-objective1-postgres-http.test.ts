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
import { placeStudent } from '../src/modules/academic/academic-structure-api.ts';
import { loadStudentContext, StudentContextError } from '../src/modules/student-context/student-context-api.ts';
import { registerStudentContextRoutes } from '../src/modules/student-context/student-context.controller.ts';

const { connectionString } = readApprovedTestTarget();
const schema = `student_context_o1_${Date.now()}`;
const setup = new pg.Pool({ connectionString });
let service: pg.Pool | undefined;
let server: http.Server | undefined;

async function applyMigrations(client: pg.PoolClient) {
  const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
  for (const file of (await readdir(migrations)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort()) {
    await client.query(`SET search_path TO "${schema}"; ${await readFile(path.join(migrations, file), 'utf8')}`);
  }
}

try {
  await setup.query(`CREATE SCHEMA "${schema}"`);
  const client = await setup.connect();
  try { await applyMigrations(client); } finally { client.release(); }
  service = new pg.Pool({ connectionString, options: `-c search_path=${schema}` });

  const [institutionA, institutionB, adminA, teacherA, adminB, student, year, program, level, klass, offer, enrollment, membershipA, membershipTeacher, membershipB] = Array.from({ length: 15 }, randomUUID);
  const suffix = randomUUID().slice(0, 8);
  await service.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'A',$2,'active'),($3,'B',$4,'active')", [institutionA, `student-context-a-${suffix}`, institutionB, `student-context-b-${suffix}`]);
  await service.query("INSERT INTO people(id,name,birth_date,phone,gender,nationality,province,municipality,address_line) VALUES($1,'Admin A','1980-01-01','900000001','other','AO','Luanda','Luanda','Rua A'),($2,'Teacher A','1980-01-01','900000002','other','AO','Luanda','Luanda','Rua T'),($3,'Admin B','1980-01-01','900000003','other','AO','Luanda','Luanda','Rua B'),($4,'Student Safe','2010-01-01','900000004','other','AO','Luanda','Luanda','Rua S')", [adminA, teacherA, adminB, student]);
  await service.query("INSERT INTO identities(person_id,provider,provider_subject) VALUES($1,'firebase','student-context-admin-a'),($2,'firebase','student-context-teacher-a'),($3,'firebase','student-context-admin-b')", [adminA, teacherA, adminB]);
  await service.query("INSERT INTO memberships(id,person_id,institution_id,role,status,approved_at) VALUES($1,$2,$3,'institution_admin','active',now()),($4,$5,$3,'teacher','active',now()),($6,$7,$8,'institution_admin','active',now())", [membershipA, adminA, institutionA, membershipTeacher, teacherA, membershipB, adminB, institutionB]);
  await service.query("INSERT INTO academic_years(id,institution_id,name,starts_on,ends_on,status) VALUES($1,$2,'2026','2026-01-01','2026-12-31','active')", [year, institutionA]);
  await service.query("INSERT INTO academic_programs(id,institution_id,code,name) VALUES($1,$2,'GEN','General')", [program, institutionA]);
  await service.query("INSERT INTO academic_levels(id,institution_id,program_id,code,name) VALUES($1,$2,$3,'10','10')", [level, institutionA, program]);
  await service.query("INSERT INTO academic_classes(id,institution_id,academic_year_id,program_id,level_id,code,status) VALUES($1,$2,$3,$4,$5,'10A','active')", [klass, institutionA, year, program, level]);
  await service.query("INSERT INTO enrollment_offers(id,institution_id,academic_year_id,name,code,status) VALUES($1,$2,$3,'General','GEN','active')", [offer, institutionA, year]);
  await service.query("INSERT INTO student_profiles(institution_id,person_id,status) VALUES($1,$2,'active')", [institutionA, student]);
  await service.query("INSERT INTO enrollment_applications(id,institution_id,student_person_id,academic_year_id,offer_id,status,created_by,updated_by) VALUES($1,$2,$3,$4,$5,'active',$6,$6)", [enrollment, institutionA, student, year, offer, adminA]);
  const adminContext = { institutionId: institutionA, personId: adminA, membershipId: membershipA, role: 'institution_admin' as const, personName: 'Admin A', identityEmail: null, institutionName: 'A', institutionSlug: `student-context-a-${suffix}` };
  await placeStudent(service as any, adminContext, { academicYearId: year, classId: klass, studentPersonId: student, expectedVersion: 1 });

  const before = (await service.query("SELECT (SELECT count(*)::text FROM academic_events) AS events, (SELECT updated_at::text FROM student_profiles WHERE institution_id=$1 AND person_id=$2) AS student_updated, (SELECT updated_at::text FROM enrollment_applications WHERE id=$3) AS enrollment_updated, (SELECT updated_at::text FROM student_academic_placements WHERE institution_id=$1 AND student_person_id=$2 AND status='active') AS placement_updated", [institutionA, student, enrollment])).rows[0];
  const direct = await loadStudentContext(service as any, adminContext, student);
  assert.deepEqual(direct.student, { displayName: 'Student Safe', status: 'active' });
  assert.deepEqual(direct.current, { enrollmentStatus: 'active', placementStatus: 'active' });
  assert.deepEqual(direct.unavailable.finance, { status: 'not_yet_authoritative' });
  assert.deepEqual(direct.unavailable.assessment, { status: 'not_yet_authoritative' });
  assert.deepEqual((await service.query("SELECT (SELECT count(*)::text FROM academic_events) AS events, (SELECT updated_at::text FROM student_profiles WHERE institution_id=$1 AND person_id=$2) AS student_updated, (SELECT updated_at::text FROM enrollment_applications WHERE id=$3) AS enrollment_updated, (SELECT updated_at::text FROM student_academic_placements WHERE institution_id=$1 AND student_person_id=$2 AND status='active') AS placement_updated", [institutionA, student, enrollment])).rows[0], before, 'read boundary must not write, emit events, or touch authoritative records');
  await assert.rejects(() => loadStudentContext(service as any, { ...adminContext, institutionId: institutionB, personId: adminB, membershipId: membershipB }, student), (error: unknown) => error instanceof StudentContextError && error.code === 'NOT_FOUND');
  await assert.rejects(() => loadStudentContext(service as any, { ...adminContext, personId: teacherA, membershipId: membershipTeacher, role: 'teacher' }, student), (error: unknown) => error instanceof StudentContextError && error.code === 'FORBIDDEN');

  const app = express();
  registerStudentContextRoutes(app, { pool: service as any, requireAuth: createRequireAuth({ verifyIdToken: async (token) => ({ uid: token }), pool: service as any, resolveInstitutionalContext }) });
  server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/student-context/${student}`;
  const request = (token?: string) => fetch(base, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  const success = await request('student-context-admin-a'); assert.equal(success.status, 200); const body = await success.json() as Record<string, unknown>;
  assert.equal(JSON.stringify(body).includes(student), false, 'response must not expose internal student identifiers');
  assert.equal(JSON.stringify(body).includes(institutionA), false, 'response must not expose institution identifiers');
  assert.equal(/stack|select\s|postgres|900000004|Rua S/i.test(JSON.stringify(body)), false, 'response must minimize PII and hide implementation detail');
  assert.equal((await request()).status, 401);
  assert.equal((await request('student-context-teacher-a')).status, 403);
  assert.equal((await request('student-context-admin-b')).status, 404);
  console.log('[STUDENT-360-01-OBJECTIVE-1] PostgreSQL same-tenant/cross-tenant/role/no-write and HTTP 200/401/403/fail-closed/PII: PASS.');
} finally {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  if (service) await service.end();
  await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
  await setup.end();
}
