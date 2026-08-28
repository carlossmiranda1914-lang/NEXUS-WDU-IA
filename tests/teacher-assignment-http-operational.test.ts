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
import { registerAcademicStructureRoutes } from '../src/modules/academic/academic-structure.controller.ts';

const { connectionString } = readApprovedTestTarget();
const schema = `nexus_teacher_assignment_http_${Date.now()}_${randomUUID().slice(0, 8)}`;
const setup = new pg.Pool({ connectionString }); let service: pg.Pool | undefined; let server: http.Server | undefined;
try {
  await setup.query(`CREATE SCHEMA "${schema}"`);
  const client = await setup.connect();
  try { for (const file of (await readdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations'))).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort()) await client.query(`SET search_path TO "${schema}"; ${await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations', file), 'utf8')}`); } finally { client.release(); }
  service = new pg.Pool({ connectionString, options: `-c search_path=${schema}` });
  const [institution, actor, membership, teacherA, teacherB, year, program, level] = Array.from({ length: 8 }, randomUUID);
  await service.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'A','teacher-http-a','active')", [institution]);
  await service.query("INSERT INTO people(id,name,birth_date,phone,gender,nationality,province,municipality,address_line) VALUES($1,'Director','1980-01-01','900000001','other','Angolana','Luanda','Luanda','Rua'),($2,'Teacher A','1980-01-01','900000002','other','Angolana','Luanda','Luanda','Rua'),($3,'Teacher B','1980-01-01','900000003','other','Angolana','Luanda','Luanda','Rua')", [actor, teacherA, teacherB]);
  await service.query("INSERT INTO identities(person_id,provider,provider_subject) VALUES($1,'firebase','teacher-assignment-director')", [actor]);
  await service.query("INSERT INTO memberships(id,person_id,institution_id,role,status,approved_at) VALUES($1,$2,$3,'director','active',now()),($4,$5,$3,'teacher','active',now()),($6,$7,$3,'teacher','active',now())", [membership, actor, institution, randomUUID(), teacherA, randomUUID(), teacherB]);
  await service.query("INSERT INTO academic_years(id,institution_id,name,starts_on,ends_on,status) VALUES($1,$2,'2026','2026-01-01','2026-12-31','active')", [year, institution]);
  await service.query("INSERT INTO academic_programs(id,institution_id,code,name) VALUES($1,$2,'GEN','Geral')", [program, institution]);
  await service.query("INSERT INTO academic_levels(id,institution_id,program_id,code,name) VALUES($1,$2,$3,'10','10.º')", [level, institution, program]);
  const app = express(); app.use(express.json());
  const auth = createRequireAuth({ verifyIdToken: async token => ({ uid: token }), pool: service as any, resolveInstitutionalContext });
  registerAcademicStructureRoutes(app, { pool: service as any, requireAuth: auth });
  server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/academic/teacher-assignments`;
  const request = (url: string, method = 'GET', body?: unknown) => fetch(url, { method, headers: { Authorization: 'Bearer teacher-assignment-director', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const subject = await request('http://127.0.0.1:' + (server.address() as any).port + '/api/academic/subjects', 'POST', { code: 'MAT', name: 'Matemática' }); assert.equal(subject.status, 201); const subjectId = (await subject.json() as any).academicSubject.id;
  const klass = await request('http://127.0.0.1:' + (server.address() as any).port + '/api/academic/classes', 'POST', { academicYearId: year, programId: program, levelId: level, code: '10A' }); assert.equal(klass.status, 201); const classId = (await klass.json() as any).academicClass.id;
  const offering = await request('http://127.0.0.1:' + (server.address() as any).port + '/api/academic/subject-offerings', 'POST', { academicYearId: year, classId, subjectId }); assert.equal(offering.status, 201); const subjectOfferingId = (await offering.json() as any).subjectOffering.id;
  const created = await request(base, 'POST', { academicYearId: year, classId, subjectOfferingId, teacherPersonId: teacherA, effectiveFrom: '2026-08-01', expectedVersion: 1 }); assert.equal(created.status, 201); const assignment = (await created.json() as any).teacherAssignment;
  const replaced = await request(`${base}/${assignment.id}/replace`, 'POST', { teacherPersonId: teacherB, effectiveFrom: '2026-08-15', expectedVersion: 1 }); assert.equal(replaced.status, 200); const replacement = (await replaced.json() as any).teacherAssignment;
  const current = await request(base); assert.equal(current.status, 200); assert.deepEqual((await current.json() as any).teacherAssignments.map((row: any) => row.teacher_person_id), [teacherB]);
  const history = await request(`${base}?view=historical`); assert.equal(history.status, 200); assert.equal((await history.json() as any).teacherAssignments.length, 2);
  const stale = await request(`${base}/${assignment.id}/replace`, 'POST', { teacherPersonId: teacherA, effectiveFrom: '2026-08-20', expectedVersion: 1 }); assert.equal(stale.status, 409); assert.equal((await stale.json() as any).code, 'STALE_VERSION');
  assert.equal(replacement.status, 'active');
  console.log('[ACADEMIC-01-TEACHER-ASSIGNMENT-HTTP] create/replace/current/history/stale/postgres: PASS.');
} finally {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  if (service) await service.end();
  await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
  await setup.end();
}
