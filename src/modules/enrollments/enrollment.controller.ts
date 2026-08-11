import { Application, Response } from 'express';
import { pool } from '../../db/index.ts';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { canManageEnrollment, canTransitionEnrollment, EnrollmentStatus, isEnrollmentStatus } from './enrollment-policy.ts';

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

export function registerEnrollmentRoutes(app: Application) {
  app.get('/api/enrollments', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    const status = req.query.status;
    if (status !== undefined && !isEnrollmentStatus(status)) return reject(res, 400, 'Estado de matrícula inválido.');
    const result = await pool.query(
      `SELECT id, student_person_id, guardian_person_id, academic_year_id, offer_id, status, created_at, updated_at
       FROM enrollment_applications WHERE institution_id = $1
       AND ($2::text IS NULL OR status = $2) ORDER BY updated_at DESC`,
      [context.institutionId, status ?? null],
    );
    res.json({ enrollments: result.rows });
  });

  app.post('/api/enrollments', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    const { studentPersonId, guardianPersonId, academicYearId, offerId } = req.body ?? {};
    if (![studentPersonId, academicYearId, offerId].every(validUuid) || (guardianPersonId !== undefined && guardianPersonId !== null && !validUuid(guardianPersonId))) {
      return reject(res, 400, 'Os identificadores da matrícula têm de ser UUIDs válidos.');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const offer = await client.query(
        `SELECT 1 FROM enrollment_offers WHERE id = $1 AND institution_id = $2 AND academic_year_id = $3 AND status = 'active'`,
        [offerId, context.institutionId, academicYearId],
      );
      if (!offer.rowCount) { await client.query('ROLLBACK'); return reject(res, 400, 'A oferta não pertence à instituição ou não está ativa.'); }
      const created = await client.query(
        `INSERT INTO enrollment_applications (institution_id, student_person_id, guardian_person_id, academic_year_id, offer_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id, status, created_at`,
        [context.institutionId, studentPersonId, guardianPersonId ?? null, academicYearId, offerId, context.personId],
      );
      await client.query(
        `INSERT INTO enrollment_events (institution_id, enrollment_application_id, actor_person_id, event_type, to_status)
         VALUES ($1, $2, $3, 'created', 'draft')`,
        [context.institutionId, created.rows[0].id, context.personId],
      );
      await client.query('COMMIT');
      res.status(201).json({ enrollment: created.rows[0] });
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (error?.code === '23505') return reject(res, 409, 'Já existe uma matrícula não cancelada para este aluno neste ano letivo.');
      throw error;
    } finally { client.release(); }
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
