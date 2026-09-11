import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { Money } from './money.ts';
import {
  Payment,
  PaymentStatus,
  PaymentAllocationStatus,
  PaymentSourceType,
  ConfirmIncomingPaymentIntent,
  PaymentValidationError,
  normalizeConfirmIncomingPaymentIntent,
} from './payment-model.ts';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import { FinancialProfileStore, requireFinancialContext, PostgresFinancialProfileStore } from './financial-context.ts';
import { PostgresJournalRepository } from './journal-repository.ts';
import { executeIdempotentFinanceCommand } from './finance-command.ts';
import { createPaymentConfirmationFingerprint } from './payment-service.ts';

export class PaymentNotFoundError extends Error {
  readonly code = 'PAYMENT_NOT_FOUND';
  constructor(message = 'Recebimento/pagamento não encontrado.') {
    super(message);
    this.name = 'PaymentNotFoundError';
  }
}

export class PaymentConflictError extends Error {
  readonly code = 'PAYMENT_CONFLICT';
  constructor(message = 'Conflito de recebimento/pagamento.') {
    super(message);
    this.name = 'PaymentConflictError';
  }
}

export type PaymentFailurePoint = 'after_counter' | 'after_journal' | 'after_payment';

interface PaymentRow {
  id: string;
  institution_id: string;
  payment_reference: string;
  journal_transaction_id: string;
  source_type: string;
  method: string;
  amount: string | number;
  currency: string;
  status: string;
  allocation_status: string;
  financial_account_id?: string | null;
  payer_person_id?: string | null;
  provider_key?: string | null;
  provider_event_id?: string | null;
  provider_transaction_ref?: string | null;
  provider_occurred_at?: string | Date | null;
  manual_evidence_ref?: string | null;
  notes?: string | null;
  effective_at: string | Date;
  confirmed_at: string | Date;
  created_at: string | Date;
  financial_profile_version: number;
  actor_kind?: string | null;
  actor_person_id?: string | null;
}

export function mapPayment(row: PaymentRow): Payment {
  return {
    id: String(row.id),
    institutionId: String(row.institution_id),
    paymentReference: String(row.payment_reference),
    journalTransactionId: String(row.journal_transaction_id),
    sourceType: row.source_type as PaymentSourceType,
    method: String(row.method),
    amount: Money.parse(String(row.amount), String(row.currency)).canonicalAmount(),
    currency: String(row.currency),
    status: row.status as PaymentStatus,
    allocationStatus: row.allocation_status as PaymentAllocationStatus,
    financialAccountId: row.financial_account_id ? String(row.financial_account_id) : undefined,
    payerPersonId: row.payer_person_id ? String(row.payer_person_id) : undefined,
    providerKey: row.provider_key ? String(row.provider_key) : undefined,
    providerEventId: row.provider_event_id ? String(row.provider_event_id) : undefined,
    providerTransactionRef: row.provider_transaction_ref ? String(row.provider_transaction_ref) : undefined,
    providerOccurredAt: row.provider_occurred_at
      ? (row.provider_occurred_at instanceof Date ? row.provider_occurred_at.toISOString() : new Date(String(row.provider_occurred_at)).toISOString())
      : undefined,
    manualEvidenceRef: row.manual_evidence_ref ? String(row.manual_evidence_ref) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    effectiveAt: row.effective_at instanceof Date ? row.effective_at.toISOString() : new Date(String(row.effective_at)).toISOString(),
    confirmedAt: row.confirmed_at instanceof Date ? row.confirmed_at.toISOString() : new Date(String(row.confirmed_at)).toISOString(),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(String(row.created_at)).toISOString(),
    financialProfileVersion: Number(row.financial_profile_version),
    actorKind: (row.actor_kind || 'human') as any,
    actorPersonId: row.actor_person_id ? String(row.actor_person_id) : undefined,
  };
}

export class PostgresPaymentRepository {
  constructor(
    private readonly pool: Pool,
    private readonly failurePoint?: PaymentFailurePoint
  ) {}

  async allocatePaymentReference(client: PoolClient, institutionId: string): Promise<string> {
    const counterSql = `
      INSERT INTO finance_payment_counters (institution_id, last_sequence, updated_at)
      VALUES ($1, 1, NOW())
      ON CONFLICT (institution_id)
      DO UPDATE SET
        last_sequence = finance_payment_counters.last_sequence + 1,
        updated_at = NOW()
      RETURNING last_sequence;
    `;
    const res = await client.query<{ last_sequence: number }>(counterSql, [institutionId]);
    const seq = res.rows[0]?.last_sequence ?? 1;
    return `PAG-${String(seq).padStart(6, '0')}`;
  }

