import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { canAccessFeeCatalogue } from './fee-catalogue-policy.ts';
import {
  PostgresFinancialAccountRepository,
  FinancialAccountConflictError,
  FinancialAccountNotFoundError,
} from './financial-account-repository.ts';
import { FinancialAccountValidationError } from './financial-account-model.ts';

export function registerFinancialAccountRoutes(
  app: Express,
  pool: Pool,
  auth = requireAuth,
): void {
  const repo = new PostgresFinancialAccountRepository(pool);

  const actor = (req: AuthRequest, res: Response, write = false) => {
    const c = req.institutionalContext;
    if (!c) {
      res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado' });
      return undefined;
    }
    if (!canAccessFeeCatalogue(c.role, write ? 'write' : 'read')) {
      res.status(403).json({ code: 'FINANCIAL_ACCOUNT_FORBIDDEN', error: 'Acesso não autorizado a contas financeiras' });
      return undefined;
    }
    return c;
  };

  const key = (req: AuthRequest, res: Response) => {
    const v = req.header('Idempotency-Key');
    if (!v) {
      res.status(422).json({ code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'Idempotency-Key is required' });
      return undefined;
    }
    return v;
  };

  const handle = (res: Response, e: unknown) => {
    if (
      e instanceof FinancialAccountNotFoundError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'FINANCIAL_ACCOUNT_NOT_FOUND')
    ) {
      return res.status(404).json({ code: 'FINANCIAL_ACCOUNT_NOT_FOUND', error: (e as Error).message || 'Conta financeira não encontrada' });
    }

    if (
      (typeof e === 'object' && e !== null && (e as Error).message === 'Finance command fingerprint conflict') ||
      e instanceof FinancialAccountConflictError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'FINANCIAL_ACCOUNT_CONFLICT') ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505')
    ) {
      return res.status(409).json({ code: 'FINANCIAL_ACCOUNT_CONFLICT', error: (e as Error).message || 'Conflito de conta financeira' });
    }

    if (
      e instanceof FinancialAccountValidationError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'FINANCIAL_ACCOUNT_VALIDATION_ERROR')
    ) {
      return res.status(422).json({ code: 'FINANCIAL_ACCOUNT_VALIDATION_ERROR', error: (e as Error).message || 'Dados inválidos' });
    }

    console.error('[FINANCIAL-ACCOUNT-HTTP] Unexpected error:', e);
    return res.status(500).json({ code: 'FINANCIAL_ACCOUNT_ERROR', error: 'Operação de conta financeira falhou' });
  };

  app.get('/api/finance/financial-accounts/persons', auth, async (req: AuthRequest, res) => {
    const actorCtx = actor(req, res, false);
    if (!actorCtx) return;
    try {
      const result = await pool.query<{ id: string; name: string; email: string | null }>(
        `SELECT DISTINCT p.id, p.name, NULL::text AS email
         FROM people p
         WHERE EXISTS (SELECT 1 FROM memberships m WHERE m.institution_id = $1 AND m.person_id = p.id)
            OR EXISTS (SELECT 1 FROM enrollment_applications ea WHERE ea.institution_id = $1 AND (ea.student_person_id = p.id OR ea.guardian_person_id = p.id))
         ORDER BY p.name ASC`,
        [actorCtx.institutionId],
      );
      res.json(result.rows);
    } catch (e) {
      handle(res, e);
    }
  });

  app.get('/api/finance/financial-accounts', auth, async (req: AuthRequest, res) => {
    const actorCtx = actor(req, res, false);
    if (!actorCtx) return;
    try {
      const status = typeof req.query.status === 'string' ? (req.query.status as any) : 'all';
      const items = await repo.list(actorCtx, status);
      res.json(items);
    } catch (e) {
      handle(res, e);
    }
  });

  app.get('/api/finance/financial-accounts/:id', auth, async (req: AuthRequest, res) => {
    const actorCtx = actor(req, res, false);
    if (!actorCtx) return;
    try {
      const item = await repo.getById(actorCtx, req.params.id);
      res.json(item);
    } catch (e) {
      handle(res, e);
    }
  });

  app.post('/api/finance/financial-accounts', auth, async (req: AuthRequest, res) => {
    const actorCtx = actor(req, res, true);
    if (!actorCtx) return;
    const idempotencyKey = key(req, res);
    if (!idempotencyKey) return;

    try {
      const created = await repo.create(actorCtx, req.body, idempotencyKey);
      res.status(201).json(created);
    } catch (e) {
      handle(res, e);
    }
  });

  for (const path of ['activate', 'deactivate'] as const) {
    app.post(`/api/finance/financial-accounts/:id/${path}`, auth, async (req: AuthRequest, res) => {
      const actorCtx = actor(req, res, true);
      if (!actorCtx) return;
      const idempotencyKey = key(req, res);
      if (!idempotencyKey) return;

      try {
        const updated = await repo.setStatus(actorCtx, req.params.id, path === 'activate' ? 'active' : 'inactive');
        res.json(updated);
      } catch (e) {
        handle(res, e);
      }
    });
  }
}
