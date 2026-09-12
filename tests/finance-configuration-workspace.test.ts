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