  async confirmInTransaction(
    client: PoolClient,
    intent: ConfirmIncomingPaymentIntent,
    commandId: string
  ): Promise<Payment> {
    // 0. Validate payer tenant safety if payer is provided
    if (intent.payerPersonId) {
      const payerCheck = await client.query(
        `SELECT 1 FROM people p
         WHERE p.id = $1
         AND (
           EXISTS (SELECT 1 FROM memberships m WHERE m.person_id = p.id AND m.institution_id = $2)
           OR EXISTS (
             SELECT 1 FROM finance_financial_account_parties fap
             WHERE fap.person_id = p.id AND fap.institution_id = $2
           )
         )`,
        [intent.payerPersonId, intent.institutionId]
      );
      if (!payerCheck.rows[0]) {
        throw new PaymentValidationError('Pessoa pagadora não pertence à instituição ou não está habilitada.');
      }
    }

    // 1. Allocate next payment reference
    const paymentReference = await this.allocatePaymentReference(client, intent.institutionId);
    this.fail('after_counter');

    // 2. Atomically confirm journal fact
    const journalRepo = new PostgresJournalRepository(client);
    const journalResult = await journalRepo.confirmInTransaction(client, {
      institutionId: intent.institutionId,
      commandId,
      journalType: 'foundation_value_received',
      effectiveAt: intent.effectiveAt,
      entries: [
        {
          positionType: 'received_value',
          money: intent.money,
          sourceRef: paymentReference,
        },
      ],
      actorKind: intent.actorKind,
      actorPersonId: intent.actorPersonId,
      financialProfileVersion: intent.financialProfileVersion,
    });
    this.fail('after_journal');

    // 3. Persist canonical payment
    const paymentId = randomUUID();
    const insertSql = `
      INSERT INTO finance_payments (
        id, institution_id, payment_reference, journal_transaction_id, source_type, method,
        amount, currency, status, allocation_status, financial_account_id, payer_person_id,
        provider_key, provider_event_id, provider_transaction_ref, provider_occurred_at,
        manual_evidence_ref, notes, effective_at, confirmed_at, created_at,
        financial_profile_version, actor_kind, actor_person_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, 'confirmed', 'unapplied', $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17, NOW(), NOW(),
        $18, $19, $20
      )
      RETURNING *;
    `;

    const insertParams = [
      paymentId,
      intent.institutionId,
      paymentReference,
      journalResult.transactionId,
      intent.sourceType,
      intent.method,
      intent.money.canonicalAmount(),
      intent.money.currency,
      intent.financialAccountId ?? null,
      intent.payerPersonId ?? null,
      intent.providerKey ?? null,
      intent.providerEventId ?? null,
      intent.providerTransactionRef ?? null,
      intent.providerOccurredAt ?? null,
      intent.manualEvidenceRef ?? null,
      intent.notes ?? null,
      intent.effectiveAt,
      intent.financialProfileVersion,
      intent.actorKind,
      intent.actorPersonId ?? null,
    ];

    const insertRes = await client.query<PaymentRow>(insertSql, insertParams);
    this.fail('after_payment');

    return mapPayment(insertRes.rows[0]);
  }

  async getById(actor: { institutionId: string }, id: string, client: Pool | PoolClient = this.pool): Promise<Payment> {
    const sql = `SELECT * FROM finance_payments WHERE institution_id = $1 AND id = $2`;
    const res = await client.query<PaymentRow>(sql, [actor.institutionId, id]);
    if (!res.rows[0]) {
      throw new PaymentNotFoundError();
    }
    return mapPayment(res.rows[0]);
  }

  async list(
    actor: { institutionId: string },
    filters?: { status?: string; financialAccountId?: string; sourceType?: string },
    client: Pool | PoolClient = this.pool
  ): Promise<Payment[]> {
    const conditions: string[] = ['institution_id = $1'];
    const params: any[] = [actor.institutionId];

    if (filters?.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filters?.financialAccountId) {
      params.push(filters.financialAccountId);
      conditions.push(`financial_account_id = $${params.length}`);
    }
    if (filters?.sourceType) {
      params.push(filters.sourceType);
      conditions.push(`source_type = $${params.length}`);
    }

    const sql = `SELECT * FROM finance_payments WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
    const res = await client.query<PaymentRow>(sql, params);
    return res.rows.map(mapPayment);
  }

  async confirmPaymentInCommand(
    actor: InstitutionalContext,
    rawInput: unknown,
    idempotencyKey: string,
    profiles?: FinancialProfileStore
  ): Promise<{ payment: Payment; replayed: boolean }> {
    const profileStore = profiles ?? new PostgresFinancialProfileStore(this.pool);
    const profile = await requireFinancialContext({
      institutionalContext: actor,
      effectiveAt: new Date(),
      store: profileStore,
    });
    const context = {
      institutionId: profile.institutionId,
      financialProfileVersion: profile.version,
      functionalCurrency: profile.functionalCurrency,
      enabledCurrencies: profile.enabledCurrencies,
      financialTimezone: profile.financialTimezone,
    };
    const intent = normalizeConfirmIncomingPaymentIntent(rawInput, context, actor.personId);

    // If financial account is specified, verify tenant ownership and active status
    if (intent.financialAccountId) {
      const accRes = await this.pool.query<{ id: string; status: string }>(
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

    const commandResult = await executeIdempotentFinanceCommand<Payment>({
      pool: this.pool,
      identity: {
        institutionId: actor.institutionId,
        operationNamespace: 'finance.payment.confirmation',
        idempotencyKey,
        canonicalFingerprint: createPaymentConfirmationFingerprint(intent),
      },
      execute: async (client) => {
        const payment = await this.confirmInTransaction(client, intent, idempotencyKey);
        return {
          resultRef: payment.id,
          result: payment,
        };
      },
      loadResult: async (client, resultRef) => {
        return this.getById(actor, resultRef, client);
      },
    });

    return {
      payment: commandResult.result,
      replayed: commandResult.replayed,
    };
  }

  private fail(point: PaymentFailurePoint): void {
    if (this.failurePoint === point) {
      throw new Error(`Injected payment failure: ${point}`);
    }
  }
}
