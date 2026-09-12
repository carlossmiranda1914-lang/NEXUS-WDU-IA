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
  const [timezone, setTimezone] = useState('Africa/Luanda');
  const [enabledCurrencies, setEnabledCurrencies] = useState('AOA');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<'legal' | 'financial' | null>(null);
  const load = async () => { try { setReadiness(await readinessClient.get()); setError(null); } catch { setError('Não foi possível confirmar a configuração financeira atual.'); } };
  useEffect(() => { void load(); }, []);
  const legalRequirement = readiness?.requirements.find(requirement => requirement.code === 'INSTITUTION_LEGAL_PROFILE');
  const financialRequirement = readiness?.requirements.find(requirement => requirement.code === 'FINANCIAL_PROFILE');
  const actionableRequirement = legalRequirement?.state === 'MISSING'
    ? legalRequirement
    : financialRequirement?.state === 'MISSING'
      ? financialRequirement
      : undefined;
  const configure = async () => {
    try {
      setError(null); setSuccess(null); setSaving(true);
      if (editing === 'legal') await readinessClient.createLegalProfile({ legalName, taxIdentifier, countryCode: jurisdiction, addressLine1, effectiveFrom: new Date().toISOString() });
      else if (editing === 'financial') await readinessClient.createFinancialProfile({ primaryJurisdiction: jurisdiction, functionalCurrency: currency, financialTimezone: timezone, monetaryPolicyVersion: 'v1', enabledCurrencies: enabledCurrencies.split(',').map(value => value.trim().toUpperCase()).filter(Boolean), effectiveFrom: new Date().toISOString() });
      await readinessClient.get().then(setReadiness);
      setSuccess('Configuração institucional guardada. A prontidão financeira foi atualizada a partir do servidor.'); setEditing(null); onComplete?.();
    } catch (caught) { setError(caught instanceof FinanceConfigurationError ? caught.message : 'Ocorreu um erro inesperado ao guardar a configuração. Tente novamente.'); }
    finally { setSaving(false); }
  };
  return <section data-testid="finance-configuration-workspace" className="rounded-xl border border-zinc-200 bg-white p-6">
    <h2 className="text-xl font-bold">Configuração Financeira</h2>
    {error && <div className="mt-3"><AuroraStateNotice tone="danger" title="Não foi possível confirmar a configuração financeira">{error}</AuroraStateNotice></div>}
    {success && <div className="mt-3"><AuroraStateNotice tone="success" title="Prontidão atualizada">{success}</AuroraStateNotice></div>}
    {readiness?.status === 'READY' && <div className="mt-3"><AuroraStateNotice tone="success" title="Finance pronta">Finance operacionalmente pronta.</AuroraStateNotice></div>}
    {actionableRequirement && <>
      <h3 className="mt-4 font-semibold">Configuração necessária</h3>
      <p className="text-sm text-zinc-600">Complete os perfis institucionais. A prontidão é confirmada pelo servidor depois de cada gravação.</p>
      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm"><strong>{requirementLabel[actionableRequirement.code]}: em falta</strong><p className="mt-1">{actionableRequirement.code === 'INSTITUTION_LEGAL_PROFILE' ? 'Registe a identidade jurídica da instituição para continuar.' : 'Registe o contexto financeiro institucional para continuar.'}</p></div>
      {readiness?.canManageConfiguration && !editing && actionableRequirement.code === 'INSTITUTION_LEGAL_PROFILE' && <button type="button" onClick={() => setEditing('legal')} className="mt-4 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Configurar perfil jurídico</button>}
      {readiness?.canManageConfiguration && !editing && actionableRequirement.code === 'FINANCIAL_PROFILE' && <button type="button" onClick={() => setEditing('financial')} className="mt-4 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Configurar perfil financeiro</button>}
      {!readiness?.canManageConfiguration && <p className="mt-4 text-sm text-zinc-600">A sua sessão pode consultar a prontidão, mas não tem permissão para alterar a configuração.</p>}
      {editing === 'legal' && readiness?.canManageConfiguration && <div data-testid="legal-profile-form" className="mt-4 space-y-3"><label className="block text-sm font-medium">Nome jurídico<input value={legalName} onChange={event => setLegalName(event.target.value)} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><label className="block text-sm font-medium">Identificação fiscal<input value={taxIdentifier} onChange={event => setTaxIdentifier(event.target.value)} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><label className="block text-sm font-medium">País / jurisdição<input value={jurisdiction} onChange={event => setJurisdiction(event.target.value.toUpperCase())} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><label className="block text-sm font-medium">Morada registada<input value={addressLine1} onChange={event => setAddressLine1(event.target.value)} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><button data-testid="legal-profile-save" type="button" onClick={configure} disabled={saving} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Guardar perfil jurídico</button></div>}
      {editing === 'financial' && readiness?.canManageConfiguration && <div data-testid="financial-profile-form" className="mt-4 space-y-3"><label className="block text-sm font-medium">Jurisdição principal<input value={jurisdiction} onChange={event => setJurisdiction(event.target.value.toUpperCase())} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><label className="block text-sm font-medium">Moeda funcional<input value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><label className="block text-sm font-medium">Fuso horário financeiro<input value={timezone} onChange={event => setTimezone(event.target.value)} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><label className="block text-sm font-medium">Moedas ativas<input value={enabledCurrencies} onChange={event => setEnabledCurrencies(event.target.value)} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><button data-testid="financial-profile-save" type="button" onClick={configure} disabled={saving} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Guardar perfil financeiro</button></div>}
    </>}
    {readiness?.receiptIssuance.status === 'BLOCKED' && readiness.receiptIssuance.reasonCode === 'JURISDICTION_POLICY_UNAVAILABLE' && <div className="mt-4"><AuroraStateNotice tone="warning" title="Emissão oficial indisponível">A configuração local está concluída, mas ainda não existe uma política jurisdicional aprovada. Não é possível criar configuração fiscal, séries ou emitir recibos oficiais.</AuroraStateNotice></div>}
  </section>;
}
