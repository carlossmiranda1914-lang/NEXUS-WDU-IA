import { Application, RequestHandler, Response } from 'express';
import { pool } from '../../db/index.ts';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import {
  AcademicYearStatus,
  canEditAcademicYearDefinition,
  canManageAcademicYear,
  canTransitionAcademicYear,
} from './academic-year-policy.ts';
import { resolveEnrollmentTemporalContext } from './enrollment-temporal-context.ts';

function reject(res: Response, status: number, error: string) {
  return res.status(status).json({ error });
}

function rejectCode(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ code, message });
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validDate(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function institutionActor(req: AuthRequest, res: Response) {
  const context = req.institutionalContext;
  if (!context) {
    reject(res, 401, 'Autenticação institucional necessária.');
    return null;
  }
  return context;
}

function academicYearActor(req: AuthRequest, res: Response) {
  const context = institutionActor(req, res);
  if (!context) return null;
  if (!canManageAcademicYear(context.role)) {
    reject(res, 403, 'Apenas a administração ou direção pode gerir anos letivos.');
    return null;
  }
  return context;
}

function parseDefinition(body: unknown) {
  const input = (body ?? {}) as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const startsOn = input.startsOn;
  const endsOn = input.endsOn;
  if (name.length < 4 || name.length > 80) return { error: 'Indique o nome do ano letivo.' } as const;
  if (!validDate(startsOn) || !validDate(endsOn) || startsOn >= endsOn) {
    return { error: 'Indique datas válidas para o ano letivo.' } as const;
  }
  return { name, startsOn, endsOn } as const;
}

function expectedVersion(body: unknown): number | null {
  const value = Number((body as Record<string, unknown> | undefined)?.expectedVersion);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Production defaults are canonical; dependencies only make the same routes testable. */
export function registerAcademicYearRoutes(
  app: Application,
  dependencies: { pool?: typeof pool; requireAuth?: RequestHandler } = {},
) {
  const academicPool = dependencies.pool ?? pool;
  const academicRequireAuth = dependencies.requireAuth ?? requireAuth;

  app.get('/api/enrollments/context', academicRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = institutionActor(req, res); if (!context) return;
    try {
      const temporal = await resolveEnrollmentTemporalContext(academicPool, context.institutionId);
      return res.json({
        institution: { id: context.institutionId, name: context.institutionName },
        permissions: {
          canActivateEnrollment: context.role === 'institution_admin' || context.role === 'director',
        },
        academicYear: temporal.academicYear,
        offers: temporal.offers.map((offer) => ({
          id: offer.id,
          name: offer.name,
          code: offer.code,
          academicYearId: offer.academicYearId,
          academic_year_id: offer.academicYearId,
          academic_year_name: temporal.academicYear?.name ?? null,
        })),
      });
    } catch (error) {
      console.error('[ENROLLMENTS] temporal context', error);
      return reject(res, 500, 'Não foi possível carregar o contexto temporal de matrícula.');
    }
  });

  app.post('/api/enrollments/setup', academicRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = academicYearActor(req, res); if (!context) return;
    return reject(res, 410, 'Configuração legada desativada. Gira o ano letivo através de /api/academic-years e as ofertas separadamente.');
  });

  app.get('/api/academic-years', academicRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = academicYearActor(req, res); if (!context) return;
    try {
      const result = await academicPool.query(
        `SELECT id, name, starts_on, ends_on, status, version, created_at, updated_at
           FROM academic_years
          WHERE institution_id = $1
          ORDER BY starts_on DESC, name ASC`,
        [context.institutionId],
      );
      return res.json({ academicYears: result.rows });
    } catch (error) {
      console.error('[ACADEMIC-YEARS] list', error);
      return reject(res, 500, 'Não foi possível carregar os anos letivos.');
    }
  });

  app.post('/api/academic-years', academicRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = academicYearActor(req, res); if (!context) return;
    const definition = parseDefinition(req.body);
    if ('error' in definition) return reject(res, 400, definition.error);
    try {
      const result = await academicPool.query(
        `INSERT INTO academic_years (institution_id, name, starts_on, ends_on, status)
         VALUES ($1, $2, $3, $4, 'draft')
         RETURNING id, name, starts_on, ends_on, status, version, created_at, updated_at`,
        [context.institutionId, definition.name, definition.startsOn, definition.endsOn],
      );
      return res.status(201).json({ academicYear: result.rows[0] });
    } catch (error: any) {
      if (error?.code === '23505') return reject(res, 409, 'Já existe um ano letivo com este nome nesta instituição.');
      console.error('[ACADEMIC-YEARS] create', error);
      return reject(res, 500, 'Não foi possível criar o ano letivo.');
    }
  });

  app.patch('/api/academic-years/:id', academicRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = academicYearActor(req, res); if (!context) return;
    if (!validUuid(req.params.id)) return reject(res, 400, 'Ano letivo inválido.');
    const definition = parseDefinition(req.body);
    if ('error' in definition) return reject(res, 400, definition.error);
    const version = expectedVersion(req.body);
    if (!version) return reject(res, 400, 'Indique a versão atual do ano letivo.');
    const client = await academicPool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query<{ status: AcademicYearStatus; version: string }>(
        `SELECT status, version FROM academic_years WHERE id = $1 AND institution_id = $2 FOR UPDATE`,
        [req.params.id, context.institutionId],
      );
      if (!existing.rowCount) { await client.query('ROLLBACK'); return reject(res, 404, 'Ano letivo não encontrado nesta instituição.'); }
      if (Number(existing.rows[0].version) !== version) { await client.query('ROLLBACK'); return rejectCode(res, 409, 'STALE_VERSION', 'O ano letivo foi alterado entretanto. Atualize os dados antes de tentar novamente.'); }
      if (!canEditAcademicYearDefinition(existing.rows[0].status)) {
        await client.query('ROLLBACK');
        return reject(res, 409, 'A definição do ano letivo só pode ser alterada enquanto estiver em Planeamento.');
      }
      const updated = await client.query(
        `UPDATE academic_years
            SET name = $1, starts_on = $2, ends_on = $3, version = version + 1, updated_at = now()
          WHERE id = $4 AND institution_id = $5 AND version = $6
          RETURNING id, name, starts_on, ends_on, status, version, created_at, updated_at`,
        [definition.name, definition.startsOn, definition.endsOn, req.params.id, context.institutionId, version],
      );
      await client.query('COMMIT');
      return res.json({ academicYear: updated.rows[0] });
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (error?.code === '23505') return reject(res, 409, 'Já existe um ano letivo com este nome nesta instituição.');
      console.error('[ACADEMIC-YEARS] update', error);
      return reject(res, 500, 'Não foi possível atualizar o ano letivo.');
    } finally {
      client.release();
    }
  });

  app.post('/api/academic-years/:id/activate', academicRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = academicYearActor(req, res); if (!context) return;
    if (!validUuid(req.params.id)) return reject(res, 400, 'Ano letivo inválido.');
    const version = expectedVersion(req.body);
    if (!version) return reject(res, 400, 'Indique a versão atual do ano letivo.');
    const client = await academicPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM institutions WHERE id = $1 FOR UPDATE', [context.institutionId]);
      const existing = await client.query<{ status: AcademicYearStatus; version: string }>(
        `SELECT status, version FROM academic_years WHERE id = $1 AND institution_id = $2 FOR UPDATE`,
        [req.params.id, context.institutionId],
      );
      if (!existing.rowCount) { await client.query('ROLLBACK'); return reject(res, 404, 'Ano letivo não encontrado nesta instituição.'); }
      if (Number(existing.rows[0].version) !== version) { await client.query('ROLLBACK'); return rejectCode(res, 409, 'STALE_VERSION', 'O ano letivo foi alterado entretanto. Atualize os dados antes de tentar novamente.'); }
      const from = existing.rows[0].status;
      if (!canTransitionAcademicYear(context.role, from, 'active')) {
        await client.query('ROLLBACK');
        return reject(res, 409, 'Este ano letivo não pode ser ativado a partir do estado atual.');
      }
      const updated = await client.query(
        `UPDATE academic_years SET status = 'active', version = version + 1, updated_at = now()
          WHERE id = $1 AND institution_id = $2 AND version = $3
          RETURNING id, name, starts_on, ends_on, status, version, created_at, updated_at`,
        [req.params.id, context.institutionId, version],
      );
      await client.query('COMMIT');
      return res.json({ academicYear: updated.rows[0] });
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (error?.code === '23505') return reject(res, 409, 'Já existe um ano letivo Ativo nesta instituição.');
      console.error('[ACADEMIC-YEARS] activate', error);
      return reject(res, 500, 'Não foi possível ativar o ano letivo.');
    } finally {
      client.release();
    }
  });

  app.post('/api/academic-years/:id/close', academicRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = academicYearActor(req, res); if (!context) return;
    if (!validUuid(req.params.id)) return reject(res, 400, 'Ano letivo inválido.');
    const version = expectedVersion(req.body);
    if (!version) return reject(res, 400, 'Indique a versão atual do ano letivo.');
    const client = await academicPool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query<{ status: AcademicYearStatus; version: string }>(
        `SELECT status, version FROM academic_years WHERE id = $1 AND institution_id = $2 FOR UPDATE`,
        [req.params.id, context.institutionId],
      );
      if (!existing.rowCount) { await client.query('ROLLBACK'); return reject(res, 404, 'Ano letivo não encontrado nesta instituição.'); }
      if (Number(existing.rows[0].version) !== version) { await client.query('ROLLBACK'); return rejectCode(res, 409, 'STALE_VERSION', 'O ano letivo foi alterado entretanto. Atualize os dados antes de tentar novamente.'); }
      const from = existing.rows[0].status;
      if (!canTransitionAcademicYear(context.role, from, 'closed')) {
        await client.query('ROLLBACK');
        return reject(res, 409, 'Este ano letivo não pode ser encerrado a partir do estado atual.');
      }
      const updated = await client.query(
        `UPDATE academic_years SET status = 'closed', version = version + 1, updated_at = now()
          WHERE id = $1 AND institution_id = $2 AND version = $3
          RETURNING id, name, starts_on, ends_on, status, version, created_at, updated_at`,
        [req.params.id, context.institutionId, version],
      );
      await client.query('COMMIT');
      return res.json({ academicYear: updated.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[ACADEMIC-YEARS] close', error);
      return reject(res, 500, 'Não foi possível encerrar o ano letivo.');
    } finally {
      client.release();
    }
  });
}
