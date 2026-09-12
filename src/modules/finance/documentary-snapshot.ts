import { ExactDecimal } from './exact-decimal.ts';
import { Money, MONEY_MAX_PRECISION, MONEY_MAX_SCALE } from './money.ts';

export type DocumentarySnapshotV1 = Readonly<{ schemaVersion: 1; issuer: Readonly<{ legalName: string; taxIdentifier: string | null; address: Readonly<{ countryCode: string; line1: string }> }>; recipient: Readonly<{ name: string; authorityId: string }>; operation: Readonly<{ reference: string | null }>; payment: Readonly<{ reference: string; amount: string; currency: string }> | null; totals: Readonly<{ documentTotal: string; currency: string }>; jurisdiction: Readonly<{ code: string; policyVersion: string }> }>;

type DocumentaryPartySnapshot = Readonly<{ name: string; authorityId: string }>;
type DocumentaryMoney = Readonly<{ amount: string; currency: string }>;
export type DocumentarySnapshotV2 = Readonly<{
  snapshotVersion: 2;
  document: Readonly<{ type: string; issuedAt: string; currency: string }>;
  issuer: DocumentarySnapshotV1['issuer']; recipient: DocumentaryPartySnapshot;
  beneficiary?: DocumentaryPartySnapshot; billingParty?: DocumentaryPartySnapshot; payer?: DocumentaryPartySnapshot;
  operation: Readonly<{ reference: string | null }>;
  obligations: readonly Readonly<{ authorityId: string; reference: string | null; components: readonly Readonly<{ kind: string; amount: string; currency: string; provenance: Readonly<{ sourceType: string; sourceId: string; versionId?: string }> }>[] }>[];
  payment: Readonly<{ authorityId: string; reference: string; confirmedAt: string; method: string; amount: string; currency: string }> | null;
  allocations: readonly Readonly<{ authorityId: string; obligationAuthorityId: string; before: DocumentaryMoney; movement: DocumentaryMoney; after: DocumentaryMoney }>[];
  unallocated?: DocumentaryMoney;
  totals: Readonly<{ documentTotal: string; currency: string }>;
  tax: Readonly<{ treatment: string }>;
  jurisdiction: Readonly<{ code: string; policyVersion: string }>;
  legalMentions: readonly string[];
  correction?: Readonly<{ originalDocumentId: string; originalSnapshotVersion: 1 | 2 }>;
  policyProvenance: Readonly<{ financialProfileVersion: number; fiscalConfigurationVersion: number; seriesId: string; adapterKey: string; policyVersion: string }>;
}>;
export type InvoiceDocumentarySnapshotV3 = Readonly<{
  snapshotVersion: 3;
  document: Readonly<{ type: 'invoice'; issuedAt: string; dueAt: string; currency: string }>;
  issuer: DocumentarySnapshotV1['issuer']; recipient: DocumentaryPartySnapshot;
  obligation: Readonly<{ authorityId: string; reference: string; amount: string; currency: string; dueAt: string }>;
  payment: null;
  lines: readonly Readonly<{ description: string; quantity: string; unitPrice: string; discount: string; tax: string; netAmount: string; totalAmount: string; currency: string; obligationAuthorityId: string }>[];
  totals: Readonly<{ subtotal: string; discountTotal: string; taxTotal: string; documentTotal: string; currency: string }>;
  tax: Readonly<{ treatment: string }>;
  jurisdiction: Readonly<{ code: string; policyVersion: string }>;
  legalMentions: readonly string[];
  policyProvenance: DocumentarySnapshotV2['policyProvenance'];
}>;
export type DocumentarySnapshot = DocumentarySnapshotV1 | DocumentarySnapshotV2 | InvoiceDocumentarySnapshotV3;
export type DecodedDocumentarySnapshot = Readonly<{ snapshotVersion: 1 | 2 | 3; snapshot: DocumentarySnapshot }>;

const freeze = <T>(value: T): Readonly<T> => Object.freeze(value);
const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

const required = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`DOCUMENTARY_SNAPSHOT_${field}_REQUIRED`);
  return value;
};

/** Reject incomplete documentary evidence before issuance allocates a document number. */
export function assertValidDocumentarySnapshot(snapshot: DocumentarySnapshotV1): void {
  required(snapshot.issuer.legalName, 'ISSUER_LEGAL_NAME');
  required(snapshot.issuer.address.countryCode, 'ISSUER_COUNTRY');
  required(snapshot.issuer.address.line1, 'ISSUER_ADDRESS');
  required(snapshot.recipient.name, 'RECIPIENT_NAME');
  required(snapshot.recipient.authorityId, 'RECIPIENT_AUTHORITY');
  required(snapshot.operation.reference, 'OPERATION_REFERENCE');
  if (!snapshot.payment) throw new Error('DOCUMENTARY_SNAPSHOT_PAYMENT_REQUIRED');
  required(snapshot.payment.reference, 'PAYMENT_REFERENCE');
  required(snapshot.payment.amount, 'PAYMENT_AMOUNT');
  required(snapshot.payment.currency, 'PAYMENT_CURRENCY');
  required(snapshot.totals.documentTotal, 'TOTAL_AMOUNT');
  required(snapshot.totals.currency, 'TOTAL_CURRENCY');
  required(snapshot.jurisdiction.code, 'JURISDICTION_CODE');
  required(snapshot.jurisdiction.policyVersion, 'POLICY_VERSION');
}

