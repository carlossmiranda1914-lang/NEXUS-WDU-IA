import assert from 'node:assert/strict';
import test from 'node:test';
import { createDocumentarySnapshot, createDocumentarySnapshotV2 } from '../src/modules/finance/documentary-snapshot.ts';
import { buildFinancialDocumentPresentation } from '../src/modules/finance/financial-document-presentation.ts';

const snapshot = createDocumentarySnapshot({ issuer: { legalName: 'Escola Aurora', taxIdentifier: 'PT999', address: { countryCode: 'PT', line1: 'Rua da Escola, 1' } }, recipient: { name: 'Maria Silva', authorityId: 'person-1' }, operation: { reference: 'PAG-42' }, payment: { reference: 'PAG-42', amount: '10.00', currency: 'EUR' }, totals: { documentTotal: '10.00', currency: 'EUR' }, jurisdiction: { code: 'core', policyVersion: 'core-1' } });

test('builds a human receipt presentation from immutable documentary truth', () => {
  const presentation = buildFinancialDocumentPresentation({ document: { documentType: 'receipt', seriesCode: 'REC', sequenceNumber: 7, issuedAt: new Date('2026-09-11T10:00:00.000Z'), status: 'issued' }, snapshot });
  assert.equal(presentation.document.typeLabel, 'Recibo');
  assert.equal(presentation.document.officialNumber, 'REC/7');
  assert.equal(presentation.issuer.legalName, 'Escola Aurora');
  assert.equal(presentation.recipient.name, 'Maria Silva');
  assert.equal(presentation.payment?.reference, 'PAG-42');
});

test('maps corrective document labels and excludes raw authority metadata', () => {
  const presentation = buildFinancialDocumentPresentation({ document: { documentType: 'credit_note', seriesCode: 'NC', sequenceNumber: 8, issuedAt: new Date('2026-09-11T10:00:00.000Z'), status: 'issued' }, snapshot });
  assert.equal(presentation.document.typeLabel, 'Nota de crédito');
  assert.doesNotMatch(JSON.stringify(presentation), /adapterKey|sourceId|renderer|template|storageReference|person-1/i);
});

test('dispatches a V2 read model without downgrading it to V1', () => {
  const v2 = createDocumentarySnapshotV2({ document: { type: 'receipt', issuedAt: '2026-09-11T10:00:00.000Z', currency: 'EUR' }, issuer: snapshot.issuer, recipient: snapshot.recipient, operation: snapshot.operation, obligations: [], payment: { authorityId: 'payment-1', reference: 'PAG-V2', confirmedAt: '2026-09-11T09:59:00.000Z', method: 'cash', amount: '10', currency: 'EUR' }, allocations: [], unallocated: { amount: '10', currency: 'EUR' }, totals: { documentTotal: '10', currency: 'EUR' }, tax: { treatment: 'policy-exempt' }, jurisdiction: { code: 'core', policyVersion: 'core-2' }, legalMentions: ['Policy mention'], policyProvenance: { financialProfileVersion: 1, fiscalConfigurationVersion: 2, seriesId: 'series-2', adapterKey: 'core', policyVersion: 'core-2' } });
  const presentation = buildFinancialDocumentPresentation({ document: { documentType: 'receipt', seriesCode: 'REC', sequenceNumber: 9, issuedAt: new Date('2026-09-11T10:00:00.000Z'), status: 'issued' }, snapshot: v2 });
  assert.equal(presentation.payment?.reference, 'PAG-V2');
  assert.deepEqual(presentation.legalMentions, ['Policy mention']);
});
