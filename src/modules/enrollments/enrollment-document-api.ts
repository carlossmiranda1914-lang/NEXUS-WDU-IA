import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import type { EnrollmentStatus } from './enrollment-policy.ts';
import { canManageEnrollment } from './enrollment-policy.ts';
import {
  canManageEnrollmentDocuments,
  canTransitionEnrollmentDocument,
  isEnrollmentDocumentStatus,
  validDocumentType,
  validEvidenceReference,
  type EnrollmentDocumentStatus,
} from './enrollment-document-policy.ts';

export interface EnrollmentDocumentQueryResult<T = any> { rows: T[]; rowCount: number | null }
export interface EnrollmentDocumentClient {
  query<T = any>(text: string, values?: unknown[]): Promise<EnrollmentDocumentQueryResult<T>>;
  release(): void;
}
export interface EnrollmentDocumentPool {
  query<T = any>(text: string, values?: unknown[]): Promise<EnrollmentDocumentQueryResult<T>>;
  connect(): Promise<EnrollmentDocumentClient>;
}

export class EnrollmentDocumentApiError extends Error {
  constructor(
    public readonly code: 'INVALID_INPUT' | 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_TRANSITION',
    message: string,
  ) {
    super(message);
    this.name = 'EnrollmentDocumentApiError';
  }
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function listEnrollmentDocuments(pool: EnrollmentDocumentPool, context: InstitutionalContext, enrollmentId: string) {
  if (!validUuid(enrollmentId)) throw new EnrollmentDocumentApiError('INVALID_INPUT', 'Matrícula inválida.');
  if (!canManageEnrollment(context.role)) throw new EnrollmentDocumentApiError('FORBIDDEN', 'O seu papel não pode consultar documentos de matrícula.');
  const application = await pool.query('SELECT id FROM enrollment_applications WHERE id = $1 AND institution_id = $2', [enrollmentId, context.institutionId]);
  if (!application.rowCount) throw new EnrollmentDocumentApiError('NOT_FOUND', 'Matrícula não encontrada nesta instituição.');
  const result = await pool.query(
    `SELECT id, document_type, status, evidence_reference, verified_by, verified_at, created_at, updated_at
       FROM enrollment_documents
      WHERE enrollment_application_id = $1 AND institution_id = $2
      ORDER BY document_type ASC`,
    [enrollmentId, context.institutionId],
  );
  return result.rows;
}

export async function addEnrollmentDocument(pool: EnrollmentDocumentPool, context: InstitutionalContext, input: { enrollmentId: string; documentType: unknown }) {
  if (!validUuid(input.enrollmentId) || !validDocumentType(input.documentType)) {
    throw new EnrollmentDocumentApiError('INVALID_INPUT', 'Documento de matrícula inválido.');
  }
  const documentType = input.documentType.trim();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const enrollment = await client.query<{ status: EnrollmentStatus }>(
      'SELECT status FROM enrollment_applications WHERE id = $1 AND institution_id = $2 FOR UPDATE',
      [input.enrollmentId, context.institutionId],
    );
    if (!enrollment.rowCount) throw new EnrollmentDocumentApiError('NOT_FOUND', 'Matrícula não encontrada nesta instituição.');
    if (!canManageEnrollmentDocuments(context.role, enrollment.rows[0].status)) {
      throw new EnrollmentDocumentApiError('FORBIDDEN', 'Os documentos desta matrícula já não podem ser alterados neste fluxo.');
    }
    const inserted = await client.query<{ id: string; document_type: string; status: EnrollmentDocumentStatus }>(
      `INSERT INTO enrollment_documents (institution_id, enrollment_application_id, document_type, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (enrollment_application_id, document_type) DO NOTHING
       RETURNING id, document_type, status`,
      [context.institutionId, input.enrollmentId, documentType],
    );
    if (inserted.rowCount) {
      await client.query(
        `INSERT INTO enrollment_events (institution_id, enrollment_application_id, actor_person_id, event_type, metadata)
         VALUES ($1, $2, $3, 'document_added', $4::jsonb)`,
        [context.institutionId, input.enrollmentId, context.personId, JSON.stringify({ documentId: inserted.rows[0].id, documentType })],
      );
      await client.query('COMMIT');
      return { document: inserted.rows[0], replayed: false };
    }
    const existing = await client.query<{ id: string; document_type: string; status: EnrollmentDocumentStatus }>(
      'SELECT id, document_type, status FROM enrollment_documents WHERE enrollment_application_id = $1 AND institution_id = $2 AND document_type = $3',
      [input.enrollmentId, context.institutionId, documentType],
    );
    await client.query('COMMIT');
    return { document: existing.rows[0], replayed: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function transitionEnrollmentDocument(pool: EnrollmentDocumentPool, context: InstitutionalContext, input: { enrollmentId: string; documentId: string; toStatus: unknown; evidenceReference?: unknown }) {
  if (!validUuid(input.enrollmentId) || !validUuid(input.documentId) || !isEnrollmentDocumentStatus(input.toStatus)) {
    throw new EnrollmentDocumentApiError('INVALID_INPUT', 'Transição documental inválida.');
  }
  if (input.toStatus === 'submitted' && !validEvidenceReference(input.evidenceReference)) {
    throw new EnrollmentDocumentApiError('INVALID_INPUT', 'A submissão documental exige uma referência de evidência.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query<{ enrollment_status: EnrollmentStatus; document_status: EnrollmentDocumentStatus; document_type: string }>(
      `SELECT e.status AS enrollment_status, d.status AS document_status, d.document_type
         FROM enrollment_documents d
         INNER JOIN enrollment_applications e ON e.id = d.enrollment_application_id
        WHERE d.id = $1 AND d.enrollment_application_id = $2
          AND d.institution_id = $3 AND e.institution_id = $3
        FOR UPDATE`,
      [input.documentId, input.enrollmentId, context.institutionId],
    );
    if (!current.rowCount) throw new EnrollmentDocumentApiError('NOT_FOUND', 'Documento não encontrado nesta matrícula.');
    const row = current.rows[0];
    if (!canTransitionEnrollmentDocument(context.role, row.enrollment_status, row.document_status, input.toStatus)) {
      throw new EnrollmentDocumentApiError('INVALID_TRANSITION', 'Transição documental não autorizada.');
    }
    const evidenceReference = input.toStatus === 'submitted' ? String(input.evidenceReference).trim() : null;
    const updated = await client.query(
      `UPDATE enrollment_documents
          SET status = $1,
              evidence_reference = CASE WHEN $1 = 'submitted' THEN $2::text ELSE evidence_reference END,
              verified_by = CASE WHEN $1 = 'verified' THEN $3::uuid ELSE NULL::uuid END,
              verified_at = CASE WHEN $1 = 'verified' THEN now() ELSE NULL::timestamptz END,
              updated_at = now()
        WHERE id = $4 AND enrollment_application_id = $5 AND institution_id = $6
        RETURNING id, document_type, status, evidence_reference, verified_by, verified_at, updated_at`,
      [input.toStatus, evidenceReference, context.personId, input.documentId, input.enrollmentId, context.institutionId],
    );
    await client.query(
      `INSERT INTO enrollment_events (institution_id, enrollment_application_id, actor_person_id, event_type, metadata)
       VALUES ($1, $2, $3, 'document_status_changed', $4::jsonb)`,
      [context.institutionId, input.enrollmentId, context.personId, JSON.stringify({ documentId: input.documentId, documentType: row.document_type, fromStatus: row.document_status, toStatus: input.toStatus })],
    );
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
