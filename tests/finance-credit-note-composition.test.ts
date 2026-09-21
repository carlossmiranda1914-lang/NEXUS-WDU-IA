import assert from 'node:assert/strict';
import test from 'node:test';
import { composeCreditNoteDocumentarySnapshotV5 } from '../src/modules/finance/financial-document-credit-note.ts';

const original = Object.freeze({
  snapshotVersion: 4 as const,
  document: { type: 'invoice_receipt' as const, issuedAt: '2026-09-14T10:00:00.000Z', dueAt: '2026-09-20T00:00:00.000Z', currency: 'AOA' },
  issuer: { legalName: 'Nexus UAT', taxIdentifier: 'NEXUS-TEST', address: { countryCode: 'NEXUS_TEST', line1: 'UAT' } },
  recipient: { name: 'Aluno UAT', authorityId: 'recipient-1' }, billingParty: { name: 'Aluno UAT', authorityId: 'recipient-1' },
  obligation: { authorityId: 'obligation-1', reference: 'OBR-000001', amount: '100.00', currency: 'AOA', dueAt: '2026-09-20T00:00:00.000Z' },
  payment: { authorityId: 'payment-1', reference: 'PAG-000001', confirmedAt: '2026-09-14T10:00:00.000Z', method: 'cash', amount: '40.00', currency: 'AOA' },
  allocations: [{ authorityId: 'allocation-1', obligationAuthorityId: 'obligation-1', before: { amount: '100.00', currency: 'AOA' }, movement: { amount: '40.00', currency: 'AOA' }, after: { amount: '60.00', currency: 'AOA' } }],
  lines: [{ description: 'Propina', quantity: '1', unitPrice: '100.00', discount: '0', tax: '0', netAmount: '100.00', totalAmount: '100.00', currency: 'AOA', obligationAuthorityId: 'obligation-1' }],
  totals: { subtotal: '100.00', discountTotal: '0', taxTotal: '0', documentTotal: '100.00', currency: 'AOA' },
  tax: { treatment: 'not_applicable' }, jurisdiction: { code: 'NEXUS_TEST', policyVersion: 'core-1' }, legalMentions: [],
  policyProvenance: { financialProfileVersion: 1, fiscalConfigurationVersion: 1, seriesId: 'invoice-receipt-series', adapterKey: 'core', policyVersion: 'core-1' },
});

test('P01 exact credit-note composition freezes a bounded V4 corrective fact', () => {
  const note = composeCreditNoteDocumentarySnapshotV5({ originalDocumentId: 'original-1', originalOfficialNumber: 'FR/1', original, issuedAt: new Date('2026-09-14T11:00:00.000Z'), amount: '0.30', currency: 'AOA', seriesId: 'credit-series', policy: { taxTreatment: 'not_applicable', legalMentions: [] }, policyProvenance: { financialProfileVersion: 1, fiscalConfigurationVersion: 1, adapterKey: 'core', policyVersion: 'core-1' } });
  assert.equal(note.snapshotVersion, 5);
  assert.equal(note.document.type, 'credit_note');
  assert.equal(note.totals.documentTotal, '0.3');
  assert.equal(note.correction.originalDocumentId, 'original-1');
  assert.equal(note.correction.permittedAmount, '100');
  assert.equal(note.original.documentType, 'invoice_receipt');
});

test('P01 rejects non-positive, cross-currency and over-bound correction money before issuance', () => {
  const input = { originalDocumentId: 'original-1', originalOfficialNumber: 'FR/1', original, issuedAt: new Date(), currency: 'AOA', seriesId: 'credit-series', policy: { taxTreatment: 'not_applicable', legalMentions: [] }, policyProvenance: { financialProfileVersion: 1, fiscalConfigurationVersion: 1, adapterKey: 'core', policyVersion: 'core-1' } };
  assert.throws(() => composeCreditNoteDocumentarySnapshotV5({ ...input, amount: '0' }), /CREDIT_NOTE_AMOUNT_POSITIVE_REQUIRED/);
  assert.throws(() => composeCreditNoteDocumentarySnapshotV5({ ...input, amount: '1.00', currency: 'EUR' }), /CREDIT_NOTE_CURRENCY_MISMATCH/);
  assert.throws(() => composeCreditNoteDocumentarySnapshotV5({ ...input, amount: '100.01' }), /CREDIT_NOTE_AMOUNT_EXCEEDS_ORIGINAL/);
  assert.throws(() => composeCreditNoteDocumentarySnapshotV5({ ...input, amount: '0.1', permittedAmount: '100.01' }), /CREDIT_NOTE_AMOUNT_EXCEEDS_ORIGINAL/);
});
