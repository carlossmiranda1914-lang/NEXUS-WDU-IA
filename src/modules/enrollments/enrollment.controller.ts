import { Application, Response } from 'express';
import { pool } from '../../db/index.ts';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { IdentityDecisionError } from '../people/identity-resolution-decision.ts';
import {
  assertNoClientAuthority,
  decideEnrollmentIdentityDecision,
  EnrollmentIntakeApiError,
  parseEnrollmentStudentInput,
  proposeEnrollmentIdentityDecision,
  resolveStudentForEnrollment,
  startEnrollmentIntake,
} from './enrollment-intake-api.ts';
import { EnrollmentIntakeError } from './enrollment-intake.ts';
import { canManageEnrollment, canTransitionEnrollment, EnrollmentStatus, isEnrollmentStatus } from './enrollment-policy.ts';
import { registerAcademicYearRoutes } from './academic-year.controller.ts';
import { registerEnrollmentDocumentRoutes } from './enrollment-document.controller.ts';
import { documentValidationGate } from './enrollment-document-requirement-policy.ts';
import { registerEnrollmentRegistrationRoutes } from './enrollment-registration.controller.ts';
import { getEnrollmentRegistrationReadiness } from './enrollment-registration-api.ts';
import { REGISTRATION_FIELD_LABELS } from './enrollment-registration-policy.ts';
import { registerEnrollmentProcessRoutes } from './enrollment-process.controller.ts';
import { activateEnrollment, EnrollmentActivationError } from './enrollment-activation.ts';

function reject(res: Response, status: number, error: string) { return res.status(status).json({ error }); }

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function enrollmentActor(req: AuthRequest, res: Response) {
  const context = req.institutionalContext;
  if (!context) { reject(res, 401, 'Autenticação institucional necessária.'); return null; }
  if (!canManageEnrollment(context.role)) { reject(res, 403, 'O seu papel não pode gerir matrículas.'); return null; }
  return context;
}

function rejectDomainError(res: Response, error: unknown) {
  if (error instanceof EnrollmentIntakeApiError) {
    if (error.code === 'IDENTITY_REVIEW_REQUIRED' || error.code === 'IDENTITY_DECISION_INVALID' || error.code === 'IDENTITY_DECISION_STALE') {
      return reject(res, 409, error.message);
    }
    return reject(res, 400, error.message);
  }
  if (error instanceof EnrollmentIntakeError) {
    if (error.code === 'ENROLLMENT_ALREADY_EXISTS' || error.code === 'IDEMPOTENCY_KEY_REUSED'
      || error.code === 'IDENTITY_DECISION_REQUIRED' || error.code === 'IDENTITY_DECISION_INVALID'
      || error.code === 'PERSON_NOT_FOUND') {
      return reject(res, 409, error.message);
    }
    return reject(res, 400, error.message);
  }
  if (error instanceof IdentityDecisionError) {
    if (error.code === 'UNAUTHORIZED_DECISION' || error.code === 'SEGREGATION_REQUIRED' || error.code === 'INSTITUTION_ADMIN_REQUIRED') {
      return reject(res, 403, error.message);
    }
    if (error.code === 'DECISION_NOT_FOUND') return reject(res, 404, error.message);
    if (error.code === 'DECISION_CASE_CONFLICT' || error.code === 'DECISION_ALREADY_FINAL') return reject(res, 409, error.message);
    return reject(res, 400, error.message);
  }
  console.error('[ENROLLMENTS] unhandled domain error', error);
  return reject(res, 500, 'Não foi possível concluir a operação de matrícula.');
}

