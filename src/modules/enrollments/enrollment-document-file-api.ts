import { createHash } from 'node:crypto';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import { canManageEnrollment, type EnrollmentStatus } from './enrollment-policy.ts';
import { canManageEnrollmentDocuments } from './enrollment-document-policy.ts';
import { isEnrollmentDocumentContentType, type EnrollmentDocumentContentType, type EnrollmentDocumentStorage } from './enrollment-document-storage.ts';
import { EnrollmentDocumentReservationError, fingerprintEnrollmentDocumentUpload, reserveEnrollmentDocumentUpload } from './enrollment-document-file-reservation.ts';
import type { EnrollmentDocumentPool } from './enrollment-document-api.ts';

export class EnrollmentDocumentFileApiError extends Error {
  constructor(public readonly code: 'INVALID_INPUT' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'STORAGE_FAILURE' | 'PERSISTENCE_FAILURE', message: string) { super(message); }
}
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const max = 6 * 1024 * 1024;
async function* bytes(value: Buffer): AsyncIterable<Uint8Array> { yield value; }

function validate(input: { enrollmentId: unknown; documentId: unknown; filename: unknown; contentType: unknown; idempotencyKey: unknown; body: unknown }) {
  if (!uuid(input.enrollmentId) || !uuid(input.documentId)) throw new EnrollmentDocumentFileApiError('INVALID_INPUT', 'Documento ou matrícula inválido.');
  if (typeof input.filename !== 'string' || !input.filename.trim() || input.filename.length > 255) throw new EnrollmentDocumentFileApiError('INVALID_INPUT', 'Nome de ficheiro inválido.');
  if (!isEnrollmentDocumentContentType(input.contentType)) throw new EnrollmentDocumentFileApiError('INVALID_INPUT', 'São aceites apenas PDF, JPG ou PNG.');
  if (typeof input.idempotencyKey !== 'string' || input.idempotencyKey.trim().length < 8 || input.idempotencyKey.trim().length > 160) throw new EnrollmentDocumentFileApiError('INVALID_INPUT', 'Idempotency-Key é obrigatório.');
  if (!Buffer.isBuffer(input.body) || !input.body.length || input.body.length > max) throw new EnrollmentDocumentFileApiError('INVALID_INPUT', 'O ficheiro é inválido ou excede 6 MB.');
  const signatureValid = input.contentType === 'application/pdf'
    ? input.body.subarray(0, 5).equals(Buffer.from('%PDF-'))
    : input.contentType === 'image/jpeg'
      ? input.body.length >= 3 && input.body[0] === 0xff && input.body[1] === 0xd8 && input.body[2] === 0xff
      : input.body.length >= 8 && input.body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!signatureValid) throw new EnrollmentDocumentFileApiError('INVALID_INPUT', 'O conteúdo não corresponde ao tipo de ficheiro declarado.');
  return { enrollmentId: input.enrollmentId, documentId: input.documentId, filename: input.filename.trim(), contentType: input.contentType, idempotencyKey: input.idempotencyKey.trim(), body: input.body };
}

