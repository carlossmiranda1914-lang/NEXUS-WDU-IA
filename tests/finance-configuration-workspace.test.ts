import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { FinanceConfigurationWorkspace } from '../src/components/finance/configuration/FinanceConfigurationWorkspace.tsx';
import type { FinanceReadinessDto } from '../src/modules/finance/finance-readiness-client.ts';

const blockedWithMissingLegalProfile: FinanceReadinessDto = {
  module: 'FINANCE', status: 'BLOCKED', canManageConfiguration: true,
  requirements: [
    { code: 'INSTITUTION_LEGAL_PROFILE', state: 'MISSING' },
    { code: 'FINANCIAL_PROFILE', state: 'MISSING' },
    { code: 'FISCAL_CONFIGURATION', state: 'BLOCKED' },
    { code: 'RECEIPT_SERIES', state: 'BLOCKED' },
  ],
  receiptIssuance: { status: 'BLOCKED', reasonCode: 'JURISDICTION_POLICY_UNAVAILABLE' },
  localPrerequisitesComplete: false,
  jurisdictionPolicyAvailable: false,
  fiscalConfigurationAvailable: false,
  seriesConfigurationAvailable: false,
};

const blockedWithMissingFinancialProfile: FinanceReadinessDto = {
  ...blockedWithMissingLegalProfile,
  requirements: blockedWithMissingLegalProfile.requirements.map((requirement) => requirement.code === 'INSTITUTION_LEGAL_PROFILE'
    ? { ...requirement, state: 'COMPLETE' }
    : requirement),
};

const blockedAfterLocalConfiguration: FinanceReadinessDto = {
  ...blockedWithMissingLegalProfile,
  requirements: blockedWithMissingLegalProfile.requirements.map((requirement) => requirement.code === 'INSTITUTION_LEGAL_PROFILE' || requirement.code === 'FINANCIAL_PROFILE'
    ? { ...requirement, state: 'COMPLETE' }
    : requirement),
  localPrerequisitesComplete: true,
};

const completeProfilesWithLocalGaps: FinanceReadinessDto = {
  module: 'FINANCE', status: 'INCOMPLETE', canManageConfiguration: true,
  requirements: [
    { code: 'INSTITUTION_LEGAL_PROFILE', state: 'COMPLETE' },
    { code: 'FINANCIAL_PROFILE', state: 'COMPLETE' },
    { code: 'FISCAL_CONFIGURATION', state: 'MISSING' },
    { code: 'RECEIPT_SERIES', state: 'MISSING' },
  ],
  receiptIssuance: { status: 'BLOCKED', reasonCode: 'FINANCE_MODULE_NOT_READY' },
  localPrerequisitesComplete: true,
  jurisdictionPolicyAvailable: true,
  fiscalConfigurationAvailable: true,
  seriesConfigurationAvailable: true,
};

const baseConfigurationReady: FinanceReadinessDto = {
  ...completeProfilesWithLocalGaps,
  status: 'READY',
  requirements: completeProfilesWithLocalGaps.requirements.map((requirement) => ({ ...requirement, state: 'COMPLETE' })),
  receiptIssuance: { status: 'BLOCKED', reasonCode: 'AGT_ONBOARDING_REQUIRED' },
};

function hasText(renderer: any, text: string) {
  return JSON.stringify(renderer.toJSON()).includes(text);
}

test('keeps the legal-profile configuration path actionable when official issuance is blocked later by jurisdiction policy', async () => {
  let current = blockedWithMissingLegalProfile;
  const calls: string[] = [];
  const readinessClient = {
    get: async () => current,
    createLegalProfile: async () => { calls.push('legal'); current = blockedWithMissingFinancialProfile; },
    createFinancialProfile: async () => { calls.push('financial'); current = blockedAfterLocalConfiguration; },
  };

  let renderer: any;
  await act(async () => {
    renderer = create(React.createElement(FinanceConfigurationWorkspace, { readinessClient: readinessClient as any }));
  });

  const root = renderer.root;
  const legalAction = root.findAllByType('button').find((button: any) => button.children.join('') === 'Configurar perfil jurídico');
  assert.ok(legalAction, 'a missing legal profile must remain actionable despite a later jurisdiction block');

  await act(async () => { legalAction.props.onClick(); });
  assert.ok(root.findByProps({ 'data-testid': 'legal-profile-form' }));
  assert.ok(hasText(renderer, 'Nome jurídico'));
  assert.ok(hasText(renderer, 'Identificação fiscal'));
  assert.ok(hasText(renderer, 'País / jurisdição'));
  assert.ok(hasText(renderer, 'Morada registada'));

  await act(async () => {
    root.findByProps({ 'data-testid': 'legal-profile-save' }).props.onClick();
  });
  assert.deepEqual(calls, ['legal']);
  assert.ok(hasText(renderer, 'Configurar perfil financeiro'), 'saving the legal profile must refresh readiness to the next actionable prerequisite');

  const financialAction = root.findAllByType('button').find((button: any) => button.children.join('') === 'Configurar perfil financeiro');
  await act(async () => { financialAction.props.onClick(); });
  assert.ok(root.findByProps({ 'data-testid': 'financial-profile-form' }));
  assert.ok(hasText(renderer, 'Jurisdição principal'));
  assert.ok(hasText(renderer, 'Moeda funcional'));
  assert.ok(hasText(renderer, 'Fuso horário financeiro'));
  assert.ok(hasText(renderer, 'Moedas ativas'));

  await act(async () => {
    root.findByProps({ 'data-testid': 'financial-profile-save' }).props.onClick();
  });
  assert.deepEqual(calls, ['legal', 'financial']);
  assert.ok(hasText(renderer, 'política jurisdicional aprovada'));
  assert.ok(!hasText(renderer, 'Criar configuração fiscal'));
  assert.ok(!hasText(renderer, 'Criar série'));
  assert.ok(!hasText(renderer, 'Emitir recibo oficial'));
});

