export const ANGOLA_POLICY_VERSION = 'angola-2025-71-683-v1' as const;
export const ANGOLA_POLICY_EFFECTIVE_FROM = new Date('2025-08-22T00:00:00.000Z');

/**
 * Publicly verified sources only. This manifest intentionally carries no
 * credentials, taxpayer facts, signing keys or production-series values.
 */
export const angolaEvidenceManifest = Object.freeze({
  decree71_25: 'Decreto Presidencial n.º 71/25',
  decree683_25: 'Decreto Executivo n.º 683/25',
  documentTypes: Object.freeze(['invoice', 'invoice_receipt', 'receipt', 'credit_note', 'debit_note'] as const),
});
