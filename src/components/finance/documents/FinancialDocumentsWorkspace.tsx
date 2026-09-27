import React, { useEffect, useState } from 'react';
import { financialDocumentClient, type FinancialDocumentCapabilities, type FinancialDocumentDetail, type FinancialDocumentProjection, type FinancialDocumentArtifactProjection } from '../../../modules/finance/financial-document-client.ts';
import { AuroraStateNotice } from '../../aurora/AuroraStateNotice.tsx';
import { formatFinanceMoney } from '../../../modules/finance/money-presentation.ts';
import { SelectedFinancialDocumentDetail } from './SelectedFinancialDocumentDetail.tsx';

type Props = {
  theme?: string;
  mode?: 'collection' | 'detail';
  selectedDocumentId?: string | null;
  onSelectDocument?: (documentId: string) => void;
  onReturnToCollection?: () => void;
  onOpenPayment?: (paymentReference: string, originDocumentId: string, originReference: string) => void;
  onOpenObligation?: (obligationId: string, originDocumentId: string, originReference: string) => void;
};

export function FinancialDocumentsWorkspace({ theme = 'light', mode = 'collection', selectedDocumentId, onSelectDocument, onReturnToCollection, onOpenPayment, onOpenObligation }: Props) {
  const [items, setItems] = useState<FinancialDocumentProjection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<FinancialDocumentProjection | null>(null);
  const [detail, setDetail] = useState<FinancialDocumentDetail | null>(null);
  const [artifacts, setArtifacts] = useState<FinancialDocumentArtifactProjection[]>([]);
  const [capabilities, setCapabilities] = useState<FinancialDocumentCapabilities>({ issue: false, correct: false });
  const light = theme === 'light';
  const documentTypeLabel = (type: string) => ({ receipt: 'Recibo', invoice: 'Fatura', invoice_receipt: 'Factura-Recibo', credit_note: 'Nota de crédito' }[type] ?? 'Documento financeiro');
  const documentStatusLabel = (status: string) => ({ issued: 'Emitido' }[status] ?? 'Estado registado');
  const referenceFor = (document: FinancialDocumentProjection) => document.presentation?.document.officialNumber ?? `${document.seriesCode}/${document.sequenceNumber}`;
  const errorMessage = (loadError: unknown) => {
    const code = loadError instanceof Error ? loadError.message : '';
    return code === 'FINANCIAL_DOCUMENT_AUTH_REQUIRED' ? 'A sessão autenticada não foi reconhecida pelo servidor. Termine sessão e entre novamente na conta UAT autorizada.' : code === 'FINANCIAL_DOCUMENT_INSTITUTION_SELECTION_REQUIRED' ? 'É necessário selecionar a instituição antes de consultar documentos financeiros.' : code === 'FINANCIAL_DOCUMENT_FORBIDDEN' ? 'A sua associação institucional não possui autorização para consultar documentos financeiros.' : 'Não foi possível carregar documentos financeiros autorizados.';
  };
  const loadSelected = async (documentId: string) => {
    try {
      const [document, nextArtifacts] = await Promise.all([financialDocumentClient.detail(documentId), financialDocumentClient.listArtifacts(documentId)]);
      setSelected(document);
      setDetail(document);
      setArtifacts(nextArtifacts);
    } catch { setError('Não foi possível carregar a proveniência autorizada do documento.'); }
  };
  const selectDocument = async (document: FinancialDocumentProjection) => {
    if (onSelectDocument) return onSelectDocument(document.id);
    await loadSelected(document.id);
  };
  const reloadSelectedDocument = async () => { if (selected) await loadSelected(selected.id); };
  const openRelatedDocument = async (documentId: string) => { await loadSelected(documentId); };
  useEffect(() => { Promise.all([financialDocumentClient.list(), financialDocumentClient.capabilities()]).then(([documents, permissions]) => { setItems(documents); setCapabilities(permissions); }).catch(loadError => setError(errorMessage(loadError))).finally(() => setLoaded(true)); }, []);
  useEffect(() => { if (mode === 'detail' && selectedDocumentId) void loadSelected(selectedDocumentId); }, [mode, selectedDocumentId]);

  if (mode === 'detail') return <section data-testid="financial-document-detail-view" className={`rounded-xl border p-6 ${light ? 'bg-[var(--color-surface-raised)] border-[var(--color-border-default)]' : 'bg-zinc-900 border-zinc-800'}`}>
    {error && <AuroraStateNotice tone="danger" title="Histórico oficial indisponível">{error}</AuroraStateNotice>}
    {selected && <SelectedFinancialDocumentDetail selected={selected} detail={detail} artifacts={artifacts} capabilities={capabilities} theme={theme} onBack={() => onReturnToCollection?.()} onOpenPayment={onOpenPayment ? reference => onOpenPayment(reference, selected.id, referenceFor(selected)) : undefined} onOpenObligation={onOpenObligation ? obligationId => onOpenObligation(obligationId, selected.id, referenceFor(selected)) : undefined} onOpenDocument={openRelatedDocument} onArtifactsChanged={setArtifacts} onDocumentChanged={reloadSelectedDocument} onError={setError} />}
  </section>;

  return <section data-testid="financial-documents-workspace" className={`rounded-xl border p-6 ${light ? 'bg-[var(--color-surface-raised)] border-[var(--color-border-default)]' : 'bg-zinc-900 border-zinc-800'}`}>
    <h2 className="text-xl font-bold">Documentos Financeiros</h2><p className="mt-1 text-sm text-zinc-500">Histórico oficial somente leitura. Os valores e números emitidos não são editáveis.</p>
    {error && <div className="mt-4"><AuroraStateNotice tone="danger" title="Histórico oficial indisponível">{error}</AuroraStateNotice></div>}
    {loaded && !error && items.length === 0 && <div className="mt-5" data-testid="financial-documents-empty-state"><AuroraStateNotice tone="info" title="Ainda não existem documentos financeiros emitidos">Não existem documentos financeiros emitidos para esta instituição. Os documentos oficiais surgirão neste histórico imutável.</AuroraStateNotice></div>}
    {items.length > 0 && <div data-testid="financial-document-list" className="mt-5 space-y-2">
      {items.map(document => <article key={document.id} className="flex items-center justify-between rounded-lg border p-3" data-testid={`financial-document-${document.id}`}><div><strong>{referenceFor(document)}</strong><span className="ml-2 text-sm text-zinc-500">{document.presentation?.document.typeLabel ?? documentTypeLabel(document.type)} · {document.presentation?.document.statusLabel ?? documentStatusLabel(document.status)}</span><p className="text-xs text-zinc-500">Data de emissão: {new Date(document.issuedAt).toLocaleString('pt-PT')} · Destinatário: {document.presentation?.recipient.name ?? 'não registado'} · Total: {document.presentation ? formatFinanceMoney({ amount: document.presentation.totals.documentTotal, currency: document.presentation.totals.currency }) : 'não registado'}</p></div><button type="button" onClick={() => void selectDocument(document)} className="rounded-md border px-3 py-1 text-sm">Visualizar</button></article>)}
    </div>}
  </section>;
}
