import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { FinancialDocumentsWorkspace } from '../src/components/finance/documents/FinancialDocumentsWorkspace.tsx';
import { financialDocumentClient, type FinancialDocumentProjection } from '../src/modules/finance/financial-document-client.ts';

function DocumentsHarness(props: any) {
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<string | null>(null);
  return React.createElement(FinancialDocumentsWorkspace, { ...props, mode: selectedDocumentId ? 'detail' : 'collection', selectedDocumentId, onSelectDocument: setSelectedDocumentId, onReturnToCollection: () => setSelectedDocumentId(null) });
}

function issuedDocument(id: string, type: 'invoice_receipt' | 'credit_note' = 'invoice_receipt'): FinancialDocumentProjection {
  return {
    id,
    type,
    status: 'issued',
    seriesCode: type === 'credit_note' ? 'CN-UAT' : 'FR-UAT',
    sequenceNumber: Number(id.replace(/\D/g, '')) || 1,
    issuedAt: '2026-09-14T10:00:00.000Z',
    snapshotVersion: type === 'credit_note' ? 5 : 4,
    correctsDocumentId: type === 'credit_note' ? 'doc-1' : null,
    presentation: {
      document: { typeLabel: type === 'credit_note' ? 'Nota de crédito' : 'Factura-Recibo', officialNumber: type === 'credit_note' ? 'CN-UAT/1' : `FR-UAT/${id}`, issueDate: '2026-09-14', dueDate: null, currency: 'EUR', statusLabel: 'Emitido' },
      issuer: { legalName: 'Instituição UAT', taxIdentifier: 'PT500000000', addressLines: ['Rua UAT'] },
      recipient: { name: 'Responsável UAT', taxIdentifier: null, addressLines: [], operationalReference: null },
      operation: { reference: 'PAG-000001', lines: [] },
      totals: { subtotal: '1.00', discountTotal: '0.00', taxTotal: '0.00', documentTotal: '1.00', currency: 'EUR' },
      policy: { taxTreatment: null, jurisdictionCode: 'NEXUS_TEST', legalMentions: [] },
      legalMentions: [],
      payment: { reference: 'PAG-000001', amount: '1.00', currency: 'EUR' },
      ...(type === 'credit_note' ? { correction: { originalOfficialNumber: 'FR-UAT/1' } } : {}),
    } as any,
  };
}

test('replaces a large documents collection with the selected document detail', async () => {
  const original = {
    list: financialDocumentClient.list,
    capabilities: financialDocumentClient.capabilities,
    detail: financialDocumentClient.detail,
    listArtifacts: financialDocumentClient.listArtifacts,
    creditNoteReadiness: financialDocumentClient.creditNoteReadiness,
  };
  const documents = Array.from({ length: 1000 }, (_, index) => issuedDocument(`doc-${index + 1}`));
  financialDocumentClient.list = async () => documents;
  financialDocumentClient.capabilities = async () => ({ issue: true, correct: true });
  financialDocumentClient.detail = async (id: string) => ({ ...documents.find(document => document.id === id)!, sources: [], corrections: id === 'doc-1' ? [issuedDocument('doc-credit-1', 'credit_note')] : [] });
  financialDocumentClient.listArtifacts = async () => [];

  try {
    let renderer: any;
    await act(async () => { renderer = create(React.createElement(DocumentsHarness)); });
    const firstAction = renderer.root.findAllByType('button').find((button: any) => button.children.join('') === 'Visualizar');
    assert.ok(firstAction);
    await act(async () => { firstAction.props.onClick(); });

    const detail = renderer.root.findByProps({ 'data-testid': 'selected-financial-document-detail' });
    assert.match(JSON.stringify(renderer.toJSON()), /FR-UAT\/doc-1/);
    assert.equal(renderer.root.findAllByProps({ 'data-testid': 'financial-document-list' }).length, 0);
    assert.ok(renderer.root.findByProps({ 'data-testid': 'financial-document-detail-view' }));
  } finally {
    financialDocumentClient.list = original.list;
    financialDocumentClient.capabilities = original.capabilities;
    financialDocumentClient.detail = original.detail;
    financialDocumentClient.listArtifacts = original.listArtifacts;
    financialDocumentClient.creditNoteReadiness = original.creditNoteReadiness;
  }
});

