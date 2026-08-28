import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import { documentValidationGate } from './enrollment-document-requirement-policy.ts';
import { getEnrollmentRegistrationReadiness } from './enrollment-registration-api.ts';

interface QueryClient {
  query<T = any>(text: string, params?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface EnrollmentActivationPool extends QueryClient {
  connect(): Promise<PoolClient>;
}

export class EnrollmentActivationError extends Error {
  constructor(
    public readonly code: 'INVALID_INPUT' | 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_STATE' | 'ACTIVATION_NOT_READY' | 'STALE_VERSION' | 'IDEMPOTENCY_CONFLICT' | 'ALREADY_ACTIVE',
    message: string,
  ) { super(message); this.name = 'EnrollmentActivationError'; }
}

type ActivationInput = {
  expectedLifecycleVersion: unknown;
  expectedRegistrationVersion: unknown;
  idempotencyKey: unknown;
  correlationId?: string | null;
};

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function positiveVersion(value: unknown): bigint | null {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '' || !/^\d+$/.test(String(value))) return null;
  const parsed = BigInt(value);
  return parsed > 0n ? parsed : null;
}

function idempotencyKey(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length >= 8 && value.trim().length <= 200 ? value.trim() : null;
}

function requestFingerprint(enrollmentId: string, lifecycleVersion: bigint, registrationVersion: bigint): string {
  return crypto.createHash('sha256').update(JSON.stringify({ operation: 'ActivateEnrollment', enrollmentId, lifecycleVersion: lifecycleVersion.toString(), registrationVersion: registrationVersion.toString() })).digest('hex');
}

function canActivate(role: InstitutionalContext['role']): boolean {
  return role === 'institution_admin' || role === 'director';
}

export async function activateEnrollment(
  pool: EnrollmentActivationPool,
  context: InstitutionalContext,
  enrollmentId: string,
  input: ActivationInput,
) {
  const lifecycleVersion = positiveVersion(input.expectedLifecycleVersion);
  const registrationVersion = positiveVersion(input.expectedRegistrationVersion);
  const key = idempotencyKey(input.idempotencyKey);
  if (!validUuid(enrollmentId) || !lifecycleVersion || !registrationVersion || !key) {
    throw new EnrollmentActivationError('INVALID_INPUT', 'Pedido de ativação inválido.');
  }
  if (!canActivate(context.role)) throw new EnrollmentActivationError('FORBIDDEN', 'O seu papel não pode ativar matrículas.');
  const fingerprint = requestFingerprint(enrollmentId, lifecycleVersion, registrationVersion);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const enrollment = await client.query<{ status: string; student_person_id: string; lifecycle_version: string; registration_version: string; document_policy_id: string | null }>(
      `SELECT status, student_person_id, lifecycle_version, registration_version, document_policy_id
         FROM enrollment_applications
        WHERE id = $1 AND institution_id = $2
        FOR UPDATE`,
      [enrollmentId, context.institutionId],
    );
    if (!enrollment.rowCount) throw new EnrollmentActivationError('NOT_FOUND', 'Matrícula não encontrada nesta instituição.');

    const prior = await client.query<{ request_fingerprint: string; result: { enrollmentId: string; lifecycleVersion: string; status: 'active' } }>(
      `SELECT request_fingerprint, result
         FROM enrollment_activation_commands
        WHERE institution_id = $1 AND idempotency_key = $2
        FOR UPDATE`,
      [context.institutionId, key],
    );
    if (prior.rowCount) {
      if (prior.rows[0].request_fingerprint !== fingerprint) throw new EnrollmentActivationError('IDEMPOTENCY_CONFLICT', 'A chave de idempotência já foi usada para outro pedido.');
      await client.query('COMMIT');
      return { ...prior.rows[0].result, replayed: true };
    }

    const current = enrollment.rows[0];
    if (BigInt(current.lifecycle_version) !== lifecycleVersion || BigInt(current.registration_version) !== registrationVersion) {
      throw new EnrollmentActivationError('STALE_VERSION', 'A matrícula foi alterada entretanto. Recarregue e reveja antes de ativar.');
    }
    if (current.status === 'active') throw new EnrollmentActivationError('ALREADY_ACTIVE', 'A matrícula já se encontra ativa.');
    if (current.status !== 'validated') throw new EnrollmentActivationError('INVALID_STATE', 'A matrícula tem de estar validada antes da ativação.');

    const readiness = await getEnrollmentRegistrationReadiness(client, context.institutionId, enrollmentId);
    if (!readiness?.ready) throw new EnrollmentActivationError('ACTIVATION_NOT_READY', 'A matrícula ainda não cumpre os requisitos de ativação.');
    const documents = await client.query<{ document_type: string; required: boolean; status: 'pending' | 'submitted' | 'verified' | 'rejected'; source_requirement_id: string | null }>(
      `SELECT document_type, required, status, source_requirement_id FROM enrollment_documents
        WHERE enrollment_application_id = $1 AND institution_id = $2`,
      [enrollmentId, context.institutionId],
    );
    const documentsReady = documentValidationGate(current.document_policy_id !== null, documents.rows.map((row) => ({ documentType: row.document_type, required: row.required, status: row.status, sourceRequirementId: row.source_requirement_id })));
    if (!documentsReady.ready) throw new EnrollmentActivationError('ACTIVATION_NOT_READY', 'A matrícula ainda não cumpre os requisitos documentais de ativação.');

    const profile = await client.query<{ status: string }>(
      `SELECT status FROM student_profiles WHERE institution_id = $1 AND person_id = $2 FOR UPDATE`,
      [context.institutionId, current.student_person_id],
    );
    if (!profile.rowCount) throw new EnrollmentActivationError('ACTIVATION_NOT_READY', 'Não existe perfil institucional elegível para ativação.');
    if (profile.rows[0].status !== 'inactive') throw new EnrollmentActivationError('ACTIVATION_NOT_READY', 'O perfil institucional não está num estado ativável.');

    await client.query(`UPDATE student_profiles SET status = 'active', updated_at = now() WHERE institution_id = $1 AND person_id = $2`, [context.institutionId, current.student_person_id]);
    const activated = await client.query<{ id: string; status: 'active'; lifecycle_version: string }>(
      `UPDATE enrollment_applications
          SET status = 'active', lifecycle_version = lifecycle_version + 1, updated_by = $1, updated_at = now()
        WHERE id = $2 AND institution_id = $3 AND lifecycle_version = $4
        RETURNING id, status, lifecycle_version`,
      [context.personId, enrollmentId, context.institutionId, lifecycleVersion.toString()],
    );
    if (!activated.rowCount) throw new EnrollmentActivationError('STALE_VERSION', 'A matrícula foi alterada entretanto. Recarregue e reveja antes de ativar.');
    const result = { enrollmentId: activated.rows[0].id, lifecycleVersion: activated.rows[0].lifecycle_version, status: activated.rows[0].status };
    await client.query(
      `INSERT INTO enrollment_events (institution_id, enrollment_application_id, actor_kind, actor_person_id, correlation_id, event_type, from_status, to_status, metadata)
       VALUES ($1, $2, 'human', $3, $4, 'enrollment_activated', 'validated', 'active', $5::jsonb)`,
      [context.institutionId, enrollmentId, context.personId, input.correlationId ?? null, JSON.stringify({ operation: 'ActivateEnrollment', result: 'succeeded', lifecycleVersion: result.lifecycleVersion })],
    );
    await client.query(
      `INSERT INTO enrollment_activation_commands (institution_id, enrollment_application_id, idempotency_key, request_fingerprint, status, result)
       VALUES ($1, $2, $3, $4, 'completed', $5::jsonb)`,
      [context.institutionId, enrollmentId, key, fingerprint, JSON.stringify(result)],
    );
    await client.query('COMMIT');
    return { ...result, replayed: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
