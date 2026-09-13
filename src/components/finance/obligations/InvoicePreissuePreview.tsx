import React, { useEffect, useState } from 'react';
import { financialDocumentClient, type InvoicePreissuePreview as InvoicePreview } from '../../../modules/finance/financial-document-client.ts';
import { browserDocumentIntentStorage, resolvePersistentDocumentIntentKey } from '../../../modules/finance/financial-document-intent.ts';
import { formatFinanceMoney } from '../../../modules/finance/money-presentation.ts';
import { AuroraStateNotice } from '../../aurora/AuroraStateNotice.tsx';

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
  useEffect(() => {
    let active = true;
    financialDocumentClient.invoicePreview(obligationId).then(value => { if (active) setPreview(value); }).catch(() => { if (active) setError('Não foi possível obter a pré-visualização autorizada desta fatura.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [obligationId]);
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
  return <section aria-live="polite" data-testid="invoice-preissue-preview" className="mx-auto mt-4 max-w-7xl rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-zinc-100">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Pré-visualização — ainda não emitido</p><h2 className="mt-1 text-xl font-bold">Fatura</h2><p className="mt-1 text-sm text-zinc-400">Esta consulta não cria documento oficial, não atribui número e não gera PDF.</p></div><button type="button" onClick={onClose} className="rounded-md border border-zinc-600 px-3 py-1.5 text-sm">Fechar</button></header>
    {loading && <AuroraStateNotice tone="info" title="A carregar pré-visualização">A confirmar os factos financeiros e os pré-requisitos de emissão.</AuroraStateNotice>}
    {error && <div className="mt-4"><AuroraStateNotice tone="danger" title="Ação indisponível">{error}</AuroraStateNotice></div>}
    {preview && <div className="mt-5 grid gap-4 lg:grid-cols-2"><section className="rounded-lg border border-zinc-700 p-4"><h3 className="font-semibold">Contexto da obrigação</h3><dl className="mt-3 grid gap-2 text-sm"><div><dt className="text-zinc-400">Referência</dt><dd>{preview.obligation?.reference ?? 'Indisponível'}</dd></div><div><dt className="text-zinc-400">Vencimento</dt><dd>{preview.obligation?.dueAt ? new Date(preview.obligation.dueAt).toLocaleDateString('pt-PT') : 'Indisponível'}</dd></div><div><dt className="text-zinc-400">Descrição</dt><dd>{preview.obligation?.lineDescription ?? 'Indisponível'}</dd></div></dl></section><section className="rounded-lg border border-zinc-700 p-4"><h3 className="font-semibold">Partes</h3><dl className="mt-3 grid gap-2 text-sm"><div><dt className="text-zinc-400">Emitente</dt><dd>{preview.issuer?.legalName ?? 'Dados em falta'}</dd></div><div><dt className="text-zinc-400">Destinatário</dt><dd>{preview.recipient?.name ?? 'Dados em falta'}</dd></div></dl></section>{preview.totals && <section className="rounded-lg border border-zinc-700 p-4"><h3 className="font-semibold">Valores</h3><dl className="mt-3 grid gap-2 text-sm"><div><dt className="text-zinc-400">Subtotal</dt><dd>{formatFinanceMoney({ amount: preview.totals.subtotal, currency: preview.totals.currency })}</dd></div><div><dt className="text-zinc-400">Desconto</dt><dd>{formatFinanceMoney({ amount: preview.totals.discountTotal, currency: preview.totals.currency })}</dd></div><div><dt className="text-zinc-400">Imposto</dt><dd>{formatFinanceMoney({ amount: preview.totals.taxTotal, currency: preview.totals.currency })}</dd></div><div><dt className="text-zinc-400">Total</dt><dd className="font-semibold">{formatFinanceMoney({ amount: preview.totals.documentTotal, currency: preview.totals.currency })}</dd></div></dl></section>}<section className="rounded-lg border border-zinc-700 p-4"><h3 className="font-semibold">Estado da emissão</h3><p className="mt-3 text-sm">{issued ? `Fatura ${issued.officialNumber} emitida${issued.replayed ? ' (operação recuperada sem duplicação).' : '.'}` : preview.readiness.status === 'READY' ? 'Pronta para emissão autorizada.' : reasonMessage(preview.blockingReason ?? preview.readiness.reasonCode)}</p><p className="mt-2 text-sm text-zinc-400">Série: {preview.series.available ? preview.series.reference : 'Não disponível'}</p><p className="mt-2 text-sm text-zinc-400">Número oficial: {issued?.officialNumber ?? 'ainda não atribuído'}</p>{preview.documentaryPolicy && <><p className="mt-2 text-sm text-zinc-400">Tratamento fiscal: {preview.documentaryPolicy.taxTreatment}</p>{preview.documentaryPolicy.legalMentions.map(mention => <p key={mention} className="mt-1 text-sm text-zinc-400">{mention}</p>)}</>}</section>{!issued && preview.readiness.status === 'READY' && preview.series.available && <footer className="lg:col-span-2"><button type="button" data-testid="issue-invoice-button" disabled={issuing} onClick={issue} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{issuing ? 'A emitir…' : 'Emitir fatura oficial'}</button></footer>}{issued && <footer className="lg:col-span-2"><button type="button" data-testid="open-issued-invoice-button" onClick={() => onIssued?.(issued.id)} className="rounded-md border border-zinc-600 px-4 py-2 text-sm font-semibold">Abrir Fatura emitida</button></footer>}</div>}
  </section>;
}
