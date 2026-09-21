import { productTerm, type ProductTermKey } from '../../lib/product-terminology.ts';
import type { CreditNoteDocumentarySnapshotV5, DocumentarySnapshot, InvoiceDocumentarySnapshotV3, InvoiceReceiptDocumentarySnapshotV4 } from './documentary-snapshot.ts';

export type CanonicalFinancialDocumentPresentation = Readonly<{
  document: Readonly<{ typeLabel: string; officialNumber: string; issueDate: string; dueDate: string | null; currency: string; statusLabel: string }>;
  issuer: Readonly<{ legalName: string; taxIdentifier: string | null; addressLines: readonly string[]; logoAssetReference: string | null }>;
  recipient: Readonly<{ name: string; taxIdentifier: string | null; addressLines: readonly string[]; operationalReference: string | null }>;
  operation: Readonly<{ reference: string | null; lines: readonly Readonly<{ description: string; quantity: string; unitPrice: string; discount: string; tax: string; netAmount: string; totalAmount: string; currency: string }>[] }>;
  totals: Readonly<{ subtotal: string | null; discountTotal: string | null; taxTotal: string | null; documentTotal: string; currency: string }>;
  policy: Readonly<{ taxTreatment: string | null; jurisdictionCode: string | null; legalMentions: readonly string[] }>;
  payment: Readonly<{ reference: string; amount: string; currency: string }> | null;
  correction: Readonly<{ originalOfficialNumber: string | null }> | null;
  legalMentions: readonly string[];
  verification: readonly Readonly<{ label: string; value: string }>[];
}>;

export type IssuedDocumentRecord = Readonly<{ documentType: string; seriesCode: string; sequenceNumber: number; issuedAt: Date; status: 'issued' }>;

/** AGT QR rendering belongs to the issued artifact boundary, never to a preview. */
export function requireIssuedAngolaQrInputs(input: { issued: boolean; issuerTaxIdentifier: string | null; officialDocumentNumber: string }) {
  if (!input.issued) throw new Error('ISSUED_DOCUMENT_REQUIRED');
  if (!input.issuerTaxIdentifier?.trim()) throw new Error('ISSUER_TAX_IDENTIFIER_REQUIRED');
  if (!input.officialDocumentNumber.trim()) throw new Error('OFFICIAL_DOCUMENT_NUMBER_REQUIRED');
  return Object.freeze({ issuerTaxIdentifier: input.issuerTaxIdentifier, officialDocumentNumber: input.officialDocumentNumber });
}

const documentTermKey = (documentType: string): ProductTermKey => {
  const key = `financial_document.${documentType}` as ProductTermKey;
  return productTerm(key) ? key : 'financial_document.receipt';
};

const isInvoiceDocumentarySnapshot = (snapshot: DocumentarySnapshot): snapshot is InvoiceDocumentarySnapshotV3 | InvoiceReceiptDocumentarySnapshotV4 => 'snapshotVersion' in snapshot && (snapshot.snapshotVersion === 3 || snapshot.snapshotVersion === 4);
const isCreditNoteDocumentarySnapshot = (snapshot: DocumentarySnapshot): snapshot is CreditNoteDocumentarySnapshotV5 => 'snapshotVersion' in snapshot && snapshot.snapshotVersion === 5;

/** Pure presentation adapter: it receives immutable issued evidence and never queries or recalculates Finance. */
export function buildFinancialDocumentPresentation(input: { document: IssuedDocumentRecord; snapshot: DocumentarySnapshot; terminology?: typeof productTerm }): CanonicalFinancialDocumentPresentation {
  const term = input.terminology ?? productTerm;
  const documentLabel = term(documentTermKey(input.document.documentType)).label;
  const invoiceSnapshot = isInvoiceDocumentarySnapshot(input.snapshot) ? input.snapshot : null;
  const operationReference = isCreditNoteDocumentarySnapshot(input.snapshot) ? input.snapshot.original.officialNumber : isInvoiceDocumentarySnapshot(input.snapshot) ? input.snapshot.obligation.reference : input.snapshot.operation.reference;
  const operationLines = isInvoiceDocumentarySnapshot(input.snapshot)
    ? input.snapshot.lines.map(line => Object.freeze({ description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, discount: line.discount, tax: line.tax, netAmount: line.netAmount, totalAmount: line.totalAmount, currency: line.currency }))
    : [];
  return Object.freeze({
    document: Object.freeze({ typeLabel: documentLabel, officialNumber: `${input.document.seriesCode}/${input.document.sequenceNumber}`, issueDate: input.document.issuedAt.toISOString(), dueDate: invoiceSnapshot?.document.dueAt ?? null, currency: input.snapshot.totals.currency, statusLabel: term('financial_document.status.issued').label }),
    issuer: Object.freeze({ legalName: input.snapshot.issuer.legalName, taxIdentifier: input.snapshot.issuer.taxIdentifier, addressLines: Object.freeze([input.snapshot.issuer.address.line1]), logoAssetReference: null }),
    recipient: Object.freeze({ name: input.snapshot.recipient.name, taxIdentifier: null, addressLines: Object.freeze([]), operationalReference: operationReference }),
    operation: Object.freeze({ reference: operationReference, lines: Object.freeze(operationLines) }),
    totals: Object.freeze({ subtotal: invoiceSnapshot?.totals.subtotal ?? null, discountTotal: invoiceSnapshot?.totals.discountTotal ?? null, taxTotal: invoiceSnapshot?.totals.taxTotal ?? null, documentTotal: input.snapshot.totals.documentTotal, currency: input.snapshot.totals.currency }),
    policy: Object.freeze({ taxTreatment: invoiceSnapshot?.tax.treatment ?? (isCreditNoteDocumentarySnapshot(input.snapshot) ? input.snapshot.tax.treatment : null), jurisdictionCode: invoiceSnapshot?.jurisdiction.code ?? (isCreditNoteDocumentarySnapshot(input.snapshot) ? input.snapshot.jurisdiction.code : null), legalMentions: Object.freeze('snapshotVersion' in input.snapshot && (input.snapshot.snapshotVersion === 2 || input.snapshot.snapshotVersion === 3 || input.snapshot.snapshotVersion === 4 || input.snapshot.snapshotVersion === 5) ? [...input.snapshot.legalMentions] : []) }),
    payment: input.snapshot.payment ? Object.freeze({ reference: input.snapshot.payment.reference, amount: input.snapshot.payment.amount, currency: input.snapshot.payment.currency }) : null,
    correction: isCreditNoteDocumentarySnapshot(input.snapshot) ? Object.freeze({ originalOfficialNumber: input.snapshot.original.officialNumber }) : null,
    legalMentions: Object.freeze('snapshotVersion' in input.snapshot && (input.snapshot.snapshotVersion === 2 || input.snapshot.snapshotVersion === 3 || input.snapshot.snapshotVersion === 4 || input.snapshot.snapshotVersion === 5) ? [...input.snapshot.legalMentions] : []),
    verification: Object.freeze([]),
  });
}
