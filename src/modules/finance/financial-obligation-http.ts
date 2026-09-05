import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { canAccessFeeCatalogue } from './fee-catalogue-policy.ts';
import {
  PostgresFinancialObligationRepository,
  FinancialObligationConflictError,
  FinancialObligationNotFoundError,
} from './financial-obligation-repository.ts';
import { FinancialObligationValidationError } from './financial-obligation-model.ts';
import type { FinancialProfileStore } from './financial-context.ts';

export function registerFinancialObligationRoutes(
  app: Express,
  pool: Pool,
  profiles: FinancialProfileStore,
  auth = requireAuth,
): void {
  const repo = new PostgresFinancialObligationRepository(pool, profiles);

  const actor = (req: AuthRequest, res: Response, write = false) => {
    const c = req.institutionalContext;
    if (!c) {
      res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado' });
      return undefined;
    }
    if (!canAccessFeeCatalogue(c.role, write ? 'write' : 'read')) {
      res.status(403).json({ code: 'FINANCIAL_OBLIGATION_FORBIDDEN', error: 'Acesso não autorizado a obrigações financeiras' });
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
      e instanceof FinancialObligationNotFoundError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'FINANCIAL_OBLIGATION_NOT_FOUND')
    ) {
      return res.status(404).json({ code: 'FINANCIAL_OBLIGATION_NOT_FOUND', error: (e as Error).message || 'Obrigação financeira não encontrada' });
    }

    if (
      e instanceof FinancialObligationConflictError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'FINANCIAL_OBLIGATION_CONFLICT') ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505')
    ) {
      return res.status(409).json({ code: 'FINANCIAL_OBLIGATION_CONFLICT', error: (e as Error).message || 'Conflito de obrigação financeira' });
    }

    if (
      e instanceof FinancialObligationValidationError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'FINANCIAL_OBLIGATION_VALIDATION_ERROR')
    ) {
      return res.status(422).json({ code: 'FINANCIAL_OBLIGATION_VALIDATION_ERROR', error: (e as Error).message || 'Dados de obrigação inválidos' });
    }

    console.error('[FINANCIAL-OBLIGATION-HTTP] Unexpected error:', e);
    return res.status(500).json({ code: 'FINANCIAL_OBLIGATION_ERROR', error: 'Operação de obrigação financeira falhou' });
  };

  app.get('/api/finance/obligations', auth, async (req: AuthRequest, res) => {
    const actorCtx = actor(req, res, false);
    if (!actorCtx) return;
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const financialAccountId = typeof req.query.financialAccountId === 'string' ? req.query.financialAccountId : undefined;
      const items = await repo.list(actorCtx, { status, financialAccountId });
      res.json(items);
    } catch (e) {
      handle(res, e);
    }
  });

  app.get('/api/finance/obligations/:id', auth, async (req: AuthRequest, res) => {
    const actorCtx = actor(req, res, false);
    if (!actorCtx) return;
    try {
      const item = await repo.getById(actorCtx, req.params.id);
      res.json(item);
    } catch (e) {
      handle(res, e);
    }
  });

  app.post('/api/finance/obligations', auth, async (req: AuthRequest, res) => {
    const actorCtx = actor(req, res, true);
    if (!actorCtx) return;
    const idempotencyKey = key(req, res);
    if (!idempotencyKey) return;

    try {
      const created = await repo.issue(actorCtx, req.body, idempotencyKey);
      res.status(201).json(created);
    } catch (e) {
      handle(res, e);
    }
  });

  app.post('/api/finance/obligations/:id/cancel', auth, async (req: AuthRequest, res) => {
    const actorCtx = actor(req, res, true);
    if (!actorCtx) return;
    const idempotencyKey = key(req, res);
    if (!idempotencyKey) return;

    try {
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : 'Cancelamento manual';
      const cancelled = await repo.cancel(actorCtx, req.params.id, reason);
      res.json(cancelled);
    } catch (e) {
      handle(res, e);
    }
  });
}
