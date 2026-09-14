import { Money } from './money.ts';
import type { CreditNoteDocumentarySnapshotV5, InvoiceReceiptDocumentarySnapshotV4 } from './documentary-snapshot.ts';

type CreditNotePolicy = Readonly<{ taxTreatment: string; legalMentions: readonly string[] }>;

/**
 * Finance-local correction composition. It has no live source reads: the
 * caller supplies the locked immutable V4 original and the current policy
 * provenance already resolved by the authoritative command.
 */
export function composeCreditNoteDocumentarySnapshotV5(input: {
  originalDocumentId: string;
  originalOfficialNumber: string;
  original: InvoiceReceiptDocumentarySnapshotV4;
  issuedAt: Date;
  amount: string;
  currency: string;
  permittedAmount?: string;
  seriesId: string;
  policy: CreditNotePolicy;
  policyProvenance: Readonly<{ financialProfileVersion: number; fiscalConfigurationVersion: number; adapterKey: string; policyVersion: string }>;
}): CreditNoteDocumentarySnapshotV5 {
  if (!input.originalDocumentId.trim() || !input.originalOfficialNumber.trim()) throw new Error('CREDIT_NOTE_ORIGINAL_REQUIRED');
  if (!Number.isFinite(input.issuedAt.getTime())) throw new Error('CREDIT_NOTE_ISSUED_AT_INVALID');
  const originalTotal = Money.parse(input.original.totals.documentTotal, input.original.totals.currency);
  const permitted = Money.parse(input.permittedAmount ?? input.original.totals.documentTotal, input.original.totals.currency);
  if (permitted.compare(originalTotal) > 0) throw new Error('CREDIT_NOTE_AMOUNT_EXCEEDS_ORIGINAL');
  const amount = Money.parse(input.amount, input.currency);
  if (amount.currency !== permitted.currency) throw new Error('CREDIT_NOTE_CURRENCY_MISMATCH');
  if (amount.compare(Money.parse('0', amount.currency)) <= 0) throw new Error('CREDIT_NOTE_AMOUNT_POSITIVE_REQUIRED');
  if (amount.compare(permitted) > 0) throw new Error('CREDIT_NOTE_AMOUNT_EXCEEDS_ORIGINAL');
  if (!input.policy.taxTreatment.trim() || !Array.isArray(input.policy.legalMentions)) throw new Error('DOCUMENTARY_POLICY_REQUIRED');
  return Object.freeze({
    snapshotVersion: 5 as const,
    document: Object.freeze({ type: 'credit_note' as const, issuedAt: input.issuedAt.toISOString(), currency: amount.currency }),
    issuer: input.original.issuer, recipient: input.original.recipient, billingParty: input.original.billingParty,
    ...(input.original.payer ? { payer: input.original.payer } : {}),
    original: Object.freeze({ documentId: input.originalDocumentId, officialNumber: input.originalOfficialNumber, documentType: 'invoice_receipt' as const, snapshotVersion: 4 as const, amount: permitted.canonicalAmount(), currency: permitted.currency }),
    correction: Object.freeze({ originalDocumentId: input.originalDocumentId, originalSnapshotVersion: 4 as const, amount: amount.canonicalAmount(), currency: amount.currency, permittedAmount: permitted.canonicalAmount() }),
    obligation: input.original.obligation, payment: input.original.payment, allocations: input.original.allocations,
    ...(input.original.unallocated ? { unallocated: input.original.unallocated } : {}),
    totals: Object.freeze({ documentTotal: amount.canonicalAmount(), currency: amount.currency }),
    tax: Object.freeze({ treatment: input.policy.taxTreatment }), jurisdiction: input.original.jurisdiction,
    legalMentions: Object.freeze([...input.policy.legalMentions]),
    policyProvenance: Object.freeze({ ...input.policyProvenance, seriesId: input.seriesId }),
  });
}
