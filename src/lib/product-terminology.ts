export type ProductTermKey =
  | 'financial_document.invoice'
  | 'financial_document.invoice_receipt'
  | 'financial_document.receipt'
  | 'financial_document.credit_note'
  | 'financial_document.debit_note'
  | 'financial_document.status.issued'
  | 'payment'
  | 'document.recipient'
  | 'document.issuer';

export type ProductTerm = Readonly<{
  label: string;
  shortLabel: string;
  description?: string;
  actionLabel?: string;
  confirmedLabel?: string;
}>;

const terms: Readonly<Record<ProductTermKey, ProductTerm>> = Object.freeze({
  'financial_document.invoice': Object.freeze({ label: 'Factura', shortLabel: 'Factura' }),
  'financial_document.invoice_receipt': Object.freeze({ label: 'Factura-Recibo', shortLabel: 'Factura-Recibo' }),
  'financial_document.receipt': Object.freeze({ label: 'Recibo', shortLabel: 'Recibo', actionLabel: 'Emitir recibo' }),
  'financial_document.credit_note': Object.freeze({ label: 'Nota de crédito', shortLabel: 'Nota de crédito', actionLabel: 'Emitir nota de crédito' }),
  'financial_document.debit_note': Object.freeze({ label: 'Nota de débito', shortLabel: 'Nota de débito' }),
  'financial_document.status.issued': Object.freeze({ label: 'Emitido', shortLabel: 'Emitido' }),
  payment: Object.freeze({ label: 'Pagamento', shortLabel: 'Pagamento', confirmedLabel: 'Confirmado' }),
  'document.recipient': Object.freeze({ label: 'Destinatário do documento', shortLabel: 'Destinatário' }),
  'document.issuer': Object.freeze({ label: 'Emitente', shortLabel: 'Emitente' }),
});

export function productTerm(key: ProductTermKey): ProductTerm {
  return terms[key];
}
