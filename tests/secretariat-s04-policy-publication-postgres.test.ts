import 'dotenv/config';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { publishEnrollmentDocumentPolicy } from '../src/modules/enrollments/enrollment-document-policy-publication.ts';
import { executeEnrollmentIntake } from '../src/modules/enrollments/enrollment-intake.ts';

const url = process.env.TEST_DATABASE_URL?.trim();
if (!url || url === process.env.DATABASE_URL?.trim() || process.env.TEST_DATABASE_CONFIRMATION !== 'NEXUS_TEST_DATABASE') throw new Error('Dedicated confirmed TEST_DATABASE_URL is required.');
const schema = `nexus_s04_publication_${Date.now()}_${randomUUID().slice(0, 8)}`; const quoted = `"${schema}"`;
const bootstrap = new pg.Pool({ connectionString: url }); await bootstrap.query(`CREATE SCHEMA ${quoted}`);
const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema},public`, max: 6 }) as any;
let assertions = 0; const ok = (value: unknown, message: string) => { assertions += 1; assert.ok(value, message); };
const A = randomUUID(), B = randomUUID(), actor = randomUUID(), year = randomUUID(), offer = randomUUID();
const ctx = (role: any = 'director', institutionId = A) => ({ institutionId, personId: actor, personName: 'Direção', identityEmail: null, membershipId: randomUUID(), institutionName: 'A', institutionSlug: 'a', role });
async function draft(version: number, code = `document-${version}`) {
  const id = randomUUID();
  await pool.query("INSERT INTO enrollment_document_policies(id,institution_id,offer_id,version,status,created_by) VALUES($1,$2,$3,$4,'draft',$5)", [id, A, offer, version, actor]);
  await pool.query("INSERT INTO enrollment_document_requirements(institution_id,policy_id,document_type,requirement_code,requirement_label,required) VALUES($1,$2,$3,$4,$5,true)", [A, id, `Documento ${version}`, code, `Documento ${version}`]);
  return id;
}
async function policyState(id: string) { return (await pool.query('SELECT status FROM enrollment_document_policies WHERE id=$1', [id])).rows[0].status as string; }

try {
  for (const name of (await readdir('src/db/migrations')).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort()) await pool.query(await readFile(`src/db/migrations/${name}`, 'utf8'));
  await pool.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'A','s04-publication-a','active'),($2,'B','s04-publication-b','active')", [A, B]);
  await pool.query('INSERT INTO people(id,name) VALUES($1,$2)', [actor, 'Direção']);
  await pool.query("INSERT INTO academic_years(id,institution_id,name,starts_on,ends_on,status) VALUES($1,$2,'2026/2027','2026-09-01','2027-07-31','active')", [year, A]);
  await pool.query("INSERT INTO enrollment_offers(id,institution_id,academic_year_id,name,code,status) VALUES($1,$2,$3,'Oferta','S04-P','active')", [offer, A, year]);

  const v1 = await draft(1, 'identity');
  const first = await publishEnrollmentDocumentPolicy(pool, ctx(), v1);
  ok(first.status === 'active' && !first.replayed && first.version === 1, 'Draft publication must activate version 1.');
  ok(await policyState(v1) === 'active', 'Published draft must be active.');
  const replay = await publishEnrollmentDocumentPolicy(pool, ctx(), v1);
  ok(replay.replayed && (await pool.query("SELECT count(*)::int AS count FROM enrollment_document_policy_events WHERE policy_id=$1 AND event_type='policy_published'", [v1])).rows[0].count === 1, 'Publishing an active policy must replay without another publication event.');
  let immutable = false; try { await pool.query("UPDATE enrollment_document_requirements SET requirement_label='Alterado' WHERE policy_id=$1", [v1]); } catch (error: any) { immutable = error?.code === '55000'; }
  ok(immutable, 'Active policy requirements must not be directly editable.');

  const oldEnrollment = await executeEnrollmentIntake(pool, { institutionId: A, actorPersonId: actor, offerId: offer, idempotencyKey: `old-${randomUUID()}`, person: { kind: 'new_person', name: 'Histórico' } });
  const v2 = await draft(2, 'proof'); const published2 = await publishEnrollmentDocumentPolicy(pool, ctx('institution_admin'), v2);
  ok(!published2.replayed && await policyState(v1) === 'retired' && await policyState(v2) === 'active', 'Publication must retire the previous active policy atomically.');
  ok((await pool.query('SELECT document_policy_id FROM enrollment_applications WHERE id=$1', [oldEnrollment.enrollmentApplicationId])).rows[0].document_policy_id === v1, 'Existing enrollment must retain its earlier policy link.');
  const newEnrollment = await executeEnrollmentIntake(pool, { institutionId: A, actorPersonId: actor, offerId: offer, idempotencyKey: `new-${randomUUID()}`, person: { kind: 'new_person', name: 'Novo' } });
  ok((await pool.query('SELECT document_policy_id FROM enrollment_applications WHERE id=$1', [newEnrollment.enrollmentApplicationId])).rows[0].document_policy_id === v2, 'New enrollment must capture the newly active policy.');
  ok((await pool.query('SELECT requirement_code FROM enrollment_documents WHERE enrollment_application_id=$1', [oldEnrollment.enrollmentApplicationId])).rows[0].requirement_code === 'identity', 'Earlier requirement snapshot must remain unchanged.');

  const rollback = await draft(3, 'rollback');
  await assert.rejects(() => publishEnrollmentDocumentPolicy(pool, ctx(), rollback, { failAfter: 'retire' }));
  ok(await policyState(v2) === 'active' && await policyState(rollback) === 'draft', 'Failure after retirement must roll back both statuses.');
  await assert.rejects(() => publishEnrollmentDocumentPolicy(pool, ctx(), rollback, { failAfter: 'activate' }));
  ok(await policyState(v2) === 'active' && await policyState(rollback) === 'draft', 'Failure after activation must roll back both statuses.');
  await assert.rejects(() => publishEnrollmentDocumentPolicy(pool, ctx(), rollback, { failAfter: 'event' }));
  ok((await pool.query("SELECT count(*)::int AS count FROM enrollment_document_policy_events WHERE policy_id=$1 AND event_type='policy_published'", [rollback])).rows[0].count === 0 && await policyState(v2) === 'active', 'Event failure must roll back policy publication.');

  await assert.rejects(() => publishEnrollmentDocumentPolicy(pool, ctx('secretariat'), rollback));
  ok(await policyState(rollback) === 'draft', 'Secretariat must not publish a draft.');
  await assert.rejects(() => publishEnrollmentDocumentPolicy(pool, ctx('director', B), rollback), (error: any) => error.code === 'NOT_FOUND');
  ok(await policyState(rollback) === 'draft', 'Other institution must fail closed without changing policy.');

  await publishEnrollmentDocumentPolicy(pool, ctx(), rollback);
  const concurrent = await draft(4, 'concurrent');
  const results = await Promise.all([publishEnrollmentDocumentPolicy(pool, ctx(), concurrent), publishEnrollmentDocumentPolicy(pool, ctx(), concurrent)]);
  const activeCount = await pool.query("SELECT count(*)::int AS count FROM enrollment_document_policies WHERE institution_id=$1 AND offer_id=$2 AND status='active'", [A, offer]);
  ok(results.every((result) => result.status === 'active') && results.filter((result) => !result.replayed).length === 1 && activeCount.rows[0].count === 1, 'Concurrent publication replay must serialize and leave exactly one active policy.');
  console.log(`[S04-POLICY-PUBLICATION-POSTGRES] passed (${assertions} assertions).`);
} finally { await pool.end(); await bootstrap.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`); await bootstrap.end(); }
