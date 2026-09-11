import assert from 'node:assert/strict';
import test from 'node:test';
import { composeReceiptDocumentarySnapshot, createDocumentarySnapshot } from '../src/modules/finance/documentary-snapshot.ts';

test('creates a versioned immutable documentary snapshot without technical metadata', () => {
  const snapshot = createDocumentarySnapshot({ issuer: { legalName: 'Escola', taxIdentifier: 'T', address: { countryCode: 'PT', line1: 'Rua' } }, recipient: { name: 'Maria', authorityId: 'person-1' }, operation: { reference: 'OBR-1' }, payment: { reference: 'PAG-1', amount: '10.00', currency: 'EUR' }, totals: { documentTotal: '10.00', currency: 'EUR' }, jurisdiction: { code: 'core', policyVersion: 'core-1' } });
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.recipient.name, 'Maria');
  assert.throws(() => { (snapshot.recipient as { name: string }).name = 'Alterada'; }, /read only|Cannot assign/i);
});

test('composes receipt presentation truth from resolved authorities', () => {
  const snapshot = composeReceiptDocumentarySnapshot({ issuer: { legalName: 'Escola', taxIdentifier: null, address: { countryCode: 'PT', line1: 'Rua' } }, recipient: { name: 'Maria', authorityId: 'person-1' }, paymentReference: 'PAG-1', amount: '10.00', currency: 'EUR', jurisdictionCode: 'core', policyVersion: 'core-1' });
  assert.equal(snapshot.payment?.reference, 'PAG-1');
  assert.equal(snapshot.totals.documentTotal, '10.00');
});

test('rejects incomplete receipt evidence before a document can be numbered', () => {
  assert.throws(() => createDocumentarySnapshot({ issuer: { legalName: 'Escola', taxIdentifier: null, address: { countryCode: 'PT', line1: '' } }, recipient: { name: 'Maria', authorityId: 'person-1' }, operation: { reference: 'PAG-1' }, payment: { reference: 'PAG-1', amount: '10.00', currency: 'EUR' }, totals: { documentTotal: '10.00', currency: 'EUR' }, jurisdiction: { code: 'core', policyVersion: 'core-1' } }), /DOCUMENTARY_SNAPSHOT_ISSUER_ADDRESS_REQUIRED/);
});