export async function uploadEnrollmentDocumentFile(pool: EnrollmentDocumentPool, storage: EnrollmentDocumentStorage, context: InstitutionalContext, input: { enrollmentId: unknown; documentId: unknown; filename: unknown; contentType: unknown; idempotencyKey: unknown; body: unknown }) {
  const value = validate(input);
  if (!canManageEnrollment(context.role)) throw new EnrollmentDocumentFileApiError('FORBIDDEN', 'O seu papel não pode anexar documentos de matrícula.');
  const sha256 = createHash('sha256').update(value.body).digest('hex');
  const fingerprint = fingerprintEnrollmentDocumentUpload({ institutionId: context.institutionId, enrollmentId: value.enrollmentId, documentId: value.documentId, idempotencyKey: value.idempotencyKey, filename: value.filename, contentType: `${value.contentType}:${sha256}` });
  const client = await pool.connect();
  let reservation: Awaited<ReturnType<typeof reserveEnrollmentDocumentUpload>> | null = null;
  try {
    await client.query('BEGIN');
    reservation = await reserveEnrollmentDocumentUpload(client, { institutionId: context.institutionId, enrollmentId: value.enrollmentId, documentId: value.documentId, actorPersonId: context.personId, idempotencyKey: value.idempotencyKey, requestFingerprint: fingerprint, filename: value.filename, contentType: value.contentType });
    if (reservation.replayed) {
      const replay = await client.query<{ status: string; original_filename: string; content_type: string; byte_size: number | null; sha256: string | null }>('SELECT status,original_filename,content_type,byte_size,sha256 FROM enrollment_document_files WHERE id=$1 AND institution_id=$2', [reservation.fileId, context.institutionId]);
      if (replay.rows[0]?.status === 'persisted') { await client.query('COMMIT'); return { file: { id: reservation.fileId, filename: replay.rows[0].original_filename, contentType: replay.rows[0].content_type, byteSize: replay.rows[0].byte_size, sha256: replay.rows[0].sha256 }, replayed: true }; }
      await client.query('COMMIT');
      throw new EnrollmentDocumentFileApiError('CONFLICT', 'O upload com esta Idempotency-Key ainda está em curso.');
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof EnrollmentDocumentReservationError) throw new EnrollmentDocumentFileApiError(error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'CONFLICT', error.message);
    throw error;
  } finally { client.release(); }

  let physicalPersisted = false;
  try {
    const stored = await storage.put({ storageKey: reservation!.storageKey, contentType: value.contentType as EnrollmentDocumentContentType, content: bytes(value.body) });
    if (stored.sha256 !== sha256 || stored.byteSize !== value.body.length) throw new EnrollmentDocumentFileApiError('STORAGE_FAILURE', 'A integridade do ficheiro persistido não pôde ser confirmada.');
    physicalPersisted = true;
    const finalize = await pool.connect();
    try {
      await finalize.query('BEGIN');
      const persisted = await finalize.query<{ id: string }>(
        `UPDATE enrollment_document_files SET status='persisted', lease_expires_at=NULL, persisted_at=now(), byte_size=$1, sha256=$2, updated_at=now()
          WHERE id=$3 AND institution_id=$4 AND status='uploading' RETURNING id`, [stored.byteSize, stored.sha256, reservation!.fileId, context.institutionId]);
      if (!persisted.rowCount) throw new EnrollmentDocumentFileApiError('CONFLICT', 'A reserva documental já não pode ser concluída.');
      const document = await finalize.query<{ enrollment_status: EnrollmentStatus; document_status: string }>(
        `SELECT e.status AS enrollment_status,d.status AS document_status FROM enrollment_applications e
         JOIN enrollment_documents d ON d.institution_id=e.institution_id AND d.enrollment_application_id=e.id
         WHERE e.id=$1 AND e.institution_id=$2 AND d.id=$3 FOR UPDATE OF e,d`,
        [value.enrollmentId, context.institutionId, value.documentId]);
      if (!document.rowCount || !canManageEnrollmentDocuments(context.role, document.rows[0].enrollment_status) || !['pending', 'rejected'].includes(document.rows[0].document_status)) throw new EnrollmentDocumentFileApiError('NOT_FOUND', 'Documento não encontrado nesta matrícula.');
      await finalize.query("UPDATE enrollment_documents SET status='submitted', updated_at=now() WHERE id=$1 AND enrollment_application_id=$2 AND institution_id=$3 AND status IN ('pending','rejected')", [value.documentId, value.enrollmentId, context.institutionId]);
      await finalize.query("INSERT INTO enrollment_events (institution_id,enrollment_application_id,actor_person_id,event_type,metadata) VALUES($1,$2,$3,'document_file_uploaded',$4::jsonb)", [context.institutionId, value.enrollmentId, context.personId, JSON.stringify({ documentId: value.documentId, fileId: reservation!.fileId, filename: value.filename, contentType: value.contentType, byteSize: stored.byteSize, sha256: stored.sha256 })]);
      await finalize.query('COMMIT');
      return { file: { id: reservation!.fileId, filename: value.filename, contentType: value.contentType, byteSize: stored.byteSize, sha256: stored.sha256 }, replayed: false };
    } catch (error) { await finalize.query('ROLLBACK'); throw error; } finally { finalize.release(); }
  } catch (error) {
    let cleanupPending = false;
    try { await storage.delete(reservation!.storageKey); } catch { cleanupPending = true; }
    const cleanup = await pool.connect();
    try { await cleanup.query("UPDATE enrollment_document_files SET status=$1, failure_reason=$2, lease_expires_at=NULL, updated_at=now() WHERE id=$3 AND institution_id=$4 AND status='uploading'", [cleanupPending ? 'cleanup_pending' : 'failed', cleanupPending ? 'storage_cleanup_failed' : 'upload_failed', reservation!.fileId, context.institutionId]); } finally { cleanup.release(); }
    if (error instanceof EnrollmentDocumentFileApiError) throw error;
    throw new EnrollmentDocumentFileApiError(physicalPersisted ? 'PERSISTENCE_FAILURE' : 'STORAGE_FAILURE', physicalPersisted ? 'Não foi possível concluir a persistência documental.' : 'Não foi possível persistir o ficheiro documental.');
  }
}

export async function getEnrollmentDocumentFile(pool: EnrollmentDocumentPool, storage: EnrollmentDocumentStorage, context: InstitutionalContext, enrollmentId: unknown, documentId: unknown) {
  if (!uuid(enrollmentId) || !uuid(documentId) || !canManageEnrollment(context.role)) throw new EnrollmentDocumentFileApiError('NOT_FOUND', 'Ficheiro não encontrado.');
  const result = await pool.query<{ storage_key: string; original_filename: string; content_type: EnrollmentDocumentContentType; byte_size: number; sha256: string }>(
    `SELECT f.storage_key,f.original_filename,f.content_type,f.byte_size,f.sha256 FROM enrollment_document_files f
      WHERE f.institution_id=$1 AND f.enrollment_application_id=$2 AND f.enrollment_document_id=$3 AND f.status='persisted'`, [context.institutionId, enrollmentId, documentId]);
  if (!result.rowCount) throw new EnrollmentDocumentFileApiError('NOT_FOUND', 'Ficheiro não encontrado.');
  try { return { file: { filename: result.rows[0].original_filename, contentType: result.rows[0].content_type, byteSize: result.rows[0].byte_size, sha256: result.rows[0].sha256 }, content: (await storage.open(result.rows[0].storage_key)).content }; }
  catch { throw new EnrollmentDocumentFileApiError('NOT_FOUND', 'Ficheiro não encontrado.'); }
}
