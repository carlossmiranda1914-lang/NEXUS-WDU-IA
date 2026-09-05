import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { canAccessPayments } from './payment-policy.ts';
import {
  PostgresFinanceOperationalContextRepository,
} from './finance-operational-context-repository.ts';
import { FinancialAccountNotFoundError } from './financial-account-repository.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerFinanceOperationalContextRoutes(
  app: Express,
  pool: Pool,
  auth = requireAuth
): void {
  const repo = new PostgresFinanceOperationalContextRepository(pool);

  const actor = (req: AuthRequest, res: Response) => {
    const c = req.institutionalContext;
    if (!c) {
      res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado.' });
      return undefined;
    }
    if (!canAccessPayments(c.role, 'read')) {
      res.status(403).json({ code: 'FINANCE_FORBIDDEN', error: 'Acesso não autorizado ao contexto financeiro operacional.' });
      return undefined;
    }
    return c;
  };

  const handle = (res: Response, e: unknown) => {
    if (
      e instanceof FinancialAccountNotFoundError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'FINANCIAL_ACCOUNT_NOT_FOUND')
    ) {
      return res.status(404).json({ code: 'FINANCIAL_ACCOUNT_NOT_FOUND', error: (e as Error).message || 'Conta financeira não encontrada.' });
    }

    console.error('[FINANCE-OPERATIONAL-CONTEXT-HTTP] Unexpected error:', e);
    return res.status(500).json({ code: 'INTERNAL_ERROR', error: 'Erro ao carregar o contexto financeiro operacional.' });
  };

  app.get('/api/finance/operational-context', auth, async (req: AuthRequest, res) => {
    const actorCtx = actor(req, res);
    if (!actorCtx) return;

    const financialAccountId = req.query.financialAccountId;
    if (typeof financialAccountId !== 'string' || !UUID_REGEX.test(financialAccountId.trim())) {
      return res.status(400).json({
        code: 'INVALID_FINANCIAL_ACCOUNT_ID',
        error: 'Parâmetro financialAccountId inválido ou em falta.',
      });
    }

    try {
      const context = await repo.getByFinancialAccountId(actorCtx, financialAccountId.trim());
      res.json(context);
    } catch (e) {
      handle(res, e);
    }
  });
}