export function registerEnrollmentRoutes(app: Application) {
  registerAcademicYearRoutes(app);
  registerEnrollmentDocumentRoutes(app);
  registerEnrollmentRegistrationRoutes(app);
  registerEnrollmentProcessRoutes(app);
  app.get('/api/enrollments', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    const status = req.query.status;
    if (status !== undefined && !isEnrollmentStatus(status)) return reject(res, 400, 'Estado de matrícula inválido.');
    const academicYearId = req.query.academicYearId;
    if (academicYearId !== undefined && !validUuid(academicYearId)) return reject(res, 400, 'Ano letivo inválido.');
    try {
      const result = await pool.query(
        `SELECT e.id, e.status, e.created_at, e.updated_at, student.name AS student_name,
          guardian.name AS guardian_name, offer.name AS offer_name, year.name AS academic_year_name
         FROM enrollment_applications e
         INNER JOIN people student ON student.id = e.student_person_id
         LEFT JOIN people guardian ON guardian.id = e.guardian_person_id
         INNER JOIN enrollment_offers offer ON offer.id = e.offer_id
         INNER JOIN academic_years year ON year.id = e.academic_year_id
         WHERE e.institution_id = $1
           AND ($2::text IS NULL OR e.status = $2)
           AND ($3::uuid IS NULL OR e.academic_year_id = $3)
         ORDER BY e.updated_at DESC`,
        [context.institutionId, status ?? null, academicYearId ?? null],
      );
      res.json({ enrollments: result.rows });
    } catch (error) { console.error('[ENROLLMENTS] list', error); return reject(res, 500, 'Não foi possível carregar as matrículas.'); }
  });

  app.post('/api/enrollments/person-resolution', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    try {
      assertNoClientAuthority(req.body);
      const student = parseEnrollmentStudentInput(req.body?.student);
      const resolution = await resolveStudentForEnrollment(pool, context, student);
      return res.json({ resolution });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  app.post('/api/enrollments/identity-decisions', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    try {
      assertNoClientAuthority(req.body);
      const student = parseEnrollmentStudentInput(req.body?.student);
      const proposedAction = req.body?.proposedAction;
      if (proposedAction !== 'REUSE_PERSON' && proposedAction !== 'CREATE_PERSON') {
        return reject(res, 400, 'Ação de decisão de identidade inválida.');
      }
      const decision = await proposeEnrollmentIdentityDecision(pool, context, {
        offerId: req.body?.offerId,
        student,
        proposedAction,
        candidatePersonId: req.body?.candidatePersonId ?? null,
        evidenceTypes: Array.isArray(req.body?.evidenceTypes) ? req.body.evidenceTypes : [],
        requestId: typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : null,
        correlationId: typeof req.headers['x-correlation-id'] === 'string' ? req.headers['x-correlation-id'] : null,
      });
      return res.status(201).json({
        decision: {
          id: decision.id,
          status: decision.status,
          riskLevel: decision.riskLevel,
          proposedAction: decision.proposedAction,
          reasonCode: decision.reasonCode,
          version: decision.version,
          replayed: decision.replayed ?? false,
        },
      });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  app.post('/api/enrollments/identity-decisions/:id/outcome', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    try {
      assertNoClientAuthority(req.body ?? {});
      const outcome = req.body?.outcome;
      if (outcome !== 'approve' && outcome !== 'reject' && outcome !== 'request_more_information') {
        return reject(res, 400, 'Resultado de decisão inválido.');
      }
      const decision = await decideEnrollmentIdentityDecision(pool, context, req.params.id, outcome);
      return res.json({
        decision: {
          id: decision.id,
          status: decision.status,
          riskLevel: decision.riskLevel,
          proposedAction: decision.proposedAction,
          reasonCode: decision.reasonCode,
          version: decision.version,
        },
      });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  app.post('/api/enrollments/intake', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    try {
      assertNoClientAuthority(req.body);
      const student = parseEnrollmentStudentInput(req.body?.student);
      const idempotencyKeyHeader = req.header('Idempotency-Key');
      if (!idempotencyKeyHeader) return reject(res, 400, 'Idempotency-Key é obrigatório para iniciar a matrícula.');
      const result = await startEnrollmentIntake(pool, context, {
        offerId: req.body?.offerId,
        student,
        idempotencyKey: idempotencyKeyHeader,
        decisionId: req.body?.decisionId ?? null,
      });
      return res.status(result.replayed ? 200 : 201).json({
        enrollment: {
          id: result.enrollmentApplicationId,
          studentPersonId: result.studentPersonId,
          studentProfileId: result.studentProfileId,
          replayed: result.replayed,
        },
      });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // Legacy write paths are intentionally closed. They previously created Person
  // directly or trusted a browser-supplied global Person UUID, bypassing 08B.1.
  app.post('/api/enrollments/drafts', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    return reject(res, 410, 'Fluxo antigo de rascunho desativado. Utilize o intake de matrícula com resolução de identidade.');
  });

  app.post('/api/enrollments', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    return reject(res, 410, 'Fluxo antigo de matrícula desativado. Utilize /api/enrollments/intake.');
  });

  app.post('/api/enrollments/:id/transitions', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    if (!validUuid(req.params.id) || !isEnrollmentStatus(req.body?.toStatus)) return reject(res, 400, 'Pedido de transição inválido.');
    const target = req.body.toStatus as EnrollmentStatus;
    if (target === 'active') return reject(res, 409, 'A ativação é executada exclusivamente por /api/enrollments/:id/activate.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query<{ status: EnrollmentStatus; document_policy_id: string | null }>(
        `SELECT status, document_policy_id FROM enrollment_applications WHERE id = $1 AND institution_id = $2 FOR UPDATE`, [req.params.id, context.institutionId],
      );
      if (!existing.rowCount) { await client.query('ROLLBACK'); return reject(res, 404, 'Matrícula não encontrada nesta instituição.'); }
      const from = existing.rows[0].status;
      if (!canTransitionEnrollment(context.role, from, target)) { await client.query('ROLLBACK'); return reject(res, 403, 'Transição de matrícula não autorizada.'); }

      if (target === 'validated') {
        const registrationGate = await getEnrollmentRegistrationReadiness(client, context.institutionId, req.params.id);
        if (!registrationGate) {
          await client.query('ROLLBACK');
          return reject(res, 404, 'Matrícula não encontrada nesta instituição.');
        }
        if (!registrationGate.ready) {
          await client.query('ROLLBACK');
          const missing = registrationGate.missing.map((field) => REGISTRATION_FIELD_LABELS[field] || field).join(', ');
          return reject(res, 409, `Complete o cadastro da matrícula antes da validação. Em falta: ${missing}.`);
        }

        const documents = await client.query<{ document_type: string; required: boolean; status: 'pending' | 'submitted' | 'verified' | 'rejected'; source_requirement_id: string | null; requirement_code: string | null; physical_file_persisted: boolean }>(
          `SELECT d.document_type, d.required, d.status, d.source_requirement_id, d.requirement_code,
                  EXISTS (SELECT 1 FROM enrollment_document_files f WHERE f.institution_id = d.institution_id AND f.enrollment_document_id = d.id AND f.enrollment_application_id = d.enrollment_application_id AND f.status = 'persisted') AS physical_file_persisted
             FROM enrollment_documents d WHERE d.enrollment_application_id = $1 AND d.institution_id = $2`,
          [req.params.id, context.institutionId],
        );
        const documentGate = documentValidationGate(
          existing.rows[0].document_policy_id !== null,
          documents.rows.map((row) => ({
            documentType: row.document_type,
            required: row.required,
            status: row.status,
            sourceRequirementId: row.source_requirement_id,
            requirementCode: row.requirement_code,
            physicalFilePersisted: row.physical_file_persisted,
          })),
        );
        if (!documentGate.ready) {
          await client.query('ROLLBACK');
          return reject(
            res,
            409,
            documentGate.reason === 'POLICY_NOT_CAPTURED'
              ? 'A política documental desta matrícula ainda não foi capturada.'
              : documentGate.reason === 'REQUIREMENTS_NOT_CONFIGURED'
                ? 'A política documental não possui requisitos materializados para esta matrícula; a validação permanece bloqueada.'
                : documentGate.reason === 'REQUIRED_DOCUMENT_FILES_MISSING'
                  ? 'Existem documentos verificados sem ficheiro físico persistido; a validação permanece bloqueada.'
                : documentGate.reason === 'REQUIRED_DOCUMENTS_UNVERIFIED'
                  ? 'Existem documentos obrigatórios recebidos que aguardam verificação.'
                  : 'Existem documentos obrigatórios por verificar.',
          );
        }
      }
      const updated = await client.query(
        `UPDATE enrollment_applications SET status = $1, updated_by = $2, updated_at = now()
         WHERE id = $3 AND institution_id = $4 RETURNING id, status, updated_at`,
        [target, context.personId, req.params.id, context.institutionId],
      );
      await client.query(
        `INSERT INTO enrollment_events (institution_id, enrollment_application_id, actor_person_id, event_type, from_status, to_status)
         VALUES ($1, $2, $3, 'status_changed', $4, $5)`,
        [context.institutionId, req.params.id, context.personId, from, target],
      );
      await client.query('COMMIT');
      res.json({ enrollment: updated.rows[0] });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });

  app.post('/api/enrollments/:id/activate', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext; if (!context) return reject(res, 401, 'Autenticação institucional necessária.');
    try { const result = await activateEnrollment(pool, context, req.params.id); return res.json({ enrollment: { status: result.status }, replayed: result.replayed }); }
    catch (error) { if (error instanceof EnrollmentActivationError) return reject(res, error.code === 'NOT_FOUND' ? 404 : error.code === 'FORBIDDEN' ? 403 : 409, error.message); throw error; }
  });
}