export function createDocumentarySnapshot(input: Omit<DocumentarySnapshotV1, 'schemaVersion'>): DocumentarySnapshotV1 {
  const snapshot = freeze({ schemaVersion: 1 as const, issuer: freeze({ ...input.issuer, address: freeze({ ...input.issuer.address }) }), recipient: freeze({ ...input.recipient }), operation: freeze({ ...input.operation }), payment: input.payment ? freeze({ ...input.payment }) : null, totals: freeze({ ...input.totals }), jurisdiction: freeze({ ...input.jurisdiction }) });
  assertValidDocumentarySnapshot(snapshot);
  return snapshot;
}

export function composeReceiptDocumentarySnapshot(input: {
  issuer: DocumentarySnapshotV1['issuer']; recipient: DocumentarySnapshotV1['recipient']; paymentReference: string; amount: string; currency: string; jurisdictionCode: string; policyVersion: string;
}): DocumentarySnapshotV1 {
  return createDocumentarySnapshot({ issuer: input.issuer, recipient: input.recipient, operation: { reference: input.paymentReference }, payment: { reference: input.paymentReference, amount: input.amount, currency: input.currency }, totals: { documentTotal: input.amount, currency: input.currency }, jurisdiction: { code: input.jurisdictionCode, policyVersion: input.policyVersion } });
}

/** V2 is the only new-write shape after cutover; V1 remains a read-only historical format. */
export function createDocumentarySnapshotV2(input: Omit<DocumentarySnapshotV2, 'snapshotVersion'>): DocumentarySnapshotV2 {
  required(input.document.type, 'DOCUMENT_TYPE'); required(input.document.issuedAt, 'ISSUED_AT'); required(input.document.currency, 'DOCUMENT_CURRENCY');
  required(input.issuer.legalName, 'ISSUER_LEGAL_NAME'); required(input.recipient.name, 'RECIPIENT_NAME'); required(input.recipient.authorityId, 'RECIPIENT_AUTHORITY');
  required(input.totals.documentTotal, 'TOTAL_AMOUNT'); required(input.totals.currency, 'TOTAL_CURRENCY'); required(input.jurisdiction.code, 'JURISDICTION_CODE'); required(input.jurisdiction.policyVersion, 'POLICY_VERSION');
  required(input.tax.treatment, 'TAX_TREATMENT');
  required(input.policyProvenance.adapterKey, 'POLICY_ADAPTER'); required(input.policyProvenance.policyVersion, 'POLICY_VERSION'); required(input.policyProvenance.seriesId, 'SERIES_ID');
  if (input.document.currency !== input.totals.currency) throw new Error('DOCUMENTARY_SNAPSHOT_CURRENCY_MISMATCH');
  return deepFreeze({ snapshotVersion: 2 as const, ...input }) as DocumentarySnapshotV2;
}

export function composeReceiptDocumentarySnapshotV2(input: {
  documentType: string; issuedAt: Date; issuer: DocumentarySnapshotV1['issuer']; recipient: DocumentaryPartySnapshot; billingParty: DocumentaryPartySnapshot; payer?: DocumentaryPartySnapshot;
  paymentAuthorityId: string; paymentReference: string; paymentConfirmedAt: Date; paymentMethod: string; amount: string; currency: string; jurisdictionCode: string; policyVersion: string;
  financialProfileVersion: number; fiscalConfigurationVersion: number; seriesId: string; adapterKey: string;
  taxTreatment: string; legalMentions: readonly string[];
  obligations: DocumentarySnapshotV2['obligations']; allocations: DocumentarySnapshotV2['allocations']; unallocated?: DocumentaryMoney;
}): DocumentarySnapshotV2 {
  required(input.taxTreatment, 'POLICY_TAX_TREATMENT');
  if (!Array.isArray(input.legalMentions)) throw new Error('DOCUMENTARY_POLICY_LEGAL_MENTIONS_REQUIRED');
  return createDocumentarySnapshotV2({
    document: { type: input.documentType, issuedAt: input.issuedAt.toISOString(), currency: input.currency }, issuer: input.issuer, recipient: input.recipient,
    billingParty: input.billingParty, ...(input.payer ? { payer: input.payer } : {}), operation: { reference: input.paymentReference }, obligations: input.obligations,
    payment: { authorityId: input.paymentAuthorityId, reference: input.paymentReference, confirmedAt: input.paymentConfirmedAt.toISOString(), method: input.paymentMethod, amount: input.amount, currency: input.currency },
    allocations: input.allocations, ...(input.unallocated ? { unallocated: input.unallocated } : {}), totals: { documentTotal: input.amount, currency: input.currency }, tax: { treatment: input.taxTreatment },
    jurisdiction: { code: input.jurisdictionCode, policyVersion: input.policyVersion }, legalMentions: [...input.legalMentions],
    policyProvenance: { financialProfileVersion: input.financialProfileVersion, fiscalConfigurationVersion: input.fiscalConfigurationVersion, seriesId: input.seriesId, adapterKey: input.adapterKey, policyVersion: input.policyVersion },
  });
}

