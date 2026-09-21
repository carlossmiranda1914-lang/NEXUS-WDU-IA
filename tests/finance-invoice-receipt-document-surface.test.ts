import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { InvoiceReceiptDocumentSurface } from '../src/components/finance/documents/InvoiceReceiptDocumentSurface.tsx';

test('Factura-Recibo preview renders one factual document with distinct commercial and settlement regions', async () => {
  let view: any;
  await act(async () => { view = create(React.createElement(InvoiceReceiptDocumentSurface, { model: {
    issuer: { legalName: 'Escola UAT', taxIdentifier: 'AO-1', address: 'Rua UAT' }, recipient: { name: 'Destinatário UAT', taxIdentifier: null, address: null }, payer: 'Pagador UAT',
    obligation: { reference: 'OBR-000001', dueAt: '2026-10-08T00:00:00.000Z' }, lines: [{ description: 'Propina', quantity: '1', unitPrice: '100', discount: '0', totalAmount: '100', currency: 'AOA' }], totals: { documentTotal: '100', currency: 'AOA' },
    payment: { reference: 'PAG-000001', date: '2026-09-08T00:00:00.000Z', amount: '40', currency: 'AOA' }, allocations: [{ before: { amount: '100', currency: 'AOA' }, movement: { amount: '40', currency: 'AOA' }, after: { amount: '60', currency: 'AOA' } }], unallocated: null,
  } })); });
  const text = JSON.stringify(view.toJSON());
  for (const expected of ['Pré-visualização — ainda não emitida', 'Fatura', 'Recebimento', 'Escola UAT', 'Destinatário UAT', 'Pagador UAT', 'OBR-000001', 'PAG-000001', '100,00 AOA', '40,00 AOA', '60,00 AOA']) assert.match(text, new RegExp(expected));
  assert.doesNotMatch(text, /Código QR|assinatura|Série \/ número/i);
  assert.match(text, /Valor não aplicado[\s\S]*Não aplicável/);
});
