import React, { useCallback, useEffect, useState } from 'react';
import { FinancialObligationApiError, financialObligationClient, type FinancialObligationRecord } from '../../../modules/finance/financial-obligation-client.ts';
import { formatFinanceMoney } from '../../../modules/finance/money-presentation.ts';

type Props = {
  obligationId: string;
  originLabel?: string | null;
  returnTestId?: string;
  onBack: () => void;
  onPreviewInvoice: (obligation: FinancialObligationRecord) => void;
};

const sourceLabel = (sourceType: FinancialObligationRecord['sourceType']) => ({ manual_finance: 'Emissão manual', enrollment: 'Matrícula', academic_process: 'Processo académico', service_request: 'Pedido de serviço' }[sourceType] ?? sourceType);
const statusLabel = (status: FinancialObligationRecord['status']) => status === 'open' ? 'Aberta' : 'Cancelada';

export function SelectedFinancialObligationDetail({ obligationId, originLabel, returnTestId = 'return-from-obligation-detail', onBack, onPreviewInvoice }: Props) {
  const [obligation, setObligation] = useState<FinancialObligationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setObligation(await financialObligationClient.getObligation(obligationId) as FinancialObligationRecord); }
    catch (caught) {
      const error = caught as FinancialObligationApiError;
      const title = error.status === 404 ? 'Obrigação indisponível' : error.status === 403 ? 'Acesso não autorizado' : 'Não foi possível carregar a obrigação';
      setError({ title, message: error.status === 404 ? 'A obrigação selecionada já não está disponível neste contexto institucional.' : error.status === 403 ? 'A sua associação institucional não possui autorização para consultar esta obrigação.' : 'Tente novamente. A informação financeira é sempre lida a partir do servidor autorizado.' });
    } finally { setLoading(false); }
  }, [obligationId]);
  useEffect(() => { void load(); }, [load]);

  return <section data-testid="financial-obligation-detail-view" className="mx-auto max-w-5xl p-4 sm:p-6">
    <button type="button" data-testid={returnTestId} onClick={onBack} className="mb-4 rounded-md border border-zinc-600 px-3 py-1.5 text-sm font-semibold text-zinc-100 hover:bg-zinc-800">{originLabel ? `Voltar — ${originLabel}` : 'Voltar às obrigações'}</button>
    {loading && <div data-testid="obligation-detail-loading" className="rounded-xl border border-zinc-800 p-8 text-sm text-zinc-400">A carregar obrigação autorizada…</div>}
    {error && <div data-testid="obligation-detail-error" className="rounded-xl border border-red-900 bg-red-950/30 p-5 text-sm text-red-200"><h2 className="font-bold">{error.title}</h2><p className="mt-1">{error.message}</p>{!loading && <button type="button" onClick={() => void load()} className="mt-4 rounded-md border border-red-700 px-3 py-1.5 font-semibold">Tentar novamente</button>}</div>}
    {obligation && !loading && <article data-testid="selected-financial-obligation-detail" className="space-y-5">
      <header data-testid="financial-obligation-identity" className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-5"><p className="text-xs font-bold uppercase tracking-wide text-emerald-400">Obrigação</p><div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-xl font-bold text-white">{obligation.feeItemName ?? 'Obrigação financeira'}</h1><p className="mt-1 text-sm text-zinc-400">{obligation.feeItemCode ? `${obligation.feeItemCode} · ` : ''}Versão do emolumento {obligation.feeCatalogueVersion}</p></div><span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${obligation.status === 'open' ? 'border-emerald-800 bg-emerald-950/60 text-emerald-300' : 'border-zinc-700 bg-zinc-800 text-zinc-300'}`}>{statusLabel(obligation.status)}</span></div></header>
      <section aria-labelledby="obligation-financial-position" className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5"><h2 id="obligation-financial-position" className="font-bold text-white">Posição financeira</h2><dl className="mt-4 grid gap-4 sm:grid-cols-3"><div><dt className="text-xs text-zinc-500">Montante da obrigação</dt><dd className="mt-1 text-lg font-bold text-emerald-400">{formatFinanceMoney(obligation.money)}</dd></div><div><dt className="text-xs text-zinc-500">Data de emissão</dt><dd className="mt-1 text-sm text-zinc-200">{new Date(obligation.effectiveAt).toLocaleDateString('pt-PT')}</dd></div><div><dt className="text-xs text-zinc-500">Vencimento</dt><dd className="mt-1 text-sm text-zinc-200">{obligation.dueAt ? new Date(obligation.dueAt).toLocaleDateString('pt-PT') : 'Não definido'}</dd></div></dl></section>
      <section aria-labelledby="obligation-context" className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5"><h2 id="obligation-context" className="font-bold text-white">Responsabilidade e origem</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-zinc-500">Conta financeira</dt><dd className="mt-1 text-sm text-zinc-200">{obligation.accountNumber ?? 'Conta financeira'}{obligation.accountName ? ` — ${obligation.accountName}` : ''}</dd></div><div><dt className="text-xs text-zinc-500">Beneficiário</dt><dd className="mt-1 text-sm text-zinc-200">{obligation.beneficiaryName ?? 'Titular da conta'}</dd></div><div><dt className="text-xs text-zinc-500">Origem registada</dt><dd className="mt-1 text-sm text-zinc-200">{sourceLabel(obligation.sourceType)}{obligation.sourceRef ? ` · ${obligation.sourceRef}` : ''}</dd></div>{obligation.notes && <div><dt className="text-xs text-zinc-500">Nota</dt><dd className="mt-1 text-sm text-zinc-200">{obligation.notes}</dd></div>}</dl></section>
      {obligation.status === 'open' && <section aria-label="Ações da obrigação" className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5"><h2 className="font-bold text-white">Ações</h2><p className="mt-1 text-sm text-zinc-400">A pré-emissão de fatura é uma ação sobre esta obrigação; não é a identidade da obrigação.</p><button type="button" data-testid={`invoice-preview-${obligation.id}`} onClick={() => onPreviewInvoice(obligation)} className="mt-4 rounded-md border border-zinc-600 px-3 py-1.5 text-sm font-semibold text-zinc-100 hover:bg-zinc-800">Pré-visualizar fatura</button></section>}
    </article>}
  </section>;
}
