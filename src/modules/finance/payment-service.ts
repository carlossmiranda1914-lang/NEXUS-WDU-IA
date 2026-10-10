import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import { FinancialProfileStore, requireFinancialContext } from './financial-context.ts';
import {
  ConfirmIncomingPaymentIntent,
  Payment,
  PaymentValidationError,
  normalizeConfirmIncomingPaymentIntent,
} from './payment-model.ts';
import { PostgresPaymentRepository } from './payment-repository.ts';
import { executeIdempotentFinanceCommand } from './finance-command.ts';

export function createPaymentConfirmationFingerprint(intent: ConfirmIncomingPaymentIntent): string {
  const payload = {
    institutionId: intent.institutionId,
    sourceType: intent.sourceType,
    method: intent.method,
    amount: intent.money.canonicalAmount(),
    currency: intent.money.currency,
    financialAccountId: intent.financialAccountId ?? '',
    payerPersonId: intent.payerPersonId ?? '',
    providerKey: intent.providerKey ?? '',
    providerEventId: intent.providerEventId ?? '',
    providerTransactionRef: intent.providerTransactionRef ?? '',
    providerOccurredAt: intent.providerOccurredAt ? intent.providerOccurredAt.toISOString() : '',
    manualEvidenceRef: intent.manualEvidenceRef ?? '',
    notes: intent.notes ?? '',
    actorKind: intent.actorKind,
    actorPersonId: intent.actorPersonId ?? '',
    financialProfileVersion: intent.financialProfileVersion,
  };

  return createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
}

export async function confirmIncomingPayment(
  pool: Pool,
  profiles: FinancialProfileStore,
  actor: InstitutionalContext,
  rawInput: unknown,
  idempotencyKey: string
): Promise<{ payment: Payment; replayed: boolean }> {
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    throw new PaymentValidationError('Chave de idempotência (Idempotency-Key) é obrigatória.');
  }

  const profile = await requireFinancialContext({
    institutionalContext: actor,
    effectiveAt: new Date(),
    store: profiles,
  });
  const context = {
    institutionId: profile.institutionId,
    financialProfileVersion: profile.version,
    functionalCurrency: profile.functionalCurrency,
    enabledCurrencies: profile.enabledCurrencies,
    financialTimezone: profile.financialTimezone,
  };
  const intent = normalizeConfirmIncomingPaymentIntent(rawInput, context, actor.personId, 'human');

  const repo = new PostgresPaymentRepository(pool);
  const commandResult = await executeIdempotentFinanceCommand<Payment>({
    pool,
    identity: {
      institutionId: actor.institutionId,
      operationNamespace: 'finance.payment.confirmation',
      idempotencyKey: idempotencyKey.trim(),
      canonicalFingerprint: createPaymentConfirmationFingerprint(intent),
    },
    execute: async (client) => {
      // Resolve an existing idempotent command before this validation so that a
      // historical manual confirmation without an account remains replayable.
      // For a new command, all validation happens before any financial write.
      if (intent.sourceType === 'manual_offline' && !intent.financialAccountId) {
        throw new PaymentValidationError('É necessário selecionar uma conta financeira ativa para confirmar um recebimento manual.');
      }

      // If financial account is specified, verify tenant ownership and active status.
      if (intent.financialAccountId) {
        const accRes = await client.query<{ id: string; status: string }>(
          `SELECT id, status FROM finance_financial_accounts WHERE institution_id = $1 AND id = $2`,
          [actor.institutionId, intent.financialAccountId]
        );
        if (!accRes.rows[0]) {
          throw new PaymentValidationError('Conta financeira não encontrada ou não pertence à instituição.');
        }
        if (accRes.rows[0].status !== 'active') {
          throw new PaymentValidationError('A conta financeira selecionada está inativa.');
        }
      }

      const payment = await repo.confirmInTransaction(client, intent, idempotencyKey.trim());
      return {
        resultRef: payment.id,
        result: payment,
      };
    },
    loadResult: async (client, resultRef) => {
      return repo.getById(actor, resultRef, client);
    },
  });

  return {
    payment: commandResult.result,
    replayed: commandResult.replayed,
  };
}

export async function confirmIncomingProviderPayment(
  pool: Pool,
  intent: ConfirmIncomingPaymentIntent,
  idempotencyKey: string
): Promise<{ payment: Payment; replayed: boolean }> {
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    throw new PaymentValidationError('Chave de idempotência do provedor é obrigatória.');
  }

  const repo = new PostgresPaymentRepository(pool);
  const commandResult = await executeIdempotentFinanceCommand<Payment>({
    pool,
    identity: {
      institutionId: intent.institutionId,
      operationNamespace: 'finance.payment.confirmation',
      idempotencyKey: idempotencyKey.trim(),
      canonicalFingerprint: createPaymentConfirmationFingerprint(intent),
    },
    execute: async (client) => {
      const payment = await repo.confirmInTransaction(client, intent, idempotencyKey.trim());
      return {
        resultRef: payment.id,
        result: payment,
      };
    },
    loadResult: async (client, resultRef) => {
      return repo.getById({ institutionId: intent.institutionId }, resultRef, client);
    },
  });

  return {
    payment: commandResult.result,
    replayed: commandResult.replayed,
  };
}
