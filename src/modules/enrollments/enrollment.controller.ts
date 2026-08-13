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
import { canConfigureEnrollment, canManageEnrollment, canTransitionEnrollment, EnrollmentStatus, isEnrollmentStatus } from './enrollment-policy.ts';
import { registerAcademicYearRoutes } from './academic-year.controller.ts';
import { registerEnrollmentDocumentRoutes } from './enrollment-document.controller.ts';

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

function enrollmentConfigurator(req: AuthRequest, res: Response) {
  const context = enrollmentActor(req, res); if (!context) return null;
  if (!canConfigureEnrollment(context.role)) { reject(res, 403, 'Apenas a administração ou direção pode configurar o ano letivo e as ofertas.'); return null; }
  return context;
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
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
  app.get('/api/enrollments/setup', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentConfigurator(req, res); if (!context) return;
    try {
      const result = await pool.query(
        `SELECT y.id AS academic_year_id, y.name AS academic_year_name, y.starts_on, y.ends_on, y.status AS academic_year_status,
                o.id AS offer_id, o.name AS offer_name, o.code AS offer_code, o.status AS offer_status
           FROM academic_years y
      LEFT JOIN enrollment_offers o ON o.academic_year_id = y.id AND o.institution_id = y.institution_id
          WHERE y.institution_id = $1
          ORDER BY y.starts_on DESC, o.name ASC`, [context.institutionId],
      );
      res.json({ configuration: result.rows });
    } catch (error) { console.error('[ENROLLMENTS] setup list', error); return reject(res, 500, 'Não foi possível carregar a configuração institucional.'); }
  });

  app.post('/api/enrollments/setup', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentConfigurator(req, res); if (!context) return;
    const { academicYearName, startsOn, endsOn, offerName, offerCode } = req.body ?? {};
    if (typeof academicYearName !== 'string' || academicYearName.trim().length < 4 || academicYearName.trim().length > 80) return reject(res, 400, 'Indique o nome do ano letivo.');
    if (!validDate(startsOn) || !validDate(endsOn) || startsOn >= endsOn) return reject(res, 400, 'Indique datas válidas para o ano letivo.');
    if (typeof offerName !== 'string' || offerName.trim().length < 2 || offerName.trim().length > 160) return reject(res, 400, 'Indique o nome da oferta de matrícula.');
    if (typeof offerCode !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/.test(offerCode)) return reject(res, 400, 'O código da oferta deve ter entre 2 e 40 letras, números, hífen ou sublinhado.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const year = await client.query<{ id: string }>(
        `INSERT INTO academic_years (institution_id, name, starts_on, ends_on, status)
         VALUES ($1, $2, $3, $4, 'active')
         ON CONFLICT (institution_id, name) DO UPDATE SET starts_on = EXCLUDED.starts_on, ends_on = EXCLUDED.ends_on, status = 'active', updated_at = now()
         RETURNING id`, [context.institutionId, academicYearName.trim(), startsOn, endsOn],
      );
      const offer = await client.query<{ id: string }>(
        `INSERT INTO enrollment_offers (institution_id, academic_year_id, name, code, status)
         VALUES ($1, $2, $3, $4, 'active')
         ON CONFLICT (institution_id, code) DO UPDATE SET academic_year_id = EXCLUDED.academic_year_id, name = EXCLUDED.name, status = 'active', updated_at = now()
         RETURNING id`, [context.institutionId, year.rows[0].id, offerName.trim(), offerCode.trim()],
      );
      await client.query('COMMIT');
      res.status(201).json({ academicYearId: year.rows[0].id, offerId: offer.rows[0].id });
    } catch (error) {
      await client.query('ROLLBACK'); console.error('[ENROLLMENTS] setup create', error); return reject(res, 500, 'Não foi possível guardar a configuração institucional.');
    } finally { client.release(); }
  });

  app.get('/api/enrollments/context', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    try {
      const result = await pool.query(
        `SELECT o.id, o.name, o.code, o.academic_year_id, y.name AS academic_year_name
         FROM enrollment_offers o INNER JOIN academic_years y ON y.id = o.academic_year_id
         WHERE o.institution_id = $1 AND o.status = 'active' AND y.status = 'active'
         ORDER BY y.starts_on DESC, o.name ASC`, [context.institutionId],
      );
      res.json({ institution: { id: context.institutionId, name: context.institutionName }, offers: result.rows });
    } catch (error) { console.error('[ENROLLMENTS] context', error); return reject(res, 500, 'Não foi possível carregar a configuração de matrícula.'); }
  });

  app.get('/api/enrollments', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    const status = req.query.status;
    if (status !== undefined && !isEnrollmentStatus(status)) return reject(res, 400, 'Estado de matrícula inválido.');
    try {
      const result = await pool.query(
        `SELECT e.id, e.status, e.created_at, e.updated_at, student.name AS student_name,
          guardian.name AS guardian_name, offer.name AS offer_name, year.name AS academic_year_name
         FROM enrollment_applications e
         INNER JOIN people student ON student.id = e.student_person_id
         LEFT JOIN people guardian ON guardian.id = e.guardian_person_id
         INNER JOIN enrollment_offers offer ON offer.id = e.offer_id
         INNER JOIN academic_years year ON year.id = e.academic_year_id
         WHERE e.institution_id = $1 AND ($2::text IS NULL OR e.status = $2) ORDER BY e.updated_at DESC`,
        [context.institutionId, status ?? null],
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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query<{ status: EnrollmentStatus }>(
        `SELECT status FROM enrollment_applications WHERE id = $1 AND institution_id = $2 FOR UPDATE`, [req.params.id, context.institutionId],
      );
      if (!existing.rowCount) { await client.query('ROLLBACK'); return reject(res, 404, 'Matrícula não encontrada nesta instituição.'); }
      const from = existing.rows[0].status;
      if (!canTransitionEnrollment(context.role, from, target)) { await client.query('ROLLBACK'); return reject(res, 403, 'Transição de matrícula não autorizada.'); }
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

