import { randomUUID, createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import { executeIdempotentFinanceCommand } from './finance-command.ts';
import { PostgresJournalRepository } from './journal-repository.ts';
import { Money } from './money.ts';
import {
  deriveObligationFinancialPosition,
  type ObligationFinancialPosition,
  type ObligationAdjustmentPositionInput,
  type ObligationDiscountPositionInput,
  type ObligationDiscountRevocationPositionInput,
} from './obligation-financial-position.ts';
import {
  ObligationDiscount,
  ObligationDiscountRevocation,
  ApplyObligationDiscountInput,
  RevokeObligationDiscountInput,
} from './obligation-discount-model.ts';
import { PostgresDiscountPolicyRepository } from './discount-policy-repository.ts';
import { ExactDecimal } from './exact-decimal.ts';
import { quantizeMoneyCandidate } from './quantization.ts';

export class ObligationDiscountValidationError extends Error {
  constructor(message: string, readonly code?: string) {
    const formatted = code && !message.includes(code) ? `${code}: ${message}` : message;
    super(formatted);
    this.name = 'ObligationDiscountValidationError';
  }
}

type DiscountRow = {
  id: string;
  institution_id: string;
  financial_account_id: string;
  obligation_id: string;
  policy_id: string;
  policy_version_id: string;
  policy_code: string;
  policy_name: string;
  policy_version: number;
  calculation_mode: 'percentage' | 'fixed_amount';
  policy_value: string;
  amount: string;
  currency: string;
  reason: string;
  journal_transaction_id: string;
  applied_at: Date | string;
  actor_person_id: string | null;
};

type RevocationRow = {
  id: string;
  institution_id: string;
  financial_account_id: string;
  obligation_id: string;
  original_discount_id: string;
  amount: string;
  currency: string;
  reason: string;
  journal_transaction_id: string;
  revoked_at: Date | string;
  actor_person_id: string | null;
};

const mapDiscount = (r: DiscountRow): ObligationDiscount => ({
  id: r.id,
  institutionId: r.institution_id,
  financialAccountId: r.financial_account_id,
  obligationId: r.obligation_id,
  policyId: r.policy_id,
  policyVersionId: r.policy_version_id,
  policyCode: r.policy_code,
  policyName: r.policy_name,
  policyVersion: Number(r.policy_version),
  calculationMode: r.calculation_mode,
  policyValue: r.policy_value.toString(),
  amount: Money.parse(r.amount, r.currency),
  currency: r.currency,
  reason: r.reason,
  journalTransactionId: r.journal_transaction_id,
  appliedAt: r.applied_at instanceof Date ? r.applied_at : new Date(r.applied_at),
  actorPersonId: r.actor_person_id,
});

const mapRevocation = (r: RevocationRow): ObligationDiscountRevocation => ({
  id: r.id,
  institutionId: r.institution_id,
  financialAccountId: r.financial_account_id,
  obligationId: r.obligation_id,
  originalDiscountId: r.original_discount_id,
  amount: Money.parse(r.amount, r.currency),
  currency: r.currency,
  reason: r.reason,
  journalTransactionId: r.journal_transaction_id,
  revokedAt: r.revoked_at instanceof Date ? r.revoked_at : new Date(r.revoked_at),
  actorPersonId: r.actor_person_id,
});

export class PostgresObligationDiscountRepository {
  private readonly policyRepo: PostgresDiscountPolicyRepository;

  constructor(private readonly pool: Pool) {
    this.policyRepo = new PostgresDiscountPolicyRepository(pool);
  }

  async applyObligationDiscount(
    actor: InstitutionalContext,
    input: ApplyObligationDiscountInput,
    idempotencyKey: string
  ): Promise<{ discount: ObligationDiscount; replayed?: boolean; position: ObligationFinancialPosition }> {
    if (!idempotencyKey?.trim()) {
      throw new ObligationDiscountValidationError('Idempotency-Key is required');
    }
    if (!input.reason?.trim()) {
      throw new ObligationDiscountValidationError('Discount reason is required');
    }

    const canonicalFingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          institutionId: actor.institutionId,
          obligationId: input.obligationId,
          discountPolicyId: input.discountPolicyId ?? null,
          discountPolicyVersionId: input.discountPolicyVersionId ?? null,
          reason: input.reason.trim(),
        })
      )
      .digest('hex');

    const result = await executeIdempotentFinanceCommand({
      pool: this.pool,
      identity: {
        institutionId: actor.institutionId,
        operationNamespace: 'finance.obligation.discount.apply',
        idempotencyKey: idempotencyKey.trim(),
        canonicalFingerprint,
      },
      execute: async client => {
        const discount = await this.applyInTransaction(client, actor, input, idempotencyKey.trim());
        return { resultRef: discount.id, result: discount };
      },
      loadResult: (client, id) => this.getDiscountById(actor.institutionId, id, client),
    });

    return {
      discount: result.result,
      replayed: result.replayed,
      position: await this.getPosition(actor.institutionId, input.obligationId),
    };
  }

  async revokeObligationDiscount(
    actor: InstitutionalContext,
    input: RevokeObligationDiscountInput,
    idempotencyKey: string
  ): Promise<{ revocation: ObligationDiscountRevocation; replayed?: boolean; position: ObligationFinancialPosition }> {
    if (!idempotencyKey?.trim()) {
      throw new ObligationDiscountValidationError('Idempotency-Key is required');
    }
    if (!input.reason?.trim()) {
      throw new ObligationDiscountValidationError('Revocation reason is required');
    }

    const canonicalFingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          institutionId: actor.institutionId,
          obligationId: input.obligationId,
          discountId: input.discountId,
          reason: input.reason.trim(),
        })
      )
      .digest('hex');

    const result = await executeIdempotentFinanceCommand({
      pool: this.pool,
      identity: {
        institutionId: actor.institutionId,
        operationNamespace: 'finance.obligation.discount.revoke',
        idempotencyKey: idempotencyKey.trim(),
        canonicalFingerprint,
      },
      execute: async client => {
        const revocation = await this.revokeInTransaction(client, actor, input, idempotencyKey.trim());
        return { resultRef: revocation.id, result: revocation };
      },
      loadResult: (client, id) => this.getRevocationById(actor.institutionId, id, client),
    });

    return {
      revocation: result.result,
      replayed: result.replayed,
      position: await this.getPosition(actor.institutionId, input.obligationId),
    };
  }

  private async applyInTransaction(
    client: PoolClient,
    actor: InstitutionalContext,
    input: ApplyObligationDiscountInput,
    commandId: string
  ): Promise<ObligationDiscount> {
    const applicationInstant = new Date();

    // 1. Candidate lookup
    const candidate = (
      await client.query<{ financial_account_id: string }>(
        `SELECT financial_account_id FROM finance_obligations WHERE institution_id = $1 AND id = $2`,
        [actor.institutionId, input.obligationId]
      )
    ).rows[0];
    if (!candidate) throw new ObligationDiscountValidationError('Open Obligation is required', 'DISCOUNT_NOT_FOUND');

    // Lock hierarchy Step 1: Account
    const account = await client.query(
      `SELECT id FROM finance_financial_accounts WHERE institution_id = $1 AND id = $2 FOR UPDATE`,
      [actor.institutionId, candidate.financial_account_id]
    );
    if (!account.rows[0]) throw new ObligationDiscountValidationError('Financial Account is required');

    // Lock hierarchy Step 2: Obligation
    const obligation = (
      await client.query<{
        id: string;
        financial_account_id: string;
        amount: string;
        currency: string;
        status: string;
        financial_profile_version: number;
      }>(
        `SELECT id, financial_account_id, amount::text, currency, status, financial_profile_version
         FROM finance_obligations WHERE institution_id = $1 AND id = $2 FOR UPDATE`,
        [actor.institutionId, input.obligationId]
      )
    ).rows[0];
    if (!obligation || obligation.status !== 'open') {
      throw new ObligationDiscountValidationError('Open Obligation is required', 'DISCOUNT_NOT_FOUND');
    }

    // Resolve Policy Version
    let policyVersion: any = null;
    let policy: any = null;

    if (input.discountPolicyVersionId) {
      const verRes = await client.query(
        `SELECT v.*, p.code as policy_code, p.status as policy_status
         FROM finance_discount_policy_versions v
         JOIN finance_discount_policies p ON p.id = v.policy_id AND p.institution_id = v.institution_id
         WHERE v.institution_id = $1 AND v.id = $2`,
        [actor.institutionId, input.discountPolicyVersionId]
      );
      if (verRes.rows.length === 0) {
        throw new ObligationDiscountValidationError('Discount policy version not found', 'DISCOUNT_NOT_FOUND');
      }
      policyVersion = verRes.rows[0];
      if (policyVersion.policy_status === 'archived') {
        throw new ObligationDiscountValidationError('Discount policy is archived', 'DISCOUNT_INACTIVE_POLICY');
      }
      if (
        (policyVersion.effective_from && new Date(policyVersion.effective_from) > applicationInstant) ||
        (policyVersion.effective_to && new Date(policyVersion.effective_to) < applicationInstant)
      ) {
        throw new ObligationDiscountValidationError(
          'Discount policy version is not effective at this date',
          'DISCOUNT_POLICY_NOT_CURRENTLY_APPLICABLE'
        );
      }
      policy = { id: policyVersion.policy_id, code: policyVersion.policy_code };
    } else if (input.discountPolicyId) {
      const pRes = await client.query(
        `SELECT id, code, status FROM finance_discount_policies WHERE institution_id = $1 AND id = $2`,
        [actor.institutionId, input.discountPolicyId]
      );
      if (pRes.rows.length === 0) {
        throw new ObligationDiscountValidationError('Discount policy not found', 'DISCOUNT_NOT_FOUND');
      }
      policy = pRes.rows[0];
      if (policy.status === 'archived') {
        throw new ObligationDiscountValidationError('Discount policy is archived', 'DISCOUNT_INACTIVE_POLICY');
      }

      const verRes = await client.query(
        `SELECT * FROM finance_discount_policy_versions
         WHERE institution_id = $1 AND policy_id = $2
           AND (effective_from IS NULL OR effective_from <= $3)
           AND (effective_to IS NULL OR effective_to >= $3)
         ORDER BY version DESC`,
        [actor.institutionId, input.discountPolicyId, applicationInstant]
      );
      if (verRes.rows.length === 0) {
        throw new ObligationDiscountValidationError(
          'No effective policy version available for this policy at current instant',
          'DISCOUNT_POLICY_NOT_CURRENTLY_APPLICABLE'
        );
      }
      if (verRes.rows.length > 1) {
        throw new ObligationDiscountValidationError('Ambiguous policy versions in effect', 'DISCOUNT_POLICY_VERSION_AMBIGUITY');
      }
      policyVersion = verRes.rows[0];
    } else {
      throw new ObligationDiscountValidationError('Either discountPolicyId or discountPolicyVersionId is required');
    }

    // Currency check
    if (policyVersion.calculation_mode === 'fixed_amount' && policyVersion.currency !== obligation.currency) {
      throw new ObligationDiscountValidationError(
        `Discount policy currency (${policyVersion.currency}) does not match obligation currency (${obligation.currency})`,
        'DISCOUNT_CURRENCY_MISMATCH'
      );
    }

    // Lock hierarchy Step 3: Allocations & Reversals
    const allocations = (
      await client.query<{ amount: string }>(
        `SELECT amount::text FROM finance_allocations WHERE institution_id = $1 AND obligation_id = $2 FOR UPDATE`,
        [actor.institutionId, obligation.id]
      )
    ).rows.map(r => Money.parse(r.amount, obligation.currency));

    const reversals = (
      await client.query<{ amount: string }>(
        `SELECT r.amount::text FROM finance_allocation_reversals r
         JOIN finance_allocations a ON a.institution_id = r.institution_id AND a.id = r.original_allocation_id
         WHERE r.institution_id = $1 AND a.obligation_id = $2 FOR UPDATE`,
        [actor.institutionId, obligation.id]
      )
    ).rows.map(r => Money.parse(r.amount, obligation.currency));

    // Lock hierarchy Step 4: Adjustments
    const adjustments = (
      await client.query<{ direction: 'increase' | 'decrease'; amount: string }>(
        `SELECT direction, amount::text FROM finance_obligation_adjustments
         WHERE institution_id = $1 AND obligation_id = $2 FOR UPDATE`,
        [actor.institutionId, obligation.id]
      )
    ).rows.map(r => ({ direction: r.direction, amount: Money.parse(r.amount, obligation.currency) }));

    // Lock hierarchy Step 5: Discounts & Revocations
    const existingDiscounts = (
      await client.query<{ id: string; amount: string }>(
        `SELECT id, amount::text FROM finance_obligation_discounts
         WHERE institution_id = $1 AND obligation_id = $2 FOR UPDATE`,
        [actor.institutionId, obligation.id]
      )
    ).rows;

    const existingRevocations = (
      await client.query<{ original_discount_id: string; amount: string }>(
        `SELECT original_discount_id, amount::text FROM finance_obligation_discount_revocations
         WHERE institution_id = $1 AND obligation_id = $2 FOR UPDATE`,
        [actor.institutionId, obligation.id]
      )
    ).rows;

    // Check One Active Discount Invariant
    const revokedSet = new Set(existingRevocations.map(r => r.original_discount_id));
    const activeDiscounts = existingDiscounts.filter(d => !revokedSet.has(d.id));
    if (activeDiscounts.length > 0) {
      throw new ObligationDiscountValidationError(
        'Obligation already has an active discount concession. Revoke it before applying a new one.',
        'DISCOUNT_ALREADY_ACTIVE'
      );
    }

    // Calculate Discount Amount
    const originalMoney = Money.parse(obligation.amount, obligation.currency);
    let netAdjustments = Money.parse('0', obligation.currency);
    for (const adj of adjustments) {
      netAdjustments = adj.direction === 'increase' ? netAdjustments.add(adj.amount) : netAdjustments.subtract(adj.amount);
    }
    const preDiscountDue = originalMoney.add(netAdjustments);

    let calculatedDiscountMoney: Money;
    if (policyVersion.calculation_mode === 'percentage') {
      const percentageRate = Number(policyVersion.value);
      const decPreDue = ExactDecimal.parse(preDiscountDue.canonicalAmount(), 30, 12);
      const decRate = ExactDecimal.parse(percentageRate.toString(), 30, 12);
      const multiplied = decPreDue.multiply(decRate, 30, 12);
      const dividedBy100 = ExactDecimal.fromParts(multiplied.coefficient, multiplied.scale + 2, 30, 12);
      calculatedDiscountMoney = quantizeMoneyCandidate(dividedBy100, preDiscountDue.currency, 2, 'half_up');
    } else {
      calculatedDiscountMoney = Money.parse(ExactDecimal.parse(policyVersion.value.toString(), 30, 12).toCanonicalString(), obligation.currency);
    }

    if (calculatedDiscountMoney.compare(Money.parse('0', obligation.currency)) <= 0) {
      throw new ObligationDiscountValidationError('Calculated discount amount must be strictly positive');
    }

    // Verify position with candidate discount
    try {
      deriveObligationFinancialPosition({
        original: originalMoney,
        adjustments,
        discounts: [
          ...existingDiscounts.map(d => ({ id: d.id, amount: Money.parse(d.amount, obligation.currency) })),
          { id: 'candidate', amount: calculatedDiscountMoney },
        ],
        discountRevocations: existingRevocations.map(r => ({
          originalDiscountId: r.original_discount_id,
          amount: Money.parse(r.amount, obligation.currency),
        })),
        allocations,
        allocationReversals: reversals,
      });
    } catch (err: any) {
      throw new ObligationDiscountValidationError(
        `DISCOUNT_FLOOR_VIOLATION: Discount would reduce payable due below covered amount: ${err.message}`,
        'DISCOUNT_FLOOR_VIOLATION'
      );
    }

    // Post Journal Transaction
    const journalRepo = new PostgresJournalRepository(client);
    const journalTx = await journalRepo.confirmInTransaction(client, {
      institutionId: actor.institutionId,
      commandId,
      journalType: 'obligation_discount',
      effectiveAt: applicationInstant,
      financialProfileVersion: obligation.financial_profile_version,
      actorPersonId: actor.personId,
      actorKind: 'human',
      reason: input.reason.trim(),
      entries: [
        {
          positionType: 'obligation_discount_applied',
          money: calculatedDiscountMoney,
          sourceRef: obligation.id,
        },
      ],
    });

    // Insert fact row
    const discountId = randomUUID();
    const factRes = await client.query<DiscountRow>(
      `INSERT INTO finance_obligation_discounts (
         id, institution_id, financial_account_id, obligation_id, policy_id, policy_version_id,
         policy_code, policy_name, policy_version, calculation_mode, policy_value, amount, currency,
         reason, journal_transaction_id, applied_at, actor_kind, actor_person_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'human', $17)
       RETURNING *`,
      [
        discountId,
        actor.institutionId,
        obligation.financial_account_id,
        obligation.id,
        policy.id,
        policyVersion.id,
        policy.code,
        policyVersion.name,
        Number(policyVersion.version),
        policyVersion.calculation_mode,
        policyVersion.value.toString(),
        calculatedDiscountMoney.canonicalAmount(),
        obligation.currency,
        input.reason.trim(),
        journalTx.transactionId,
        applicationInstant,
        actor.personId || null,
      ]
    );

    return mapDiscount(factRes.rows[0]);
  }

  private async revokeInTransaction(
    client: PoolClient,
    actor: InstitutionalContext,
    input: RevokeObligationDiscountInput,
    commandId: string
  ): Promise<ObligationDiscountRevocation> {
    const revocationInstant = new Date();

    // 1. Find target discount
    const discountRes = await client.query<DiscountRow>(
      `SELECT * FROM finance_obligation_discounts
       WHERE institution_id = $1 AND obligation_id = $2 AND id = $3
       FOR UPDATE`,
      [actor.institutionId, input.obligationId, input.discountId]
    );
    if (discountRes.rows.length === 0) {
      throw new ObligationDiscountValidationError('Target discount fact not found', 'DISCOUNT_NOT_FOUND');
    }
    const targetDiscount = mapDiscount(discountRes.rows[0]);

    // Lock hierarchy Step 1: Account
    await client.query(
      `SELECT id FROM finance_financial_accounts WHERE institution_id = $1 AND id = $2 FOR UPDATE`,
      [actor.institutionId, targetDiscount.financialAccountId]
    );

    // Lock hierarchy Step 2: Obligation
    const obligation = (
      await client.query<{ financial_profile_version: number; status: string }>(
        `SELECT financial_profile_version, status FROM finance_obligations WHERE institution_id = $1 AND id = $2 FOR UPDATE`,
        [actor.institutionId, input.obligationId]
      )
    ).rows[0];
    if (!obligation) throw new ObligationDiscountValidationError('Obligation not found', 'DISCOUNT_NOT_FOUND');

    // Lock hierarchy Step 5: Check if already revoked
    const existingRevRes = await client.query(
      `SELECT id FROM finance_obligation_discount_revocations
       WHERE institution_id = $1 AND original_discount_id = $2
       FOR UPDATE`,
      [actor.institutionId, input.discountId]
    );
    if (existingRevRes.rows.length > 0) {
      throw new ObligationDiscountValidationError('Target discount is already revoked', 'DISCOUNT_ALREADY_REVOKED');
    }

    // Post Compensating Journal Transaction
    const journalRepo = new PostgresJournalRepository(client);
    const journalTx = await journalRepo.confirmInTransaction(client, {
      institutionId: actor.institutionId,
      commandId,
      journalType: 'obligation_discount',
      effectiveAt: revocationInstant,
      financialProfileVersion: obligation.financial_profile_version,
      actorPersonId: actor.personId,
      actorKind: 'human',
      reason: input.reason.trim(),
      entries: [
        {
          positionType: 'obligation_discount_revoked',
          money: targetDiscount.amount,
          sourceRef: input.obligationId,
        },
      ],
    });

    // Insert revocation fact row
    const revocationId = randomUUID();
    const factRes = await client.query<RevocationRow>(
      `INSERT INTO finance_obligation_discount_revocations (
         id, institution_id, financial_account_id, obligation_id, original_discount_id,
         amount, currency, reason, journal_transaction_id, revoked_at, actor_kind, actor_person_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'human', $11)
       RETURNING *`,
      [
        revocationId,
        actor.institutionId,
        targetDiscount.financialAccountId,
        input.obligationId,
        targetDiscount.id,
        targetDiscount.amount.canonicalAmount(),
        targetDiscount.currency,
        input.reason.trim(),
        journalTx.transactionId,
        revocationInstant,
        actor.personId || null,
      ]
    );

    return mapRevocation(factRes.rows[0]);
  }

  async getDiscountById(
    institutionId: string,
    id: string,
    client: Pool | PoolClient = this.pool
  ): Promise<ObligationDiscount> {
    const res = await client.query<DiscountRow>(
      `SELECT * FROM finance_obligation_discounts WHERE institution_id = $1 AND id = $2`,
      [institutionId, id]
    );
    if (res.rows.length === 0) {
      throw new ObligationDiscountValidationError('Discount not found', 'DISCOUNT_NOT_FOUND');
    }
    return mapDiscount(res.rows[0]);
  }

  async getRevocationById(
    institutionId: string,
    id: string,
    client: Pool | PoolClient = this.pool
  ): Promise<ObligationDiscountRevocation> {
    const res = await client.query<RevocationRow>(
      `SELECT * FROM finance_obligation_discount_revocations WHERE institution_id = $1 AND id = $2`,
      [institutionId, id]
    );
    if (res.rows.length === 0) {
      throw new ObligationDiscountValidationError('Discount revocation not found', 'DISCOUNT_NOT_FOUND');
    }
    return mapRevocation(res.rows[0]);
  }

  async getPosition(institutionId: string, obligationId: string): Promise<ObligationFinancialPosition> {
    const obligation = (
      await this.pool.query<{ amount: string; currency: string }>(
        `SELECT amount::text, currency FROM finance_obligations WHERE institution_id = $1 AND id = $2`,
        [institutionId, obligationId]
      )
    ).rows[0];
    if (!obligation) throw new ObligationDiscountValidationError('Obligation not found', 'DISCOUNT_NOT_FOUND');

    const adjustments = (
      await this.pool.query<{ direction: 'increase' | 'decrease'; amount: string }>(
        `SELECT direction, amount::text FROM finance_obligation_adjustments
         WHERE institution_id = $1 AND obligation_id = $2 ORDER BY recorded_at, id`,
        [institutionId, obligationId]
      )
    ).rows.map(r => ({ direction: r.direction, amount: Money.parse(r.amount, obligation.currency) }));

    const discounts = (
      await this.pool.query<{ id: string; amount: string }>(
        `SELECT id, amount::text FROM finance_obligation_discounts
         WHERE institution_id = $1 AND obligation_id = $2 ORDER BY applied_at, id`,
        [institutionId, obligationId]
      )
    ).rows.map(r => ({ id: r.id, amount: Money.parse(r.amount, obligation.currency) }));

    const revocations = (
      await this.pool.query<{ original_discount_id: string; amount: string }>(
        `SELECT original_discount_id, amount::text FROM finance_obligation_discount_revocations
         WHERE institution_id = $1 AND obligation_id = $2 ORDER BY revoked_at, id`,
        [institutionId, obligationId]
      )
    ).rows.map(r => ({ originalDiscountId: r.original_discount_id, amount: Money.parse(r.amount, obligation.currency) }));

    const allocations = (
      await this.pool.query<{ amount: string }>(
        `SELECT amount::text FROM finance_allocations WHERE institution_id = $1 AND obligation_id = $2`,
        [institutionId, obligationId]
      )
    ).rows.map(r => Money.parse(r.amount, obligation.currency));

    const reversals = (
      await this.pool.query<{ amount: string }>(
        `SELECT r.amount::text FROM finance_allocation_reversals r
         JOIN finance_allocations a ON a.institution_id = r.institution_id AND a.id = r.original_allocation_id
         WHERE r.institution_id = $1 AND a.obligation_id = $2`,
        [institutionId, obligationId]
      )
    ).rows.map(r => Money.parse(r.amount, obligation.currency));

    return deriveObligationFinancialPosition({
      original: Money.parse(obligation.amount, obligation.currency),
      adjustments,
      discounts,
      discountRevocations: revocations,
      allocations,
      allocationReversals: reversals,
    });
  }
}
