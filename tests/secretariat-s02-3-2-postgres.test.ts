import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeEnrollmentIntake } from '../src/modules/enrollments/enrollment-intake.ts';

const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString) throw new Error('TEST_DATABASE_URL is required for S02.3.2 PostgreSQL test.');
const { Pool } = pg;
const schema = `nexus_s0232_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const schemaId = `"${schema}"`;
const bootstrap = new Pool({ connectionString });
await bootstrap.query(`CREATE SCHEMA ${schemaId}`);
const pool = new Pool({ connectionString, options: `-c search_path=${schema},public`, max: 4 });
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
let assertions = 0;
const assert = (condition: unknown, message: string) => { assertions += 1; if (!condition) throw new Error(message); };

try {
  const migrations = (await readdir(migrationsDir)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  const migrationPool = new Pool({ connectionString, options: `-c search_path=${schema}` });
  try {
    for (const filename of migrations) await migrationPool.query(await readFile(path.join(migrationsDir, filename), 'utf8'));
  } finally {
    await migrationPool.end();
  }

  const institution = randomUUID();
  const actor = randomUUID();
  const year = randomUUID();
  const offer = randomUUID();
  await pool.query("INSERT INTO institutions (id,name,slug,status) VALUES ($1,'Escola S0232','s0232','active')", [institution]);
  await pool.query("INSERT INTO people (id,name) VALUES ($1,'Diretor S0232')", [actor]);
  await pool.query("INSERT INTO academic_years (id,institution_id,name,starts_on,ends_on,status) VALUES ($1,$2,'2026/2027','2026-09-01','2027-07-31','active')", [year, institution]);
  await pool.query("INSERT INTO enrollment_offers (id,institution_id,academic_year_id,name,code,status) VALUES ($1,$2,$3,'Geral','S0232','active')", [offer, institution, year]);

  const v1 = randomUUID();
  await pool.query("INSERT INTO enrollment_document_policies (id,institution_id,offer_id,version,status,created_by,activated_at) VALUES ($1,$2,$3,1,'active',$4,now())", [v1, institution, offer, actor]);
  await pool.query("INSERT INTO enrollment_document_requirements (institution_id,policy_id,document_type,required,sort_order) VALUES ($1,$2,'BI',true,1),($1,$2,'Foto',false,2)", [institution, v1]);

  const first = await executeEnrollmentIntake(pool as any, { institutionId: institution, actorPersonId: actor, offerId: offer, idempotencyKey: `s0232-first-${randomUUID()}`, person: { kind: 'new_person', name: 'Aluno Um' } });
  const firstApp = await pool.query('SELECT document_policy_id FROM enrollment_applications WHERE id=$1', [first.enrollmentApplicationId]);
  assert(firstApp.rows[0].document_policy_id === v1, 'First enrollment must capture active policy v1.');
  const firstDocs = await pool.query('SELECT document_type,required,status FROM enrollment_documents WHERE enrollment_application_id=$1 ORDER BY document_type', [first.enrollmentApplicationId]);
  assert(firstDocs.rows.length === 2, 'Policy v1 requirements must materialize in enrollment snapshot.');
  assert(firstDocs.rows.some((row) => row.document_type === 'BI' && row.required === true && row.status === 'pending'), 'Required metadata must be preserved in snapshot.');
  assert(firstDocs.rows.some((row) => row.document_type === 'Foto' && row.required === false), 'Optional metadata must be preserved in snapshot.');

  await pool.query("UPDATE enrollment_document_policies SET status='retired' WHERE id=$1", [v1]);
  const v2 = randomUUID();
  await pool.query("INSERT INTO enrollment_document_policies (id,institution_id,offer_id,version,status,created_by,activated_at) VALUES ($1,$2,$3,2,'active',$4,now())", [v2, institution, offer, actor]);
  await pool.query("INSERT INTO enrollment_document_requirements (institution_id,policy_id,document_type,required,sort_order) VALUES ($1,$2,'Certificado',true,1)", [institution, v2]);

  const firstAfter = await pool.query('SELECT document_policy_id FROM enrollment_applications WHERE id=$1', [first.enrollmentApplicationId]);
  assert(firstAfter.rows[0].document_policy_id === v1, 'Changing offer policy must not rewrite historical enrollment snapshot.');

  const second = await executeEnrollmentIntake(pool as any, { institutionId: institution, actorPersonId: actor, offerId: offer, idempotencyKey: `s0232-second-${randomUUID()}`, person: { kind: 'new_person', name: 'Aluno Dois' } });
  const secondApp = await pool.query('SELECT document_policy_id FROM enrollment_applications WHERE id=$1', [second.enrollmentApplicationId]);
  assert(secondApp.rows[0].document_policy_id === v2, 'New enrollment must capture policy v2.');
  const secondDocs = await pool.query('SELECT document_type FROM enrollment_documents WHERE enrollment_application_id=$1', [second.enrollmentApplicationId]);
  assert(secondDocs.rows.length === 1 && secondDocs.rows[0].document_type === 'Certificado', 'New version must materialize only its own requirements.');

  await pool.query("UPDATE enrollment_document_policies SET status='retired' WHERE id=$1", [v2]);
  const third = await executeEnrollmentIntake(pool as any, { institutionId: institution, actorPersonId: actor, offerId: offer, idempotencyKey: `s0232-third-${randomUUID()}`, person: { kind: 'new_person', name: 'Aluno Tres' } });
  const thirdApp = await pool.query('SELECT document_policy_id FROM enrollment_applications WHERE id=$1', [third.enrollmentApplicationId]);
  assert(thirdApp.rows[0].document_policy_id === null, 'Enrollment without active policy must remain explicitly uncaptured.');

  console.log(`[S02.3.2-POSTGRES] passed (${assertions} assertions).`);
} finally {
  await pool.end();
  await bootstrap.query(`DROP SCHEMA IF EXISTS ${schemaId} CASCADE`);
  await bootstrap.end();
}