test('shows original and correction relationships in the selected detail while keeping actions contextual', async () => {
  const original = {
    list: financialDocumentClient.list,
    capabilities: financialDocumentClient.capabilities,
    detail: financialDocumentClient.detail,
    listArtifacts: financialDocumentClient.listArtifacts,
    creditNoteReadiness: financialDocumentClient.creditNoteReadiness,
  };
  const invoiceReceipt = issuedDocument('doc-1');
  const creditNote = issuedDocument('doc-credit-1', 'credit_note');
  financialDocumentClient.list = async () => [invoiceReceipt, creditNote];
  financialDocumentClient.capabilities = async () => ({ issue: true, correct: true });
  financialDocumentClient.detail = async (id: string) => id === invoiceReceipt.id
    ? { ...invoiceReceipt, sources: [], corrections: [creditNote] }
    : { ...creditNote, sources: [], corrections: [] };
  financialDocumentClient.listArtifacts = async (id: string) => id === creditNote.id
    ? [{ id: 'artifact-1', document_id: id, render_version: 'renderer-1', template_version: 'template-1', generated_at: '2026-09-14T10:00:00.000Z', content_hash: 'hash', media_type: 'application/pdf', byte_size: 1 }]
    : [];
  financialDocumentClient.creditNoteReadiness = async () => ({ status: 'ELIGIBLE', seriesId: 'series-1', currency: 'EUR', maximumAmount: '1.00' });

  try {
    let renderer: any;
    await act(async () => { renderer = create(React.createElement(DocumentsHarness)); });
    const actions = renderer.root.findAllByType('button').filter((button: any) => button.children.join('') === 'Visualizar');
    await act(async () => { actions[0].props.onClick(); });
    let detailText = JSON.stringify(renderer.toJSON());
    assert.match(detailText, /CN-UAT\/1/);
    assert.match(detailText, /Criar Nota de Crédito/);
    assert.match(detailText, /Gerar PDF oficial/);
    assert.doesNotMatch(detailText, /Visualizar PDF oficial/);

    await act(async () => { renderer.root.findByProps({ 'data-testid': 'return-to-financial-documents-collection' }).props.onClick(); });
    const currentActions = renderer.root.findAllByType('button').filter((button: any) => button.children.join('') === 'Visualizar');
    await act(async () => { currentActions[1].props.onClick(); });
    detailText = JSON.stringify(renderer.toJSON());
    assert.match(detailText, /Documento corrigido[\s\S]*FR-UAT\/1/);
    assert.doesNotMatch(detailText, /Criar Nota de Crédito/);
    assert.match(detailText, /Visualizar PDF oficial/);
    assert.match(detailText, /Gerar PDF oficial/);
    assert.doesNotMatch(detailText, /Imprimir/);
  } finally {
    financialDocumentClient.list = original.list;
    financialDocumentClient.capabilities = original.capabilities;
    financialDocumentClient.detail = original.detail;
    financialDocumentClient.listArtifacts = original.listArtifacts;
    financialDocumentClient.creditNoteReadiness = original.creditNoteReadiness;
  }
});

test('opens a selected correction from its original and returns from the credit note to that exact original', async () => {
  const original = { list: financialDocumentClient.list, capabilities: financialDocumentClient.capabilities, detail: financialDocumentClient.detail, listArtifacts: financialDocumentClient.listArtifacts, creditNoteReadiness: financialDocumentClient.creditNoteReadiness };
  const invoiceReceipt = issuedDocument('doc-1');
  const creditNote = issuedDocument('doc-credit-1', 'credit_note');
  financialDocumentClient.list = async () => [invoiceReceipt, creditNote];
  financialDocumentClient.capabilities = async () => ({ issue: true, correct: true });
  financialDocumentClient.detail = async (id: string) => id === invoiceReceipt.id ? { ...invoiceReceipt, sources: [], corrections: [creditNote] } : { ...creditNote, sources: [], corrections: [] };
  financialDocumentClient.listArtifacts = async () => [];
  financialDocumentClient.creditNoteReadiness = async () => ({ status: 'BLOCKED', reasonCode: 'CREDIT_NOTE_ALREADY_CORRECTED' });
  try {
    let renderer: any;
    await act(async () => { renderer = create(React.createElement(DocumentsHarness)); });
    const documents = renderer.root.findAllByType('button').filter((button: any) => button.children.join('') === 'Visualizar');
    await act(async () => { documents[0].props.onClick(); });
    const correctionAction = renderer.root.findAllByType('button').find((button: any) => button.children.join('') === 'Abrir Nota de crédito');
    assert.ok(correctionAction, 'an original must expose an actionable correction relationship');
    await act(async () => { correctionAction.props.onClick(); });
    assert.match(JSON.stringify(renderer.toJSON()), /CN-UAT\/1/);
    const originalAction = renderer.root.findAllByType('button').find((button: any) => button.children.join('') === 'Abrir documento original');
    assert.ok(originalAction, 'a credit note must expose an actionable original relationship');
    await act(async () => { originalAction.props.onClick(); });
    assert.match(JSON.stringify(renderer.toJSON()), /FR-UAT\/doc-1/);
  } finally {
    financialDocumentClient.list = original.list; financialDocumentClient.capabilities = original.capabilities; financialDocumentClient.detail = original.detail; financialDocumentClient.listArtifacts = original.list; financialDocumentClient.creditNoteReadiness = original.creditNoteReadiness;
  }
});

