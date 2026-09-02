import 'dotenv/config';
import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import {
  addEnrollmentDocument,
  EnrollmentDocumentApiError,
  listEnrollmentDocuments,
  transitionEnrollmentDocument,
  type EnrollmentDocumentPool,
} from '../src/modules/enrollments/enrollment-document-api.ts';

const { Pool } = pg;
const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString) throw new Error('TEST_DATABASE_URL is required for S02.3 PostgreSQL test.');
const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
const schemaName = `nexus_s023_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const schemaIdentifier = `"${schemaName}"`;
const bootstrap = new Pool({ connectionString });
await bootstrap.query(`CREATE SCHEMA ${schemaIdentifier}`);
const pool = new Pool({ connectionString, options: `-c search_path=${schemaName},public`, max: 4 }) as pg.Pool & EnrollmentDocumentPool;

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition { assertions += 1; if (!condition) throw new Error(message); }

const ids = {
  institutionA: randomUUID(), institutionB: randomUUID(), actorA: randomUUID(), actorB: randomUUID(), studentA: randomUUID(),
  yearA: randomUUID(), offerA: randomUUID(), enrollmentA: randomUUID(),
};
function context(institutionId: string, personId: string, slug: string): InstitutionalContext {
  return { personId, personName: 'Secretaria', identityEmail: null, membershipId: randomUUID(), institutionId, institutionName: slug, institutionSlug: slug, role: 'secretariat' };
}
const contextA = context(ids.institutionA, ids.actorA, 'escola-a');
const contextB = context(ids.institutionB, ids.actorB, 'escola-b');

try {
  const migrations = (await readdir(migrationsDirectory)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  const migrationPool = new Pool({ connectionString, options: `-c search_path=${schemaName}` });
  try {
    for (const filename of migrations) await migrationPool.query(await readFile(path.join(migrationsDirectory, filename), 'utf8'));
  } finally {
    await migrationPool.end();
  }
  await pool.query("INSERT INTO institutions (id,name,slug,status) VALUES ($1,'Escola A','escola-a','active'),($2,'Escola B','escola-b','active')", [ids.institutionA, ids.institutionB]);
  await pool.query("INSERT INTO people (id,name) VALUES ($1,'Secretaria A'),($2,'Secretaria B'),($3,'Aluno A')", [ids.actorA, ids.actorB, ids.studentA]);
  await pool.query("INSERT INTO academic_years (id,institution_id,name,starts_on,ends_on,status) VALUES ($1,$2,'2026/2027','2026-09-01','2027-07-31','active')", [ids.yearA, ids.institutionA]);
  await pool.query("INSERT INTO enrollment_offers (id,institution_id,academic_year_id,name,code,status) VALUES ($1,$2,$3,'Geral','GERAL-S023','active')", [ids.offerA, ids.institutionA, ids.yearA]);
  await pool.query("INSERT INTO enrollment_applications (id,institution_id,student_person_id,academic_year_id,offer_id,status,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,'under_review',$6,$6)", [ids.enrollmentA, ids.institutionA, ids.studentA, ids.yearA, ids.offerA, ids.actorA]);

  const created = await addEnrollmentDocument(pool, contextA, { enrollmentId: ids.enrollmentA, documentType: 'Certificado escolar' });
  assert(created.document.status === 'pending' && created.replayed === false, 'New checklist item must start pending.');
  const replay = await addEnrollmentDocument(pool, contextA, { enrollmentId: ids.enrollmentA, documentType: 'Certificado escolar' });
  assert(replay.document.id === created.document.id && replay.replayed === true, 'Duplicate document type must replay idempotently.');
  const listed = await listEnrollmentDocuments(pool, contextA, ids.enrollmentA);
  assert(listed.documents.length === 1, 'Institution must list its document exactly once.');

  let crossInstitutionBlocked = false;
  try { await listEnrollmentDocuments(pool, contextB, ids.enrollmentA); } catch (error) { crossInstitutionBlocked = error instanceof EnrollmentDocumentApiError && error.code === 'NOT_FOUND'; }
  assert(crossInstitutionBlocked, 'Cross-institution document listing must fail closed.');

  let evidenceRequired = false;
  try { await transitionEnrollmentDocument(pool, contextA, { enrollmentId: ids.enrollmentA, documentId: created.document.id, toStatus: 'submitted' }); }
  catch (error) { evidenceRequired = error instanceof EnrollmentDocumentApiError && error.code === 'INVALID_INPUT'; }
  assert(evidenceRequired, 'Submitted document must require evidence reference.');

  const submitted = await transitionEnrollmentDocument(pool, contextA, { enrollmentId: ids.enrollmentA, documentId: created.document.id, toStatus: 'submitted', evidenceReference: 'arquivo/teste/certificado' });
  assert(submitted.status === 'submitted' && submitted.evidence_reference === 'arquivo/teste/certificado', 'Submission must persist evidence reference.');
  const verified = await transitionEnrollmentDocument(pool, contextA, { enrollmentId: ids.enrollmentA, documentId: created.document.id, toStatus: 'verified' });
  assert(verified.status === 'verified' && verified.verified_by === ids.actorA, 'Verification must persist verifier.');

  let verifiedTerminal = false;
  try { await transitionEnrollmentDocument(pool, contextA, { enrollmentId: ids.enrollmentA, documentId: created.document.id, toStatus: 'submitted', evidenceReference: 'outro' }); }
  catch (error) { verifiedTerminal = error instanceof EnrollmentDocumentApiError && error.code === 'INVALID_TRANSITION'; }
  assert(verifiedTerminal, 'Verified document must be terminal in S02.3.1.');

  const events = await pool.query<{ event_type: string }>('SELECT event_type FROM enrollment_events WHERE enrollment_application_id = $1 ORDER BY created_at', [ids.enrollmentA]);
  assert(events.rows.filter((row) => row.event_type === 'document_added').length === 1, 'Document addition must be audited once.');
  assert(events.rows.filter((row) => row.event_type === 'document_status_changed').length === 2, 'Document transitions must be audited.');

  await pool.query("UPDATE enrollment_applications SET status='validated' WHERE id=$1", [ids.enrollmentA]);
  let validatedImmutable = false;
  try { await addEnrollmentDocument(pool, contextA, { enrollmentId: ids.enrollmentA, documentType: 'Novo documento' }); }
  catch (error) { validatedImmutable = error instanceof EnrollmentDocumentApiError && error.code === 'FORBIDDEN'; }
  assert(validatedImmutable, 'Validated application must reject document mutation.');

  console.log(`[S02.3-DOCUMENT-POSTGRES] passed (${assertions} assertions).`);
} finally {
  await pool.end();
  await bootstrap.query(`DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE`);
  await bootstrap.end();
}
