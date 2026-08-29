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

  const [institutionA, institutionB, adminA, teacherA, adminB, student, emptyStudent, directorA, secretariatA, financialA, parentA, outsider, year, oldYear, olderYear, program, level, klass, oldClass, olderClass, offer, oldOffer, olderOffer, enrollment, oldEnrollment, olderEnrollment, oldPlacement, olderPlacement, membershipA, membershipTeacher, membershipB, membershipDirector, membershipSecretariat, membershipFinancial, membershipStudent, membershipParent, subject, subjectOffering] = Array.from({ length: 38 }, randomUUID);
  const suffix = randomUUID().slice(0, 8);
  await service.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'A',$2,'active'),($3,'B',$4,'active')", [institutionA, `student-context-a-${suffix}`, institutionB, `student-context-b-${suffix}`]);
  await service.query("INSERT INTO people(id,name,birth_date,phone,gender,nationality,province,municipality,address_line) VALUES($1,'Admin A','1980-01-01','900000001','other','AO','Luanda','Luanda','Rua A'),($2,'Teacher A','1980-01-01','900000002','other','AO','Luanda','Luanda','Rua T'),($3,'Admin B','1980-01-01','900000003','other','AO','Luanda','Luanda','Rua B'),($4,'Student Safe','2010-01-01','900000004','other','AO','Luanda','Luanda','Rua S'),($5,'No History','2011-01-01','900000005','other','AO','Luanda','Luanda','Rua N'),($6,'Director','1980-01-01','900000006','other','AO','Luanda','Luanda','Rua D'),($7,'Secretariat','1980-01-01','900000007','other','AO','Luanda','Luanda','Rua C'),($8,'Financial','1980-01-01','900000008','other','AO','Luanda','Luanda','Rua F'),($9,'Parent','1980-01-01','900000009','other','AO','Luanda','Luanda','Rua P'),($10,'Outsider','1980-01-01','900000010','other','AO','Luanda','Luanda','Rua O')", [adminA, teacherA, adminB, student, emptyStudent, directorA, secretariatA, financialA, parentA, outsider]);
  await service.query("INSERT INTO identities(person_id,provider,provider_subject) VALUES($1,'firebase','student-context-admin-a'),($2,'firebase','student-context-teacher-a'),($3,'firebase','student-context-admin-b'),($4,'firebase','student-context-director-a'),($5,'firebase','student-context-secretariat-a'),($6,'firebase','student-context-financial-a'),($7,'firebase','student-context-student-a'),($8,'firebase','student-context-parent-a'),($9,'firebase','student-context-outsider-a')", [adminA, teacherA, adminB, directorA, secretariatA, financialA, student, parentA, outsider]);
  await service.query("INSERT INTO memberships(id,person_id,institution_id,role,status,approved_at) VALUES($1,$2,$3,'institution_admin','active',now()),($4,$5,$3,'teacher','active',now()),($6,$7,$8,'institution_admin','active',now()),($9,$10,$3,'director','active',now()),($11,$12,$3,'secretariat','active',now()),($13,$14,$3,'financial','active',now()),($15,$16,$3,'student','active',now()),($17,$18,$3,'parent','active',now())", [membershipA, adminA, institutionA, membershipTeacher, teacherA, membershipB, adminB, institutionB, membershipDirector, directorA, membershipSecretariat, secretariatA, membershipFinancial, financialA, membershipStudent, student, membershipParent, parentA]);
  await service.query("INSERT INTO academic_years(id,institution_id,name,starts_on,ends_on,status) VALUES($1,$2,'2026','2026-01-01','2026-12-31','active'),($3,$2,'2025','2025-01-01','2025-12-31','closed'),($4,$2,'2024','2024-01-01','2024-12-31','closed')", [year, institutionA, oldYear, olderYear]);
  await service.query("INSERT INTO academic_programs(id,institution_id,code,name) VALUES($1,$2,'GEN','General')", [program, institutionA]);
  await service.query("INSERT INTO academic_levels(id,institution_id,program_id,code,name) VALUES($1,$2,$3,'10','10')", [level, institutionA, program]);
  await service.query("INSERT INTO academic_classes(id,institution_id,academic_year_id,program_id,level_id,code,status) VALUES($1,$2,$3,$4,$5,'10A','active'),($6,$2,$7,$4,$5,'OLD','closed'),($8,$2,$9,$4,$5,'OLDER','closed')", [klass, institutionA, year, program, level, oldClass, oldYear, olderClass, olderYear]);
  await service.query("INSERT INTO academic_subjects(id,institution_id,code,name,status) VALUES($1,$2,'MAT','Mathematics','active')", [subject, institutionA]);
  await service.query("INSERT INTO academic_subject_offerings(id,institution_id,academic_year_id,class_id,subject_id,status) VALUES($1,$2,$3,$4,$5,'active')", [subjectOffering, institutionA, year, klass, subject]);
  await service.query("INSERT INTO enrollment_offers(id,institution_id,academic_year_id,name,code,status) VALUES($1,$2,$3,'General','GEN','active'),($4,$2,$5,'Old','OLD','active'),($6,$2,$7,'Older','OLDER','active')", [offer, institutionA, year, oldOffer, oldYear, olderOffer, olderYear]);
  await service.query("INSERT INTO student_profiles(institution_id,person_id,status) VALUES($1,$2,'active'),($1,$3,'active')", [institutionA, student, emptyStudent]);
  await service.query("INSERT INTO guardian_relationships(institution_id,guardian_person_id,student_person_id,relationship,status) VALUES($1,$2,$3,'parent','active')", [institutionA, parentA, student]);
  await service.query("INSERT INTO enrollment_applications(id,institution_id,student_person_id,academic_year_id,offer_id,status,created_by,updated_by) VALUES($1,$2,$3,$4,$5,'active',$6,$6),($7,$2,$3,$8,$9,'active',$6,$6),($10,$2,$3,$11,$12,'active',$6,$6)", [enrollment, institutionA, student, year, offer, adminA, oldEnrollment, oldYear, oldOffer, olderEnrollment, olderYear, olderOffer]);
  const adminContext = { institutionId: institutionA, personId: adminA, membershipId: membershipA, role: 'institution_admin' as const, personName: 'Admin A', identityEmail: null, institutionName: 'A', institutionSlug: `student-context-a-${suffix}` };
  await placeStudent(service as any, adminContext, { academicYearId: year, classId: klass, studentPersonId: student, expectedVersion: 1 });
  await service.query("INSERT INTO student_academic_placements(id,institution_id,academic_year_id,class_id,student_person_id,status) VALUES($1,$2,$3,$4,$5,'ended')", [oldPlacement, institutionA, oldYear, oldClass, student]);
  await service.query("INSERT INTO student_academic_placements(id,institution_id,academic_year_id,class_id,student_person_id,status) VALUES($1,$2,$3,$4,$5,'ended')", [olderPlacement, institutionA, olderYear, olderClass, student]);
  const readIndexes = await service.query("SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND indexname IN ('student_context_enrollment_history_idx','student_context_placement_history_idx') ORDER BY indexname");
  assert.deepEqual(readIndexes.rows.map((row: any) => row.indexname), ['student_context_enrollment_history_idx', 'student_context_placement_history_idx'], 'history query paths must have explicit institution/student temporal indexes');

  const before = (await service.query("SELECT (SELECT count(*)::text FROM academic_events) AS events, (SELECT string_agg(id::text||':'||updated_at::text,',' ORDER BY id) FROM student_profiles WHERE institution_id=$1) AS profiles, (SELECT string_agg(id::text||':'||updated_at::text,',' ORDER BY id) FROM enrollment_applications WHERE institution_id=$1 AND student_person_id=$2) AS enrollments, (SELECT string_agg(id::text||':'||updated_at::text,',' ORDER BY id) FROM student_academic_placements WHERE institution_id=$1 AND student_person_id=$2) AS placements, (SELECT count(*)::text FROM information_schema.tables WHERE table_schema=current_schema()) AS tables", [institutionA, student])).rows[0];
  let projectionQueries = 0;
  const countedPool = { query: async <T>(sql: string, params?: unknown[]) => { projectionQueries += 1; return service!.query(sql, params) as any as Promise<{ rows: T[]; rowCount: number | null }>; } };
  const direct = await loadStudentContext(countedPool, adminContext, student);
  assert.equal(projectionQueries, 3, 'admin current/history projection must use a fixed three-query shape, independent of history row count');
  assert.deepEqual(direct.student, { displayName: 'Student Safe', status: 'active' });
  assert.deepEqual(direct.current, {
    enrollment: { status: 'active', academicYear: { name: '2026' } },
    placement: {
      status: 'active',
      academicYear: { name: '2026' },
      class: { code: '10A' },
      program: { code: 'GEN', name: 'General' },
      level: { code: '10', name: '10' },
      subjects: [{ code: 'MAT', name: 'Mathematics' }],
    },
  });
  assert.deepEqual(direct.history, {
    enrollments: [{ status: 'active', academicYear: { name: '2025' } }, { status: 'active', academicYear: { name: '2024' } }],
    placements: [
      { status: 'ended', academicYear: { name: '2025' }, class: { code: 'OLD' }, program: { code: 'GEN', name: 'General' }, level: { code: '10', name: '10' } },
      { status: 'ended', academicYear: { name: '2024' }, class: { code: 'OLDER' }, program: { code: 'GEN', name: 'General' }, level: { code: '10', name: '10' } },
    ],
  });
  const noHistory = await loadStudentContext(service as any, adminContext, emptyStudent);
  assert.deepEqual(noHistory.current, { enrollment: null, placement: null });
  assert.deepEqual(noHistory.history, { enrollments: [], placements: [] }, 'absence of history must remain an explicit empty history, not a synthesized fact');
  assert.deepEqual(direct.unavailable.finance, { status: 'not_yet_authoritative' });
  assert.deepEqual(direct.unavailable.assessment, { status: 'not_yet_authoritative' });
  assert.deepEqual((await service.query("SELECT (SELECT count(*)::text FROM academic_events) AS events, (SELECT string_agg(id::text||':'||updated_at::text,',' ORDER BY id) FROM student_profiles WHERE institution_id=$1) AS profiles, (SELECT string_agg(id::text||':'||updated_at::text,',' ORDER BY id) FROM enrollment_applications WHERE institution_id=$1 AND student_person_id=$2) AS enrollments, (SELECT string_agg(id::text||':'||updated_at::text,',' ORDER BY id) FROM student_academic_placements WHERE institution_id=$1 AND student_person_id=$2) AS placements, (SELECT count(*)::text FROM information_schema.tables WHERE table_schema=current_schema()) AS tables", [institutionA, student])).rows[0], before, 'read boundary must not write, emit events, alter current or historical authority records, or materialize a projection');
  await assert.rejects(() => loadStudentContext(service as any, { ...adminContext, institutionId: institutionB, personId: adminB, membershipId: membershipB }, student), (error: unknown) => error instanceof StudentContextError && error.code === 'NOT_FOUND');
  await assert.rejects(() => loadStudentContext(service as any, { ...adminContext, personId: teacherA, membershipId: membershipTeacher, role: 'teacher' }, student), (error: unknown) => error instanceof StudentContextError && error.code === 'FORBIDDEN');

  const app = express();
  registerStudentContextRoutes(app, { pool: service as any, requireAuth: createRequireAuth({ verifyIdToken: async (token) => ({ uid: token }), pool: service as any, resolveInstitutionalContext }) });
  server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/student-context/${student}`;
  const request = (token?: string, target = student) => fetch(`http://127.0.0.1:${(server.address() as any).port}/api/student-context/${target}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  const success = await request('student-context-admin-a'); assert.equal(success.status, 200); const body = await success.json() as Record<string, unknown>; assert.deepEqual(body.current, direct.current, 'HTTP must expose the same server-authorized current projection'); assert.deepEqual(body.history, direct.history, 'HTTP must expose the same server-authorized historical projection');
  assert.equal(JSON.stringify(body).includes(student), false, 'response must not expose internal student identifiers');
  assert.equal(JSON.stringify(body).includes(institutionA), false, 'response must not expose institution identifiers');
  assert.equal(/stack|select\s|postgres|900000004|Rua S/i.test(JSON.stringify(body)), false, 'response must minimize PII and hide implementation detail');
  assert.equal([adminA, teacherA, membershipA, membershipTeacher, membershipDirector, membershipSecretariat, membershipFinancial, membershipStudent, membershipParent].some((internalId) => JSON.stringify(body).includes(internalId)), false, 'response must not expose identity, membership, or other internal identifiers');
  assert.deepEqual(body.unavailable, { finance: { status: 'not_yet_authoritative' }, assessment: { status: 'not_yet_authoritative' }, attendance: { status: 'not_yet_authoritative' }, physicalDocuments: { status: 'not_yet_authoritative' } });
  assert.equal(/sem d[ií]vidas|sem faltas|sem notas|saldo|balance|physical.*available/i.test(JSON.stringify(body)), false, 'unavailable domains must not report invented operational facts');
  assert.equal((await request()).status, 401);
  assert.equal((await request('student-context-teacher-a')).status, 403);
  assert.equal((await request('student-context-financial-a')).status, 403);
  assert.equal((await request('student-context-director-a')).status, 200);
  assert.equal((await request('student-context-secretariat-a')).status, 200);
  assert.equal((await request('student-context-student-a')).status, 200);
  assert.equal((await request('student-context-parent-a')).status, 200);
  assert.equal((await request('student-context-parent-a', emptyStudent)).status, 403);
  assert.equal((await request('student-context-admin-b')).status, 404);
  const notFound = await request('student-context-admin-a', randomUUID()); assert.equal(notFound.status, 404); assert.equal(/stack|select\s|postgres|constraint/i.test(await notFound.text()), false);
  assert.equal((await request('student-context-outsider-a')).status, 403);
  console.log('[STUDENT-360-01-OPERATIONAL-PROJECTION] PostgreSQL/HTTP current-history coherence, fixed query shape, source indexes, failure safety, tenant/privacy and read purity: PASS.');
} finally {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  if (service) await service.end();
  await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
  await setup.end();
}
