import React, { useEffect, useState } from 'react';
import {
  financialDocumentClient,
  type CreditNoteReadinessProjection,
  type FinancialDocumentArtifactProjection,
  type FinancialDocumentCapabilities,
  type FinancialDocumentDetail,
  type FinancialDocumentProjection,
} from '../../../modules/finance/financial-document-client.ts';
import { browserDocumentIntentStorage, resolvePersistentDocumentIntentKey } from '../../../modules/finance/financial-document-intent.ts';
import { formatFinanceMoney } from '../../../modules/finance/money-presentation.ts';
import { InvoiceDocumentSurface } from './InvoiceDocumentSurface.tsx';

type Props = {
  selected: FinancialDocumentProjection;
  detail: FinancialDocumentDetail | null;
  artifacts: FinancialDocumentArtifactProjection[];
  capabilities: FinancialDocumentCapabilities;
  theme?: string;
  onBack: () => void;
  onOpenPayment?: (reference: string) => void;
  onOpenObligation?: (obligationId: string) => void;
  onOpenDocument?: (documentId: string) => void;
  onArtifactsChanged: (artifacts: FinancialDocumentArtifactProjection[]) => void;
  onDocumentChanged: () => Promise<void>;
  onError: (message: string) => void;
};

const documentTypeLabel = (type: string) => ({ receipt: 'Recibo', invoice: 'Fatura', invoice_receipt: 'Factura-Recibo', credit_note: 'Nota de crédito' }[type] ?? 'Documento financeiro');

