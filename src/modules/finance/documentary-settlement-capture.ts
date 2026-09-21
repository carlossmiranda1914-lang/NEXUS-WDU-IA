import type { PoolClient } from 'pg';
import { Money } from './money.ts';

export type DocumentarySettlementCapture = Readonly<{
  obligations: readonly Readonly<{ authorityId: string; reference: string | null; components: readonly Readonly<{ kind: string; amount: string; currency: string; provenance: Readonly<{ sourceType: string; sourceId: string; versionId?: string }> }>[] }>[];
  allocations: readonly Readonly<{ authorityId: string; obligationAuthorityId: string; before: Readonly<{ amount: string; currency: string }>; movement: Readonly<{ amount: string; currency: string }>; after: Readonly<{ amount: string; currency: string }> }>[];
  unallocated?: Readonly<{ amount: string; currency: string }>;
}>;

type AllocationRow = { id:string; obligation_id:string; amount:string; currency:string; effective_at:Date; recorded_at:Date; obligation_amount:string; obligation_currency:string; source_type:string; source_ref:string; fee_catalogue_version:number; reversed:string };
type AdjustmentRow = { id:string; direction:'increase'|'decrease'; amount:string; currency:string };
type DiscountRow = { id:string; amount:string; currency:string };

const money = (amount:string, currency:string) => Money.parse(amount, currency);
const serial = (value: Money) => ({ amount: value.canonicalAmount(), currency: value.currency });

/**
 * Captures settlement evidence only from immutable Finance facts.  The query is
 * evaluated inside issuance's command transaction, before number allocation.
 */
export async function captureReceiptSettlement(client: Pick<PoolClient, 'query'>, input: { institutionId:string; paymentId:string; paymentAmount:string; currency:string; asOf:Date }): Promise<DocumentarySettlementCapture> {
  const allocations = await client.query<AllocationRow>(
    `SELECT a.id,a.obligation_id,a.amount::text,a.currency,a.effective_at,a.recorded_at,
            o.amount::text obligation_amount,o.currency obligation_currency,o.source_type,o.source_ref,o.fee_catalogue_version,
            COALESCE((SELECT SUM(r.amount) FROM finance_allocation_reversals r WHERE r.institution_id=a.institution_id AND r.original_allocation_id=a.id AND r.effective_at <= $3),0)::text reversed
       FROM finance_allocations a
       JOIN finance_obligations o ON o.institution_id=a.institution_id AND o.id=a.obligation_id
      WHERE a.institution_id=$1 AND a.payment_id=$2 AND a.effective_at <= $3
      ORDER BY a.effective_at,a.recorded_at,a.id`,
    [input.institutionId, input.paymentId, input.asOf],
  );
  const active = allocations.rows.filter(row => money(row.amount, row.currency).compare(money(row.reversed, row.currency)) > 0);
  const obligationIds = [...new Set(active.map(row => row.obligation_id))];
  const obligations: Array<DocumentarySettlementCapture['obligations'][number]> = [];
  for (const obligationId of obligationIds) {
    const row = active.find(candidate => candidate.obligation_id === obligationId)!;
    const adjustments = await client.query<AdjustmentRow>(`SELECT id,direction,amount::text,currency FROM finance_obligation_adjustments WHERE institution_id=$1 AND obligation_id=$2 AND effective_at <= $3 ORDER BY effective_at,recorded_at,id`, [input.institutionId, obligationId, input.asOf]);
    const discounts = await client.query<DiscountRow>(`SELECT d.id,d.amount::text,d.currency FROM finance_obligation_discounts d WHERE d.institution_id=$1 AND d.obligation_id=$2 AND d.applied_at <= $3 AND NOT EXISTS (SELECT 1 FROM finance_obligation_discount_revocations r WHERE r.institution_id=d.institution_id AND r.original_discount_id=d.id AND r.revoked_at <= $3) ORDER BY d.applied_at,d.id`, [input.institutionId, obligationId, input.asOf]);
    obligations.push(Object.freeze({ authorityId: obligationId, reference: row.source_ref, components: Object.freeze([
      Object.freeze({ kind: 'obligation_original', amount: money(row.obligation_amount, row.obligation_currency).canonicalAmount(), currency: row.obligation_currency, provenance: Object.freeze({ sourceType: row.source_type, sourceId: obligationId, versionId: `fee_catalogue_version:${row.fee_catalogue_version}` }) }),
      ...adjustments.rows.map(adjustment => Object.freeze({ kind: `obligation_adjustment_${adjustment.direction}`, amount: money(adjustment.amount, adjustment.currency).canonicalAmount(), currency: adjustment.currency, provenance: Object.freeze({ sourceType: 'obligation_adjustment', sourceId: adjustment.id }) })),
      ...discounts.rows.map(discount => Object.freeze({ kind: 'obligation_discount', amount: money(discount.amount, discount.currency).canonicalAmount(), currency: discount.currency, provenance: Object.freeze({ sourceType: 'obligation_discount', sourceId: discount.id }) })),
    ]) }));
  }
  const allocationSnapshots: Array<DocumentarySettlementCapture['allocations'][number]> = [];
  for (const allocation of active) {
    const effectiveDue = await effectiveDueAt(client, input.institutionId, allocation.obligation_id, allocation.effective_at, allocation.obligation_amount, allocation.obligation_currency);
    const priorCovered = await coveredBefore(client, input.institutionId, allocation.obligation_id, allocation.effective_at, allocation.recorded_at, allocation.id, allocation.currency);
    const before = effectiveDue.subtract(priorCovered);
    const movement = money(allocation.amount, allocation.currency).subtract(money(allocation.reversed, allocation.currency));
    const after = before.subtract(movement);
    if (after.compare(money('0', allocation.currency)) < 0) throw new Error('DOCUMENTARY_SETTLEMENT_POSITION_INVALID');
    allocationSnapshots.push(Object.freeze({ authorityId: allocation.id, obligationAuthorityId: allocation.obligation_id, before: Object.freeze(serial(before)), movement: Object.freeze(serial(movement)), after: Object.freeze(serial(after)) }));
  }
  const allocated = allocationSnapshots.reduce((total, allocation) => total.add(money(allocation.movement.amount, allocation.movement.currency)), money('0', input.currency));
  const residual = money(input.paymentAmount, input.currency).subtract(allocated);
  if (residual.compare(money('0', input.currency)) < 0) throw new Error('DOCUMENTARY_PAYMENT_ALLOCATION_INVALID');
  return Object.freeze({ obligations: Object.freeze(obligations), allocations: Object.freeze(allocationSnapshots), ...(residual.compare(money('0', input.currency)) > 0 ? { unallocated: Object.freeze(serial(residual)) } : {}) });
}

