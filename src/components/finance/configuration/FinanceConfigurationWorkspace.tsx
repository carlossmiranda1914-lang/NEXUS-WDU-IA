import React, { useEffect, useState } from 'react';
import { FinanceConfigurationError, FinanceReadinessClient, financeReadinessClient, type DocumentSeriesConfiguration, type FinanceReadinessDto, type FinancialProfileConfiguration, type FiscalConfiguration, type LegalProfileConfiguration } from '../../../modules/finance/finance-readiness-client.ts';
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
  const [editing, setEditing] = useState<'legal' | 'financial' | 'fiscal' | 'series' | null>(null);
  const [seriesType, setSeriesType] = useState<'receipt' | 'invoice' | 'invoice_receipt' | 'credit_note'>('receipt');
  const [seriesCode, setSeriesCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [legalProfile, setLegalProfile] = useState<LegalProfileConfiguration | null>(null);
  const [financialProfile, setFinancialProfile] = useState<FinancialProfileConfiguration | null>(null);
  const [fiscalConfigurations, setFiscalConfigurations] = useState<FiscalConfiguration[]>([]);
  const [documentSeries, setDocumentSeries] = useState<DocumentSeriesConfiguration[]>([]);
  const load = async () => {
    setLoading(true);
    try {
      const optionalClient = readinessClient as Partial<FinanceReadinessClient>;
      const [nextReadiness, legal, financial, fiscal, series] = await Promise.all([
        readinessClient.get(), optionalClient.getLegalProfile?.() ?? Promise.resolve({ item: null }), optionalClient.getFinancialProfile?.() ?? Promise.resolve({ item: null }), optionalClient.listFiscalConfigurations?.() ?? Promise.resolve({ items: [] }), optionalClient.listDocumentSeries?.() ?? Promise.resolve({ items: [] }),
      ]);
      setReadiness(nextReadiness); setLegalProfile(legal.item); setFinancialProfile(financial.item); setFiscalConfigurations(fiscal.items); setDocumentSeries(series.items); setError(null);
    }
    catch { setError('Não foi possível confirmar a configuração financeira atual.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const legalRequirement = readiness?.requirements.find(requirement => requirement.code === 'INSTITUTION_LEGAL_PROFILE');
  const financialRequirement = readiness?.requirements.find(requirement => requirement.code === 'FINANCIAL_PROFILE');
  const actionableRequirement = legalRequirement?.state === 'MISSING'
    ? legalRequirement
    : financialRequirement?.state === 'MISSING'
      ? financialRequirement
      : undefined;
  const requirementStateLabel = (state: FinanceReadinessDto['requirements'][number]['state']) => state === 'COMPLETE' ? 'Concluído' : state === 'MISSING' ? 'Em falta' : 'Bloqueado';
  const startLegalVersion = () => { setLegalName(legalProfile?.legalName ?? ''); setTaxIdentifier(legalProfile?.taxIdentifier ?? ''); setAddressLine1(legalProfile?.registeredAddress.line1 ?? ''); setEditing('legal'); };
  const startFinancialVersion = () => { setJurisdiction(financialProfile?.primaryJurisdiction ?? 'AO'); setCurrency(financialProfile?.functionalCurrency ?? 'AOA'); setTimezone(financialProfile?.financialTimezone ?? 'Africa/Luanda'); setEnabledCurrencies(financialProfile?.enabledCurrencies.join(', ') ?? 'AOA'); setEditing('financial'); };
  const productionBlocked = readiness?.receiptIssuance.status === 'BLOCKED' && /^AGT_/.test(readiness.receiptIssuance.reasonCode);
  const canManageFiscalConfiguration = Boolean(readiness?.canManageConfiguration && readiness.jurisdictionPolicyAvailable && !productionBlocked);
  const canManageSeries = Boolean(canManageFiscalConfiguration && fiscalConfigurations.length > 0 && readiness?.seriesConfigurationAvailable);
  const configure = async () => {
    try {
      setError(null); setSuccess(null); setSaving(true);
      if (editing === 'legal') await readinessClient.createLegalProfile({ legalName, taxIdentifier, countryCode: jurisdiction, addressLine1, effectiveFrom: new Date().toISOString() });
      else if (editing === 'financial') await readinessClient.createFinancialProfile({ primaryJurisdiction: jurisdiction, functionalCurrency: currency, financialTimezone: timezone, monetaryPolicyVersion: 'v1', enabledCurrencies: enabledCurrencies.split(',').map(value => value.trim().toUpperCase()).filter(Boolean), effectiveFrom: new Date().toISOString() });
      else if (editing === 'fiscal') await readinessClient.createFiscalConfiguration({ version: (fiscalConfigurations[0]?.version ?? 0) + 1, operationalConfiguration: {}, effectiveFrom: new Date().toISOString(), idempotencyKey: `finance-fiscal-${crypto.randomUUID()}` });
      else if (editing === 'series') await readinessClient.createDocumentSeries({ code: seriesCode.trim(), documentType: seriesType, effectiveFrom: new Date().toISOString(), idempotencyKey: `finance-series-${crypto.randomUUID()}` });
      await load();
      setSuccess('Configuração institucional guardada. A prontidão financeira foi atualizada a partir do servidor.'); setEditing(null); onComplete?.();
    } catch (caught) { setError(caught instanceof FinanceConfigurationError ? caught.message : 'Ocorreu um erro inesperado ao guardar a configuração. Tente novamente.'); }
    finally { setSaving(false); }
  };
  return <section data-testid="finance-configuration-workspace" className="rounded-xl border border-zinc-200 bg-white p-6">
    <h2 className="text-xl font-bold">Configuração Financeira</h2>
    {loading && <p className="mt-3 text-sm text-zinc-600">A carregar configuração financeira…</p>}
    {error && <div className="mt-3"><AuroraStateNotice tone="danger" title="Não foi possível confirmar a configuração financeira">{error}</AuroraStateNotice></div>}
    {success && <div className="mt-3"><AuroraStateNotice tone="success" title="Prontidão atualizada">{success}</AuroraStateNotice></div>}
    {readiness?.status === 'READY' && <div className="mt-3"><AuroraStateNotice tone="success" title="Configuração base concluída">Os recursos institucionais base estão configurados. A prontidão de emissão é avaliada separadamente por tipo de documento; a produção AO pode permanecer bloqueada por pré-requisitos externos.</AuroraStateNotice></div>}
    {readiness && <>
      <section data-testid="finance-readiness-requirements" className="mt-4 rounded-md border border-zinc-200 p-3 text-sm">
        <h3 className="font-semibold">Estado da configuração</h3>
        <ul className="mt-2 space-y-1">
          {readiness.requirements.map(requirement => <li key={requirement.code}><strong>{requirementLabel[requirement.code]}:</strong> {requirementStateLabel(requirement.state)} {requirement.code === 'FISCAL_CONFIGURATION' || requirement.code === 'RECEIPT_SERIES' ? <span className="text-zinc-600">· Recurso local Nexus</span> : null}</li>)}
        </ul>
      </section>
      {readiness.receiptIssuance.status === 'BLOCKED' && /^AGT_/.test(readiness.receiptIssuance.reasonCode) && <div className="mt-4"><AuroraStateNotice tone="warning" title="Pré-requisito externo de produção AO">A emissão oficial depende de requisitos externos da AGT. Estes requisitos não são configuráveis nesta área.</AuroraStateNotice></div>}
      {!actionableRequirement && readiness.status !== 'READY' && <div className="mt-4"><AuroraStateNotice tone="warning" title="Configuração local pendente">Existem recursos locais em falta. Esta área não apresenta uma ação que não esteja disponível para a configuração atual.</AuroraStateNotice></div>}
      <section className="mt-5 grid gap-4" data-testid="finance-configuration-management">
        <section className="rounded-md border border-zinc-200 p-4"><h3 className="font-semibold">Perfil jurídico institucional</h3>{legalProfile ? <><p className="mt-2 text-sm">{legalProfile.legalName} · NIF: {legalProfile.taxIdentifier ?? 'não registado'}</p><p className="text-sm">{legalProfile.registeredAddress.line1}</p><p className="text-sm text-zinc-600">Efetivo desde {new Date(legalProfile.effectiveFrom).toLocaleDateString('pt-PT')}</p><p className="mt-2 text-sm text-zinc-600">As alterações criam uma nova versão efetiva do perfil. A versão atual permanece preservada.</p>{readiness.canManageConfiguration && !editing && <button type="button" className="mt-3 rounded-md border px-3 py-1 text-sm" onClick={startLegalVersion}>Atualizar perfil jurídico</button>}</> : <p className="mt-2 text-sm">Ainda não configurado.</p>}</section>
        <section className="rounded-md border border-zinc-200 p-4"><h3 className="font-semibold">Perfil financeiro</h3>{financialProfile ? <><p className="mt-2 text-sm">Jurisdição: {financialProfile.primaryJurisdiction} · Moeda funcional: {financialProfile.functionalCurrency}</p><p className="text-sm">Fuso horário: {financialProfile.financialTimezone} · Moedas ativas: {financialProfile.enabledCurrencies.join(', ')}</p><p className="text-sm text-zinc-600">Efetivo desde {new Date(financialProfile.effectiveFrom).toLocaleDateString('pt-PT')}</p><p className="mt-2 text-sm text-zinc-600">As alterações criam uma nova versão efetiva do perfil financeiro. A versão atual permanece preservada.</p>{readiness.canManageConfiguration && !editing && <button type="button" className="mt-3 rounded-md border px-3 py-1 text-sm" onClick={startFinancialVersion}>Atualizar perfil financeiro</button>}</> : <p className="mt-2 text-sm">Ainda não configurado.</p>}</section>
        <section className="rounded-md border border-zinc-200 p-4"><h3 className="font-semibold">Configuração fiscal</h3>{fiscalConfigurations[0] ? <p className="mt-2 text-sm">Configuração efetiva: versão {fiscalConfigurations[0].version} · estado efetivo</p> : <p className="mt-2 text-sm">Ainda não existe configuração fiscal efetiva.</p>}{canManageFiscalConfiguration && !editing && <button type="button" className="mt-3 rounded-md border px-3 py-1 text-sm" onClick={() => setEditing('fiscal')}>{fiscalConfigurations[0] ? 'Criar nova versão de configuração fiscal' : 'Criar configuração fiscal'}</button>}<p className="mt-2 text-sm text-zinc-600">Para produção AO, adesão AGT, material de assinatura e série de produção são pré-requisitos externos. Não são configuráveis nesta área.</p></section>
        <section className="rounded-md border border-zinc-200 p-4"><h3 className="font-semibold">Séries documentais</h3>{(['receipt', 'invoice', 'invoice_receipt', 'credit_note'] as const).map(type => { const items = documentSeries.filter(item => item.document_type === type); const label = ({ receipt: 'recibos', invoice: 'faturas', invoice_receipt: 'facturas-recibo', credit_note: 'notas de crédito' } as const)[type]; return <div key={type} className="mt-3"><strong className="text-sm">Séries de {label}</strong><p className="text-sm">{items.length ? items.map(item => `${item.code} · ${item.status}`).join(', ') : 'Nenhuma série efetiva configurada.'}</p></div>; })}{canManageSeries && !editing && <button type="button" className="mt-3 rounded-md border px-3 py-1 text-sm" onClick={() => setEditing('series')}>Criar série documental</button>}<p className="mt-2 text-sm text-zinc-600">A criação de séries só é possível após política e configuração fiscal efetivas; não há ação de produção AO enquanto a autoridade externa estiver incompleta.</p></section>
      </section>
      {editing === 'fiscal' && canManageFiscalConfiguration && <div data-testid="fiscal-configuration-form" className="mt-4"><p className="text-sm">A política fiscal é determinada pelo servidor para a jurisdição institucional.</p><button type="button" onClick={configure} disabled={saving} className="mt-3 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Guardar configuração fiscal</button></div>}
      {editing === 'series' && canManageSeries && <div data-testid="document-series-form" className="mt-4 space-y-3"><label className="block text-sm font-medium">Tipo documental<select value={seriesType} onChange={event => setSeriesType(event.target.value as typeof seriesType)} className="mt-1 block rounded border p-2"><option value="receipt">Recibo</option><option value="invoice">Fatura</option><option value="invoice_receipt">Factura-Recibo</option><option value="credit_note">Nota de Crédito</option></select></label><label className="block text-sm font-medium">Código da série<input value={seriesCode} onChange={event => setSeriesCode(event.target.value)} className="mt-1 block rounded border p-2" /></label><button type="button" onClick={configure} disabled={saving || !seriesCode.trim()} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Guardar série documental</button></div>}
    </>}
    {actionableRequirement && <>
      <h3 className="mt-4 font-semibold">Configuração necessária</h3>
      <p className="text-sm text-zinc-600">Complete os perfis institucionais. A prontidão é confirmada pelo servidor depois de cada gravação.</p>
      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm"><strong>{requirementLabel[actionableRequirement.code]}: em falta</strong><p className="mt-1">{actionableRequirement.code === 'INSTITUTION_LEGAL_PROFILE' ? 'Registe a identidade jurídica da instituição para continuar.' : 'Registe o contexto financeiro institucional para continuar.'}</p></div>
      {readiness?.canManageConfiguration && !editing && actionableRequirement.code === 'INSTITUTION_LEGAL_PROFILE' && <button type="button" onClick={startLegalVersion} className="mt-4 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Configurar perfil jurídico</button>}
      {readiness?.canManageConfiguration && !editing && actionableRequirement.code === 'FINANCIAL_PROFILE' && <button type="button" onClick={startFinancialVersion} className="mt-4 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Configurar perfil financeiro</button>}
      {!readiness?.canManageConfiguration && <p className="mt-4 text-sm text-zinc-600">A sua sessão pode consultar a prontidão, mas não tem permissão para alterar a configuração.</p>}
      {editing === 'legal' && readiness?.canManageConfiguration && <div data-testid="legal-profile-form" className="mt-4 space-y-3"><label className="block text-sm font-medium">Nome jurídico<input value={legalName} onChange={event => setLegalName(event.target.value)} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><label className="block text-sm font-medium">Identificação fiscal<input value={taxIdentifier} onChange={event => setTaxIdentifier(event.target.value)} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><label className="block text-sm font-medium">País / jurisdição<input value={jurisdiction} onChange={event => setJurisdiction(event.target.value.toUpperCase())} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><label className="block text-sm font-medium">Morada registada<input value={addressLine1} onChange={event => setAddressLine1(event.target.value)} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><button data-testid="legal-profile-save" type="button" onClick={configure} disabled={saving} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Guardar perfil jurídico</button></div>}
      {editing === 'financial' && readiness?.canManageConfiguration && <div data-testid="financial-profile-form" className="mt-4 space-y-3"><label className="block text-sm font-medium">Jurisdição principal<input value={jurisdiction} onChange={event => setJurisdiction(event.target.value.toUpperCase())} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><label className="block text-sm font-medium">Moeda funcional<input value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><label className="block text-sm font-medium">Fuso horário financeiro<input value={timezone} onChange={event => setTimezone(event.target.value)} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><label className="block text-sm font-medium">Moedas ativas<input value={enabledCurrencies} onChange={event => setEnabledCurrencies(event.target.value)} disabled={saving} className="mt-1 block w-full rounded-md border p-2" /></label><button data-testid="financial-profile-save" type="button" onClick={configure} disabled={saving} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Guardar perfil financeiro</button></div>}
    </>}
    {readiness?.receiptIssuance.status === 'BLOCKED' && readiness.receiptIssuance.reasonCode === 'JURISDICTION_POLICY_UNAVAILABLE' && <div className="mt-4"><AuroraStateNotice tone="warning" title="Emissão oficial indisponível">A configuração local está concluída, mas ainda não existe uma política jurisdicional aprovada. Não é possível criar configuração fiscal, séries ou emitir recibos oficiais.</AuroraStateNotice></div>}
  </section>;
}
