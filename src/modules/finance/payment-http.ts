import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { canAccessPayments } from './payment-policy.ts';
import {
  PostgresPaymentRepository,
  PaymentNotFoundError,
  PaymentConflictError,
} from './payment-repository.ts';
import { PaymentValidationError } from './payment-model.ts';
import { confirmIncomingPayment } from './payment-service.ts';
import type { FinancialProfileStore } from './financial-context.ts';

export function registerPaymentRoutes(
  app: Express,
  pool: Pool,
  profiles: FinancialProfileStore,
  auth = requireAuth
): void {
  const repo = new PostgresPaymentRepository(pool);

  const actor = (req: AuthRequest, res: Response, write = false) => {
    const c = req.institutionalContext;
    if (!c) {
      res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado.' });
      return undefined;
    }
    if (!canAccessPayments(c.role, write ? 'write' : 'read')) {
      res.status(403).json({ code: 'PAYMENT_FORBIDDEN', error: 'Acesso não autorizado a pagamentos.' });
      return undefined;
    }
    return c;
  };

  const key = (req: AuthRequest, res: Response) => {
    const v = req.header('Idempotency-Key');
    if (!v || !v.trim()) {
      res.status(422).json({ code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'O cabeçalho Idempotency-Key é obrigatório.' });
      return undefined;
    }
    return v.trim();
  };

  const handle = (res: Response, e: unknown) => {
    if (
      e instanceof PaymentNotFoundError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'PAYMENT_NOT_FOUND')
    ) {
      return res.status(404).json({ code: 'PAYMENT_NOT_FOUND', error: (e as Error).message || 'Recebimento não encontrado.' });
    }

    if (
      (typeof e === 'object' && e !== null && (e as Error).message === 'Finance command fingerprint conflict') ||
      e instanceof PaymentConflictError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'PAYMENT_CONFLICT') ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505')
    ) {
      return res.status(409).json({ code: 'PAYMENT_CONFLICT', error: (e as Error).message || 'Conflito de pagamento/recebimento.' });
    }

    if (
      e instanceof PaymentValidationError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'PAYMENT_VALIDATION_ERROR')
    ) {
      return res.status(422).json({ code: 'PAYMENT_VALIDATION_ERROR', error: (e as Error).message || 'Dados de pagamento inválidos.' });
    }

    if (
      typeof e === 'object' && e !== null &&
      ((e as Error).message.includes('Financial profile') || (e as Error).message.includes('financial profile'))
    ) {
      return res.status(422).json({ code: 'FINANCIAL_PROFILE_UNAVAILABLE', error: (e as Error).message });
    }

    console.error('[PAYMENT-HTTP] Unexpected error:', e);
    return res.status(500).json({ code: 'PAYMENT_ERROR', error: 'Operação de pagamento falhou.' });
  };

  app.get('/api/finance/payments', auth, async (req: AuthRequest, res) => {
    const actorCtx = actor(req, res, false);
    if (!actorCtx) return;
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const financialAccountId = typeof req.query.financialAccountId === 'string' ? req.query.financialAccountId : undefined;
      const sourceType = typeof req.query.sourceType === 'string' ? req.query.sourceType : undefined;
      const items = await repo.list(actorCtx, { status, financialAccountId, sourceType });
      res.json(items);
    } catch (e) {
      handle(res, e);
    }
  });

  app.get('/api/finance/payments/:id', auth, async (req: AuthRequest, res) => {
    const actorCtx = actor(req, res, false);
    if (!actorCtx) return;
    try {
      const item = await repo.getById(actorCtx, req.params.id);
      res.json(item);
    } catch (e) {
      handle(res, e);
    }
  });

  app.post('/api/finance/payments/manual', auth, async (req: AuthRequest, res) => {
    const actorCtx = actor(req, res, true);
    if (!actorCtx) return;
    const idempKey = key(req, res);
    if (!idempKey) return;
    try {
      const result = await confirmIncomingPayment(
        pool,
        profiles,
        actorCtx,
        { ...req.body, sourceType: 'manual_offline' },
        idempKey
      );
      const statusCode = result.replayed ? 200 : 201;
      res.status(statusCode).json(result);
    } catch (e) {
      handle(res, e);
    }
  });
}
