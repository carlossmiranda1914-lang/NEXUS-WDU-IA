import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { canAccessPayments } from './payment-policy.ts';
import { PostgresObligationDiscountRepository, ObligationDiscountValidationError } from './obligation-discount-repository.ts';
import type { ObligationDiscount, ObligationDiscountRevocation } from './obligation-discount-model.ts';
import type { ObligationFinancialPosition } from './obligation-financial-position.ts';

function serializePosition(pos: ObligationFinancialPosition) {
  return {
    netAdjustments: pos.netAdjustments.serialize(),
    grossDiscounts: pos.grossDiscounts.serialize(),
    revokedDiscounts: pos.revokedDiscounts.serialize(),
    netDiscounts: pos.netDiscounts.serialize(),
    effectiveDue: pos.effectiveDue.serialize(),
    netCovered: pos.netCovered.serialize(),
    remainingCoverable: pos.remainingCoverable.serialize(),
  };
}

function serializeDiscount(d: ObligationDiscount) {
  return {
    ...d,
    amount: d.amount.serialize(),
    appliedAt: d.appliedAt instanceof Date ? d.appliedAt.toISOString() : d.appliedAt,
  };
}

function serializeRevocation(r: ObligationDiscountRevocation) {
  return {
    ...r,
    amount: r.amount.serialize(),
    revokedAt: r.revokedAt instanceof Date ? r.revokedAt.toISOString() : r.revokedAt,
  };
}

export function registerObligationDiscountRoutes(app: Express, pool: Pool, auth = requireAuth) {
  const repository = new PostgresObligationDiscountRepository(pool);

  // 1. Apply Discount Concession
  app.post('/api/finance/obligations/:obligationId/discounts', auth, async (req: AuthRequest, res: Response) => {
    const actor = req.institutionalContext;
    if (!actor) {
      return res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado.' });
    }
    if (!canAccessPayments(actor.role, 'write')) {
      return res.status(403).json({ code: 'DISCOUNT_FORBIDDEN', error: 'Acesso não autorizado a concessão de descontos.' });
    }

    const key = req.header('Idempotency-Key');
    if (!key?.trim()) {
      return res.status(422).json({ code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'O cabeçalho Idempotency-Key é obrigatório.' });
    }

    try {
      const result = await repository.applyObligationDiscount(
        actor,
        { ...req.body, obligationId: req.params.obligationId },
        key
      );
      return res.status(result.replayed ? 200 : 201).json({
        discount: serializeDiscount(result.discount),
        position: serializePosition(result.position),
        replayed: result.replayed,
      });
    } catch (error: any) {
      const message = error instanceof Error ? error.message : '';
      if (/fingerprint conflict/i.test(message)) {
        return res.status(409).json({ code: 'DISCOUNT_CONFLICT', error: 'Conflito de idempotência.' });
      }
      if (/already active|DISCOUNT_ALREADY_ACTIVE/i.test(message)) {
        return res.status(409).json({ code: 'DISCOUNT_ALREADY_ACTIVE', error: message });
      }
      if (/not found|DISCOUNT_NOT_FOUND|Open Obligation is required/i.test(message)) {
        return res.status(404).json({ code: 'DISCOUNT_NOT_FOUND', error: 'Obrigação ou política não encontrada.' });
      }
      if (/DISCOUNT_FLOOR_VIOLATION|below covered|floor/i.test(message)) {
        return res.status(422).json({ code: 'DISCOUNT_FLOOR_VIOLATION', error: message });
      }
      if (/DISCOUNT_CURRENCY_MISMATCH|currency/i.test(message)) {
        return res.status(422).json({ code: 'DISCOUNT_CURRENCY_MISMATCH', error: message });
      }
      if (/DISCOUNT_POLICY_NOT_CURRENTLY_APPLICABLE|no effective policy version/i.test(message)) {
        return res.status(422).json({ code: 'DISCOUNT_POLICY_NOT_CURRENTLY_APPLICABLE', error: message });
      }
      if (error instanceof ObligationDiscountValidationError) {
        return res.status(422).json({ code: error.code || 'DISCOUNT_VALIDATION_ERROR', error: message });
      }
      console.error('[DISCOUNT-HTTP-APPLY]', error);
      return res.status(500).json({ code: 'DISCOUNT_ERROR', error: 'A concessão do desconto falhou.' });
    }
  });

  // 2. Revoke Discount Concession
  app.post(
    '/api/finance/obligations/:obligationId/discounts/:discountId/revoke',
    auth,
    async (req: AuthRequest, res: Response) => {
      const actor = req.institutionalContext;
      if (!actor) {
        return res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado.' });
      }
      if (!canAccessPayments(actor.role, 'write')) {
        return res.status(403).json({ code: 'DISCOUNT_FORBIDDEN', error: 'Acesso não autorizado a revogação de descontos.' });
      }

      const key = req.header('Idempotency-Key');
      if (!key?.trim()) {
        return res.status(422).json({ code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'O cabeçalho Idempotency-Key é obrigatório.' });
      }

      try {
        const result = await repository.revokeObligationDiscount(
          actor,
          {
            obligationId: req.params.obligationId,
            discountId: req.params.discountId,
            reason: req.body.reason,
          },
          key
        );
        return res.status(result.replayed ? 200 : 200).json({
          revocation: serializeRevocation(result.revocation),
          position: serializePosition(result.position),
          replayed: result.replayed,
        });
      } catch (error: any) {
        const message = error instanceof Error ? error.message : '';
        if (/fingerprint conflict/i.test(message)) {
          return res.status(409).json({ code: 'DISCOUNT_CONFLICT', error: 'Conflito de idempotência.' });
        }
        if (/already revoked|DISCOUNT_ALREADY_REVOKED/i.test(message)) {
          return res.status(409).json({ code: 'DISCOUNT_ALREADY_REVOKED', error: message });
        }
        if (/not found|DISCOUNT_NOT_FOUND|Discount application not found/i.test(message)) {
          return res.status(404).json({ code: 'DISCOUNT_NOT_FOUND', error: 'Desconto não encontrado.' });
        }
        if (error instanceof ObligationDiscountValidationError) {
          return res.status(422).json({ code: error.code || 'DISCOUNT_VALIDATION_ERROR', error: message });
        }
        console.error('[DISCOUNT-HTTP-REVOKE]', error);
        return res.status(500).json({ code: 'DISCOUNT_ERROR', error: 'A revogação do desconto falhou.' });
      }
    }
  );
}

