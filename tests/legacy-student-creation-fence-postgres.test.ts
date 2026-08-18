import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { isInstitutionOwned, resolveInstitutionOwnedResourceIds } from '../src/auth/institution-resource-ownership.ts';
import { registerLegacyStudentRoutes } from '../src/modules/legacy-students/legacy-student.routes.ts';

const url = process.env.TEST_DATABASE_URL?.trim();
if (!url || url === process.env.DATABASE_URL?.trim() || process.env.TEST_DATABASE_CONFIRMATION !== 'NEXUS_TEST_DATABASE') throw new Error('Safe TEST_DATABASE_URL confirmation is required.');
const schema = `legacy_fence_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const quoted = `"${schema}"`;
const bootstrap = new pg.Pool({ connectionString: url });
await bootstrap.query(`CREATE SCHEMA ${quoted}`);
const scopedUrl = new URL(url); scopedUrl.searchParams.set('options', `-c search_path=${schema},public`);
const pool = new pg.Pool({ connectionString: scopedUrl.toString() });
let assertions = 0;
const expect = (value: unknown, message: string) => { assertions += 1; assert(value, message); };
const count = async (table: string) => Number((await pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count);

function context(institutionId: string, actor: string) { return { institutionId, personId: actor, personName: 'Administrador de teste', identityEmail: null, membershipId: randomUUID(), institutionName: 'Teste', institutionSlug: 'teste', role: 'institution_admin' as const }; }
function createApp(institutionId: string, actor: string, broadcasts: unknown[]) {
  const app = express(); app.use(express.json());
  const auth: any = (req: any, _res: any, next: any) => { req.institutionalContext = context(institutionId, actor); req.user = { uid: actor, dbName: 'Administrador de teste', dbRole: 'admin', email: 'admin@test.invalid' }; next(); };
  const authorize: any = (roles: string[]) => (req: any, res: any, next: any) => roles.includes(req.user?.dbRole) ? next() : res.status(403).json({ error: 'Acesso negado.' });
  registerLegacyStudentRoutes(app, { db: drizzle(pool), pool, requireAuth: auth, authorizeRole: authorize, resolveAuthorizedLegacyStudentIds: async () => [], scopeLegacyRecordsToInstitution: async (req: any, resourceType: string, records: any[]) => { const owned = await resolveInstitutionOwnedResourceIds(pool, req.institutionalContext, resourceType); return records.filter((record) => isInstitutionOwned(String(record.id), owned)); }, resolveInstitutionOwnedResourceIds, isInstitutionOwned, broadcastToAll: (type: string, payload: unknown) => broadcasts.push({ type, payload }) });
  return app;
}
async function request(app: express.Express, route: string, body: unknown) {
  const server = http.createServer(app); await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { const address = server.address() as { port: number }; const response = await fetch(`http://127.0.0.1:${address.port}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: response.status, body: await response.json() }; }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

