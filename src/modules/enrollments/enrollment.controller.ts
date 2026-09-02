import { Application, RequestHandler, Response } from 'express';
import { pool } from '../../db/index.ts';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { IdentityDecisionError, submitIdentityDecisionEvidence } from '../people/identity-resolution-decision.ts';
import {
  assertNoClientAuthority,
  decideEnrollmentIdentityDecision,
  listEnrollmentIdentityDecisionQueue,
  readEnrollmentIdentityDecision,
  readEnrollmentIdentityDecisionForActor,
  EnrollmentIntakeApiError,
  parseEnrollmentStudentInput,
  proposeEnrollmentIdentityDecision,
  resolveStudentForEnrollment,
  resumeApprovedIdentityDecisionIntake,
  toPublicEnrollmentResolution,
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
import { registerEnrollmentActivationRoutes } from './enrollment-activation.controller.ts';
import { registerAcademicStructureRoutes } from '../academic/academic-structure.controller.ts';
import { ActiveStudentsError, loadActiveStudents } from '../student-context/active-students-api.ts';

function reject(res: Response, status: number, error: string) { return res.status(status).json({ error }); }
function rejectCode(res: Response, status: number, code: string, message: string) { return res.status(status).json({ code, message }); }

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
    if (error.code === 'IDENTITY_DECISION_NOT_FOUND') return reject(res, 404, error.message);
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

/**
 * Production defaults stay canonical; explicit dependencies make the identical
 * Express router mountable against the disposable PostgreSQL schema in tests.
 */
export function registerEnrollmentRoutes(
  app: Application,
  dependencies: { pool?: typeof pool; requireAuth?: RequestHandler } = {},
) {
  const enrollmentPool = dependencies.pool ?? pool;
  const enrollmentRequireAuth = dependencies.requireAuth ?? requireAuth;
  registerAcademicYearRoutes(app, { pool: enrollmentPool, requireAuth: enrollmentRequireAuth });
  registerAcademicStructureRoutes(app, { pool: enrollmentPool, requireAuth: enrollmentRequireAuth });
  registerEnrollmentDocumentRoutes(app, { pool: enrollmentPool, requireAuth: enrollmentRequireAuth });
  registerEnrollmentRegistrationRoutes(app, { pool: enrollmentPool, requireAuth: enrollmentRequireAuth });
  registerEnrollmentProcessRoutes(app);
  registerEnrollmentActivationRoutes(app, { pool: enrollmentPool, requireAuth: enrollmentRequireAuth });
  app.get('/api/active-students', enrollmentRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');
    try {
      return res.json(await loadActiveStudents(enrollmentPool as any, context));
    } catch (error) {
      if (error instanceof ActiveStudentsError) return reject(res, 403, 'O seu papel não pode consultar alunos ativos.');
      console.error('[ACTIVE-STUDENTS] list', error);
      return reject(res, 500, 'Não foi possível carregar os alunos ativos.');
    }
  });
  app.get('/api/enrollments', enrollmentRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    const status = req.query.status;
    if (status !== undefined && !isEnrollmentStatus(status)) return reject(res, 400, 'Estado de matrícula inválido.');
    const academicYearId = req.query.academicYearId;
    if (academicYearId !== undefined && !validUuid(academicYearId)) return reject(res, 400, 'Ano letivo inválido.');
    try {
      const result = await enrollmentPool.query(
        `SELECT e.id, e.status, e.created_at, e.updated_at, e.lifecycle_version, e.registration_version, student.name AS student_name,
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

  app.post('/api/enrollments/person-resolution', enrollmentRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    try {
      assertNoClientAuthority(req.body);
      const student = parseEnrollmentStudentInput(req.body?.student);
      const resolution = await resolveStudentForEnrollment(enrollmentPool, context, student);
      return res.json({ resolution: toPublicEnrollmentResolution(resolution) });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  app.post('/api/enrollments/identity-decisions', enrollmentRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    try {
      assertNoClientAuthority(req.body);
      const student = parseEnrollmentStudentInput(req.body?.student);
      const proposedAction = req.body?.proposedAction;
      if (proposedAction !== 'REUSE_PERSON' && proposedAction !== 'CREATE_PERSON' && proposedAction !== 'REVIEW_REQUIRED') {
        return reject(res, 400, 'Ação de decisão de identidade inválida.');
      }
      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'candidatePersonId')) {
        return reject(res, 400, 'A seleção de uma Pessoa é uma autoridade exclusiva do servidor.');
      }
      const decision = await proposeEnrollmentIdentityDecision(enrollmentPool, context, {
        offerId: req.body?.offerId,
        student,
        proposedAction,
        candidatePersonId: null,
        evidenceTypes: Array.isArray(req.body?.evidenceTypes) ? req.body.evidenceTypes : [],
        requestId: typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : null,
        correlationId: typeof req.headers['x-correlation-id'] === 'string' ? req.headers['x-correlation-id'] : null,
      });
      return res.status(201).json({ decision: { ...await readEnrollmentIdentityDecisionForActor(enrollmentPool, context, decision.publicRef), replayed: decision.replayed ?? false } });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  app.get('/api/enrollments/identity-decisions', enrollmentRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    try { return res.json({ decisions: await listEnrollmentIdentityDecisionQueue(enrollmentPool, context) }); } catch (error) { return rejectDomainError(res, error); }
  });

  app.get('/api/enrollments/identity-decisions/:ref', enrollmentRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    try { return res.json({ decision: await readEnrollmentIdentityDecisionForActor(enrollmentPool, context, req.params.ref) }); } catch (error) { return rejectDomainError(res, error); }
  });

  app.post('/api/enrollments/identity-decisions/:ref/outcome', enrollmentRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    try {
      assertNoClientAuthority(req.body ?? {});
      const outcome = req.body?.outcome;
      if (outcome !== 'approve' && outcome !== 'reject' && outcome !== 'request_more_information') {
        return reject(res, 400, 'Resultado de decisão inválido.');
      }
      await readEnrollmentIdentityDecision(enrollmentPool, context, req.params.ref);
      const privateDecision = await (enrollmentPool as any).query('SELECT id FROM identity_resolution_decisions WHERE institution_id = $1 AND public_ref = $2', [context.institutionId, req.params.ref]);
      if (!privateDecision.rowCount) return reject(res, 404, 'Decisão de identidade não encontrada nesta instituição.');
      const decision = await decideEnrollmentIdentityDecision(enrollmentPool, context, privateDecision.rows[0].id, outcome);
      return res.json({ decision: await readEnrollmentIdentityDecisionForActor(enrollmentPool, context, req.params.ref) });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  app.post('/api/enrollments/identity-decisions/:ref/evidence', enrollmentRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    try {
      assertNoClientAuthority(req.body ?? {});
      // Explicitly reject authority-shaped IDs even when nested outside student.
      if (Object.keys(req.body ?? {}).some((key) => /(?:person|decision)[_-]?id/i.test(key))) return reject(res, 400, 'IDs internos não são aceites para evidência.');
      const student = parseEnrollmentStudentInput(req.body?.student);
      const expectedVersion = req.body?.expectedVersion;
      if (!Number.isInteger(expectedVersion) || expectedVersion < 1) return reject(res, 400, 'Versão de decisão inválida.');
      const decision = await submitIdentityDecisionEvidence(enrollmentPool as any, {
        institutionId: context.institutionId, actorPersonId: context.personId, decisionRef: req.params.ref, expectedVersion,
        student, evidenceTypes: Array.isArray(req.body?.evidenceTypes) ? req.body.evidenceTypes : [],
        requestId: typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : null,
        correlationId: typeof req.headers['x-correlation-id'] === 'string' ? req.headers['x-correlation-id'] : null,
      });
      return res.json({ decision: { ...await readEnrollmentIdentityDecisionForActor(enrollmentPool, context, decision.publicRef), replayed: decision.replayed ?? false } });
    } catch (error) { return rejectDomainError(res, error); }
  });

  app.post('/api/enrollments/identity-decisions/:ref/intake', enrollmentRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    try {
      assertNoClientAuthority(req.body ?? {});
      const idempotencyKeyHeader = req.header('Idempotency-Key');
      if (!idempotencyKeyHeader) return reject(res, 400, 'Idempotency-Key é obrigatório para retomar a matrícula.');
      const result = await resumeApprovedIdentityDecisionIntake(enrollmentPool, context, {
        decisionRef: req.params.ref,
        idempotencyKey: idempotencyKeyHeader,
      });
      return res.status(result.replayed ? 200 : 201).json({
        enrollment: { id: result.enrollmentApplicationId, replayed: result.replayed },
      });
    } catch (error) { return rejectDomainError(res, error); }
  });

  app.post('/api/enrollments/intake', enrollmentRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    try {
      assertNoClientAuthority(req.body);
      const student = parseEnrollmentStudentInput(req.body?.student);
      const idempotencyKeyHeader = req.header('Idempotency-Key');
      if (!idempotencyKeyHeader) return reject(res, 400, 'Idempotency-Key é obrigatório para iniciar a matrícula.');
      const result = await startEnrollmentIntake(enrollmentPool, context, {
        offerId: req.body?.offerId,
        student,
        idempotencyKey: idempotencyKeyHeader,
        decisionRef: req.body?.decisionRef ?? null,
      });
      return res.status(result.replayed ? 200 : 201).json({
        enrollment: {
          id: result.enrollmentApplicationId,
          replayed: result.replayed,
        },
      });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // Legacy write paths are intentionally closed. They previously created Person
  // directly or trusted a browser-supplied global Person UUID, bypassing 08B.1.
  app.post('/api/enrollments/drafts', enrollmentRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    return reject(res, 410, 'Fluxo antigo de rascunho desativado. Utilize o intake de matrícula com resolução de identidade.');
  });

  app.post('/api/enrollments', enrollmentRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    return reject(res, 410, 'Fluxo antigo de matrícula desativado. Utilize /api/enrollments/intake.');
  });

  app.post('/api/enrollments/:id/transitions', enrollmentRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    if (!validUuid(req.params.id) || !isEnrollmentStatus(req.body?.toStatus)) return reject(res, 400, 'Pedido de transição inválido.');
    const target = req.body.toStatus as EnrollmentStatus;
    if (target === 'active') {
      return rejectCode(res, 409, 'ACTIVE_REQUIRES_CANONICAL_ACTIVATION', 'A ativação exige a operação canónica de matrícula.');
    }
    const client = await enrollmentPool.connect();
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

        const documents = await client.query<{ document_type: string; required: boolean; status: 'pending' | 'submitted' | 'verified' | 'rejected'; source_requirement_id: string | null }>(
          'SELECT document_type, required, status, source_requirement_id FROM enrollment_documents WHERE enrollment_application_id = $1 AND institution_id = $2',
          [req.params.id, context.institutionId],
        );
        const documentGate = documentValidationGate(
          existing.rows[0].document_policy_id !== null,
          documents.rows.map((row) => ({
            documentType: row.document_type,
            required: row.required,
            status: row.status,
            sourceRequirementId: row.source_requirement_id,
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

}
