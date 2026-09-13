import { productTerm, type ProductTermKey } from '../../lib/product-terminology.ts';
import type { DocumentarySnapshot, InvoiceDocumentarySnapshotV3 } from './documentary-snapshot.ts';

export type CanonicalFinancialDocumentPresentation = Readonly<{
  document: Readonly<{ typeLabel: string; officialNumber: string; issueDate: string; dueDate: string | null; currency: string; statusLabel: string }>;
  issuer: Readonly<{ legalName: string; taxIdentifier: string | null; addressLines: readonly string[]; logoAssetReference: string | null }>;
  recipient: Readonly<{ name: string; taxIdentifier: string | null; addressLines: readonly string[]; operationalReference: string | null }>;
  operation: Readonly<{ reference: string | null; lines: readonly Readonly<{ label: string; amount: string }>[] }>;
  totals: Readonly<{ documentTotal: string; currency: string }>;
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

const isInvoiceDocumentarySnapshot = (snapshot: DocumentarySnapshot): snapshot is InvoiceDocumentarySnapshotV3 => 'snapshotVersion' in snapshot && snapshot.snapshotVersion === 3;

/** Pure presentation adapter: it receives immutable issued evidence and never queries or recalculates Finance. */
export function buildFinancialDocumentPresentation(input: { document: IssuedDocumentRecord; snapshot: DocumentarySnapshot; terminology?: typeof productTerm }): CanonicalFinancialDocumentPresentation {
  const term = input.terminology ?? productTerm;
  const documentLabel = term(documentTermKey(input.document.documentType)).label;
  const invoiceSnapshot = isInvoiceDocumentarySnapshot(input.snapshot) ? input.snapshot : null;
  const operationReference = isInvoiceDocumentarySnapshot(input.snapshot) ? input.snapshot.obligation.reference : input.snapshot.operation.reference;
  const operationLines = isInvoiceDocumentarySnapshot(input.snapshot)
    ? input.snapshot.lines.map(line => Object.freeze({ label: `${line.description} · ${line.quantity} × ${line.unitPrice} · desconto ${line.discount} · imposto ${line.tax}`, amount: line.totalAmount }))
    : [];
  return Object.freeze({
    document: Object.freeze({ typeLabel: documentLabel, officialNumber: `${input.document.seriesCode}/${input.document.sequenceNumber}`, issueDate: input.document.issuedAt.toISOString(), dueDate: invoiceSnapshot?.document.dueAt ?? null, currency: input.snapshot.totals.currency, statusLabel: term('financial_document.status.issued').label }),
    issuer: Object.freeze({ legalName: input.snapshot.issuer.legalName, taxIdentifier: input.snapshot.issuer.taxIdentifier, addressLines: Object.freeze([input.snapshot.issuer.address.line1]), logoAssetReference: null }),
    recipient: Object.freeze({ name: input.snapshot.recipient.name, taxIdentifier: null, addressLines: Object.freeze([]), operationalReference: operationReference }),
    operation: Object.freeze({ reference: operationReference, lines: Object.freeze(operationLines) }),
    totals: Object.freeze({ documentTotal: input.snapshot.totals.documentTotal, currency: input.snapshot.totals.currency }),
    payment: input.snapshot.payment ? Object.freeze({ reference: input.snapshot.payment.reference, amount: input.snapshot.payment.amount, currency: input.snapshot.payment.currency }) : null,
    correction: null,
    legalMentions: Object.freeze('snapshotVersion' in input.snapshot && (input.snapshot.snapshotVersion === 2 || input.snapshot.snapshotVersion === 3) ? [...input.snapshot.legalMentions] : []),
    verification: Object.freeze([]),
  });
}
