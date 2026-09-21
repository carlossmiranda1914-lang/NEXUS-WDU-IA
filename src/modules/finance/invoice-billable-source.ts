import type { Pool, PoolClient } from 'pg';
import { Money } from './money.ts';

type Queryable = Pick<Pool | PoolClient, 'query'>;

export type InvoiceBillableSource = Readonly<{
  obligationId: string;
  financialAccountId: string;
  reference: string;
  description: string;
  currency: string;
  originalAmount: string;
  adjustmentTotal: string;
  preDiscountAmount: string;
  discountTotal: string;
  billableAmount: string;
  dueAt: Date;
  financialProfileVersion: number;
  beneficiaryPersonId: string | null;
}>;

type ObligationRow = { id: string; financial_account_id: string; source_ref: string; name: string; amount: string; currency: string; due_at: Date | null; financial_profile_version: number; beneficiary_person_id: string | null };
type AdjustmentRow = { direction: 'increase' | 'decrease'; amount: string; currency: string };
type DiscountRow = { amount: string; currency: string };

/**
 * Resolves an invoiceable amount independently from settlement.  It freezes
 * the pre-issuance obligation position: original due plus effective approved
 * adjustments, minus effective non-revoked discounts. Payments never enter
 * this calculation and therefore cannot retroactively redefine an invoice.
 */
export async function resolveInvoiceBillableSource(db: Queryable, input: { institutionId: string; obligationId: string; at: Date; lock?: boolean }): Promise<InvoiceBillableSource> {
  const lock = input.lock ? ' FOR UPDATE' : '';
  const obligation = await db.query<ObligationRow>(
    `SELECT o.id,o.financial_account_id,o.source_ref,fcv.name,o.amount::text,o.currency,o.due_at,o.financial_profile_version,o.beneficiary_person_id
       FROM finance_obligations o
       JOIN finance_fee_catalogue_versions fcv ON fcv.institution_id=o.institution_id AND fcv.item_id=o.fee_catalogue_item_id AND fcv.version=o.fee_catalogue_version
      WHERE o.institution_id=$1 AND o.id=$2 AND o.status='open'${lock}`,
    [input.institutionId, input.obligationId],
  );
  const row = obligation.rows[0];
  if (!row) throw new Error('INVOICE_SOURCE_NOT_ELIGIBLE');
  if (!row.due_at) throw new Error('INVOICE_DUE_DATE_REQUIRED');
  const adjustments = await db.query<AdjustmentRow>(
    `SELECT direction,amount::text,currency FROM finance_obligation_adjustments
      WHERE institution_id=$1 AND obligation_id=$2 AND effective_at<=$3 ORDER BY effective_at,recorded_at,id`,
    [input.institutionId, row.id, input.at],
  );
  const discounts = await db.query<DiscountRow>(
    `SELECT d.amount::text,d.currency FROM finance_obligation_discounts d
      WHERE d.institution_id=$1 AND d.obligation_id=$2 AND d.applied_at<=$3
        AND NOT EXISTS (SELECT 1 FROM finance_obligation_discount_revocations r WHERE r.institution_id=d.institution_id AND r.original_discount_id=d.id AND r.revoked_at<=$3)
      ORDER BY d.applied_at,d.id`,
    [input.institutionId, row.id, input.at],
  );
  const original = Money.parse(row.amount, row.currency);
  const adjustmentTotal = adjustments.rows.reduce((total, adjustment) => {
    const amount = Money.parse(adjustment.amount, row.currency);
    if (adjustment.currency !== row.currency) throw new Error('INVOICE_CURRENCY_MISMATCH');
    return adjustment.direction === 'increase' ? total.add(amount) : total.subtract(amount);
  }, Money.parse('0', row.currency));
  const preDiscount = original.add(adjustmentTotal);
  if (preDiscount.compare(Money.parse('0', row.currency)) <= 0) throw new Error('INVOICE_BILLABLE_AMOUNT_INVALID');
  const discountTotal = discounts.rows.reduce((total, discount) => {
    if (discount.currency !== row.currency) throw new Error('INVOICE_CURRENCY_MISMATCH');
    return total.add(Money.parse(discount.amount, row.currency));
  }, Money.parse('0', row.currency));
  const billable = preDiscount.subtract(discountTotal);
  if (billable.compare(Money.parse('0', row.currency)) <= 0) throw new Error('INVOICE_BILLABLE_AMOUNT_INVALID');
  return Object.freeze({
    obligationId: row.id, financialAccountId: row.financial_account_id, reference: row.source_ref, description: row.name,
    currency: row.currency, originalAmount: original.canonicalAmount(), adjustmentTotal: adjustmentTotal.canonicalAmount(), preDiscountAmount: preDiscount.canonicalAmount(), discountTotal: discountTotal.canonicalAmount(), billableAmount: billable.canonicalAmount(), dueAt: row.due_at, financialProfileVersion: row.financial_profile_version, beneficiaryPersonId: row.beneficiary_person_id,
  });
}
