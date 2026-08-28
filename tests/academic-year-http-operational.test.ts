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
import { registerAcademicYearRoutes } from '../src/modules/enrollments/academic-year.controller.ts';

const { connectionString } = readApprovedTestTarget();
const schema = `nexus_academic_year_http_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const setup = new pg.Pool({ connectionString });
let service: pg.Pool | undefined;
let server: http.Server | undefined;
const safe = (body: unknown) => assert.doesNotMatch(JSON.stringify(body).toLowerCase(), /select |stack|postgres|person_id|external year|internal id/);

try {
  await setup.query(`CREATE SCHEMA "${schema}"`);
  const client = await setup.connect();
  try {
    const migrations = (await readdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations'))).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
    for (const file of migrations) await client.query(`SET search_path TO "${schema}"; ${await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations', file), 'utf8')}`);
  } finally { client.release(); }
  service = new pg.Pool({ connectionString, options: `-c search_path=${schema}` });
  const [institutionA, institutionB, actor, membership, externalYear] = Array.from({ length: 5 }, randomUUID);
  await service.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Academic A','academic-a','active'),($2,'Academic B','academic-b','active')", [institutionA, institutionB]);
  await service.query("INSERT INTO people(id,name,birth_date,phone,gender,nationality,province,municipality,address_line) VALUES($1,'Academic Director','1980-01-01','900000001','other','Angolana','Luanda','Luanda','Rua A')", [actor]);
  await service.query("INSERT INTO identities(person_id,provider,provider_subject) VALUES($1,'firebase','academic-director')", [actor]);
  await service.query("INSERT INTO memberships(id,person_id,institution_id,role,status,approved_at) VALUES($1,$2,$3,'director','active',now())", [membership, actor, institutionA]);
  await service.query("INSERT INTO academic_years(id,institution_id,name,starts_on,ends_on,status) VALUES($1,$2,'External Year','2026-01-01','2026-12-31','draft')", [externalYear, institutionB]);

  const app = express(); app.use(express.json());
  const auth = createRequireAuth({ verifyIdToken: async (token) => ({ uid: token }), pool: service as any, resolveInstitutionalContext });
  registerAcademicYearRoutes(app, { pool: service as any, requireAuth: auth });
  server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address() as { port: number }; const base = `http://127.0.0.1:${address.port}`;
  const request = (pathName: string, init: RequestInit = {}) => fetch(`${base}${pathName}`, { ...init, headers: { Authorization: 'Bearer academic-director', 'Content-Type': 'application/json', ...(init.headers ?? {}) } });

  const created = await request('/api/academic-years', { method: 'POST', body: JSON.stringify({ name: '2026/2027', startsOn: '2026-09-01', endsOn: '2027-07-31' }) });
  assert.equal(created.status, 201); const createdBody = await created.json() as any; safe(createdBody);
  assert.equal(createdBody.academicYear.status, 'draft'); assert.equal(Number(createdBody.academicYear.version), 1);
  const id = createdBody.academicYear.id;

  const listed = await request('/api/academic-years'); assert.equal(listed.status, 200); const listedBody = await listed.json() as any;
  assert.equal(listedBody.academicYears.length, 1); assert.equal(listedBody.academicYears[0].id, id); safe(listedBody);

  const edited = await request(`/api/academic-years/${id}`, { method: 'PATCH', body: JSON.stringify({ name: '2026/2027 Revised', startsOn: '2026-09-02', endsOn: '2027-07-30', expectedVersion: 1 }) });
  assert.equal(edited.status, 200); assert.equal(Number((await edited.json() as any).academicYear.version), 2);
  const stale = await request(`/api/academic-years/${id}`, { method: 'PATCH', body: JSON.stringify({ name: 'Stale', startsOn: '2026-09-02', endsOn: '2027-07-30', expectedVersion: 1 }) });
  assert.equal(stale.status, 409); const staleBody = await stale.json() as any; assert.equal(staleBody.code, 'STALE_VERSION'); safe(staleBody);

  const activated = await request(`/api/academic-years/${id}/activate`, { method: 'POST', body: JSON.stringify({ expectedVersion: 2 }) });
  assert.equal(activated.status, 200); assert.equal((await activated.json() as any).academicYear.status, 'active');
  const crossTenant = await request(`/api/academic-years/${externalYear}/activate`, { method: 'POST', body: JSON.stringify({ expectedVersion: 1 }) });
  assert.equal(crossTenant.status, 404); safe(await crossTenant.json());
  const external = await service.query<{ status: string; version: string }>('SELECT status,version FROM academic_years WHERE id=$1', [externalYear]);
  assert.deepEqual(external.rows[0], { status: 'draft', version: '1' });

  const closed = await request(`/api/academic-years/${id}/close`, { method: 'POST', body: JSON.stringify({ expectedVersion: 3 }) });
  assert.equal(closed.status, 200); assert.equal((await closed.json() as any).academicYear.status, 'closed');
  const historical = await service.query<{ status: string; version: string }>('SELECT status,version FROM academic_years WHERE id=$1 AND institution_id=$2', [id, institutionA]);
  assert.deepEqual(historical.rows[0], { status: 'closed', version: '4' });
  console.log('[ACADEMIC-01-ACADEMIC-YEAR-HTTP] auth/context/authority/postgres: PASS.');
} finally {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  if (service) await service.end();
  await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
  await setup.end();
}
