import assert from 'node:assert/strict';
import test from 'node:test';
import { composeReceiptDocumentarySnapshotV2, createDocumentarySnapshot, createDocumentarySnapshotV2, decodeDocumentarySnapshot } from '../src/modules/finance/documentary-snapshot.ts';

const issuer = { legalName: 'Escola Aurora', taxIdentifier: 'PT999', address: { countryCode: 'PT', line1: 'Rua da Escola, 1' } };
const recipient = { name: 'Maria Silva', authorityId: 'person-maria' };

test('preserves a historical V1 snapshot without semantic upgrade', () => {
  const historical = createDocumentarySnapshot({ issuer, recipient, operation: { reference: 'PAY-V1' }, payment: { reference: 'PAY-V1', amount: '10.00', currency: 'EUR' }, totals: { documentTotal: '10.00', currency: 'EUR' }, jurisdiction: { code: 'core', policyVersion: 'core-1' } });
  const decoded = decodeDocumentarySnapshot(historical);
  assert.equal(decoded.snapshotVersion, 1);
  assert.deepEqual(decoded.snapshot, historical);
});

test('creates V2 as the explicit canonical new-write format with frozen distinct party roles', () => {
  const snapshot = createDocumentarySnapshotV2({
    document: { type: 'receipt', issuedAt: '2026-09-11T12:00:00.000Z', currency: 'EUR' },
    issuer,
    recipient,
    beneficiary: { name: 'João Silva', authorityId: 'person-joao' },
    billingParty: recipient,
    payer: { name: 'Pedro Silva', authorityId: 'person-pedro' },
    operation: { reference: 'PAY-V2' },
    obligations: [],
    payment: { authorityId: 'payment-1', reference: 'PAY-V2', confirmedAt: '2026-09-11T11:59:00.000Z', method: 'cash', amount: '10.00', currency: 'EUR' },
    allocations: [],
    unallocated: { amount: '10.00', currency: 'EUR' },
    totals: { documentTotal: '10.00', currency: 'EUR' },
    tax: { treatment: 'not_applicable' },
    jurisdiction: { code: 'core', policyVersion: 'core-1' },
    legalMentions: [],
    policyProvenance: { financialProfileVersion: 1, fiscalConfigurationVersion: 1, seriesId: 'series-1', adapterKey: 'core', policyVersion: 'core-1' },
  });
  assert.equal(snapshot.snapshotVersion, 2);
  assert.equal(snapshot.beneficiary?.authorityId, 'person-joao');
  assert.equal(snapshot.billingParty?.authorityId, 'person-maria');
  assert.equal(snapshot.payer?.authorityId, 'person-pedro');
  assert.equal(snapshot.unallocated?.amount, '10.00');
});

test('V2 rejects an absent tax treatment instead of silently treating it as not applicable', () => {
  assert.throws(() => createDocumentarySnapshotV2({
    document: { type: 'receipt', issuedAt: '2026-09-11T12:00:00.000Z', currency: 'EUR' }, issuer, recipient,
    operation: { reference: 'PAY-TAX' }, obligations: [], payment: null, allocations: [],
    totals: { documentTotal: '10.00', currency: 'EUR' }, tax: { treatment: '' },
    jurisdiction: { code: 'core', policyVersion: 'core-1' }, legalMentions: [],
    policyProvenance: { financialProfileVersion: 1, fiscalConfigurationVersion: 1, seriesId: 'series-tax', adapterKey: 'core', policyVersion: 'core-1' },
  }), /DOCUMENTARY_SNAPSHOT_TAX_TREATMENT_REQUIRED/);
});

test('V2 receipt composition requires explicit policy evidence for tax treatment and legal mentions', () => {
  assert.throws(() => composeReceiptDocumentarySnapshotV2({
    documentType: 'receipt', issuedAt: new Date('2026-09-11T12:00:00.000Z'), issuer, recipient, billingParty: recipient,
    paymentAuthorityId: 'payment-policy', paymentReference: 'PAY-POLICY', paymentConfirmedAt: new Date('2026-09-11T11:00:00.000Z'), paymentMethod: 'cash', amount: '10.00', currency: 'EUR',
    jurisdictionCode: 'core', policyVersion: 'core-1', financialProfileVersion: 1, fiscalConfigurationVersion: 1, seriesId: 'series-policy', adapterKey: 'core',
  } as any), /DOCUMENTARY_SNAPSHOT_POLICY_TAX_TREATMENT_REQUIRED/);
});
