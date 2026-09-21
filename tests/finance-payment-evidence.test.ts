import assert from 'node:assert/strict';
import test from 'node:test';
import { projectExternalPaymentEvidence } from '../src/modules/finance/payment-evidence.ts';

test('provider transaction references remain external payment evidence, never Nexus document numbering', () => {
  const evidence = projectExternalPaymentEvidence({ sourceType: 'provider', method: 'card', providerKey: 'adyen', providerTransactionRef: 'PSP-88271', providerOccurredAt: '2026-09-11T10:00:00.000Z' });
  assert.deepEqual(evidence, { source: 'provider', providerKey: 'adyen', externalReference: 'PSP-88271', occurredAt: new Date('2026-09-11T10:00:00.000Z'), artifactReference: null });
  assert.equal(Object.hasOwn(evidence!, 'officialNumber'), false);
  assert.equal(JSON.stringify(evidence).includes('paymentReference'), false);
});

test('manual external evidence is projected without fabricating bank or provider proof', () => {
  assert.deepEqual(projectExternalPaymentEvidence({ sourceType: 'manual_offline', method: 'bank_transfer', manualEvidenceRef: 'BANK-REF-42' }), { source: 'bank_transfer', providerKey: null, externalReference: 'BANK-REF-42', occurredAt: null, artifactReference: 'BANK-REF-42' });
  assert.equal(projectExternalPaymentEvidence({ sourceType: 'manual_offline', method: 'cash' }), null);
});
