import assert from 'node:assert/strict';
import test from 'node:test';
import { composeInvoiceDocumentarySnapshotV3, decodeDocumentarySnapshot } from '../src/modules/finance/documentary-snapshot.ts';
import { validateDocumentSourceType } from '../src/modules/finance/financial-document-model.ts';

test('invoice V3 snapshot freezes one authoritative obligation line and exact AOA totals', () => {
  const snapshot = composeInvoiceDocumentarySnapshotV3({
    issuedAt: new Date('2026-09-12T10:00:00.000Z'),
    dueAt: new Date('2026-10-12T00:00:00.000Z'),
    issuer: { legalName: 'Nexus Escola', taxIdentifier: 'AO500000001', address: { countryCode: 'AO', line1: 'Rua da Escola, 1' } },
    recipient: { name: 'Encarregado', authorityId: 'person-1' },
    obligation: { authorityId: 'obligation-1', reference: 'OBR-0001', amount: '100.00', currency: 'AOA', dueAt: '2026-10-12T00:00:00.000Z' },
    line: { description: 'Propina de setembro', quantity: '1', unitPrice: '100.00', discount: '0.00', tax: '0.00' },
    taxTreatment: 'not_applicable',
    legalMentions: [],
    jurisdictionCode: 'NEXUS_TEST', policyVersion: 'core-1', financialProfileVersion: 1, fiscalConfigurationVersion: 1, seriesId: 'invoice-series', adapterKey: 'core',
  });
  assert.equal(snapshot.snapshotVersion, 3);
  assert.equal(snapshot.document.type, 'invoice');
  assert.equal(snapshot.document.dueAt, '2026-10-12T00:00:00.000Z');
  assert.deepEqual(snapshot.lines, [{ description: 'Propina de setembro', quantity: '1', unitPrice: '100', discount: '0', tax: '0', netAmount: '100', totalAmount: '100', currency: 'AOA', obligationAuthorityId: 'obligation-1' }]);
  assert.deepEqual(snapshot.totals, { subtotal: '100', discountTotal: '0', taxTotal: '0', documentTotal: '100', currency: 'AOA' });
  assert.equal(snapshot.payment, null);
  assert.deepEqual(decodeDocumentarySnapshot(snapshot), { snapshotVersion: 3, snapshot });
});

test('source type matrix permits only payment receipt and obligation invoice', () => {
  assert.doesNotThrow(() => validateDocumentSourceType('payment', 'receipt'));
  assert.doesNotThrow(() => validateDocumentSourceType('obligation', 'invoice'));
  assert.throws(() => validateDocumentSourceType('payment', 'invoice'), /FINANCIAL_DOCUMENT_SOURCE_TYPE_INVALID/);
  assert.throws(() => validateDocumentSourceType('obligation', 'receipt'), /FINANCIAL_DOCUMENT_SOURCE_TYPE_INVALID/);
});

test('unknown documentary snapshot version fails closed', () => {
  assert.throws(() => decodeDocumentarySnapshot({ snapshotVersion: 99 }), /DOCUMENTARY_SNAPSHOT_VERSION_UNSUPPORTED/);
});
