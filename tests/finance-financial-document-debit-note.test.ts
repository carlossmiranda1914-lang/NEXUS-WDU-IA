import assert from 'node:assert/strict';
import test from 'node:test';
import { composeDebitNoteDocumentarySnapshotV6 } from '../src/modules/finance/documentary-snapshot.ts';
import { buildFinancialDocumentPresentation } from '../src/modules/finance/financial-document-presentation.ts';
import { renderFinancialDocumentPdf } from '../src/modules/finance/financial-document-artifact-renderer.ts';
import { createSyntheticUatFiscalAdapterRegistry, resolveDocumentaryPolicy } from '../src/modules/finance/fiscal-adapter-registry.ts';

const input = () => ({ issuedAt: new Date('2026-09-22T10:00:00.000Z'), issuer: { legalName: 'Escola Nexus', taxIdentifier: '500000000', address: { countryCode: 'AO', line1: 'Rua 1' } }, recipient: { name: 'Maria', authorityId: 'person-1' }, billingParty: { name: 'Maria', authorityId: 'person-1' }, obligation: { authorityId: 'obligation-1', reference: 'OBR-1', currency: 'EUR' }, debitEvent: { adjustmentId: 'adjustment-1', obligationId: 'obligation-1', amount: '40.00', currency: 'EUR', reason: 'Evento factual', journalTransactionId: 'journal-1' }, jurisdictionCode: 'core', policyVersion: 'core-1', financialProfileVersion: 1, fiscalConfigurationVersion: 1, seriesId: 'series-1', adapterKey: 'core', legalMentions: ['AO-RJF-DOC-080', 'AO-RJF-DEBIT-083'] });

test('Task 9 freezes only a structured debit-event source with policy-derived zero tax', () => {
  const snapshot = composeDebitNoteDocumentarySnapshotV6(input());
  assert.equal(snapshot.document.type, 'debit_note');
  assert.equal(snapshot.debitEvent.basisType, 'debit_event');
  assert.equal(snapshot.tax.treatment, 'zero_tax_liquidation');
  assert.equal(snapshot.tax.amount, '0');
  assert.throws(() => composeDebitNoteDocumentarySnapshotV6({ ...input(), debitEvent: { ...input().debitEvent, amount: '0.00' } }), /AMOUNT/);
  assert.throws(() => composeDebitNoteDocumentarySnapshotV6({ ...input(), legalMentions: ['AO-RJF-DOC-080'] }), /POLICY/);
});

test('Task 9 policy is explicit and the artifact is rendered only from immutable issued truth', () => {
  const adapter = createSyntheticUatFiscalAdapterRegistry().resolveForJurisdiction('NEXUS_TEST');
  const policy = resolveDocumentaryPolicy(adapter, 'debit_note');
  assert.equal(policy.taxTreatment, 'zero_tax_liquidation');
  assert.deepEqual(policy.legalMentions, ['AO-RJF-DOC-080', 'AO-RJF-DEBIT-083']);
  const snapshot = composeDebitNoteDocumentarySnapshotV6(input());
  const presentation = buildFinancialDocumentPresentation({ document: { documentType: 'debit_note', seriesCode: 'ND', sequenceNumber: 7, issuedAt: new Date(snapshot.document.issuedAt), status: 'issued' }, snapshot });
  const pdf = renderFinancialDocumentPdf({ presentation, renderVersion: 'renderer-2' }).toString('latin1');
  assert.match(pdf, /NOTA DE D.BITO|Nota de d.bito/i);
  assert.match(pdf, /40,00 EUR/);
  assert.match(pdf, /AO-RJF-DEBIT-083/);
});

console.log('FINANCE_FINANCIAL_DOCUMENT_DEBIT_NOTE=PASS');
