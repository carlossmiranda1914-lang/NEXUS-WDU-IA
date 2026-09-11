import React, { useEffect, useState } from 'react';
import { FinanceConfigurationError, FinanceReadinessClient, financeReadinessClient, type FinanceReadinessDto } from '../../../modules/finance/finance-readiness-client.ts';
import { AuroraStateNotice } from '../../aurora/AuroraStateNotice.tsx';

const requirementLabel: Record<FinanceReadinessDto['requirements'][number]['code'], string> = {
  FINANCIAL_PROFILE: 'Perfil financeiro institucional',
  INSTITUTION_LEGAL_PROFILE: 'Perfil jurídico institucional',
  FISCAL_CONFIGURATION: 'Configuração fiscal',
  RECEIPT_SERIES: 'Série de recibos',
};

export function FinanceConfigurationWorkspace({ readinessClient = financeReadinessClient, onComplete }: { readinessClient?: FinanceReadinessClient; onComplete?: () => void }) {
  const [readiness, setReadiness] = useState<FinanceReadinessDto | null>(null);
  const [legalName, setLegalName] = useState('');
  const [taxIdentifier, setTaxIdentifier] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [jurisdiction, setJurisdiction] = useState('AO');
  const [currency, setCurrency] = useState('AOA');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const load = async () => { try { setReadiness(await readinessClient.get()); setError(null); } catch { setError('Não foi possível confirmar a configuração financeira atual.'); } };
  useEffect(() => { void load(); }, []);
  const firstIncomplete = readiness?.requirements.find(requirement => requirement.state !== 'COMPLETE');
  const configure = async () => {
    try {
      setError(null); setSuccess(null); setSaving(true);
      if (firstIncomplete?.code === 'INSTITUTION_LEGAL_PROFILE') await readinessClient.createLegalProfile({ legalName, taxIdentifier, countryCode: jurisdiction, addressLine1, effectiveFrom: new Date().toISOString() });
      else if (firstIncomplete?.code === 'FINANCIAL_PROFILE') await readinessClient.createFinancialProfile({ primaryJurisdiction: jurisdiction, functionalCurrency: currency, financialTimezone: jurisdiction === 'AO' ? 'Africa/Luanda' : 'Europe/Lisbon', monetaryPolicyVersion: 'v1', enabledCurrencies: [currency], effectiveFrom: new Date().toISOString() });
      await readinessClient.get().then(setReadiness);
      setSuccess('Configuração institucional guardada. A prontidão financeira foi atualizada a partir do servidor.'); setEditing(false); onComplete?.();
    } catch (caught) { setError(caught instanceof FinanceConfigurationError ? caught.message : 'Ocorreu um erro inesperado ao guardar a configuração. Tente novamente.'); }
    finally { setSaving(false); }
  };
  return <section data-testid="finance-configuration-workspace" className="rounded-xl border border-zinc-200 bg-white p-6">
    <h2 className="text-xl font-bold">Configuração Financeira</h2>
    {error && <div className="mt-3"><AuroraStateNotice tone="danger" title="Não foi possível confirmar a configuração financeira">{error}</AuroraStateNotice></div>}
    {success && <div className="mt-3"><AuroraStateNotice tone="success" title="Prontidão atualizada">{success}</AuroraStateNotice></div>}
    {readiness?.status === 'READY' && <div className="mt-3"><AuroraStateNotice tone="success" title="Finance pronta">Finance operacionalmente pronta.</AuroraStateNotice></div>}
    {readiness?.status === 'BLOCKED' && <div className="mt-3"><AuroraStateNotice tone="warning" title="Emissão oficial indisponível">A instituição está configurada, mas ainda não existe uma política jurisdicional aprovada para emitir documentos oficiais.</AuroraStateNotice></div>}
    {readiness?.status === 'INCOMPLETE' && <><h3 className="mt-4 font-semibold">Configuração necessária</h3><p className="text-sm text-zinc-600">Os recebimentos estão disponíveis, mas ainda não é possível emitir recibos oficiais.</p>
      {firstIncomplete && <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm"><strong>Passo atual: {requirementLabel[firstIncomplete.code]}</strong><p className="mt-1">Complete este perfil institucional para que o servidor possa reavaliar a prontidão.</p></div>}
      {readiness.canManageConfiguration && firstIncomplete?.state === 'MISSING' && (firstIncomplete.code === 'INSTITUTION_LEGAL_PROFILE' || firstIncomplete.code === 'FINANCIAL_PROFILE') && !editing && <button type="button" onClick={() => setEditing(true)} className="mt-4 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Concluir configuração</button>}
      {!readiness.canManageConfiguration && <p className="mt-4 text-sm text-zinc-600">A sua sessão pode consultar a prontidão, mas não tem permissão para alterar a configuração.</p>}
      {readiness?.status === 'BLOCKED' && readiness.receiptIssuance.status === 'BLOCKED' && readiness.receiptIssuance.reasonCode === 'JURISDICTION_POLICY_UNAVAILABLE' && <p className="mt-4 text-sm text-amber-800">A emissão oficial permanece indisponível até existir uma política jurisdicional aprovada. Não foi criada uma configuração fiscal ou série sintética.</p>}
      {editing && readiness.canManageConfiguration && firstIncomplete?.code === 'INSTITUTION_LEGAL_PROFILE' && <div className="mt-4 space-y-3"><label className="block text-sm font-medium">Nome jurídico<input value={legalName} onChange={event => setLegalName(event.target.value)} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><label className="block text-sm font-medium">Identificação fiscal<input value={taxIdentifier} onChange={event => setTaxIdentifier(event.target.value)} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><label className="block text-sm font-medium">Morada<input value={addressLine1} onChange={event => setAddressLine1(event.target.value)} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><button type="button" onClick={configure} disabled={saving} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Guardar perfil jurídico</button></div>}
      {editing && readiness.canManageConfiguration && firstIncomplete?.code === 'FINANCIAL_PROFILE' && <div className="mt-4 space-y-3"><label className="block text-sm font-medium">Jurisdição principal<input value={jurisdiction} onChange={event => setJurisdiction(event.target.value.toUpperCase())} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><label className="block text-sm font-medium">Moeda funcional<input value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><button type="button" onClick={configure} disabled={saving} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Guardar perfil financeiro</button></div>}
    </>}
  </section>;
}
