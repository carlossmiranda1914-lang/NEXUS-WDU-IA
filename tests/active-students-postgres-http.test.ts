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
import { registerEnrollmentRoutes } from '../src/modules/enrollments/enrollment.controller.ts';

const { connectionString } = readApprovedTestTarget();
const schema = `active_students_${Date.now()}`;
const setup = new pg.Pool({ connectionString });
let service: pg.Pool | undefined;
let server: http.Server | undefined;

async function applyMigrations(client: pg.PoolClient) {
  const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
  for (const filename of (await readdir(directory)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort()) {
    await client.query(`SET search_path TO "${schema}"; ${await readFile(path.join(directory, filename), 'utf8')}`);
  }
}

try {
  await setup.query(`CREATE SCHEMA "${schema}"`);
  const client = await setup.connect();
  try { await applyMigrations(client); } finally { client.release(); }
  service = new pg.Pool({ connectionString, options: `-c search_path=${schema}` });

  const [institutionA, institutionB, adminA, teacherA, adminB, student, partialStudent, studentB, membershipA, membershipTeacher, membershipB, yearCurrent, yearHistorical, program, level, classCurrent, classHistorical, offerCurrent, offerHistorical, currentEnrollment, historicalEnrollment, currentPlacement, historicalPlacement] = Array.from({ length: 23 }, randomUUID);
  await service.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'A','active-students-a','active'),($2,'B','active-students-b','active')", [institutionA, institutionB]);
  await service.query("INSERT INTO people(id,name) VALUES($1,'Admin A'),($2,'Teacher A'),($3,'Admin B'),($4,'Student One'),($5,'Partial Student'),($6,'Student B')", [adminA, teacherA, adminB, student, partialStudent, studentB]);
  await service.query("INSERT INTO identities(person_id,provider,provider_subject) VALUES($1,'firebase','active-students-admin-a'),($2,'firebase','active-students-teacher-a'),($3,'firebase','active-students-admin-b')", [adminA, teacherA, adminB]);
  await service.query("INSERT INTO memberships(id,person_id,institution_id,role,status,approved_at) VALUES($1,$2,$3,'institution_admin','active',now()),($4,$5,$3,'teacher','active',now()),($6,$7,$8,'institution_admin','active',now())", [membershipA, adminA, institutionA, membershipTeacher, teacherA, membershipB, adminB, institutionB]);
  await service.query("INSERT INTO academic_years(id,institution_id,name,starts_on,ends_on,status) VALUES($1,$2,'2026/2027','2026-01-01','2026-12-31','active'),($3,$2,'2025/2026','2025-01-01','2025-12-31','closed')", [yearCurrent, institutionA, yearHistorical]);
  await service.query("INSERT INTO academic_programs(id,institution_id,code,name,status) VALUES($1,$2,'GEN','Geral','active')", [program, institutionA]);
  await service.query("INSERT INTO academic_levels(id,institution_id,program_id,code,name,status) VALUES($1,$2,$3,'10','10.º ano','active')", [level, institutionA, program]);
  await service.query("INSERT INTO academic_classes(id,institution_id,academic_year_id,program_id,level_id,code,status) VALUES($1,$2,$3,$4,$5,'10A','active'),($6,$2,$7,$4,$5,'OLD','closed')", [classCurrent, institutionA, yearCurrent, program, level, classHistorical, yearHistorical]);
  await service.query("INSERT INTO enrollment_offers(id,institution_id,academic_year_id,name,code,status) VALUES($1,$2,$3,'Oferta atual','ATUAL','active'),($4,$2,$5,'Oferta antiga','ANTIGA','active')", [offerCurrent, institutionA, yearCurrent, offerHistorical, yearHistorical]);
  await service.query("INSERT INTO student_profiles(institution_id,person_id,status) VALUES($1,$2,'active'),($1,$3,'active'),($4,$5,'active')", [institutionA, student, partialStudent, institutionB, studentB]);
  const refs = await service.query<{ person_id: string; public_ref: string }>('SELECT person_id,public_ref FROM student_profiles');
  const studentRef = refs.rows.find((row) => row.person_id === student)!.public_ref;
  await service.query("INSERT INTO enrollment_applications(id,institution_id,student_person_id,academic_year_id,offer_id,status,created_by,updated_by) VALUES($1,$2,$3,$4,$5,'active',$6,$6),($7,$2,$3,$8,$9,'active',$6,$6),(gen_random_uuid(),$2,$10,$4,$5,'active',$6,$6)", [currentEnrollment, institutionA, student, yearCurrent, offerCurrent, adminA, historicalEnrollment, yearHistorical, offerHistorical, partialStudent]);
  await service.query("INSERT INTO student_academic_placements(id,institution_id,academic_year_id,class_id,student_person_id,status) VALUES($1,$2,$3,$4,$5,'active'),($6,$2,$7,$8,$5,'ended')", [currentPlacement, institutionA, yearCurrent, classCurrent, student, historicalPlacement, yearHistorical, classHistorical]);

  const before = (await service.query("SELECT (SELECT count(*)::text FROM academic_events) AS events,(SELECT string_agg(id::text||':'||updated_at::text,',' ORDER BY id) FROM student_profiles) AS profiles,(SELECT string_agg(id::text||':'||updated_at::text,',' ORDER BY id) FROM enrollment_applications) AS enrollments,(SELECT string_agg(id::text||':'||updated_at::text,',' ORDER BY id) FROM student_academic_placements) AS placements")).rows[0];
  const app = express();
  const auth = createRequireAuth({ verifyIdToken: async (token) => ({ uid: token }), pool: service as any, resolveInstitutionalContext });
  registerEnrollmentRoutes(app, { pool: service as any, requireAuth: auth });
  server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/active-students`;
  const request = (token?: string) => fetch(base, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });

  const success = await request('active-students-admin-a');
  assert.equal(success.status, 200, 'institutional staff must receive the authorized active-student projection');
  const body = await success.json() as { students: Array<Record<string, unknown>> };
  assert.equal(body.students.length, 2, 'one active StudentProfile must yield one row even with multiple enrollment periods');
  const row = body.students.find((item) => item.displayName === 'Student One')!;
  assert.deepEqual(row, {
    studentRef,
    displayName: 'Student One',
    status: 'active',
    current: {
      academicYear: { name: '2026/2027' },
      class: { code: '10A' },
      program: { code: 'GEN', name: 'Geral' },
      level: { code: '10', name: '10.º ano' },
    },
  });
  assert.deepEqual(body.students.find((item) => item.displayName === 'Partial Student')!.current, { academicYear: { name: '2026/2027' }, class: null, program: null, level: null }, 'partial academic context must remain explicit rather than synthesized');
  const serialized = JSON.stringify(body);
  for (const internalId of [student, partialStudent, currentEnrollment, historicalEnrollment, currentPlacement, historicalPlacement, institutionA, membershipA]) assert.equal(serialized.includes(internalId), false, 'active-student HTTP payload must not expose internal identifiers');
  assert.equal(serialized.includes('2025/2026'), false, 'history must not create or contaminate an active-student row');
  assert.equal((await request()).status, 401);
  assert.equal((await request('active-students-teacher-a')).status, 403);
  const tenantB = await request('active-students-admin-b'); assert.equal(tenantB.status, 200);
  const tenantBBody = await tenantB.json() as { students: Array<Record<string, unknown>> };
  assert.equal(tenantBBody.students.some((item) => item.studentRef === studentRef || item.displayName === 'Student One'), false, 'tenant B must not receive a row or opaque reference belonging to tenant A');
  assert.deepEqual((await service.query("SELECT (SELECT count(*)::text FROM academic_events) AS events,(SELECT string_agg(id::text||':'||updated_at::text,',' ORDER BY id) FROM student_profiles) AS profiles,(SELECT string_agg(id::text||':'||updated_at::text,',' ORDER BY id) FROM enrollment_applications) AS enrollments,(SELECT string_agg(id::text||':'||updated_at::text,',' ORDER BY id) FROM student_academic_placements) AS placements")).rows[0], before, 'read projection must not create events, mutate authorities, or materialize a cache');
  console.log('[STUDENT-EXPERIENCE-01] Active Students PostgreSQL/HTTP one-person/current-only/tenant/privacy/read-purity: PASS.');
} finally {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  if (service) await service.end();
  await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
  await setup.end();
}