async function effectiveDueAt(client: Pick<PoolClient, 'query'>, institutionId:string, obligationId:string, at:Date, original:string, currency:string): Promise<Money> {
  const adjustments = await client.query<AdjustmentRow>(`SELECT id,direction,amount::text,currency FROM finance_obligation_adjustments WHERE institution_id=$1 AND obligation_id=$2 AND effective_at <= $3`, [institutionId, obligationId, at]);
  const discounts = await client.query<DiscountRow>(`SELECT d.id,d.amount::text,d.currency FROM finance_obligation_discounts d WHERE d.institution_id=$1 AND d.obligation_id=$2 AND d.applied_at <= $3 AND NOT EXISTS (SELECT 1 FROM finance_obligation_discount_revocations r WHERE r.institution_id=d.institution_id AND r.original_discount_id=d.id AND r.revoked_at <= $3)`, [institutionId, obligationId, at]);
  return discounts.rows.reduce((value, discount) => value.subtract(money(discount.amount, discount.currency)), adjustments.rows.reduce((value, adjustment) => adjustment.direction === 'increase' ? value.add(money(adjustment.amount, adjustment.currency)) : value.subtract(money(adjustment.amount, adjustment.currency)), money(original, currency)));
}

async function coveredBefore(client: Pick<PoolClient, 'query'>, institutionId:string, obligationId:string, effectiveAt:Date, recordedAt:Date, allocationId:string, currency:string): Promise<Money> {
  const result = await client.query<{ covered:string }>(`SELECT COALESCE(SUM(a.amount - COALESCE((SELECT SUM(r.amount) FROM finance_allocation_reversals r WHERE r.institution_id=a.institution_id AND r.original_allocation_id=a.id AND (r.effective_at,r.recorded_at,r.id) < ($3,$4,$5::uuid)),0)),0)::text covered FROM finance_allocations a WHERE a.institution_id=$1 AND a.obligation_id=$2 AND (a.effective_at,a.recorded_at,a.id) < ($3,$4,$5::uuid)`, [institutionId, obligationId, effectiveAt, recordedAt, allocationId]);
  return money(result.rows[0]?.covered ?? '0', currency);
}
