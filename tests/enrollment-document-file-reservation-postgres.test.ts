import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprintEnrollmentDocumentUpload, reserveEnrollmentDocumentUpload } from '../src/modules/enrollments/enrollment-document-file-reservation.ts';

const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString || connectionString === process.env.DATABASE_URL?.trim() || process.env.TEST_DATABASE_CONFIRMATION !== 'NEXUS_TEST_DATABASE') throw new Error('Dedicated confirmed TEST_DATABASE_URL is required.');
const schema = `nexus_document_file_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const schemaId = `"${schema}"`;
const bootstrap = new pg.Pool({ connectionString });
await bootstrap.query(`CREATE SCHEMA ${schemaId}`);
const pool = new pg.Pool({ connectionString, options: `-c search_path=${schema},public` });
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
const ids = { institutionA: randomUUID(), institutionB: randomUUID(), actor: randomUUID(), student: randomUUID(), year: randomUUID(), offer: randomUUID(), enrollment: randomUUID(), document: randomUUID() };
let assertions = 0;
function assert(value: unknown, message: string): asserts value { assertions += 1; if (!value) throw new Error(message); }

async function reserve(idempotencyKey: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await reserveEnrollmentDocumentUpload(client, {
      institutionId: ids.institutionA, enrollmentId: ids.enrollment, documentId: ids.document, actorPersonId: ids.actor, idempotencyKey, filename: 'bi.pdf', contentType: 'application/pdf',
      requestFingerprint: fingerprintEnrollmentDocumentUpload({ institutionId: ids.institutionA, enrollmentId: ids.enrollment, documentId: ids.document, idempotencyKey, filename: 'bi.pdf', contentType: 'application/pdf' }),
    });
    await client.query('COMMIT'); return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

try {
  for (const name of (await readdir(migrationsDir)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort()) await pool.query(await readFile(path.join(migrationsDir, name), 'utf8'));
  await pool.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'A','a','active'),($2,'B','b','active')", [ids.institutionA, ids.institutionB]);
  await pool.query('INSERT INTO people(id,name) VALUES($1,$2),($3,$4)', [ids.actor, 'Operador', ids.student, 'Aluno']);
  await pool.query("INSERT INTO academic_years(id,institution_id,name,starts_on,ends_on,status) VALUES($1,$2,'2026','2026-01-01','2026-12-31','active')", [ids.year, ids.institutionA]);
  await pool.query("INSERT INTO enrollment_offers(id,institution_id,academic_year_id,name,code,status) VALUES($1,$2,$3,'Geral','G','active')", [ids.offer, ids.institutionA, ids.year]);
  await pool.query("INSERT INTO enrollment_applications(id,institution_id,student_person_id,academic_year_id,offer_id,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$6)", [ids.enrollment, ids.institutionA, ids.student, ids.year, ids.offer, ids.actor]);
  await pool.query("INSERT INTO enrollment_documents(id,institution_id,enrollment_application_id,document_type) VALUES($1,$2,$3,'BI')", [ids.document, ids.institutionA, ids.enrollment]);

  const first = await reserve('reservation-key-0001');
  assert(!first.replayed && /^[a-f0-9]{64}$/.test(first.storageKey), 'First reservation must create an opaque storage key.');
  const replay = await reserve('reservation-key-0001');
  assert(replay.replayed && replay.fileId === first.fileId, 'Retry with the same idempotency key must replay the reservation.');
  await pool.query("UPDATE enrollment_document_files SET lease_expires_at = now() - interval '1 second' WHERE id=$1", [first.fileId]);
  const replacement = await reserve('reservation-key-0002');
  assert(!replacement.replayed && replacement.fileId !== first.fileId, 'Expired uploading reservation must not block a new reservation.');
  const expired = await pool.query<{ status: string; failure_reason: string }>('SELECT status,failure_reason FROM enrollment_document_files WHERE id=$1', [first.fileId]);
  assert(expired.rows[0].status === 'failed' && expired.rows[0].failure_reason === 'lease_expired', 'Abandoned reservation must be deterministically retired.');
  await pool.query("UPDATE enrollment_document_files SET status='persisted', lease_expires_at=NULL, persisted_at=now(), byte_size=4, sha256=repeat('a',64) WHERE id=$1", [replacement.fileId]);
  let persistedUnique = false;
  try { await pool.query("INSERT INTO enrollment_document_files(id,institution_id,enrollment_application_id,enrollment_document_id,storage_key,original_filename,content_type,byte_size,sha256,idempotency_key,request_fingerprint,status,persisted_at,uploaded_by) VALUES(gen_random_uuid(),$1,$2,$3,repeat('b',64),'x.pdf','application/pdf',1,repeat('b',64),'reservation-key-0003',repeat('b',64),'persisted',now(),$4)", [ids.institutionA, ids.enrollment, ids.document, ids.actor]); } catch (error: any) { persistedUnique = error?.code === '23505'; }
  assert(persistedUnique, 'Database must enforce one persisted physical file per document.');
  let crossInstitutionRejected = false;
  try { await pool.query("INSERT INTO enrollment_document_files(id,institution_id,enrollment_application_id,enrollment_document_id,storage_key,original_filename,content_type,idempotency_key,request_fingerprint,status,lease_expires_at,uploaded_by) VALUES(gen_random_uuid(),$1,$2,$3,repeat('c',64),'x.pdf','application/pdf','reservation-key-0004',repeat('c',64),'uploading',now()+interval '1 minute',$4)", [ids.institutionB, ids.enrollment, ids.document, ids.actor]); } catch (error: any) { crossInstitutionRejected = error?.code === '23503'; }
  assert(crossInstitutionRejected, 'Composite foreign keys must reject mismatched institution, enrollment and document.');
  const bytesColumn = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_schema=$1 AND table_name='enrollment_document_files' AND column_name='content'", [schema]);
  assert(bytesColumn.rowCount === 0, 'PostgreSQL metadata table must not contain document bytes.');
  console.log(`[ENROLLMENT-DOCUMENT-FILE-RESERVATION-POSTGRES] passed (${assertions} assertions).`);
} finally { await pool.end(); await bootstrap.query(`DROP SCHEMA IF EXISTS ${schemaId} CASCADE`); await bootstrap.end(); }
