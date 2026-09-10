import React, { useEffect, useState } from 'react';
import { FinanceConfigurationError, FinanceReadinessClient, financeReadinessClient, type FinanceReadinessDto } from '../../../modules/finance/finance-readiness-client.ts';

const requirementLabel: Record<FinanceReadinessDto['requirements'][number]['code'], string> = {
  FINANCIAL_PROFILE: 'Perfil financeiro institucional',
  FISCAL_CONFIGURATION: 'Configuração fiscal',
  RECEIPT_SERIES: 'Série de recibos',
};

export function FinanceConfigurationWorkspace({ readinessClient = financeReadinessClient, onComplete }: { readinessClient?: FinanceReadinessClient; onComplete?: () => void }) {
  const [readiness, setReadiness] = useState<FinanceReadinessDto | null>(null);
  const [code, setCode] = useState('RECIBOS');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const load = async () => { try { setReadiness(await readinessClient.get()); setError(null); } catch { setError('Não foi possível confirmar a configuração financeira atual.'); } };
  useEffect(() => { void load(); }, []);
  const firstIncomplete = readiness?.requirements.find(requirement => requirement.state !== 'COMPLETE');
  const configure = async () => {
    try {
      setError(null);
      if (firstIncomplete?.code === 'FISCAL_CONFIGURATION') {
        await readinessClient.createFiscalConfiguration({ idempotencyKey: `finance-fiscal-configuration-${crypto.randomUUID()}` });
      } else if (firstIncomplete?.code === 'RECEIPT_SERIES') {
        if (!code.trim()) { setError('Indique um código de série não vazio.'); return; }
        await readinessClient.createReceiptSeries({ code: code.trim(), idempotencyKey: `finance-receipt-series-${crypto.randomUUID()}` });
      }
      await readinessClient.get().then(setReadiness);
      setEditing(false); onComplete?.();
    } catch (caught) { setError(caught instanceof FinanceConfigurationError ? caught.message : 'Ocorreu um erro inesperado ao guardar a configuração. Tente novamente.'); }
  };
  return <section data-testid="finance-configuration-workspace" className="rounded-xl border border-zinc-200 bg-white p-6">
    <h2 className="text-xl font-bold">Configuração Financeira</h2>
    {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
    {readiness?.status === 'READY' && <p className="mt-3 text-sm text-emerald-700">Finance operacionalmente pronta.</p>}
    {readiness?.status === 'BLOCKED' && <p className="mt-3 text-sm text-rose-600">A configuração financeira requer atenção administrativa.</p>}
    {readiness?.status === 'INCOMPLETE' && <><h3 className="mt-4 font-semibold">Configuração necessária</h3><p className="text-sm text-zinc-600">Os recebimentos estão disponíveis, mas ainda não é possível emitir recibos oficiais.</p>
      {firstIncomplete && <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm"><strong>Passo atual: {requirementLabel[firstIncomplete.code]}</strong><p className="mt-1">{firstIncomplete.code === 'FINANCIAL_PROFILE' ? 'O perfil financeiro institucional ainda não está efetivo. Esta autoridade não é criada nesta página; contacte a administração institucional.' : firstIncomplete.code === 'FISCAL_CONFIGURATION' ? 'Crie primeiro a configuração fiscal institucional neutra. Depois confirmaremos novamente a prontidão antes de pedir a série.' : 'Defina uma série de recibos depois de a configuração fiscal estar efetiva.'}</p></div>}
      {readiness.canManageConfiguration && firstIncomplete?.state === 'MISSING' && firstIncomplete.code !== 'FINANCIAL_PROFILE' && !editing && <button type="button" onClick={() => setEditing(true)} className="mt-4 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Concluir configuração</button>}
      {!readiness.canManageConfiguration && <p className="mt-4 text-sm text-zinc-600">A sua sessão pode consultar a prontidão, mas não tem permissão para alterar a configuração.</p>}
      {editing && readiness.canManageConfiguration && firstIncomplete?.code === 'FISCAL_CONFIGURATION' && <div className="mt-4 space-y-3"><p className="text-sm text-zinc-600">Será criada a primeira configuração fiscal institucional efetiva, com o adaptador neutro já suportado pelo servidor. Não define regras de um país.</p><button type="button" onClick={configure} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Guardar configuração fiscal</button></div>}
      {editing && readiness.canManageConfiguration && firstIncomplete?.code === 'RECEIPT_SERIES' && <div className="mt-4 space-y-3"><div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-700"><p><strong>O que é:</strong> a Série identifica a sequência documental desta instituição.</p><p><strong>Não é:</strong> o número oficial seguinte é atribuído exclusivamente pelo servidor.</p><p><strong>Contrato atual:</strong> use um código de texto não vazio e código único na instituição. Não existe regra legal de formato neste ecrã; a data de efetividade é definida no momento de guardar.</p></div><label className="block text-sm font-medium">Código da série de recibos<input value={code} onChange={event => setCode(event.target.value)} className="mt-1 block w-full rounded-md border p-2" /></label><button type="button" onClick={configure} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Guardar série de recibos</button></div>}
    </>}
  </section>;
}
