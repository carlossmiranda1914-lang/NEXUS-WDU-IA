import type { PoolClient } from 'pg';
import { Money } from './money.ts';
import { resolveInvoiceBillableSource, type InvoiceBillableSource } from './invoice-billable-source.ts';
import { captureReceiptSettlement, type DocumentarySettlementCapture } from './documentary-settlement-capture.ts';

export type InvoiceReceiptComposition = Readonly<{ obligation: InvoiceBillableSource; settlement: DocumentarySettlementCapture }>;

/**
 * Source-only boundary for Factura-Recibo. It proves a single economic
 * relationship before issuance touches a series: confirmed payment settlement
 * must be active, non-reversed, and exclusively linked to the chosen billable
 * obligation. IAM, readiness, numbering and persistence remain shared callers'
 * responsibilities.
 */
export async function resolveInvoiceReceiptComposition(client: Pick<PoolClient, 'query'>, input: {
  institutionId: string;
  payment: { id: string; amount: string; currency: string };
  obligationId: string;
  at: Date;
}): Promise<InvoiceReceiptComposition> {
  const obligation = await resolveInvoiceBillableSource(client, { institutionId: input.institutionId, obligationId: input.obligationId, at: input.at, lock: true });
  if (obligation.currency !== input.payment.currency) throw new Error('INVOICE_RECEIPT_CURRENCY_RELATIONSHIP_INVALID');
  const settlement = await captureReceiptSettlement(client, { institutionId: input.institutionId, paymentId: input.payment.id, paymentAmount: input.payment.amount, currency: input.payment.currency, asOf: input.at });
  if (settlement.allocations.length === 0) throw new Error('INVOICE_RECEIPT_ALLOCATION_REQUIRED');
  if (settlement.allocations.some(allocation => allocation.obligationAuthorityId !== obligation.obligationId)) throw new Error('INVOICE_RECEIPT_ALLOCATION_RELATIONSHIP_INVALID');
  const applied = settlement.allocations.reduce((total, allocation) => total.add(Money.parse(allocation.movement.amount, allocation.movement.currency)), Money.parse('0', input.payment.currency));
  if (applied.compare(Money.parse(obligation.billableAmount, obligation.currency)) > 0) throw new Error('INVOICE_RECEIPT_AMOUNT_RELATIONSHIP_INVALID');
  return Object.freeze({ obligation, settlement });
}
