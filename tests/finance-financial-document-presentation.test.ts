import assert from 'node:assert/strict';
import test from 'node:test';
import { createDocumentarySnapshot } from '../src/modules/finance/documentary-snapshot.ts';
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
