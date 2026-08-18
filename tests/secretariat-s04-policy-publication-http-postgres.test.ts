import 'dotenv/config';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

const baseUrl = process.env.TEST_DATABASE_URL?.trim();
if (!baseUrl || baseUrl === process.env.DATABASE_URL?.trim() || process.env.TEST_DATABASE_CONFIRMATION !== 'NEXUS_TEST_DATABASE') throw new Error('Dedicated confirmed TEST_DATABASE_URL is required.');
const schema = `nexus_s04_publication_http_${Date.now()}`; const quoted = `"${schema}"`; const bootstrap = new pg.Pool({ connectionString: baseUrl }); await bootstrap.query(`CREATE SCHEMA ${quoted}`);
const scoped = new URL(baseUrl); scoped.searchParams.set('options', `-c search_path=${schema},public`); const pool = new pg.Pool({ connectionString: scoped.toString() });
const routes: any[] = []; const app = new Proxy({}, { get: (_target, method: string) => (path: string, ...handlers: any[]) => routes.push({ method, path, handlers }) }) as any;
let assertions = 0; const ok = (value: unknown, message: string) => { assertions += 1; assert.ok(value, message); };
const A = randomUUID(), B = randomUUID(), actor = randomUUID(), year = randomUUID(), offer = randomUUID();
const context = (role: any, institutionId = A) => ({ institutionId, personId: actor, personName: 'Direção', identityEmail: null, membershipId: randomUUID(), institutionName: 'A', institutionSlug: 'a', role });
async function fixture(version: number) { const id = randomUUID(); await pool.query("INSERT INTO enrollment_document_policies(id,institution_id,offer_id,version,status,created_by) VALUES($1,$2,$3,$4,'draft',$5)", [id, A, offer, version, actor]); await pool.query("INSERT INTO enrollment_document_requirements(institution_id,policy_id,document_type,requirement_code,requirement_label) VALUES($1,$2,'Documento','document','Documento')", [A, id]); return id; }
async function call(handler: any, id: string, current: any) { const output: any = { status: 200 }; await handler({ params: { id }, institutionalContext: current }, { status(code: number) { output.status = code; return this; }, json(body: any) { output.body = body; return this; } }); return output; }

let dbPool: any;
try {
  for (const name of (await readdir('src/db/migrations')).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort()) await pool.query(await readFile(`src/db/migrations/${name}`, 'utf8'));
  await pool.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'A','s04-http-a','active'),($2,'B','s04-http-b','active')", [A, B]); await pool.query('INSERT INTO people(id,name) VALUES($1,$2)', [actor, 'Direção']); await pool.query("INSERT INTO academic_years(id,institution_id,name,starts_on,ends_on,status) VALUES($1,$2,'2026','2026-01-01','2026-12-31','active')", [year, A]); await pool.query("INSERT INTO enrollment_offers(id,institution_id,academic_year_id,name,code,status) VALUES($1,$2,$3,'Oferta','S04-H','active')", [offer, A, year]);
  process.env.DATABASE_URL = scoped.toString();
  const { registerEnrollmentDocumentPolicyRoutes } = await import('../src/modules/enrollments/enrollment-document-policy.controller.ts'); dbPool = (await import('../src/db/index.ts')).pool; registerEnrollmentDocumentPolicyRoutes(app);
  const publish = routes.find((route) => route.path === '/api/enrollment-document-policies/:id/publish').handlers.at(-1);
  const director = await call(publish, await fixture(1), context('director')); ok(director.status === 200 && director.body.status === 'active', 'Director must publish.'); ok(!JSON.stringify(director.body).match(/policy_id|institution_id|offer_id|person_id/), 'Response must not expose technical identifiers.');
  const admin = await call(publish, await fixture(2), context('institution_admin')); ok(admin.status === 200 && admin.body.status === 'active', 'Institution admin must publish.');
  const secretaryId = await fixture(3); ok((await call(publish, secretaryId, context('secretariat'))).status === 403, 'Secretariat must be rejected.'); ok((await call(publish, secretaryId, undefined)).status === 401, 'Missing institutional authentication must be rejected.'); ok((await call(publish, secretaryId, context('director', B))).status === 404, 'Cross-tenant policy publication must fail closed.');
  console.log(`[S04-POLICY-PUBLICATION-HTTP-POSTGRES] passed (${assertions} assertions).`);
} finally { await dbPool?.end().catch(() => {}); await pool.end(); await bootstrap.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`); await bootstrap.end(); }