/**
 * V3 is the invoice-only envelope. It intentionally does not make V2 payment
 * fields optional: a future issuer must freeze the obligation fact and lines.
 */
export function composeInvoiceDocumentarySnapshotV3(input: {
  issuedAt: Date; dueAt: Date; issuer: DocumentarySnapshotV1['issuer']; recipient: DocumentaryPartySnapshot;
  obligation: { authorityId: string; reference: string; amount: string; currency: string; dueAt: string };
  line: { description: string; quantity: string; unitPrice: string; discount: string; tax: string };
  taxTreatment: string; legalMentions: readonly string[]; jurisdictionCode: string; policyVersion: string;
  financialProfileVersion: number; fiscalConfigurationVersion: number; seriesId: string; adapterKey: string;
}): InvoiceDocumentarySnapshotV3 {
  required(input.obligation.authorityId, 'INVOICE_OBLIGATION'); required(input.obligation.reference, 'INVOICE_OBLIGATION_REFERENCE');
  required(input.line.description, 'INVOICE_LINE_DESCRIPTION'); required(input.taxTreatment, 'POLICY_TAX_TREATMENT');
  if (!Number.isFinite(input.issuedAt.getTime()) || !Number.isFinite(input.dueAt.getTime())) throw new Error('DOCUMENTARY_SNAPSHOT_INVOICE_DATE_INVALID');
  if (!Array.isArray(input.legalMentions)) throw new Error('DOCUMENTARY_POLICY_LEGAL_MENTIONS_REQUIRED');
  const currency = input.obligation.currency;
  const quantity = ExactDecimal.parse(input.line.quantity, MONEY_MAX_PRECISION, MONEY_MAX_SCALE);
  const unitPrice = ExactDecimal.parse(input.line.unitPrice, MONEY_MAX_PRECISION, MONEY_MAX_SCALE);
  const gross = Money.fromDecimal(quantity.multiply(unitPrice, MONEY_MAX_PRECISION, MONEY_MAX_SCALE), currency);
  const discount = Money.parse(input.line.discount, currency);
  const tax = Money.parse(input.line.tax, currency);
  if (discount.compare(gross) > 0) throw new Error('DOCUMENTARY_SNAPSHOT_INVOICE_DISCOUNT_EXCEEDS_GROSS');
  const net = gross.subtract(discount); const total = net.add(tax);
  if (!total.equals(Money.parse(input.obligation.amount, currency))) throw new Error('DOCUMENTARY_SNAPSHOT_INVOICE_TOTAL_MISMATCH');
  return deepFreeze({ snapshotVersion: 3 as const,
    document: { type: 'invoice' as const, issuedAt: input.issuedAt.toISOString(), dueAt: input.dueAt.toISOString(), currency }, issuer: input.issuer, recipient: input.recipient,
    obligation: { ...input.obligation }, payment: null,
    lines: [{ description: input.line.description, quantity: quantity.toCanonicalString(), unitPrice: unitPrice.toCanonicalString(), discount: discount.canonicalAmount(), tax: tax.canonicalAmount(), netAmount: net.canonicalAmount(), totalAmount: total.canonicalAmount(), currency, obligationAuthorityId: input.obligation.authorityId }],
    totals: { subtotal: gross.canonicalAmount(), discountTotal: discount.canonicalAmount(), taxTotal: tax.canonicalAmount(), documentTotal: total.canonicalAmount(), currency }, tax: { treatment: input.taxTreatment },
    jurisdiction: { code: input.jurisdictionCode, policyVersion: input.policyVersion }, legalMentions: [...input.legalMentions],
    policyProvenance: { financialProfileVersion: input.financialProfileVersion, fiscalConfigurationVersion: input.fiscalConfigurationVersion, seriesId: input.seriesId, adapterKey: input.adapterKey, policyVersion: input.policyVersion },
  }) as InvoiceDocumentarySnapshotV3;
}

/** Explicit discriminator: legacy rows are recognized solely by their stored V1 schema marker. */
export function decodeDocumentarySnapshot(value: unknown): DecodedDocumentarySnapshot {
  if (!value || typeof value !== 'object') throw new Error('DOCUMENTARY_SNAPSHOT_INVALID');
  const snapshot = value as Record<string, unknown>;
  if (snapshot.snapshotVersion === 2) return { snapshotVersion: 2, snapshot: value as DocumentarySnapshotV2 };
  if (snapshot.snapshotVersion === 3) return { snapshotVersion: 3, snapshot: value as InvoiceDocumentarySnapshotV3 };
  if (snapshot.schemaVersion === 1) return { snapshotVersion: 1, snapshot: value as DocumentarySnapshotV1 };
  throw new Error('DOCUMENTARY_SNAPSHOT_VERSION_UNSUPPORTED');
}
