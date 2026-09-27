import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { FinanceWorkspace } from '../src/components/finance/FinanceWorkspace.tsx';
import { financialDocumentClient } from '../src/modules/finance/financial-document-client.ts';

const renderedText = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(renderedText).join('');
  if (value && typeof value === 'object' && 'props' in value) return renderedText((value as { props: { children?: unknown } }).props.children);
  return '';
};

const document = {
  id: 'document-1', type: 'invoice_receipt', status: 'issued', seriesCode: 'FR', sequenceNumber: 7, issuedAt: '2026-09-03T00:00:00.000Z', snapshotVersion: 1, correctsDocumentId: null,
  presentation: { document: { typeLabel: 'Factura-Recibo', officialNumber: 'FR/7', issueDate: '2026-09-03T00:00:00.000Z', dueDate: null, currency: 'AOA', statusLabel: 'Emitido' }, issuer: { legalName: 'Nexus UAT', taxIdentifier: null, addressLines: [] }, recipient: { name: 'Ana Silva', taxIdentifier: null, addressLines: [], operationalReference: null }, operation: { reference: 'PAG-1', lines: [] }, totals: { subtotal: '100.00', discountTotal: '0.00', taxTotal: '0.00', documentTotal: '100.00', currency: 'AOA' }, policy: { taxTreatment: null, jurisdictionCode: 'NEXUS_TEST', legalMentions: [] }, legalMentions: [], payment: { reference: 'PAG-1', amount: '100.00', currency: 'AOA' } },
};
const detail = { ...document, sources: [], corrections: [] };
const originals = {
  list: financialDocumentClient.list,
  capabilities: financialDocumentClient.capabilities,
  detail: financialDocumentClient.detail,
  artifacts: financialDocumentClient.listArtifacts,
};

try {
  (financialDocumentClient as any).list = async () => [document];
  (financialDocumentClient as any).capabilities = async () => ({ issue: false, correct: false });
  (financialDocumentClient as any).detail = async () => detail;
  (financialDocumentClient as any).listArtifacts = async () => [];

  let view!: ReturnType<typeof create>;
  await act(async () => { view = create(React.createElement(FinanceWorkspace, { initialTab: 'documents' })); await Promise.resolve(); });
  assert.equal(view.root.findAllByProps({ 'data-testid': 'financial-document-list' }).length, 1, 'documents collection must be the initial primary surface');

  await act(async () => {
    view.root.findAllByType('button').find(button => button.children.join('') === 'Visualizar')!.props.onClick();
    await Promise.resolve();
  });

  assert.equal(view.root.findAllByProps({ 'data-testid': 'financial-document-list' }).length, 0, 'documents collection must not remain primary after opening an exact document');
  assert.equal(view.root.findAllByProps({ 'data-testid': 'financial-document-detail-view' }).length, 1, 'exact document detail must become the primary surface');
  const identity = renderedText(view.root.findByProps({ 'data-testid': 'financial-document-identity' }).children);
  assert.match(identity, /Factura-Recibo/);
  assert.match(identity, /FR\/7/);
  assert.match(identity, /Emitido/);

  await act(async () => { view.root.findByProps({ 'data-testid': 'return-to-financial-documents-collection' }).props.onClick(); });
  assert.equal(view.root.findAllByProps({ 'data-testid': 'financial-document-list' }).length, 1, 'return must restore the documents collection');
  assert.equal(view.root.findAllByProps({ 'data-testid': 'financial-document-detail-view' }).length, 0, 'detail must not remain mounted after returning to the collection');
} finally {
  (financialDocumentClient as any).list = originals.list;
  (financialDocumentClient as any).capabilities = originals.capabilities;
  (financialDocumentClient as any).detail = originals.detail;
  (financialDocumentClient as any).listArtifacts = originals.artifacts;
}

console.log('FINANCE_FINANCIAL_DOCUMENT_DEDICATED_VIEW_UI=PASS');
