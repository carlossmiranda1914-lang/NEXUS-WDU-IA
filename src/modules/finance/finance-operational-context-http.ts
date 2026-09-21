import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { canAccessPayments } from './payment-policy.ts';
import {
  PostgresFinanceOperationalContextRepository,
  AmbiguousFinancialAccountError,
  StudentNotFoundError,
  EnrollmentNotFoundError,
} from './finance-operational-context-repository.ts';
import { FinancialAccountNotFoundError } from './financial-account-repository.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STUDENT_REF_REGEX = /^stu_[A-Za-z0-9_-]{22}$/;

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
      e instanceof AmbiguousFinancialAccountError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'AMBIGUOUS_FINANCIAL_ACCOUNT')
    ) {
      return res.status(409).json({ code: 'AMBIGUOUS_FINANCIAL_ACCOUNT', error: (e as Error).message });
    }

    if (
      e instanceof StudentNotFoundError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'STUDENT_NOT_FOUND')
    ) {
      return res.status(404).json({ code: 'STUDENT_NOT_FOUND', error: (e as Error).message });
    }

    if (
      e instanceof EnrollmentNotFoundError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'ENROLLMENT_NOT_FOUND')
    ) {
      return res.status(404).json({ code: 'ENROLLMENT_NOT_FOUND', error: (e as Error).message });
    }

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
    const studentRef = req.query.studentRef;
    const enrollmentId = req.query.enrollmentId;

    if (typeof financialAccountId === 'string' && financialAccountId.trim()) {
      if (!UUID_REGEX.test(financialAccountId.trim())) {
        return res.status(400).json({
          code: 'INVALID_FINANCIAL_ACCOUNT_ID',
          error: 'Parâmetro financialAccountId inválido.',
        });
      }
      try {
        const context = await repo.getByFinancialAccountId(actorCtx, financialAccountId.trim());
        return res.json(context);
      } catch (e) {
        return handle(res, e);
      }
    }

    if (typeof studentRef === 'string' && studentRef.trim()) {
      if (!STUDENT_REF_REGEX.test(studentRef.trim())) {
        return res.status(400).json({
          code: 'INVALID_STUDENT_REF',
          error: 'Parâmetro studentRef inválido.',
        });
      }
      try {
        const context = await repo.getByStudentRef(actorCtx, studentRef.trim());
        return res.json(context);
      } catch (e) {
        return handle(res, e);
      }
    }

    if (typeof enrollmentId === 'string' && enrollmentId.trim()) {
      if (!UUID_REGEX.test(enrollmentId.trim())) {
        return res.status(400).json({
          code: 'INVALID_ENROLLMENT_ID',
          error: 'Parâmetro enrollmentId inválido.',
        });
      }
      try {
        const context = await repo.getByEnrollmentId(actorCtx, enrollmentId.trim());
        return res.json(context);
      } catch (e) {
        return handle(res, e);
      }
    }

    return res.status(400).json({
      code: 'INVALID_QUERY_PARAMS',
      error: 'É obrigatório fornecer financialAccountId, studentRef ou enrollmentId.',
    });
  });
}
