import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeEnrollmentIntake } from '../src/modules/enrollments/enrollment-intake.ts';
import { captureEnrollmentDocumentPolicy } from '../src/modules/enrollments/enrollment-document-snapshot.ts';
import { documentValidationGate } from '../src/modules/enrollments/enrollment-document-requirement-policy.ts';

const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString || connectionString === process.env.DATABASE_URL?.trim() || process.env.TEST_DATABASE_CONFIRMATION !== 'NEXUS_TEST_DATABASE') {
  throw new Error('Dedicated confirmed TEST_DATABASE_URL is required for the S04 PostgreSQL test.');
}

const schema = `nexus_s04_snapshot_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const schemaId = `"${schema}"`;
const bootstrap = new pg.Pool({ connectionString });
await bootstrap.query(`CREATE SCHEMA ${schemaId}`);
const pool = new pg.Pool({ connectionString, options: `-c search_path=${schema},public`, max: 4 });
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
let assertions = 0;
const assert = (condition: unknown, message: string) => { assertions += 1; if (!condition) throw new Error(message); };

async function expectForeignKey(action: () => Promise<unknown>, message: string) {
  let rejected = false;
  try { await action(); } catch (error: any) { rejected = error?.code === '23503'; }
  assert(rejected, message);
}

try {
  for (const name of (await readdir(migrationsDir)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort()) {
    await pool.query(await readFile(path.join(migrationsDir, name), 'utf8'));
  }

  const ids = {
    institutionA: randomUUID(), institutionB: randomUUID(), actor: randomUUID(),
    yearA: randomUUID(), yearB: randomUUID(), offerA: randomUUID(), offerB: randomUUID(),
    policyA1: randomUUID(), policyB1: randomUUID(), requirementB: randomUUID(),
  };
  await pool.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Escola A','s04-a','active'),($2,'Escola B','s04-b','active')", [ids.institutionA, ids.institutionB]);
  await pool.query("INSERT INTO people(id,name) VALUES($1,'Direção S04')", [ids.actor]);
  await pool.query("INSERT INTO academic_years(id,institution_id,name,starts_on,ends_on,status) VALUES($1,$2,'2026/2027','2026-09-01','2027-07-31','active'),($3,$4,'2026/2027','2026-09-01','2027-07-31','active')", [ids.yearA, ids.institutionA, ids.yearB, ids.institutionB]);
  await pool.query("INSERT INTO enrollment_offers(id,institution_id,academic_year_id,name,code,status) VALUES($1,$2,$3,'Oferta A','S04-A','active'),($4,$5,$6,'Oferta B','S04-B','active')", [ids.offerA, ids.institutionA, ids.yearA, ids.offerB, ids.institutionB, ids.yearB]);

  await expectForeignKey(
    () => pool.query("INSERT INTO enrollment_document_policies(id,institution_id,offer_id,version,status,created_by) VALUES($1,$2,$3,1,'draft',$4)", [randomUUID(), ids.institutionA, ids.offerB, ids.actor]),
    'A policy must not reference an offer from another institution.',
  );
  await pool.query("INSERT INTO enrollment_document_policies(id,institution_id,offer_id,version,status,created_by) VALUES($1,$2,$3,1,'draft',$4),($5,$6,$7,1,'draft',$4)", [ids.policyA1, ids.institutionA, ids.offerA, ids.actor, ids.policyB1, ids.institutionB, ids.offerB]);
  const requirementA = randomUUID();
  await pool.query("INSERT INTO enrollment_document_requirements(id,institution_id,policy_id,document_type,requirement_code,requirement_label,required,sort_order) VALUES($1,$2,$3,'Identificação','identity','Documento de identificação',true,1)", [requirementA, ids.institutionA, ids.policyA1]);
  await pool.query("INSERT INTO enrollment_document_requirements(id,institution_id,policy_id,document_type,requirement_code,requirement_label,required,sort_order) VALUES($1,$2,$3,'Documento B','b-document','Documento B',true,1)", [ids.requirementB, ids.institutionB, ids.policyB1]);
  await expectForeignKey(
    () => pool.query("INSERT INTO enrollment_document_requirements(institution_id,policy_id,document_type,requirement_code,requirement_label) VALUES($1,$2,'Estrangeiro','foreign','Documento estrangeiro')", [ids.institutionB, ids.policyA1]),
    'A requirement must not reference a policy from another institution.',
  );
  await pool.query("UPDATE enrollment_document_policies SET status='active', activated_at=now() WHERE id=$1", [ids.policyA1]);

  const first = await executeEnrollmentIntake(pool as any, {
    institutionId: ids.institutionA, actorPersonId: ids.actor, offerId: ids.offerA,
    idempotencyKey: `s04-first-${randomUUID()}`, person: { kind: 'new_person', name: 'Aluno Histórico' },
  });
  await expectForeignKey(
    () => pool.query('UPDATE enrollment_applications SET document_policy_id=$1 WHERE id=$2', [ids.policyB1, first.enrollmentApplicationId]),
    'An enrollment must not capture a document policy from another institution.',
  );
  const initialSnapshot = await pool.query<{ document_type: string; requirement_code: string; requirement_label: string; requirement_type: string; required: boolean; source_requirement_id: string | null }>(
    'SELECT document_type,requirement_code,requirement_label,requirement_type,required,source_requirement_id FROM enrollment_documents WHERE enrollment_application_id=$1', [first.enrollmentApplicationId],
  );
  assert(initialSnapshot.rowCount === 1, 'The active policy must materialize one enrollment requirement.');
  assert(initialSnapshot.rows[0].document_type === 'Identificação' && initialSnapshot.rows[0].requirement_code === 'identity' && initialSnapshot.rows[0].requirement_label === 'Documento de identificação' && initialSnapshot.rows[0].requirement_type === 'document' && initialSnapshot.rows[0].required, 'The materialized snapshot must freeze code, label, type, required and document type.');
  await expectForeignKey(
    () => pool.query('UPDATE enrollment_documents SET source_requirement_id=$1 WHERE enrollment_application_id=$2', [ids.requirementB, first.enrollmentApplicationId]),
    'A snapshot must not reference a source requirement from another institution.',
  );

  await pool.query("UPDATE enrollment_document_policies SET status='retired' WHERE id=$1", [ids.policyA1]);
  await pool.query("UPDATE enrollment_document_requirements SET document_type='Passaporte', requirement_code='passport', requirement_label='Passaporte atualizado', required=false WHERE id=$1", [requirementA]);
  const unchanged = await pool.query<{ document_type: string; requirement_code: string; requirement_label: string; required: boolean }>('SELECT document_type,requirement_code,requirement_label,required FROM enrollment_documents WHERE enrollment_application_id=$1', [first.enrollmentApplicationId]);
  assert(JSON.stringify(unchanged.rows[0]) === JSON.stringify({ document_type: 'Identificação', requirement_code: 'identity', requirement_label: 'Documento de identificação', required: true }), 'Editing the source requirement must not alter an existing enrollment snapshot.');
  await pool.query('DELETE FROM enrollment_document_requirements WHERE id=$1', [requirementA]);
  const afterSourceRemoval = await pool.query<{ requirement_code: string; requirement_label: string; requirement_type: string; source_requirement_id: string | null }>('SELECT requirement_code,requirement_label,requirement_type,source_requirement_id FROM enrollment_documents WHERE enrollment_application_id=$1', [first.enrollmentApplicationId]);
  assert(afterSourceRemoval.rows[0].source_requirement_id === null && afterSourceRemoval.rows[0].requirement_code === 'identity' && afterSourceRemoval.rows[0].requirement_label === 'Documento de identificação' && afterSourceRemoval.rows[0].requirement_type === 'document', 'Removing a source requirement must retain its historical enrollment meaning.');
  const futurePolicy = randomUUID();
  await pool.query("INSERT INTO enrollment_document_policies(id,institution_id,offer_id,version,status,created_by) VALUES($1,$2,$3,2,'draft',$4)", [futurePolicy, ids.institutionA, ids.offerA, ids.actor]);
  await pool.query('DELETE FROM enrollment_document_policies WHERE id=$1', [futurePolicy]);
  const stillHistorical = await pool.query('SELECT 1 FROM enrollment_documents WHERE enrollment_application_id=$1 AND requirement_code=$2', [first.enrollmentApplicationId, 'identity']);
  assert(stillHistorical.rowCount === 1, 'Retiring or removing a future policy must not destroy historical document snapshots.');

  const policyA2 = randomUUID();
  const requirementA2 = randomUUID();
  await pool.query("INSERT INTO enrollment_document_policies(id,institution_id,offer_id,version,status,created_by) VALUES($1,$2,$3,3,'draft',$4)", [policyA2, ids.institutionA, ids.offerA, ids.actor]);
  await pool.query("INSERT INTO enrollment_document_requirements(id,institution_id,policy_id,document_type,requirement_code,requirement_label,required,sort_order) VALUES($1,$2,$3,'Comprovativo','proof','Comprovativo de morada',true,1)", [requirementA2, ids.institutionA, policyA2]);
  await pool.query("UPDATE enrollment_document_policies SET status='active', activated_at=now() WHERE id=$1", [policyA2]);
  const second = await executeEnrollmentIntake(pool as any, {
    institutionId: ids.institutionA, actorPersonId: ids.actor, offerId: ids.offerA,
    idempotencyKey: `s04-second-${randomUUID()}`, person: { kind: 'new_person', name: 'Aluno Atual' },
  });
  const secondDoc = await pool.query<{ id: string; status: string; requirement_code: string }>('SELECT id,status,requirement_code FROM enrollment_documents WHERE enrollment_application_id=$1', [second.enrollmentApplicationId]);
  assert(secondDoc.rowCount === 1 && secondDoc.rows[0].requirement_code === 'proof', 'A new enrollment must capture the current policy requirement snapshot.');
  await pool.query("UPDATE enrollment_documents SET status='verified' WHERE id=$1", [secondDoc.rows[0].id]);
  const withoutFile = documentValidationGate(true, [{ documentType: 'Comprovativo', required: true, status: 'verified', requirementCode: secondDoc.rows[0].requirement_code, physicalFilePersisted: false }]);
  assert(!withoutFile.ready && withoutFile.reason === 'REQUIRED_DOCUMENT_FILES_MISSING', 'Readiness must still require a persisted physical file for a verified snapshot.');
  await pool.query("INSERT INTO enrollment_document_files(institution_id,enrollment_application_id,enrollment_document_id,storage_key,original_filename,content_type,byte_size,sha256,idempotency_key,request_fingerprint,status,persisted_at,uploaded_by) VALUES($1,$2,$3,$4,'teste.pdf','application/pdf',4,$5,'s04-file-key',$5,'persisted',now(),$6)", [ids.institutionA, second.enrollmentApplicationId, secondDoc.rows[0].id, 'a'.repeat(64), 'b'.repeat(64), ids.actor]);
  const withFile = documentValidationGate(true, [{ documentType: 'Comprovativo', required: true, status: 'verified', requirementCode: secondDoc.rows[0].requirement_code, physicalFilePersisted: true }]);
  assert(withFile.ready, 'Readiness must accept a verified immutable snapshot only when its physical file persists.');

  await pool.query("UPDATE enrollment_document_policies SET status='retired' WHERE id=$1", [policyA2]);
  const policyRollback = randomUUID();
  await pool.query("INSERT INTO enrollment_document_policies(id,institution_id,offer_id,version,status,created_by) VALUES($1,$2,$3,4,'draft',$4)", [policyRollback, ids.institutionA, ids.offerA, ids.actor]);
  await pool.query("INSERT INTO enrollment_document_requirements(institution_id,policy_id,document_type,requirement_code,requirement_label,required,sort_order) VALUES($1,$2,'A','a','Documento A',true,1),($1,$2,'B','b','Documento B',true,2)", [ids.institutionA, policyRollback]);
  await pool.query("UPDATE enrollment_document_policies SET status='active', activated_at=now() WHERE id=$1", [policyRollback]);
  const rollbackStudent = randomUUID(); const rollbackEnrollment = randomUUID();
  await pool.query("INSERT INTO people(id,name) VALUES($1,'Aluno Rollback')", [rollbackStudent]);
  await pool.query('INSERT INTO enrollment_applications(id,institution_id,student_person_id,academic_year_id,offer_id,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$6)', [rollbackEnrollment, ids.institutionA, rollbackStudent, ids.yearA, ids.offerA, ids.actor]);
  await pool.query("INSERT INTO enrollment_documents(institution_id,enrollment_application_id,document_type,status) VALUES($1,$2,'B','pending')", [ids.institutionA, rollbackEnrollment]);
  const client = await pool.connect();
  let materializationFailed = false;
  try {
    await client.query('BEGIN');
    await captureEnrollmentDocumentPolicy(client as any, { institutionId: ids.institutionA, offerId: ids.offerA, enrollmentId: rollbackEnrollment });
    await client.query('COMMIT');
  } catch (error: any) {
    materializationFailed = error?.code === '23505';
    await client.query('ROLLBACK');
  } finally { client.release(); }
  assert(materializationFailed, 'A duplicate materialized document must fail deterministically.');
  const rolledBack = await pool.query<{ document_policy_id: string | null; count: string }>('SELECT e.document_policy_id, (SELECT count(*) FROM enrollment_documents d WHERE d.enrollment_application_id=e.id)::text AS count FROM enrollment_applications e WHERE e.id=$1', [rollbackEnrollment]);
  assert(rolledBack.rows[0].document_policy_id === null && rolledBack.rows[0].count === '1', 'A materialization failure must roll back the policy capture and partial snapshot rows.');

  console.log(`[S04-DOCUMENT-SNAPSHOT-POSTGRES] passed (${assertions} assertions).`);
} finally {
  await pool.end();
  await bootstrap.query(`DROP SCHEMA IF EXISTS ${schemaId} CASCADE`);
  await bootstrap.end();
}