test('uses the authoritative obligation source ID instead of its display reference for document navigation', async () => {
  const original = { list: financialDocumentClient.list, capabilities: financialDocumentClient.capabilities, detail: financialDocumentClient.detail, listArtifacts: financialDocumentClient.listArtifacts, creditNoteReadiness: financialDocumentClient.creditNoteReadiness };
  const invoiceReceipt = issuedDocument('doc-1');
  financialDocumentClient.list = async () => [invoiceReceipt];
  financialDocumentClient.capabilities = async () => ({ issue: true, correct: false });
  financialDocumentClient.detail = async () => ({ ...invoiceReceipt, sources: [{ type: 'obligation', sourceId: 'obligation-uuid', paymentReference: null, obligationReference: 'DISPLAY-REF' }], corrections: [] });
  financialDocumentClient.listArtifacts = async () => [];
  const opened: string[] = [];
  try {
    let renderer: any;
    await act(async () => { renderer = create(React.createElement(DocumentsHarness, { onOpenObligation: (id: string) => opened.push(id) })); });
    const action = renderer.root.findAllByType('button').find((button: any) => button.children.join('') === 'Visualizar');
    await act(async () => { action.props.onClick(); });
    const obligationAction = renderer.root.findAllByType('button').find((button: any) => button.children.join('') === 'Abrir obrigação');
    await act(async () => { obligationAction.props.onClick(); });
    assert.deepEqual(opened, ['obligation-uuid']);
  } finally {
    financialDocumentClient.list = original.list; financialDocumentClient.capabilities = original.capabilities; financialDocumentClient.detail = original.detail; financialDocumentClient.listArtifacts = original.list; financialDocumentClient.creditNoteReadiness = original.creditNoteReadiness;
  }
});

test('does not expose the credit-note action for an invoice receipt the server marks ineligible', async () => {
  const original = {
    list: financialDocumentClient.list,
    capabilities: financialDocumentClient.capabilities,
    detail: financialDocumentClient.detail,
    listArtifacts: financialDocumentClient.listArtifacts,
    creditNoteReadiness: financialDocumentClient.creditNoteReadiness,
  };
  const invoiceReceipt = issuedDocument('doc-ineligible');
  financialDocumentClient.list = async () => [invoiceReceipt];
  financialDocumentClient.capabilities = async () => ({ issue: true, correct: true });
  financialDocumentClient.detail = async () => ({ ...invoiceReceipt, sources: [], corrections: [] });
  financialDocumentClient.listArtifacts = async () => [];
  financialDocumentClient.creditNoteReadiness = async () => ({ status: 'BLOCKED', reasonCode: 'CREDIT_NOTE_NOT_ELIGIBLE' });

  try {
    let renderer: any;
    await act(async () => { renderer = create(React.createElement(DocumentsHarness)); });
    const action = renderer.root.findAllByType('button').find((button: any) => button.children.join('') === 'Visualizar');
    await act(async () => { action.props.onClick(); });
    assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /Criar Nota de Crédito/);
  } finally {
    financialDocumentClient.list = original.list;
    financialDocumentClient.capabilities = original.capabilities;
    financialDocumentClient.detail = original.detail;
    financialDocumentClient.listArtifacts = original.listArtifacts;
    financialDocumentClient.creditNoteReadiness = original.creditNoteReadiness;
  }
});
