import { createHash, randomUUID } from 'node:crypto';
import { createEnrollmentDocumentStorageKey } from './enrollment-document-storage.ts';

export const ENROLLMENT_DOCUMENT_UPLOAD_LEASE_MS = 15 * 60 * 1000;

export interface EnrollmentDocumentReservationClient {
  query<T = any>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
}

export class EnrollmentDocumentReservationError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'CONFLICT' | 'IDEMPOTENCY_KEY_REUSED', message: string) {
    super(message);
    this.name = 'EnrollmentDocumentReservationError';
  }
}

export function fingerprintEnrollmentDocumentUpload(input: { institutionId: string; enrollmentId: string; documentId: string; idempotencyKey: string; filename: string; contentType: string }): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

export async function reserveEnrollmentDocumentUpload(
  client: EnrollmentDocumentReservationClient,
  input: { institutionId: string; enrollmentId: string; documentId: string; actorPersonId: string; idempotencyKey: string; requestFingerprint: string; filename: string; contentType: string; now?: Date },
): Promise<{ fileId: string; storageKey: string; leaseExpiresAt: Date; replayed: boolean }> {
  const now = input.now ?? new Date();
  const leaseExpiresAt = new Date(now.getTime() + ENROLLMENT_DOCUMENT_UPLOAD_LEASE_MS);
  const locked = await client.query<{ id: string; enrollment_status: string; document_status: string }>(
    `SELECT d.id, e.status AS enrollment_status, d.status AS document_status
       FROM enrollment_documents d
       INNER JOIN enrollment_applications e ON e.id = d.enrollment_application_id AND e.institution_id = d.institution_id
      WHERE d.id = $1 AND d.enrollment_application_id = $2 AND d.institution_id = $3
      FOR UPDATE`,
    [input.documentId, input.enrollmentId, input.institutionId],
  );
  if (!locked.rowCount) throw new EnrollmentDocumentReservationError('NOT_FOUND', 'Documento não encontrado nesta matrícula.');

  await client.query(
    `UPDATE enrollment_document_files
        SET status = 'failed', failure_reason = 'lease_expired', updated_at = $1
      WHERE institution_id = $2 AND enrollment_document_id = $3
        AND status = 'uploading' AND lease_expires_at <= $1`,
    [now, input.institutionId, input.documentId],
  );

  const existing = await client.query<{ id: string; storage_key: string; request_fingerprint: string; status: string; lease_expires_at: Date | null }>(
    `SELECT id, storage_key, request_fingerprint, status, lease_expires_at
       FROM enrollment_document_files
      WHERE institution_id = $1 AND enrollment_document_id = $2 AND idempotency_key = $3
      FOR UPDATE`,
    [input.institutionId, input.documentId, input.idempotencyKey],
  );
  if (existing.rowCount) {
    const row = existing.rows[0];
    if (row.request_fingerprint !== input.requestFingerprint) throw new EnrollmentDocumentReservationError('IDEMPOTENCY_KEY_REUSED', 'A chave de idempotência já foi usada com outro pedido documental.');
    if (row.status === 'uploading' && row.lease_expires_at && row.lease_expires_at > now) return { fileId: row.id, storageKey: row.storage_key, leaseExpiresAt: row.lease_expires_at, replayed: true };
    if (row.status === 'persisted') return { fileId: row.id, storageKey: row.storage_key, leaseExpiresAt: now, replayed: true };
  }

  if (!['draft', 'under_review', 'awaiting_documents', 'blocked'].includes(locked.rows[0].enrollment_status) || !['pending', 'rejected'].includes(locked.rows[0].document_status)) {
    throw new EnrollmentDocumentReservationError('CONFLICT', 'O documento não aceita um novo ficheiro neste estado.');
  }

  const persisted = await client.query<{ id: string }>(
    `SELECT id FROM enrollment_document_files WHERE institution_id = $1 AND enrollment_document_id = $2 AND status = 'persisted' FOR UPDATE`,
    [input.institutionId, input.documentId],
  );
  if (persisted.rowCount) throw new EnrollmentDocumentReservationError('CONFLICT', 'Este documento já possui um ficheiro físico persistido.');

  const fileId = randomUUID();
  const storageKey = createEnrollmentDocumentStorageKey();
  await client.query(
    `INSERT INTO enrollment_document_files (
       id, institution_id, enrollment_application_id, enrollment_document_id, storage_key,
       original_filename, content_type, idempotency_key, request_fingerprint, status,
       lease_expires_at, uploaded_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'uploading', $10, $11)`,
    [fileId, input.institutionId, input.enrollmentId, input.documentId, storageKey, input.filename, input.contentType, input.idempotencyKey, input.requestFingerprint, leaseExpiresAt, input.actorPersonId],
  );
  return { fileId, storageKey, leaseExpiresAt, replayed: false };
}
