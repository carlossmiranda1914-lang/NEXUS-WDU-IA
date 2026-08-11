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

  app.post('/api/enrollments/drafts', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = enrollmentActor(req, res); if (!context) return;
    const { studentName, guardianName, offerId } = req.body ?? {};
    if (typeof studentName !== 'string' || studentName.trim().length < 3 || studentName.trim().length > 160) return reject(res, 400, 'Indique o nome completo do aluno.');
    if (guardianName !== undefined && (typeof guardianName !== 'string' || guardianName.trim().length < 3 || guardianName.trim().length > 160)) return reject(res, 400, 'O nome do encarregado é inválido.');
    if (!validUuid(offerId)) return reject(res, 400, 'Selecione uma oferta de matrícula válida.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const offer = await client.query<{ academic_year_id: string }>(
        `SELECT o.academic_year_id FROM enrollment_offers o INNER JOIN academic_years y ON y.id = o.academic_year_id
         WHERE o.id = $1 AND o.institution_id = $2 AND o.status = 'active' AND y.status = 'active'`, [offerId, context.institutionId],
      );
      if (!offer.rowCount) { await client.query('ROLLBACK'); return reject(res, 400, 'A oferta não pertence à instituição ou não está ativa.'); }
      const student = await client.query<{ id: string }>(`INSERT INTO people (name) VALUES ($1) RETURNING id`, [studentName.trim()]);
      await client.query(`INSERT INTO student_profiles (institution_id, person_id, status) VALUES ($1, $2, 'inactive')`, [context.institutionId, student.rows[0].id]);
      let guardianPersonId: string | null = null;
      if (guardianName?.trim()) {
        const guardian = await client.query<{ id: string }>(`INSERT INTO people (name) VALUES ($1) RETURNING id`, [guardianName.trim()]);
        guardianPersonId = guardian.rows[0].id;
        await client.query(
          `INSERT INTO guardian_relationships (institution_id, guardian_person_id, student_person_id, relationship)
           VALUES ($1, $2, $3, 'guardian')`, [context.institutionId, guardianPersonId, student.rows[0].id],
        );
      }
      const enrollment = await client.query(
        `INSERT INTO enrollment_applications (institution_id, student_person_id, guardian_person_id, academic_year_id, offer_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id, status, created_at`,
        [context.institutionId, student.rows[0].id, guardianPersonId, offer.rows[0].academic_year_id, offerId, context.personId],
      );
      await client.query(`INSERT INTO enrollment_events (institution_id, enrollment_application_id, actor_person_id, event_type, to_status) VALUES ($1, $2, $3, 'created', 'draft')`, [context.institutionId, enrollment.rows[0].id, context.personId]);
      await client.query('COMMIT');
      res.status(201).json({ enrollment: { ...enrollment.rows[0], student_name: studentName.trim(), guardian_name: guardianName?.trim() || null } });
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (error?.code === '23505') return reject(res, 409, 'Já existe uma matrícula não cancelada para este aluno neste ano letivo.');
      console.error('[ENROLLMENTS] draft', error); return reject(res, 500, 'Não foi possível criar o rascunho de matrícula.');
    } finally { client.release(); }
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