test('does not expose configuration mutations to a read-only user', async () => {
  const readinessClient = { get: async () => ({ ...blockedWithMissingLegalProfile, canManageConfiguration: false }) };
  let renderer: any;
  await act(async () => {
    renderer = create(React.createElement(FinanceConfigurationWorkspace, { readinessClient: readinessClient as any }));
  });

  assert.ok(hasText(renderer, 'não tem permissão para alterar a configuração'));
  assert.equal(renderer.root.findAllByType('button').length, 0);
});

test('renders complete profiles and missing local resources instead of an empty configuration screen', async () => {
  let renderer: any;
  await act(async () => {
    renderer = create(React.createElement(FinanceConfigurationWorkspace, { readinessClient: { get: async () => completeProfilesWithLocalGaps } as any }));
  });
  const text = JSON.stringify(renderer.toJSON());
  assert.match(text, /Perfil jurídico institucional.*Concluído/);
  assert.match(text, /Perfil financeiro institucional.*Concluído/);
  assert.match(text, /Configuração fiscal.*Em falta/);
  assert.match(text, /Série de recibos.*Em falta/);
  assert.match(text, /Recurso local Nexus/);
  assert.doesNotMatch(text, /Configurar perfil jurídico/);
  assert.doesNotMatch(text, /Configurar perfil financeiro/);
});

test('describes READY as base configuration rather than universal Finance or AO-production readiness', async () => {
  let renderer: any;
  await act(async () => {
    renderer = create(React.createElement(FinanceConfigurationWorkspace, { readinessClient: { get: async () => baseConfigurationReady } as any }));
  });
  const text = JSON.stringify(renderer.toJSON());
  assert.match(text, /Configuração base concluída/);
  assert.match(text, /A prontidão de emissão é avaliada separadamente por tipo de documento/);
  assert.match(text, /requisitos externos da AGT/);
  assert.doesNotMatch(text, /Finance pronta/);
  assert.doesNotMatch(text, /Finance operacionalmente pronta/);
});

test('exits loading with an explicit error when readiness fails', async () => {
  let renderer: any;
  await act(async () => {
    renderer = create(React.createElement(FinanceConfigurationWorkspace, { readinessClient: { get: async () => { throw new Error('TOKEN_ACQUISITION_TIMEOUT'); } } as any }));
  });
  assert.ok(hasText(renderer, 'Não foi possível confirmar a configuração financeira atual.'));
  assert.ok(!hasText(renderer, 'A carregar configuração financeira'));
});

test('shows current authoritative configuration and opens versioned profile actions without inventing AO production actions', async () => {
  const readinessClient = {
    get: async () => completeProfilesWithLocalGaps,
    getLegalProfile: async () => ({ item: { legalName: 'Escola UAT', taxIdentifier: 'AO-1', registeredAddress: { line1: 'Rua UAT' }, effectiveFrom: '2026-09-01T00:00:00.000Z' } }),
    getFinancialProfile: async () => ({ item: { primaryJurisdiction: 'AO', functionalCurrency: 'AOA', financialTimezone: 'Africa/Luanda', enabledCurrencies: ['AOA'], effectiveFrom: '2026-09-01T00:00:00.000Z' } }),
    listFiscalConfigurations: async () => ({ items: [] }),
    listDocumentSeries: async () => ({ items: [] }),
  };
  let renderer: any;
  await act(async () => { renderer = create(React.createElement(FinanceConfigurationWorkspace, { readinessClient: readinessClient as any })); });
  const text = JSON.stringify(renderer.toJSON());
  assert.match(text, /Escola UAT/);
  assert.match(text, /AOA/);
  assert.match(text, /Atualizar perfil jurídico/);
  assert.match(text, /Atualizar perfil financeiro/);
  assert.match(text, /As alterações criam uma nova versão efetiva do perfil\. A versão atual permanece preservada\./);
  assert.match(text, /As alterações criam uma nova versão efetiva do perfil financeiro\. A versão atual permanece preservada\./);
  assert.doesNotMatch(text, /atualização substitui o registo histórico/i);
  assert.match(text, /Configuração fiscal/);
  assert.match(text, /recibos/);
  assert.match(text, /faturas/);
  assert.match(text, /AGT/);
  assert.doesNotMatch(text, /Criar configuração fiscal de produção/);
});
