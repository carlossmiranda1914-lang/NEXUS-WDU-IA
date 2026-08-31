import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import { canManageEnrollmentDocuments, type EnrollmentDocumentStatus } from './enrollment-document-policy.ts';
import { canConfigureDocumentRequirements, normalizeDocumentRequirements } from './enrollment-document-requirement-policy.ts';
import { captureEnrollmentDocumentPolicy } from './enrollment-document-snapshot.ts';
import type { EnrollmentStatus } from './enrollment-policy.ts';

export interface EnrollmentDocumentRequirementsClient {
  query<T = any>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
  release(): void;
}

export interface EnrollmentDocumentRequirementsPool {
  connect(): Promise<EnrollmentDocumentRequirementsClient>;
}

export class EnrollmentDocumentRequirementsError extends Error {
  constructor(
    public readonly code: 'INVALID_INPUT' | 'FORBIDDEN' | 'NOT_FOUND' | 'SNAPSHOT_ALREADY_CAPTURED',
    message: string,
  ) {
    super(message);
    this.name = 'EnrollmentDocumentRequirementsError';
  }
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeInput(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === 'string')) {
    throw new EnrollmentDocumentRequirementsError('INVALID_INPUT', 'Indique pelo menos um requisito documental válido.');
  }
  const normalized = normalizeDocumentRequirements(value);
  if (normalized.length === 0 || normalized.length !== value.length) {
    throw new EnrollmentDocumentRequirementsError('INVALID_INPUT', 'Cada requisito documental deve ter entre 2 e 120 caracteres e não pode repetir-se.');
  }
  return normalized;
}

function sameRequirements(left: readonly { document_type: string; required: boolean }[], right: readonly string[]) {
  if (left.length !== right.length || left.some((item) => !item.required)) return false;
  const current = left.map((item) => item.document_type.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt')).sort();
  const expected = right.map((item) => item.toLocaleLowerCase('pt')).sort();
  return current.every((value, index) => value === expected[index]);
}

/**
 * Explicitly creates/reuses the active offer policy and captures it only for an
 * enrollment that has never received a document-policy snapshot. Existing
 * enrollment snapshots are immutable and may replay only the same command.
 */
export async function configureEnrollmentDocumentRequirements(
  pool: EnrollmentDocumentRequirementsPool,
  context: InstitutionalContext,
  input: { enrollmentId: unknown; requirements: unknown },
) {
  if (!validUuid(input.enrollmentId)) throw new EnrollmentDocumentRequirementsError('INVALID_INPUT', 'Matrícula inválida.');
  if (!canConfigureDocumentRequirements(context.role)) {
    throw new EnrollmentDocumentRequirementsError('FORBIDDEN', 'A configuração de requisitos documentais é exclusiva da Direção ou Administração.');
  }
  const requirements = normalizeInput(input.requirements);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const enrollment = await client.query<{ offer_id: string; status: EnrollmentStatus; document_policy_id: string | null }>(
      `SELECT offer_id, status, document_policy_id
         FROM enrollment_applications
        WHERE id = $1 AND institution_id = $2
        FOR UPDATE`,
      [input.enrollmentId, context.institutionId],
    );
    if (!enrollment.rowCount) throw new EnrollmentDocumentRequirementsError('NOT_FOUND', 'Matrícula não encontrada nesta instituição.');
    const application = enrollment.rows[0];
    if (!canManageEnrollmentDocuments(context.role, application.status)) {
      throw new EnrollmentDocumentRequirementsError('FORBIDDEN', 'Esta matrícula já não aceita configuração documental neste fluxo.');
    }

    const captured = await client.query<{ document_type: string; required: boolean; source_requirement_id: string | null }>(
      `SELECT document_type, required, source_requirement_id
         FROM enrollment_documents
        WHERE enrollment_application_id = $1 AND institution_id = $2
        ORDER BY document_type`,
      [input.enrollmentId, context.institutionId],
    );
    if (application.document_policy_id !== null || captured.rowCount) {
      if (application.document_policy_id !== null && captured.rows.every((item) => item.source_requirement_id !== null) && sameRequirements(captured.rows, requirements)) {
        await client.query('COMMIT');
        return { replayed: true, requirementsCaptured: captured.rows.length };
      }
      throw new EnrollmentDocumentRequirementsError('SNAPSHOT_ALREADY_CAPTURED', 'Esta matrícula já possui uma snapshot documental e não pode ser alterada por uma nova configuração.');
    }

    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [context.institutionId, `document-policy:${application.offer_id}`]);
    const active = await client.query<{ id: string }>(
      `SELECT id FROM enrollment_document_policies
        WHERE institution_id = $1 AND offer_id = $2 AND status = 'active'
        FOR UPDATE`,
      [context.institutionId, application.offer_id],
    );
    let policyId = active.rows[0]?.id;
    if (policyId) {
      const activeRequirements = await client.query<{ document_type: string; required: boolean }>(
        `SELECT document_type, required FROM enrollment_document_requirements
          WHERE institution_id = $1 AND policy_id = $2
          ORDER BY document_type`,
        [context.institutionId, policyId],
      );
      if (!sameRequirements(activeRequirements.rows, requirements)) {
        await client.query(`UPDATE enrollment_document_policies SET status = 'retired' WHERE id = $1 AND institution_id = $2`, [policyId, context.institutionId]);
        policyId = undefined;
      }
    }
    if (!policyId) {
      const version = await client.query<{ next_version: number }>(
        `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
           FROM enrollment_document_policies
          WHERE institution_id = $1 AND offer_id = $2`,
        [context.institutionId, application.offer_id],
      );
      const created = await client.query<{ id: string }>(
        `INSERT INTO enrollment_document_policies (institution_id, offer_id, version, status, created_by, activated_at)
         VALUES ($1, $2, $3, 'active', $4, now())
         RETURNING id`,
        [context.institutionId, application.offer_id, version.rows[0].next_version, context.personId],
      );
      policyId = created.rows[0].id;
      for (const [sortOrder, documentType] of requirements.entries()) {
        await client.query(
          `INSERT INTO enrollment_document_requirements (institution_id, policy_id, document_type, required, sort_order)
           VALUES ($1, $2, $3, true, $4)`,
          [context.institutionId, policyId, documentType, sortOrder],
        );
      }
    }

    const snapshot = await captureEnrollmentDocumentPolicy(client as any, {
      institutionId: context.institutionId,
      offerId: application.offer_id,
      enrollmentId: input.enrollmentId,
    });
    if (!snapshot.policyCaptured || snapshot.requirementsCaptured === 0) {
      throw new EnrollmentDocumentRequirementsError('INVALID_INPUT', 'Não foi possível materializar os requisitos documentais desta matrícula.');
    }
    await client.query(
      `INSERT INTO enrollment_events (institution_id, enrollment_application_id, actor_person_id, event_type, metadata)
       VALUES ($1, $2, $3, 'document_requirements_materialized', $4::jsonb)`,
      [context.institutionId, input.enrollmentId, context.personId, JSON.stringify({ requirementsCaptured: snapshot.requirementsCaptured })],
    );
    await client.query('COMMIT');
    return { replayed: false, requirementsCaptured: snapshot.requirementsCaptured };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
