import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { FinanceWorkspace } from '../src/components/finance/FinanceWorkspace.tsx';
import { FinancialDocumentsWorkspace } from '../src/components/finance/documents/FinancialDocumentsWorkspace.tsx';
import { FinancePaymentsWorkspace } from '../src/components/finance/payments/FinancePaymentsWorkspace.tsx';
import { FinancialObligationsWorkspace } from '../src/components/finance/obligations/FinancialObligationsWorkspace.tsx';
import { financialDocumentClient } from '../src/modules/finance/financial-document-client.ts';

const document = {
  id: 'document-1', type: 'invoice_receipt', status: 'issued', seriesCode: 'FR', sequenceNumber: 7, issuedAt: '2026-09-03T00:00:00.000Z', snapshotVersion: 1, correctsDocumentId: null,
  presentation: { document: { typeLabel: 'Factura-Recibo', officialNumber: 'FR/7', issueDate: '2026-09-03T00:00:00.000Z', dueDate: null, currency: 'AOA', statusLabel: 'Emitido' }, issuer: { legalName: 'Nexus UAT', taxIdentifier: null, addressLines: [] }, recipient: { name: 'Ana Silva', taxIdentifier: null, addressLines: [], operationalReference: null }, operation: { reference: 'PAG-1', lines: [], }, totals: { subtotal: '100.00', discountTotal: '0.00', taxTotal: '0.00', documentTotal: '100.00', currency: 'AOA' }, policy: { taxTreatment: null, jurisdictionCode: 'NEXUS_TEST', legalMentions: [] }, legalMentions: [], payment: { reference: 'PAG-1', amount: '100.00', currency: 'AOA' } },
};
const detail = { ...document, sources: [
  { type: 'payment', sourceId: 'payment-1', paymentReference: 'PAG-1', obligationReference: null },
  { type: 'obligation', sourceId: 'obligation-1', paymentReference: null, obligationReference: 'Propina' },
], corrections: [] };
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

  let paymentFlow!: ReturnType<typeof create>;
  await act(async () => { paymentFlow = create(React.createElement(FinanceWorkspace, { initialTab: 'documents' })); await Promise.resolve(); });
  await act(async () => { paymentFlow.root.findAllByType('button').find(button => button.children.join('') === 'Visualizar')!.props.onClick(); await Promise.resolve(); });
  await act(async () => { paymentFlow.root.findAllByType('button').find(button => button.children.join('') === 'Abrir pagamento')!.props.onClick(); });
  assert.equal(paymentFlow.root.findByType(FinancePaymentsWorkspace).props.initialPaymentReference, 'PAG-1', 'document relationship must open the authoritative payment reference');
  await act(async () => { paymentFlow.root.findByProps({ 'data-testid': 'return-to-financial-document' }).props.onClick(); });
  assert.equal(paymentFlow.root.findByType(FinancialDocumentsWorkspace).props.selectedDocumentId, 'document-1', 'return from payment must restore the exact document origin');

  let obligationFlow!: ReturnType<typeof create>;
  await act(async () => { obligationFlow = create(React.createElement(FinanceWorkspace, { initialTab: 'documents' })); await Promise.resolve(); });
  await act(async () => { obligationFlow.root.findAllByType('button').find(button => button.children.join('') === 'Visualizar')!.props.onClick(); await Promise.resolve(); });
  await act(async () => { obligationFlow.root.findAllByType('button').find(button => button.children.join('') === 'Abrir obrigação')!.props.onClick(); });
  assert.equal(obligationFlow.root.findByType(FinancialObligationsWorkspace).props.initialObligationId, 'obligation-1', 'document relationship must open the authoritative obligation ID');
  await act(async () => { obligationFlow.root.findByProps({ 'data-testid': 'return-to-financial-document' }).props.onClick(); });
  assert.equal(obligationFlow.root.findByType(FinancialDocumentsWorkspace).props.selectedDocumentId, 'document-1', 'return from obligation must restore the exact document origin');
} finally {
  (financialDocumentClient as any).list = originals.list;
  (financialDocumentClient as any).capabilities = originals.capabilities;
  (financialDocumentClient as any).detail = originals.detail;
  (financialDocumentClient as any).listArtifacts = originals.artifacts;
}
console.log('FINANCE_F1B_RELATIONSHIP_NAVIGATION=PASS');
