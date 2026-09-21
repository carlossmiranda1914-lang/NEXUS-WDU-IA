import assert from 'node:assert/strict';
import test from 'node:test';
import { composeInvoiceReceiptDocumentarySnapshotV4 } from '../src/modules/finance/documentary-snapshot.ts';

const base = (overrides: Record<string, unknown> = {}) => ({
  issuedAt: new Date('2026-09-13T10:00:00.000Z'), dueAt: new Date('2026-10-08T00:00:00.000Z'),
  issuer: { legalName: 'Nexus UAT', taxIdentifier: 'NIF-1', address: { countryCode: 'NEXUS_TEST', line1: 'Rua 1' } },
  recipient: { name: 'Aluno', authorityId: 'person-1' }, billingParty: { name: 'Aluno', authorityId: 'person-1' }, payer: { name: 'Pagador', authorityId: 'person-1' },
  obligation: { authorityId: 'obligation-1', reference: 'OBR-1', amount: '0.3', currency: 'AOA', dueAt: '2026-10-08T00:00:00.000Z' },
  payment: { authorityId: 'payment-1', reference: 'PAG-1', confirmedAt: new Date('2026-09-13T09:00:00.000Z'), method: 'cash', amount: '0.3', currency: 'AOA' },
  allocations: [{ authorityId: 'allocation-1', obligationAuthorityId: 'obligation-1', before: { amount: '0.3', currency: 'AOA' }, movement: { amount: '0.1', currency: 'AOA' }, after: { amount: '0.2', currency: 'AOA' } }, { authorityId: 'allocation-2', obligationAuthorityId: 'obligation-1', before: { amount: '0.2', currency: 'AOA' }, movement: { amount: '0.2', currency: 'AOA' }, after: { amount: '0', currency: 'AOA' } }],
  line: { description: 'Propina', quantity: '1', unitPrice: '0.3', discount: '0', tax: '0' }, taxTreatment: 'not_applicable', legalMentions: [], jurisdictionCode: 'core', policyVersion: 'core-1', financialProfileVersion: 1, fiscalConfigurationVersion: 1, seriesId: 'series-1', adapterKey: 'core',
  ...overrides,
});

test('Factura-Recibo V4 freezes commercial and payment truth with exact settlement money', () => {
  const snapshot = composeInvoiceReceiptDocumentarySnapshotV4(base() as any);
  assert.equal(snapshot.snapshotVersion, 4);
  assert.equal(snapshot.document.type, 'invoice_receipt');
  assert.equal(snapshot.obligation.reference, 'OBR-1');
  assert.equal(snapshot.payment.reference, 'PAG-1');
  assert.equal(snapshot.lines[0]?.totalAmount, '0.3');
  assert.equal(snapshot.allocations.length, 2);
  assert.equal(snapshot.allocations[1]?.after.amount, '0');
  assert.equal(Object.isFrozen(snapshot), true);
});

test('Factura-Recibo V4 fails closed for currency mismatch, missing allocation, and payment reconciliation mismatch', () => {
  assert.throws(() => composeInvoiceReceiptDocumentarySnapshotV4(base({ allocations: [] }) as any), /ALLOCATION_REQUIRED/);
  assert.throws(() => composeInvoiceReceiptDocumentarySnapshotV4(base({ payment: { authorityId: 'payment-1', reference: 'PAG-1', confirmedAt: new Date(), method: 'cash', amount: '0.3', currency: 'EUR' } }) as any), /CURRENCY_MISMATCH/);
  assert.throws(() => composeInvoiceReceiptDocumentarySnapshotV4(base({ payment: { authorityId: 'payment-1', reference: 'PAG-1', confirmedAt: new Date(), method: 'cash', amount: '0.4', currency: 'AOA' } }) as any), /PAYMENT_RECONCILIATION/);
});