export function SelectedFinancialDocumentDetail({ selected, detail, artifacts, capabilities, theme = 'light', onBack, onOpenPayment, onOpenObligation, onOpenDocument, onArtifactsChanged, onDocumentChanged, onError }: Props) {
  const [creditNoteAmount, setCreditNoteAmount] = useState('');
  const [creditNoteFormOpen, setCreditNoteFormOpen] = useState(false);
  const [creditNoteReadiness, setCreditNoteReadiness] = useState<CreditNoteReadinessProjection | null>(null);
  const light = theme === 'light';
  const sourceLabel = (source: FinancialDocumentDetail['sources'][number]) => source.type === 'payment'
    ? `Pagamento ${source.paymentReference ?? 'associado'}`
    : source.type === 'obligation' ? `Obrigação ${source.obligationReference ?? 'associada'}` : 'Origem financeira registada';
  useEffect(() => {
    setCreditNoteFormOpen(false);
    setCreditNoteReadiness(null);
    if (!capabilities.correct || selected.type !== 'invoice_receipt' || selected.snapshotVersion !== 4) return;
    financialDocumentClient.creditNoteReadiness(selected.id).then(setCreditNoteReadiness).catch(() => setCreditNoteReadiness(null));
  }, [capabilities.correct, selected.id, selected.snapshotVersion, selected.type]);
  const createCreditNote = async () => {
    if (!creditNoteAmount.trim() || creditNoteReadiness?.status !== 'ELIGIBLE') return;
    try {
      const key = resolvePersistentDocumentIntentKey(browserDocumentIntentStorage(), `finance-document-intent:credit-note:${selected.id}:${creditNoteReadiness.seriesId}:${creditNoteAmount}`, () => `document-credit-note-${crypto.randomUUID()}`);
      await financialDocumentClient.issueCreditNote({ originalDocumentId: selected.id, seriesId: creditNoteReadiness.seriesId, amount: creditNoteAmount, currency: creditNoteReadiness.currency, idempotencyKey: key });
      setCreditNoteFormOpen(false);
      setCreditNoteAmount('');
      setCreditNoteReadiness(null);
      await onDocumentChanged();
    } catch (error: any) {
      onError(error?.message || 'Não foi possível emitir a Nota de Crédito.');
    }
  };
  const generateArtifact = async () => {
    try {
      await financialDocumentClient.generateArtifact(selected.id);
      onArtifactsChanged(await financialDocumentClient.listArtifacts(selected.id));
    } catch {
      onError('Não foi possível gerar o PDF oficial. O documento emitido permanece inalterado.');
    }
  };
  const openArtifact = async (artifact: FinancialDocumentArtifactProjection) => {
    try {
      const bytes = await financialDocumentClient.artifactContent(artifact.id);
      window.open(URL.createObjectURL(bytes), '_blank', 'noopener');
    } catch {
      onError('Não foi possível recuperar o PDF oficial autorizado.');
    }
  };

  return <aside data-testid="selected-financial-document-detail" className={`min-w-0 rounded-lg border p-4 ${light ? 'bg-[var(--color-surface-raised)] border-[var(--color-border-default)]' : 'bg-zinc-800 border-zinc-700'}`}>
    <button type="button" onClick={onBack} className="mb-3 rounded-md border px-3 py-1 text-sm lg:hidden">Voltar aos documentos</button>
    {selected.type === 'invoice' && selected.presentation ? <InvoiceDocumentSurface model={{ mode: 'issued', status: selected.presentation.document.statusLabel, seriesNumber: selected.presentation.document.officialNumber, issueDate: selected.presentation.document.issueDate, dueDate: selected.presentation.document.dueDate, issuer: { legalName: selected.presentation.issuer.legalName, taxIdentifier: selected.presentation.issuer.taxIdentifier, address: selected.presentation.issuer.addressLines[0] ?? null }, recipient: { name: selected.presentation.recipient.name, taxIdentifier: selected.presentation.recipient.taxIdentifier, address: selected.presentation.recipient.addressLines[0] ?? null }, reference: selected.presentation.operation.reference, lines: selected.presentation.operation.lines, totals: selected.presentation.totals, taxTreatment: selected.presentation.policy.taxTreatment, legalMentions: selected.presentation.legalMentions }} /> : <section>
      <h3 className="font-semibold">Documento emitido</h3>
      <p>{selected.presentation?.document.officialNumber ?? `${selected.seriesCode}/${selected.sequenceNumber}`} · {selected.presentation?.document.typeLabel ?? documentTypeLabel(selected.type)}</p>
      <p className="text-xs text-zinc-500">Data de emissão: {new Date(selected.issuedAt).toLocaleString('pt-PT')} · Estado: {selected.presentation?.document.statusLabel ?? 'Emitido'}</p>
      {selected.presentation && <div className="mt-3 space-y-1 text-sm"><p>Emitente: {selected.presentation.issuer.legalName}</p><p>Destinatário: {selected.presentation.recipient.name}</p><p>Total: {formatFinanceMoney({ amount: selected.presentation.totals.documentTotal, currency: selected.presentation.totals.currency })}</p>{selected.presentation.correction?.originalOfficialNumber && <p>Documento corrigido: {selected.presentation.correction.originalOfficialNumber}</p>}</div>}
    </section>}
    <section className={`mt-4 border-t pt-4 ${light ? 'border-[var(--color-border-default)]' : 'border-zinc-700'}`}>
      <h4 className="font-semibold">Proveniência do documento</h4>
      <ul className="text-sm">{detail?.sources.map((source, index) => <li key={`${source.type}-${source.sourceId}-${index}`}>{sourceLabel(source)}{source.type === 'payment' && source.paymentReference && onOpenPayment && <button type="button" onClick={() => onOpenPayment(source.paymentReference!)} className="ml-2 underline">Abrir pagamento</button>}{source.type === 'obligation' && onOpenObligation && <button type="button" onClick={() => onOpenObligation(source.sourceId)} className="ml-2 underline">Abrir obrigação</button>}</li>)}</ul>
      <h4 className="mt-3 font-semibold">Correções relacionadas</h4>
      <ul className="text-sm">{detail?.corrections.map(correction => <li key={correction.id}>{correction.presentation?.document.officialNumber ?? `${correction.seriesCode}/${correction.sequenceNumber}`}{onOpenDocument && <button type="button" onClick={() => onOpenDocument(correction.id)} className="ml-2 underline">Abrir Nota de crédito</button>}</li>)}</ul>
      {selected.type === 'credit_note' && selected.correctsDocumentId && onOpenDocument && <p className="mt-3 text-sm">Esta Nota de Crédito corrige o documento emitido indicado abaixo. A obrigação e o pagamento apresentados são proveniência histórica e não são corrigidos diretamente. <button type="button" onClick={() => onOpenDocument(selected.correctsDocumentId!)} className="underline">Abrir documento original</button></p>}
    </section>
    <section className={`mt-4 border-t pt-4 ${light ? 'border-[var(--color-border-default)]' : 'border-zinc-700'}`} aria-label="Ações do documento selecionado">
      {creditNoteReadiness?.status === 'ELIGIBLE' && <><button type="button" onClick={() => setCreditNoteFormOpen(true)} className="mr-2 rounded-md border px-3 py-1 text-sm">Criar Nota de Crédito</button>{creditNoteFormOpen && <div className="mt-3"><p className="text-sm">Montante da Nota de Crédito (máximo: {creditNoteReadiness.maximumAmount} {creditNoteReadiness.currency})</p><input aria-label="Montante da Nota de Crédito" value={creditNoteAmount} onChange={event => setCreditNoteAmount(event.target.value)} inputMode="decimal" className="mt-1 rounded border px-2 py-1" /><button type="button" onClick={createCreditNote} className="ml-2 rounded-md border px-3 py-1 text-sm">Emitir Nota de Crédito</button></div>}</>}
      {artifacts.length === 0 && capabilities.issue && <button type="button" onClick={generateArtifact} className="mr-2 rounded-md border px-3 py-1 text-sm">Gerar PDF oficial</button>}
      {artifacts.map(artifact => <button key={artifact.id} type="button" onClick={() => openArtifact(artifact)} className="mr-2 rounded-md border px-3 py-1 text-sm">Visualizar PDF oficial</button>)}
    </section>
  </aside>;
}
