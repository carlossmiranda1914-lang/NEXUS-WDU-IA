import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { InvoicePreissuePreview } from '../src/components/finance/obligations/InvoicePreissuePreview.tsx';
import { financialDocumentClient } from '../src/modules/finance/financial-document-client.ts';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const ready: any = { documentType: 'invoice', officialDocumentCreated: false, definitiveNumberAllocated: false, sourceEligibility: 'ELIGIBLE', readiness: { documentType: 'invoice', status: 'READY', prerequisites: {} }, blockingReason: null, series: { available: true, reference: 'FT' }, documentFacts: { issuer: { legalName: 'Escola Nexus', taxIdentifier: 'AO500', address: 'Rua 1' }, recipient: { name: 'Família Silva', taxIdentifier: null, address: null }, obligation: { reference: 'OBR-1', dueAt: '2026-10-01T00:00:00.000Z', description: 'Propina', currency: 'AOA' }, lines: [{ description: 'Propina', quantity: '1', unitPrice: '100', discount: '0', tax: '0', netAmount: '100', totalAmount: '100', currency: 'AOA' }], totals: { subtotal: '100', discountTotal: '0', taxTotal: '0', documentTotal: '100', currency: 'AOA' }, policy: { taxTreatment: 'isento', legalMentions: ['Menção autorizada'], jurisdictionCode: 'NEXUS_TEST' } } };
const blocked: any = { ...ready, readiness: { documentType: 'invoice', status: 'BLOCKED', reasonCode: 'INVOICE_SERIES_NOT_EFFECTIVE', prerequisites: {} }, blockingReason: 'INVOICE_SERIES_NOT_EFFECTIVE', series: { available: false, reference: null } };
const original = { preview: financialDocumentClient.invoicePreview, series: financialDocumentClient.listActiveInvoiceSeries, issue: financialDocumentClient.issueInvoice };
const storage = new Map<string, string>();
(globalThis as any).window = { sessionStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } };
try {
  (financialDocumentClient as any).invoicePreview = async () => ready;
  (financialDocumentClient as any).listActiveInvoiceSeries = async () => [{ id: 'series-1', code: 'FT', document_type: 'invoice', status: 'active' }];
  let command: any; let opened: string | undefined; let renderer!: ReturnType<typeof create>;
  (financialDocumentClient as any).issueInvoice = async (input: any) => { command = input; return { id: 'invoice-1', sequenceNumber: 1, replayed: false }; };
  await act(async () => { renderer = create(React.createElement(InvoicePreissuePreview, { obligationId: 'obligation-1', onClose: () => undefined, onIssued: id => { opened = id; } })); });
  const rendered = JSON.stringify(renderer.toJSON());
  assert.match(rendered, /Pré-visualização — ainda não emitida/); assert.match(rendered, /Propina/); assert.match(rendered, /100,00 AOA/); assert.match(rendered, /Série \/ número/); assert.match(rendered, /ainda não atribuído/); assert.match(rendered, /Menção autorizada/);
  await act(async () => { await renderer.root.findByProps({ 'data-testid': 'issue-invoice-button' }).props.onClick(); });
  assert.match(JSON.stringify(renderer.toJSON()), /Fatura FT\/1 emitida/); assert.equal(opened, undefined); assert.deepEqual({ obligationId: command.obligationId, seriesId: command.seriesId }, { obligationId: 'obligation-1', seriesId: 'series-1' }); assert.ok(typeof command.idempotencyKey === 'string');
  await act(async () => { renderer.root.findByProps({ 'data-testid': 'open-issued-invoice-button' }).props.onClick(); }); assert.equal(opened, 'invoice-1');
  (financialDocumentClient as any).invoicePreview = async () => blocked;
  let blockedRenderer!: ReturnType<typeof create>;
  await act(async () => { blockedRenderer = create(React.createElement(InvoicePreissuePreview, { obligationId: 'obligation-2', onClose: () => undefined })); });
  assert.match(JSON.stringify(blockedRenderer.toJSON()), /Ainda não existe uma série de faturas ativa/); assert.equal(blockedRenderer.root.findAllByProps({ 'data-testid': 'issue-invoice-button' }).length, 0, 'blocked server readiness must not expose official issue action');
  (financialDocumentClient as any).invoicePreview = async () => ready;
  (financialDocumentClient as any).issueInvoice = async () => ({ id: 'invoice-1', sequenceNumber: 1, replayed: true });
  let replayRenderer!: ReturnType<typeof create>;
  await act(async () => { replayRenderer = create(React.createElement(InvoicePreissuePreview, { obligationId: 'obligation-3', onClose: () => undefined })); });
  await act(async () => { await replayRenderer.root.findByProps({ 'data-testid': 'issue-invoice-button' }).props.onClick(); });
  assert.match(JSON.stringify(replayRenderer.toJSON()), /operação recuperada sem duplicação/, 'a recovered authoritative idempotency result must not look like a second issue');
} finally {
  (financialDocumentClient as any).invoicePreview = original.preview; (financialDocumentClient as any).listActiveInvoiceSeries = original.series; (financialDocumentClient as any).issueInvoice = original.issue;
  delete (globalThis as any).window;
}
console.log('INVOICE_PREISSUE_UI_SERVER_AUTHORITY=PASS');
