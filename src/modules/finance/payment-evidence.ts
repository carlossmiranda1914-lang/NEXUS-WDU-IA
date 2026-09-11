import type { Payment } from './payment-model.ts';

export type ExternalPaymentEvidence = Readonly<{
  source: 'bank_transfer' | 'provider' | 'manual_external_reference';
  providerKey: string | null;
  externalReference: string | null;
  occurredAt: Date | null;
  artifactReference: string | null;
}>;

/**
 * Projects independently-originated payment evidence.  It deliberately has no
 * official-document-number field: only Financial Document issuance can assign
 * Nexus official numbering.
 */
export function projectExternalPaymentEvidence(payment: Pick<Payment, 'sourceType' | 'method' | 'providerKey' | 'providerTransactionRef' | 'providerOccurredAt' | 'manualEvidenceRef'>): ExternalPaymentEvidence | null {
  if (payment.sourceType === 'provider') return Object.freeze({ source: 'provider', providerKey: payment.providerKey ?? null, externalReference: payment.providerTransactionRef ?? null, occurredAt: payment.providerOccurredAt ? new Date(payment.providerOccurredAt) : null, artifactReference: payment.manualEvidenceRef ?? null });
  if (payment.method === 'bank_transfer') return Object.freeze({ source: 'bank_transfer', providerKey: null, externalReference: payment.manualEvidenceRef ?? null, occurredAt: null, artifactReference: payment.manualEvidenceRef ?? null });
  if (payment.method === 'external_reference') return Object.freeze({ source: 'manual_external_reference', providerKey: null, externalReference: payment.manualEvidenceRef ?? null, occurredAt: null, artifactReference: payment.manualEvidenceRef ?? null });
  return null;
}
