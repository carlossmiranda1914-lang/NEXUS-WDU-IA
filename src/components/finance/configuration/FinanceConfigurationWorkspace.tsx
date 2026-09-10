import React, { useEffect, useState } from 'react';
import { FinanceReadinessClient, financeReadinessClient, type FinanceReadinessDto } from '../../../modules/finance/finance-readiness-client.ts';

const requirementLabel: Record<FinanceReadinessDto['requirements'][number]['code'], string> = {
  FINANCIAL_PROFILE: 'Perfil financeiro institucional',
  FISCAL_CONFIGURATION: 'Configuração fiscal',
  RECEIPT_SERIES: 'Série de recibos',
};

export function FinanceConfigurationWorkspace({ readinessClient = financeReadinessClient, onComplete }: { readinessClient?: FinanceReadinessClient; onComplete?: () => void }) {
  const [readiness, setReadiness] = useState<FinanceReadinessDto | null>(null);
  const [code, setCode] = useState('REC');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const load = async () => { try { setReadiness(await readinessClient.get()); setError(null); } catch { setError('Não foi possível confirmar a configuração financeira atual.'); } };
  useEffect(() => { void load(); }, []);
  const missing = readiness?.requirements.filter(requirement => requirement.state !== 'COMPLETE') ?? [];
  const configure = async () => {
    try {
      await readinessClient.createReceiptSeries({ code: code.trim(), idempotencyKey: `finance-receipt-series-${crypto.randomUUID()}` });
      await readinessClient.get().then(setReadiness);
      setEditing(false); onComplete?.();
    } catch { setError('Não foi possível concluir a configuração. Verifique os dados da série e tente novamente.'); }
  };
  return <section data-testid="finance-configuration-workspace" className="rounded-xl border border-zinc-200 bg-white p-6">
    <h2 className="text-xl font-bold">Configuração Financeira</h2>
    {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
    {readiness?.status === 'READY' && <p className="mt-3 text-sm text-emerald-700">Finance operacionalmente pronta.</p>}
    {readiness?.status === 'BLOCKED' && <p className="mt-3 text-sm text-rose-600">A configuração financeira requer atenção administrativa.</p>}
    {readiness?.status === 'INCOMPLETE' && <><h3 className="mt-4 font-semibold">Configuração necessária</h3><p className="text-sm text-zinc-600">Os recebimentos estão disponíveis, mas ainda não é possível emitir recibos oficiais.</p><ul className="mt-3 text-sm">{missing.map(requirement => <li key={requirement.code}>Falta: {requirementLabel[requirement.code]}</li>)}</ul>
      {readiness.canManageConfiguration && !editing && <button type="button" onClick={() => setEditing(true)} className="mt-4 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Concluir configuração</button>}
      {editing && readiness.canManageConfiguration && <div className="mt-4 space-y-3"><label className="block text-sm font-medium">Código da série de recibos<input value={code} onChange={event => setCode(event.target.value)} className="mt-1 block w-full rounded-md border p-2" /></label><button type="button" onClick={configure} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Guardar série de recibos</button></div>}
    </>}
  </section>;
}
