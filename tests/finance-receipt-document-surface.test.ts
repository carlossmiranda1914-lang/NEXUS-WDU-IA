import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { ReceiptDocumentSurface, aggregateReceiptAllocationMovements } from '../src/components/finance/documents/ReceiptDocumentSurface.tsx';

const model = {
  mode: 'preview' as const,
  status: 'Confirmado',
  payment: { reference: 'PAG-000001', date: '2026-09-08T00:00:00.000Z', amount: '40', currency: 'AOA' },
  issuer: { legalName: 'Escola UAT', taxIdentifier: 'AO-1', address: 'Rua UAT' },
  payer: 'Pagador UAT',
  recipient: 'Destinatário UAT',
  settlement: {
    sourceDocuments: [{ reference: 'OBR-000001' }],
    allocations: [{ before: { amount: '100', currency: 'AOA' }, movement: { amount: '40', currency: 'AOA' }, after: { amount: '60', currency: 'AOA' } }],
    unallocated: null,
  },
};

test('receipt preview renders payment and settlement facts in a structured non-official document surface', async () => {
  let view: any;
  await act(async () => { view = create(React.createElement(ReceiptDocumentSurface, { model })); });
  const text = JSON.stringify(view.toJSON());
  for (const fact of ['Pré-visualização — ainda não emitido', 'PAG-000001', '08/09/2026', '40,00 AOA', 'Escola UAT', 'Pagador UAT', 'Destinatário UAT', 'OBR-000001', 'Valor aplicado', 'Valor não aplicado']) assert.match(text, new RegExp(fact));
  assert.doesNotMatch(text, /REC\//, 'a preview cannot invent a definitive receipt number');
  assert.doesNotMatch(text, /Código QR|assinatura fiscal/i, 'a preview cannot invent fiscal identifiers');
  assert.match(text, /Total aplicado[\s\S]*40,00 AOA/, 'the 40 AOA allocation is not the 60 AOA remaining obligation');
  assert.match(text, /Valor não aplicado[\s\S]*Não aplicável/, 'remaining obligation must not be presented as unallocated payment');
});

test('receipt allocation totals use exact money arithmetic and fail closed across currencies', () => {
  const exact = aggregateReceiptAllocationMovements([
    { amount: '0.10', currency: 'AOA' },
    { amount: '0.20', currency: 'AOA' },
  ], 'AOA');
  assert.deepEqual(exact, { amount: '0.3', currency: 'AOA' }, '0.10 + 0.20 must be exact 0.30');

  const multiple = aggregateReceiptAllocationMovements([
    { amount: '10.01', currency: 'AOA' },
    { amount: '20.02', currency: 'AOA' },
    { amount: '9.97', currency: 'AOA' },
  ], 'AOA');
  assert.deepEqual(multiple, { amount: '40', currency: 'AOA' });

  assert.equal(aggregateReceiptAllocationMovements([
    { amount: '40', currency: 'AOA' },
    { amount: '1', currency: 'EUR' },
  ], 'AOA'), null, 'cross-currency allocations must never be silently summed');
});

test('receipt surface keeps readiness outside the payment and settlement facts', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('../src/components/finance/payments/FinancePaymentsWorkspace.tsx', import.meta.url), 'utf8');
  const surface = await (await import('node:fs/promises')).readFile(new URL('../src/components/finance/documents/ReceiptDocumentSurface.tsx', import.meta.url), 'utf8');
  assert.match(source, /ReceiptDocumentSurface/, 'the receipt preview must use the structured surface');
  assert.match(source, /data-testid="receipt-preview-readiness"/, 'readiness needs its own presentation boundary');
  assert.doesNotMatch(source, /adapterKey|snapshotVersion|storageReference/, 'the browser cannot author internal authority');
  assert.doesNotMatch(surface, /dark:bg-zinc-950|dark:text-zinc-100/, 'the document card must not combine dark paper with light-theme forced text');
});

test('issued receipt presentation remains derived from immutable documentary presentation', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('../src/components/finance/documents/FinancialDocumentsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /selected\.presentation/, 'issued receipt facts must come from the persisted document presentation');
  assert.doesNotMatch(source, /paymentClient|receiptPreview\(/, 'issued receipt history cannot rebuild from mutable payment state');
});
