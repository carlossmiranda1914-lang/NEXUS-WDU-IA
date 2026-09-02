import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import http from 'node:http';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pg from 'pg';
import { readApprovedTestTarget } from '../scripts/nexus-test-db-safety.mjs';
import { resolveInstitutionalContext } from '../src/auth/institutional-context.ts';
import { createRequireAuth } from '../src/middleware/auth.ts';
import { registerEnrollmentRegistrationRoutes } from '../src/modules/enrollments/enrollment-registration.controller.ts';

const { connectionString } = readApprovedTestTarget();
const schema = `nexus_enrollment_http_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const setup = new pg.Pool({ connectionString });
const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
let service: pg.Pool | undefined;
let server: http.Server | undefined;

try {
  await setup.query(`CREATE SCHEMA "${schema}"`);
  const client = await setup.connect();
  try { for (const file of (await readdir(migrations)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort()) await client.query(`SET search_path TO "${schema}", public; ${await readFile(path.join(migrations, file), 'utf8')}`); }
  finally { client.release(); }
  service = new pg.Pool({ connectionString, options: `-c search_path=${schema},public`, max: 4 });
  const institution = randomUUID(), actor = randomUUID(), student = randomUUID(), membership = randomUUID(), application = randomUUID(), year = randomUUID(), offer = randomUUID();
  await service.query("INSERT INTO institutions (id,name,slug,status) VALUES ($1,'HTTP EN01','http-en01','active')", [institution]);
  await service.query("INSERT INTO people (id,name,birth_date) VALUES ($1,'Secretaria HTTP','1980-01-01'),($2,'Aluno HTTP','2012-01-01')", [actor, student]);
  await service.query("INSERT INTO identities (person_id,provider,provider_subject) VALUES ($1,'firebase','http-admin')", [actor]);
  await service.query("INSERT INTO memberships (id,person_id,institution_id,role,status,approved_at) VALUES ($1,$2,$3,'secretariat','active',now())", [membership, actor, institution]);
  await service.query("INSERT INTO academic_years (id,institution_id,name,starts_on,ends_on,status) VALUES ($1,$2,'2026','2026-01-01','2026-12-31','active')", [year, institution]);
  await service.query("INSERT INTO enrollment_offers (id,institution_id,academic_year_id,name,code,status) VALUES ($1,$2,$3,'Oferta','HTTP01','active')", [offer, institution, year]);
  await service.query("INSERT INTO student_profiles (institution_id,person_id,status) VALUES ($1,$2,'inactive')", [institution, student]);
  await service.query("INSERT INTO enrollment_applications (id,institution_id,student_person_id,academic_year_id,offer_id,status,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,'draft',$6,$6)", [application, institution, student, year, offer, actor]);
  const app = express(); app.use(express.json());
  const auth = createRequireAuth({ verifyIdToken: async (token) => ({ uid: token }), pool: service as any, resolveInstitutionalContext });
  registerEnrollmentRegistrationRoutes(app, { pool: service as any, requireAuth: auth });
  server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string'); const base = `http://127.0.0.1:${address.port}`;
  const payload = { expectedRegistrationVersion: '1', student: { expectedVersion: '1', name: 'Aluno HTTP', birthDate: '2012-01-01', phone: '923000000' }, guardian: null, enrollment: {} };
  const first = await fetch(`${base}/api/enrollments/${application}/registration`, { method: 'PUT', headers: { Authorization: 'Bearer http-admin', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  assert.equal(first.status, 200);
  const stale = await fetch(`${base}/api/enrollments/${application}/registration`, { method: 'PUT', headers: { Authorization: 'Bearer http-admin', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  assert.equal(stale.status, 409); const body = await stale.json() as Record<string, unknown>; assert.equal(body.code, 'STALE_VERSION');
  const publicBody = JSON.stringify(body).toLowerCase(); assert.doesNotMatch(publicBody, /select |stack|postgres|person_id|923000000|aluno http/);
  const persisted = await service.query<{ name: string; registration_version: string }>('SELECT p.name,e.registration_version FROM enrollment_applications e JOIN people p ON p.id=e.student_person_id WHERE e.id=$1', [application]);
  assert.deepEqual(persisted.rows[0], { name: 'Aluno HTTP', registration_version: '2' });
  console.log('[ENROLLMENT-01-HTTP] stale conflict route/context/service/postgres: PASS.');
} finally {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  if (service) await service.end();
  await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined); await setup.end();
}
