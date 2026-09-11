import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { canAccessPayments } from './payment-policy.ts';
import { type Allocation, type AllocationReversal, type ObligationCoveragePositionProjection, type PaymentAllocationPositionProjection } from './allocation-model.ts';
import { PostgresAllocationRepository } from './allocation-repository.ts';
import { AllocationCommandValidationError } from './allocation-service.ts';

const allocationView = (allocation: Allocation) => ({
  id: allocation.id,
  financialAccountId: allocation.financialAccountId,
  paymentId: allocation.paymentId,
  obligationId: allocation.obligationId,
  money: allocation.money.serialize(),
  effectiveAt: allocation.effectiveAt.toISOString(),
  recordedAt: allocation.recordedAt.toISOString(),
  actorKind: allocation.actorKind,
  journalTransactionId: allocation.journalTransactionId,
  status: allocation.status,
});

const reversalView = (reversal: AllocationReversal) => ({
  id: reversal.id,
  originalAllocationId: reversal.originalAllocationId,
  money: reversal.money.serialize(),
  reason: reversal.reason,
  effectiveAt: reversal.effectiveAt.toISOString(),
  recordedAt: reversal.recordedAt.toISOString(),
  actorKind: reversal.actorKind,
  journalTransactionId: reversal.journalTransactionId,
  status: reversal.status,
});

const paymentPositionView = (position: PaymentAllocationPositionProjection) => ({
  state: position.state,
  allocated: position.allocated.serialize(),
  unapplied: position.unapplied.serialize(),
});

const obligationPositionView = (position: ObligationCoveragePositionProjection) => ({
  state: position.state,
  covered: position.covered.serialize(),
  uncovered: position.uncovered.serialize(),
});

export function registerFinanceAllocationRoutes(app: Express, pool: Pool, auth = requireAuth): void {
  const repository = new PostgresAllocationRepository(pool);

  const actor = (req: AuthRequest, res: Response, write = false) => {
    const context = req.institutionalContext;
    if (!context) {
      res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado.' });
      return undefined;
    }
    if (!canAccessPayments(context.role, write ? 'write' : 'read')) {
      res.status(403).json({ code: 'ALLOCATION_FORBIDDEN', error: 'Acesso não autorizado a alocações.' });
      return undefined;
    }
    return context;
  };

  const idempotencyKey = (req: AuthRequest, res: Response) => {
    const value = req.header('Idempotency-Key');
    if (!value || !value.trim()) {
      res.status(422).json({ code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'O cabeçalho Idempotency-Key é obrigatório.' });
      return undefined;
    }
    return value.trim();
  };

  const handle = (res: Response, error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Finance command fingerprint conflict' || (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505')) {
      return res.status(409).json({ code: 'ALLOCATION_CONFLICT', error: 'Conflito de alocação.' });
    }
    // Tenant-scoped repository reads deliberately make a foreign identifier
    // indistinguishable from an absent local resource.
    if (message === 'Original Allocation is required' || message === 'Allocation not found' || message === 'Allocation reversal not found') {
      return res.status(404).json({ code: 'ALLOCATION_NOT_FOUND', error: 'Alocação não encontrada.' });
    }
    if (error instanceof AllocationCommandValidationError) {
      const conflict = /Confirmed Payment|Obligation must be eligible|exceeds .*remaining|currency must match|resources are required/.test(message);
      return res.status(conflict ? 409 : 422).json({
        code: conflict ? 'ALLOCATION_CONFLICT' : 'ALLOCATION_VALIDATION_ERROR',
        error: conflict ? 'A alocação não pode ser confirmada no estado atual.' : message || 'Dados de alocação inválidos.',
      });
    }
    console.error('[ALLOCATION-HTTP] Unexpected error:', error);
    return res.status(500).json({ code: 'ALLOCATION_ERROR', error: 'Operação de alocação falhou.' });
  };

  app.get('/api/finance/allocations', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res);
    if (!context) return;
    const paymentId = typeof req.query.paymentId === 'string' ? req.query.paymentId.trim() : '';
    const obligationId = typeof req.query.obligationId === 'string' ? req.query.obligationId.trim() : '';
    if ((paymentId && obligationId) || (!paymentId && !obligationId)) {
      return res.status(422).json({ code: 'ALLOCATION_QUERY_REQUIRED', error: 'Indique paymentId ou obligationId.' });
    }
    try {
      const allocations = paymentId
        ? await repository.listForPayment(context, paymentId)
        : await repository.listForObligation(context, obligationId);
      return res.json({ allocations: allocations.map(allocationView) });
    } catch (error) {
      return handle(res, error);
    }
  });

  app.post('/api/finance/allocations', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res, true);
    if (!context) return;
    const key = idempotencyKey(req, res);
    if (!key) return;
    try {
      const result = await repository.confirmAllocationInCommand(context, req.body, key);
      return res.status(result.replayed ? 200 : 201).json({
        allocations: result.allocations.map(allocationView),
        replayed: result.replayed,
        paymentPosition: paymentPositionView(result.paymentPosition),
      });
    } catch (error) {
      return handle(res, error);
    }
  });

  app.post('/api/finance/allocations/:allocationId/reversals', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res, true);
    if (!context) return;
    const key = idempotencyKey(req, res);
    if (!key) return;
    try {
      const result = await repository.reverseAllocationInCommand(context, { ...req.body, originalAllocationId: req.params.allocationId }, key);
      return res.status(result.replayed ? 200 : 201).json({ reversal: reversalView(result.reversal), replayed: result.replayed });
    } catch (error) {
      return handle(res, error);
    }
  });
}
