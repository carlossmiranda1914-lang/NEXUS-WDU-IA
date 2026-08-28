import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import { canManageEnrollment, type EnrollmentStatus } from './enrollment-policy.ts';
import { getEnrollmentRegistrationReadiness } from './enrollment-registration-api.ts';
import { canAssignEnrollmentProcess, canReceiveEnrollmentProcessAssignment, projectEnrollmentProcess, type EnrollmentProcessProjection, type EnrollmentProcessStageKey } from './enrollment-process-policy.ts';

interface QueryClient {
  query<T = any>(text: string, params?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface EnrollmentProcessPool extends QueryClient {
  connect(): Promise<PoolClient>;
}

export class EnrollmentProcessApiError extends Error {
  constructor(
    public readonly code: 'INVALID_INPUT' | 'NOT_FOUND' | 'FORBIDDEN' | 'STALE_VERSION' | 'INVALID_ASSIGNEE',
    message: string,
  ) {
    super(message);
    this.name = 'EnrollmentProcessApiError';
  }
}

type ApplicationRow = {
  id: string;
  institution_id: string;
  status: EnrollmentStatus;
  academic_context_valid: boolean;
  document_policy_id: string | null;
  created_at: string;
};

type ProcessRow = {
  current_stage: EnrollmentProcessStageKey;
  assigned_to_person_id: string | null;
  assigned_to_name: string | null;
  started_at: string;
  last_progress_at: string;
  blocked_at: string | null;
  blocked_reason_code: string | null;
  projection_fingerprint: string;
  version: number;
  updated_at: string;
};

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function fingerprint(projection: EnrollmentProcessProjection): string {
  return crypto.createHash('sha256').update(JSON.stringify({
    currentStage: projection.currentStage,
    stages: projection.stages.map((item) => ({ key: item.key, status: item.status, reasonCode: item.reasonCode, evidence: item.evidence.summary })),
    blockers: projection.blockers.map((item) => item.reasonCode),
  })).digest('hex');
}

async function lockApplication(client: QueryClient, institutionId: string, enrollmentId: string): Promise<ApplicationRow | null> {
  const application = await client.query<ApplicationRow>(
    `SELECT e.id, e.institution_id, e.status, e.document_policy_id, e.created_at,
            (o.id IS NOT NULL AND y.id IS NOT NULL) AS academic_context_valid
       FROM enrollment_applications e
       LEFT JOIN academic_years y
         ON y.id = e.academic_year_id AND y.institution_id = e.institution_id
       LEFT JOIN enrollment_offers o
         ON o.id = e.offer_id AND o.institution_id = e.institution_id
        AND o.academic_year_id = e.academic_year_id
      WHERE e.id = $1 AND e.institution_id = $2
      FOR UPDATE OF e`,
    [enrollmentId, institutionId],
  );
  return application.rows[0] ?? null;
}

async function calculateProjection(client: QueryClient, context: InstitutionalContext, application: ApplicationRow) {
  const registration = await getEnrollmentRegistrationReadiness(client, context.institutionId, application.id);
  if (!registration) throw new EnrollmentProcessApiError('NOT_FOUND', 'Matrícula não encontrada nesta instituição.');
  const documents = await client.query<{ document_type: string; required: boolean; status: 'pending' | 'submitted' | 'verified' | 'rejected'; source_requirement_id: string | null }>(
    `SELECT document_type, required, status, source_requirement_id
       FROM enrollment_documents
      WHERE enrollment_application_id = $1 AND institution_id = $2
      ORDER BY document_type`,
    [application.id, context.institutionId],
  );
  return projectEnrollmentProcess({
    enrollmentStatus: application.status,
    registrationReady: registration.ready,
    registrationMissing: registration.missing,
    academicContextValid: application.academic_context_valid,
    policyCaptured: application.document_policy_id !== null,
    documents: documents.rows.map((item) => ({ documentType: item.document_type, required: item.required, status: item.status, sourceRequirementId: item.source_requirement_id })),
  }, context.role);
}

function primaryBlocker(projection: EnrollmentProcessProjection) {
  return projection.blockers.find((item) => item.stage === projection.currentStage) ?? projection.blockers[0] ?? null;
}

async function persistProjection(client: QueryClient, application: ApplicationRow, projection: EnrollmentProcessProjection, correlationId: string | null) {
  const projectionFingerprint = fingerprint(projection);
  const blocker = primaryBlocker(projection);
  const inserted = await client.query<{ current_stage: EnrollmentProcessStageKey }>(
    `INSERT INTO enrollment_processes (
       enrollment_application_id, institution_id, current_stage, started_at, last_progress_at,
       blocked_at, blocked_reason_code, projection_fingerprint
     ) VALUES ($1, $2, $3, $4, now(), CASE WHEN $5::text IS NULL THEN NULL ELSE now() END, $5, $6)
     ON CONFLICT (enrollment_application_id) DO NOTHING
     RETURNING current_stage`,
    [application.id, application.institution_id, projection.currentStage, application.created_at, blocker?.reasonCode ?? null, projectionFingerprint],
  );

  let current = await client.query<ProcessRow>(
    `SELECT p.current_stage, p.assigned_to_person_id, assignee.name AS assigned_to_name,
            p.started_at, p.last_progress_at, p.blocked_at, p.blocked_reason_code,
            p.projection_fingerprint, p.version, p.updated_at
       FROM enrollment_processes p
       LEFT JOIN people assignee ON assignee.id = p.assigned_to_person_id
      WHERE p.enrollment_application_id = $1 AND p.institution_id = $2
      FOR UPDATE OF p`,
    [application.id, application.institution_id],
  );
  if (!current.rowCount) throw new EnrollmentProcessApiError('NOT_FOUND', 'Processo de matrícula não encontrado nesta instituição.');

  if (inserted.rowCount) {
    await client.query(
      `INSERT INTO enrollment_events (institution_id, enrollment_application_id, actor_kind, actor_person_id, correlation_id, system_cause, event_type, metadata)
       VALUES ($1, $2, 'system', NULL, $3, 'PROCESS_RECONCILIATION', 'process_started', $4::jsonb)`,
      [application.institution_id, application.id, correlationId, JSON.stringify({ currentStage: projection.currentStage })],
    );
  } else if (current.rows[0].projection_fingerprint !== projectionFingerprint) {
    const previous = current.rows[0];
    await client.query(
      `UPDATE enrollment_processes
          SET current_stage = $1,
              blocked_at = CASE WHEN $2::text IS NULL THEN NULL ELSE COALESCE(blocked_at, now()) END,
              blocked_reason_code = $2,
              projection_fingerprint = $3,
              version = version + 1,
              updated_at = now()
        WHERE enrollment_application_id = $4 AND institution_id = $5`,
      [projection.currentStage, blocker?.reasonCode ?? null, projectionFingerprint, application.id, application.institution_id],
    );
    await client.query(
      `INSERT INTO enrollment_events (institution_id, enrollment_application_id, actor_kind, actor_person_id, correlation_id, system_cause, event_type, metadata)
       VALUES ($1, $2, 'system', NULL, $3, 'PROCESS_RECONCILIATION', 'process_reconciled', $4::jsonb)`,
      [application.institution_id, application.id, correlationId, JSON.stringify({
        fromStage: previous.current_stage,
        toStage: projection.currentStage,
        fromBlocker: previous.blocked_reason_code,
        toBlocker: blocker?.reasonCode ?? null,
      })],
    );
    current = await client.query<ProcessRow>(
      `SELECT p.current_stage, p.assigned_to_person_id, assignee.name AS assigned_to_name,
              p.started_at, p.last_progress_at, p.blocked_at, p.blocked_reason_code,
              p.projection_fingerprint, p.version, p.updated_at
         FROM enrollment_processes p
         LEFT JOIN people assignee ON assignee.id = p.assigned_to_person_id
        WHERE p.enrollment_application_id = $1 AND p.institution_id = $2`,
      [application.id, application.institution_id],
    );
  }
  return current.rows[0];
}

export async function loadEnrollmentProcess(pool: EnrollmentProcessPool, context: InstitutionalContext, enrollmentId: string) {
  if (!validUuid(enrollmentId)) throw new EnrollmentProcessApiError('INVALID_INPUT', 'Matrícula inválida.');
  if (!canManageEnrollment(context.role)) throw new EnrollmentProcessApiError('FORBIDDEN', 'O seu papel não pode consultar processos de matrícula.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const application = await lockApplication(client, context.institutionId, enrollmentId);
    if (!application) throw new EnrollmentProcessApiError('NOT_FOUND', 'Matrícula não encontrada nesta instituição.');
    const projection = await calculateProjection(client, context, application);
    const persisted = await client.query<ProcessRow>(
      `SELECT p.current_stage, p.assigned_to_person_id, assignee.name AS assigned_to_name,
              p.started_at, p.last_progress_at, p.blocked_at, p.blocked_reason_code,
              p.projection_fingerprint, p.version, p.updated_at
         FROM enrollment_processes p
         LEFT JOIN people assignee ON assignee.id = p.assigned_to_person_id
        WHERE p.enrollment_application_id = $1 AND p.institution_id = $2`,
      [application.id, application.institution_id],
    );
    if (!persisted.rowCount) throw new EnrollmentProcessApiError('NOT_FOUND', 'Processo de matrícula não encontrado nesta instituição.');
    await client.query('COMMIT');
    return {
      enrollmentId: application.id,
      enrollmentStatus: application.status,
      ...projection,
      assignedTo: persisted.rows[0].assigned_to_person_id ? { personId: persisted.rows[0].assigned_to_person_id, name: persisted.rows[0].assigned_to_name } : null,
      version: persisted.rows[0].version,
      timestamps: {
        startedAt: persisted.rows[0].started_at,
        lastProgressAt: persisted.rows[0].last_progress_at,
        blockedAt: persisted.rows[0].blocked_at,
        updatedAt: persisted.rows[0].updated_at,
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Explicit server-side materialization; it is never invoked by a browser read. */
export async function reconcileEnrollmentProcess(pool: EnrollmentProcessPool, context: InstitutionalContext, enrollmentId: string, correlationId: string | null = null) {
  if (!validUuid(enrollmentId)) throw new EnrollmentProcessApiError('INVALID_INPUT', 'Matrícula inválida.');
  if (!canManageEnrollment(context.role)) throw new EnrollmentProcessApiError('FORBIDDEN', 'O seu papel não pode consultar processos de matrícula.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const application = await lockApplication(client, context.institutionId, enrollmentId);
    if (!application) throw new EnrollmentProcessApiError('NOT_FOUND', 'Matrícula não encontrada nesta instituição.');
    const projection = await calculateProjection(client, context, application);
    await persistProjection(client, application, projection, correlationId);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function assignEnrollmentProcess(
  pool: EnrollmentProcessPool,
  context: InstitutionalContext,
  enrollmentId: string,
  input: { assignedToPersonId: unknown; expectedVersion: unknown },
) {
  if (!validUuid(enrollmentId) || (!validUuid(input.assignedToPersonId) && input.assignedToPersonId !== null) || !Number.isInteger(input.expectedVersion) || Number(input.expectedVersion) < 1) {
    throw new EnrollmentProcessApiError('INVALID_INPUT', 'Atribuição de processo inválida.');
  }
  if (!canAssignEnrollmentProcess(context.role)) throw new EnrollmentProcessApiError('FORBIDDEN', 'O seu papel não pode atribuir processos de matrícula.');
  await loadEnrollmentProcess(pool, context, enrollmentId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const application = await lockApplication(client, context.institutionId, enrollmentId);
    if (!application) throw new EnrollmentProcessApiError('NOT_FOUND', 'Matrícula não encontrada nesta instituição.');
    if (application.status === 'cancelled' || application.status === 'active') {
      throw new EnrollmentProcessApiError('FORBIDDEN', 'Este processo está encerrado e não aceita nova atribuição.');
    }
    if (input.assignedToPersonId) {
      const membership = await client.query<{ role: InstitutionalContext['role'] }>(
        `SELECT role FROM memberships
          WHERE person_id = $1 AND institution_id = $2 AND status = 'active'`,
        [input.assignedToPersonId, context.institutionId],
      );
      if (!membership.rowCount || !canReceiveEnrollmentProcessAssignment(membership.rows[0].role)) {
        throw new EnrollmentProcessApiError('INVALID_ASSIGNEE', 'O responsável não possui vínculo operacional elegível nesta instituição.');
      }
    }
    const current = await client.query<{ assigned_to_person_id: string | null; version: number }>(
      `SELECT assigned_to_person_id, version FROM enrollment_processes
        WHERE enrollment_application_id = $1 AND institution_id = $2 FOR UPDATE`,
      [enrollmentId, context.institutionId],
    );
    if (!current.rowCount) throw new EnrollmentProcessApiError('NOT_FOUND', 'Processo de matrícula não encontrado nesta instituição.');
    if (current.rows[0].version !== input.expectedVersion) {
      throw new EnrollmentProcessApiError('STALE_VERSION', 'O processo foi atualizado por outra operação. Recarregue antes de atribuir.');
    }
    const updated = await client.query<{ assigned_to_person_id: string | null; version: number; updated_at: string }>(
      `UPDATE enrollment_processes
          SET assigned_to_person_id = $1, last_progress_at = now(), version = version + 1, updated_at = now()
        WHERE enrollment_application_id = $2 AND institution_id = $3 AND version = $4
        RETURNING assigned_to_person_id, version, updated_at`,
      [input.assignedToPersonId, enrollmentId, context.institutionId, input.expectedVersion],
    );
    if (!updated.rowCount) throw new EnrollmentProcessApiError('STALE_VERSION', 'O processo foi atualizado por outra operação. Recarregue antes de atribuir.');
    await client.query(
      `INSERT INTO enrollment_events (institution_id, enrollment_application_id, actor_person_id, event_type, metadata)
       VALUES ($1, $2, $3, 'process_assignment_changed', $4::jsonb)`,
      [context.institutionId, enrollmentId, context.personId, JSON.stringify({
        fromPersonId: current.rows[0].assigned_to_person_id,
        toPersonId: input.assignedToPersonId,
        version: updated.rows[0].version,
      })],
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
