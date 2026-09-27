import React, { useEffect, useState } from 'react';
import { financialDocumentClient, type InvoicePreissuePreview as InvoicePreview } from '../../../modules/finance/financial-document-client.ts';
import { browserDocumentIntentStorage, resolvePersistentDocumentIntentKey } from '../../../modules/finance/financial-document-intent.ts';
import { AuroraStateNotice } from '../../aurora/AuroraStateNotice.tsx';
import { InvoiceDocumentSurface } from '../documents/InvoiceDocumentSurface.tsx';

const reasonMessage = (code: string | null | undefined) => ({
  INVOICE_SERIES_NOT_EFFECTIVE: 'Ainda não existe uma série de faturas ativa e efetiva para esta instituição.',
  INVOICE_SOURCE_NOT_ELIGIBLE: 'Esta obrigação não está elegível para emissão de fatura.',
  INVOICE_DUE_DATE_REQUIRED: 'A obrigação precisa de uma data de vencimento antes de poder ser faturada.',
  INSTITUTION_LEGAL_PROFILE_REQUIRED: 'Complete o perfil jurídico institucional antes de emitir uma fatura.',
  DOCUMENT_RECIPIENT_REQUIRED: 'Complete os dados do destinatário antes de emitir uma fatura.',
  FISCAL_ADAPTER_UNSUPPORTED_JURISDICTION: 'A política fiscal desta instituição ainda não permite emissão oficial para esta jurisdição.',
}[code ?? ''] ?? 'A emissão oficial desta fatura ainda não está disponível. Reveja os pré-requisitos apresentados.');

export function InvoicePreissuePreview({ obligationId, onClose, onIssued }: { obligationId: string; onClose: () => void; onIssued?: (documentId: string) => void }) {
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ id: string; officialNumber: string; replayed: boolean } | null>(null);
  useEffect(() => { let active = true; financialDocumentClient.invoicePreview(obligationId).then(value => { if (active) setPreview(value); }).catch(() => { if (active) setError('Não foi possível obter a pré-visualização autorizada desta fatura.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [obligationId]);
  const issue = async () => {
    if (!preview || preview.readiness.status !== 'READY' || !preview.series.available) return;
    setIssuing(true); setError(null);
    try {
      const selected = (await financialDocumentClient.listActiveInvoiceSeries())[0];
      if (!selected) throw new Error('INVOICE_SERIES_NOT_EFFECTIVE');
      const idempotencyKey = resolvePersistentDocumentIntentKey(browserDocumentIntentStorage(), `finance-document-intent:invoice:${obligationId}:${selected.id}`, () => `document-invoice-${crypto.randomUUID()}`);
      const command = await financialDocumentClient.issueInvoice({ obligationId, seriesId: selected.id, idempotencyKey });
      setIssued({ id: command.id, officialNumber: `${selected.code}/${command.sequenceNumber}`, replayed: command.replayed });
    } catch (issueError) { setError(issueError instanceof Error ? reasonMessage(issueError.message) : 'Não foi possível emitir a fatura autorizada.'); } finally { setIssuing(false); }
  };
  const facts = preview?.documentFacts;
  return <section aria-live="polite" data-testid="invoice-preissue-preview" className="mt-4">
    <header data-testid="selected-obligation-context" className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-3 px-1"><div><p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">A visualizar obrigação</p><p className="mt-1 text-sm text-zinc-400">{facts ? `${facts.obligation.reference} · ${facts.obligation.description}` : 'A carregar a referência da obrigação selecionada.'}</p><p className="mt-1 text-sm text-zinc-400">Pré-visualização — ainda não emitida</p></div><button type="button" onClick={onClose} className="rounded-md border border-zinc-600 px-3 py-1.5 text-sm">Fechar</button></header>
    {loading && <div className="mx-auto mt-4 max-w-5xl"><AuroraStateNotice tone="info" title="A carregar pré-visualização">A confirmar os factos financeiros e os pré-requisitos de emissão.</AuroraStateNotice></div>}
    {error && <div className="mx-auto mt-4 max-w-5xl"><AuroraStateNotice tone="danger" title="Ação indisponível">{error}</AuroraStateNotice></div>}
    {preview && <><div className="mx-auto mt-4 max-w-5xl"><AuroraStateNotice tone={preview.readiness.status === 'READY' ? 'success' : 'warning'} title="Estado da emissão">{issued ? `Fatura ${issued.officialNumber} emitida${issued.replayed ? ' (operação recuperada sem duplicação).' : '.'}` : preview.readiness.status === 'READY' ? 'Pronta para emissão autorizada.' : reasonMessage(preview.blockingReason ?? preview.readiness.reasonCode)}<span className="block pt-1 text-sm">Série: {preview.series.available ? preview.series.reference : 'Não disponível'} · Número oficial: {issued?.officialNumber ?? 'ainda não atribuído'}</span></AuroraStateNotice></div>
      {facts && <div className="mt-4"><InvoiceDocumentSurface model={{ mode: 'preview', status: 'Pré-visualização — ainda não emitida', seriesNumber: issued?.officialNumber ?? (preview.series.available ? `${preview.series.reference}/a atribuir` : 'Ainda sem série efetiva'), issueDate: null, dueDate: facts.obligation.dueAt, issuer: facts.issuer, recipient: facts.recipient, reference: facts.obligation.reference, lines: facts.lines, totals: facts.totals, taxTreatment: facts.policy?.taxTreatment ?? null, legalMentions: facts.policy?.legalMentions ?? [] }} /></div>}
      {!issued && preview.readiness.status === 'READY' && preview.series.available && <footer className="mx-auto mt-4 max-w-5xl"><button type="button" data-testid="issue-invoice-button" disabled={issuing} onClick={issue} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{issuing ? 'A emitir…' : 'Emitir fatura oficial'}</button></footer>}
      {issued && <footer className="mx-auto mt-4 max-w-5xl"><button type="button" data-testid="open-issued-invoice-button" onClick={() => onIssued?.(issued.id)} className="rounded-md border border-zinc-600 px-4 py-2 text-sm font-semibold">Abrir Fatura emitida</button></footer>}</>}
  </section>;
}