try {
  for (const file of (await readdir('src/db/migrations')).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort()) await pool.query(await readFile(path.join('src/db/migrations', file), 'utf8'));
  await pool.query(`CREATE TABLE students (id text PRIMARY KEY, name text NOT NULL, class text NOT NULL, attendance_rate integer NOT NULL DEFAULT 100, average_grade double precision NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'active', outstanding_fees integer NOT NULL DEFAULT 0, guardians_name text NOT NULL DEFAULT '', guardians_contact text NOT NULL DEFAULT '', behavior_degree text NOT NULL DEFAULT 'Excelente', documents jsonb NOT NULL DEFAULT '[]', behavior_history jsonb NOT NULL DEFAULT '[]', grades jsonb NOT NULL DEFAULT '[]', created_at timestamp DEFAULT now()); CREATE TABLE teachers (id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, phone text, subjects jsonb NOT NULL DEFAULT '[]', classes jsonb NOT NULL DEFAULT '[]', productivity_score integer NOT NULL DEFAULT 90, schedule jsonb NOT NULL DEFAULT '[]', status text NOT NULL DEFAULT 'active', documents jsonb NOT NULL DEFAULT '[]', created_at timestamp DEFAULT now()); CREATE TABLE invoices (id text PRIMARY KEY, student_id text NOT NULL REFERENCES students(id), student_name text NOT NULL, amount integer NOT NULL, due_date text NOT NULL, status text NOT NULL DEFAULT 'pending', category text NOT NULL DEFAULT 'tuition', created_at timestamp DEFAULT now()); CREATE TABLE automations (id text PRIMARY KEY, name text NOT NULL, active boolean NOT NULL DEFAULT true, executions integer NOT NULL DEFAULT 0);`);
  const A = randomUUID(), B = randomUUID(), actorA = randomUUID(), actorB = randomUUID();
  await pool.query(`INSERT INTO institutions(id,name,slug,status) VALUES ($1,'A',$2,'active'),($3,'B',$4,'active')`, [A, `a-${Date.now()}`, B, `b-${Date.now()}`]);
  await pool.query(`INSERT INTO people(id,name) VALUES($1,'Actor A'),($2,'Actor B')`, [actorA, actorB]);
  await pool.query(`INSERT INTO memberships(person_id,institution_id,role,status) VALUES($1,$2,'institution_admin','active'),($3,$4,'institution_admin','active')`, [actorA, A, actorB, B]);
  await pool.query(`INSERT INTO students(id,name,class,guardians_name,guardians_contact) VALUES('A-1','Aluno A','A','G','C'),('B-1','Aluno B','B','G','C')`);
  await pool.query(`INSERT INTO institution_resource_ownership(institution_id,resource_type,resource_id) VALUES($1,'student','A-1'),($2,'student','B-1')`, [A, B]);
  await pool.query(`INSERT INTO invoices(id,student_id,student_name,amount,due_date) VALUES('I-1','A-1','Aluno A',100,'2026-01-01')`);
  await pool.query(`INSERT INTO automations(id,name,executions) VALUES('AUTO-1','Fluxo legado',7)`);
  const baseline = { students: await count('students'), invoices: await count('invoices'), ownership: await count('institution_resource_ownership'), creationLogs: await count("operational_logs WHERE action = 'STUDENT_CREATION'"), automation: Number((await pool.query("SELECT executions FROM automations WHERE id='AUTO-1'")).rows[0].executions) };
  const notices: unknown[] = [], appA = createApp(A, actorA, notices), appB = createApp(B, actorB, notices);
  let response = await request(appA, '/api/students', { name: 'Novo', class: 'A' }); expect(response.status === 410, 'missing id is gone'); expect(await count('students') === baseline.students && await count('invoices') === baseline.invoices && await count('institution_resource_ownership') === baseline.ownership, 'missing id has no persistence side effects'); expect(notices.length === 0, 'missing id has no automation/realtime side effect');
  response = await request(appA, '/api/students', { id: 'missing', name: 'Novo' }); expect(response.status === 404, 'unknown id is not created'); expect(await count('students') === baseline.students, 'unknown id leaves students unchanged');
  response = await request(appA, '/api/students', { id: 'B-1', name: 'Alterado' }); expect(response.status === 404, 'cross tenant is fail closed'); expect((await pool.query("SELECT name FROM students WHERE id='B-1'")).rows[0].name === 'Aluno B', 'cross tenant row remains unchanged');
  response = await request(appA, '/api/students', { id: 'A-1', name: 'Aluno A atualizado' }); expect(response.status === 200, 'owned legacy student updates'); expect(await count('students') === baseline.students, 'update does not create student'); expect((await pool.query("SELECT name FROM students WHERE id='A-1'")).rows[0].name === 'Aluno A atualizado', 'only owned row updates'); expect(await count("operational_logs WHERE action = 'STUDENT_UPDATE'") === 1, 'student update audit remains');
  response = await request(appB, '/api/migration/execute', { rows: [] }); expect(response.status === 410, 'migration execute is gone'); expect(await count('students') === baseline.students && await count('invoices') === baseline.invoices && await count('institution_resource_ownership') === baseline.ownership, 'migration fence has no creation side effects'); expect(await count("operational_logs WHERE action = 'STUDENT_CREATION'") === baseline.creationLogs, 'no student creation audit exists'); expect(Number((await pool.query("SELECT executions FROM automations WHERE id='AUTO-1'")).rows[0].executions) === baseline.automation, 'automation is unchanged');
  console.log(`[LEGACY-STUDENT-CREATION-FENCE-POSTGRES] passed (${assertions} assertions).`);
} finally { await pool.end(); await bootstrap.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`); await bootstrap.end(); }
