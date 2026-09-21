import assert from 'node:assert/strict';
import test from 'node:test';
import { composeInvoiceDocumentarySnapshotV3, createDocumentarySnapshot, createDocumentarySnapshotV2 } from '../src/modules/finance/documentary-snapshot.ts';
import { buildFinancialDocumentPresentation } from '../src/modules/finance/financial-document-presentation.ts';
import { renderFinancialDocumentPdf } from '../src/modules/finance/financial-document-artifact-renderer.ts';

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

test('dispatches a V3 invoice from its frozen obligation reference without live Finance lookup', () => {
  const v3 = composeInvoiceDocumentarySnapshotV3({
    issuedAt: new Date('2026-09-12T10:00:00.000Z'), dueAt: new Date('2026-10-12T00:00:00.000Z'),
    issuer: snapshot.issuer, recipient: snapshot.recipient,
    obligation: { authorityId: 'obligation-1', reference: 'OBR-42', amount: '100.00', currency: 'AOA', dueAt: '2026-10-12T00:00:00.000Z' },
    line: { description: 'Propina', quantity: '1', unitPrice: '100', discount: '0', tax: '0' },
    taxTreatment: 'not_applicable', legalMentions: ['Menção de teste'], jurisdictionCode: 'NEXUS_TEST', policyVersion: 'core-1', financialProfileVersion: 1, fiscalConfigurationVersion: 1, seriesId: 'invoice-series', adapterKey: 'core',
  });
  const presentation = buildFinancialDocumentPresentation({ document: { documentType: 'invoice', seriesCode: 'FT', sequenceNumber: 1, issuedAt: new Date('2026-09-12T10:00:00.000Z'), status: 'issued' }, snapshot: v3 });
  assert.equal(presentation.operation.reference, 'OBR-42');
  assert.equal(presentation.operation.lines.length, 1);
  assert.equal(presentation.operation.lines[0]!.description, 'Propina');
  assert.equal(presentation.operation.lines[0]!.quantity, '1');
  assert.equal(presentation.operation.lines[0]!.unitPrice, '100');
  assert.equal(presentation.operation.lines[0]!.discount, '0');
  assert.equal(presentation.operation.lines[0]!.tax, '0');
  assert.equal(presentation.operation.lines[0]!.netAmount, '100');
  assert.equal(presentation.operation.lines[0]!.totalAmount, '100');
  assert.equal(presentation.totals.subtotal, '100');
  assert.equal(presentation.totals.discountTotal, '0');
  assert.equal(presentation.totals.taxTotal, '0');
  assert.equal(presentation.policy.taxTreatment, 'not_applicable');
  assert.equal(presentation.policy.jurisdictionCode, 'NEXUS_TEST');
  assert.equal(presentation.document.dueDate, '2026-10-12T00:00:00.000Z');
  assert.equal(presentation.payment, null);
  assert.equal(presentation.totals.documentTotal, '100');
  assert.deepEqual(presentation.legalMentions, ['Menção de teste']);
  const pdf = renderFinancialDocumentPdf({ presentation });
  assert.match(pdf.toString('latin1'), /Propina/);
  assert.match(pdf.toString('latin1'), /Vencimento: 2026-10-12/);
  assert.match(pdf.toString('latin1'), /NIF: PT999/);
  assert.match(pdf.toString('latin1'), /Qtd\./);
  assert.match(pdf.toString('latin1'), /Unitario/);
  assert.match(pdf.toString('latin1'), /Desconto/);
  assert.match(pdf.toString('latin1'), /Imposto/);
  assert.match(pdf.toString('latin1'), /TOTAIS/);
  assert.match(pdf.toString('latin1'), /Menção de teste/);
});

test('renderer entrypoint receives only immutable presentation, never a live Finance authority', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('../src/modules/finance/financial-document-artifact-service.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /finance_(payments|obligations|allocations|profile_versions|fiscal_configuration_versions)/);
  assert.match(source, /documentary_snapshot/);
});
