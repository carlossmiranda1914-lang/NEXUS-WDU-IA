import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { FinancialObligationsWorkspace } from '../src/components/finance/obligations/FinancialObligationsWorkspace.tsx';
import { FinanceWorkspace } from '../src/components/finance/FinanceWorkspace.tsx';
import { financialObligationClient } from '../src/modules/finance/financial-obligation-client.ts';
import type { FinancialObligationRecord, FinancialAccountRecord, PersonOptionRecord } from '../src/modules/finance/financial-obligation-client.ts';
import type { FeeCatalogueRecord } from '../src/modules/finance/fee-catalogue-client.ts';
import { feeCatalogueClient } from '../src/modules/finance/fee-catalogue-client.ts';

const sampleAccounts: FinancialAccountRecord[] = [
  {
    id: 'acc-001',
    institutionId: 'inst-001',
    accountNumber: 'FA-2026-000001',
    name: 'Conta Familiar',
    status: 'active',
    parties: [
      {
        id: 'party-001',
        financialAccountId: 'acc-001',
        personId: 'person-001',
        role: 'primary_debtor',
        status: 'active',
      },
    ],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];

const samplePersons: PersonOptionRecord[] = [
  {
    id: 'person-001',
    name: 'Maria Antónia Santos',
    email: 'maria.santos@example.com',
  },
  {
    id: 'person-002',
    name: 'João Pedro Silva (Aluno)',
    email: 'joao.silva@example.com',
  },
];

const sampleFeeItems: FeeCatalogueRecord[] = [
  {
    id: 'fee-001',
    feeTypeId: 'type-001',
    feeType: {
      id: 'type-001',
      canonicalKey: 'tuition',
      displayName: 'Propina Regular',
      codePrefix: 'PROP',
    },
    code: 'PROP-000001',
    status: 'active',
    currentVersion: 2,
    current: {
      feeTypeId: 'type-001',
      name: 'Propina Anual 2026/2027',
      kind: 'tuition',
      description: 'Propina oficial',
      money: { amount: '120.00', currency: 'EUR' },
      effectiveFrom: '2026-09-01T00:00:00.000Z',
    },
    history: [],
  },
];

const sampleObligations: FinancialObligationRecord[] = [
  {
    id: 'ob-001',
    institutionId: 'inst-001',
    financialAccountId: 'acc-001',
    accountNumber: 'FA-2026-000001',
    accountName: 'Conta Familiar',
    beneficiaryPersonId: 'person-002',
    beneficiaryName: 'João Pedro Silva (Aluno)',
    sourceType: 'manual_finance',
    sourceRef: 'MAN-2026-001',
    feeCatalogueItemId: 'fee-001',
    feeCatalogueVersion: 2,
    feeItemCode: 'PROP-000001',
    feeItemName: 'Propina Anual 2026/2027',
    money: {
      amount: '120.00',
      currency: 'EUR',
    },
    effectiveAt: '2026-09-05T00:00:00.000Z',
    dueAt: '2026-09-30T00:00:00.000Z',
    status: 'open',
    financialProfileVersion: 1,
    createdByPersonId: 'admin-001',
    idempotencyKey: 'idem-ob-001',
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z',
  },
];

test('FinancialObligationsWorkspace renders list of obligations with correct data', async () => {
  const origListOb = financialObligationClient.listObligations;
  financialObligationClient.listObligations = async () => sampleObligations;

  let renderer: any;
  await act(async () => {
    renderer = create(React.createElement(FinancialObligationsWorkspace, { theme: 'light' }));
  });

  const tree = renderer.toJSON();
  assert.ok(tree, 'Workspace rendered');

  // Check obligation code, amount, status
  const jsonStr = JSON.stringify(tree);
  assert.ok(jsonStr.includes('PROP-000001'), 'Fee code displayed');
  assert.ok(jsonStr.includes('120.00'), 'Obligation amount displayed');
  assert.ok(jsonStr.includes('FA-2026-000001'), 'Account display reference displayed');
  assert.ok(jsonStr.includes('João Pedro Silva (Aluno)'), 'Beneficiary displayed');
  assert.ok(jsonStr.includes('manual_finance'), 'Source type displayed');

  financialObligationClient.listObligations = origListOb;
});

test('FinancialObligationsWorkspace subview transition to Create Obligation and back', async () => {
  const origListOb = financialObligationClient.listObligations;
  const origListAcc = financialObligationClient.listAccounts;
  const origListFee = feeCatalogueClient.list;
  const origListPersons = financialObligationClient.listPersonOptions;

  financialObligationClient.listObligations = async () => sampleObligations;
  financialObligationClient.listAccounts = async () => sampleAccounts;
  feeCatalogueClient.list = async () => sampleFeeItems;
  financialObligationClient.listPersonOptions = async () => samplePersons;

  let renderer: any;
  await act(async () => {
    renderer = create(React.createElement(FinancialObligationsWorkspace, { theme: 'light' }));
  });

  // Find "Nova obrigação" button
  const root = renderer.root;
  const newBtn = root.findByProps({ 'data-testid': 'new-obligation-button' });
  assert.ok(newBtn, 'Nova obrigação button exists');

  await act(async () => {
    newBtn.props.onClick();
  });

  // Now in create view
  const createViewTitle = root.findByProps({ 'data-testid': 'create-obligation-title' });
  assert.ok(createViewTitle, 'Navigated to create view');

  // Verify amount is not a freely editable input but read-only snapshot info
  const amountInput = root.findAllByProps({ 'data-testid': 'fee-amount-display' });
  assert.ok(amountInput.length > 0, 'Amount display element exists');

  // Cancel back to list
  const cancelBtn = root.findByProps({ 'data-testid': 'cancel-obligation-button' });
  await act(async () => {
    cancelBtn.props.onClick();
  });

  // Back to list
  const listTitle = root.findByProps({ 'data-testid': 'obligations-list-title' });
  assert.ok(listTitle, 'Returned to obligations list');

  financialObligationClient.listObligations = origListOb;
  financialObligationClient.listAccounts = origListAcc;
  feeCatalogueClient.list = origListFee;
  financialObligationClient.listPersonOptions = origListPersons;
});

test('FinancialObligationsWorkspace subview transition to Manage Accounts and back', async () => {
  const origListOb = financialObligationClient.listObligations;
  const origListAcc = financialObligationClient.listAccounts;
  const origListPersons = financialObligationClient.listPersonOptions;

  financialObligationClient.listObligations = async () => sampleObligations;
  financialObligationClient.listAccounts = async () => sampleAccounts;
  financialObligationClient.listPersonOptions = async () => samplePersons;

  let renderer: any;
  await act(async () => {
    renderer = create(React.createElement(FinancialObligationsWorkspace, { theme: 'light' }));
  });

  const root = renderer.root;
  const manageAccBtn = root.findByProps({ 'data-testid': 'manage-accounts-button' });
  assert.ok(manageAccBtn, 'Gerir contas financeiras button exists');

  await act(async () => {
    manageAccBtn.props.onClick();
  });

  // Now in accounts view
  const accountsTitle = root.findByProps({ 'data-testid': 'accounts-view-title' });
  assert.ok(accountsTitle, 'Navigated to accounts view');

  // Back to list
  const backBtn = root.findByProps({ 'data-testid': 'accounts-back-button' });
  await act(async () => {
    backBtn.props.onClick();
  });

  const listTitle = root.findByProps({ 'data-testid': 'obligations-list-title' });
  assert.ok(listTitle, 'Returned to obligations list');

  financialObligationClient.listObligations = origListOb;
  financialObligationClient.listAccounts = origListAcc;
  financialObligationClient.listPersonOptions = origListPersons;
});

test('FinanceWorkspace switches between Catálogo de Emolumentos and Obrigações Financeiras tabs', async () => {
  const origListOb = financialObligationClient.listObligations;
  const origListFee = feeCatalogueClient.list;
  financialObligationClient.listObligations = async () => sampleObligations;
  feeCatalogueClient.list = async () => sampleFeeItems;

  let renderer: any;
  await act(async () => {
    renderer = create(React.createElement(FinanceWorkspace, { theme: 'light', initialTab: 'catalogue' }));
  });

  const root = renderer.root;
  const catTab = root.findByProps({ 'data-testid': 'finance-tab-catalogue' });
  const obTab = root.findByProps({ 'data-testid': 'finance-tab-obligations' });
  assert.ok(catTab && obTab, 'Both Finance tabs exist');

  // Switch to Obligations
  await act(async () => {
    obTab.props.onClick();
  });

  const obListTitle = root.findByProps({ 'data-testid': 'obligations-list-title' });
  assert.ok(obListTitle, 'Switched to obligations view');

  // Switch back to Catalogue
  await act(async () => {
    catTab.props.onClick();
  });

  const jsonStr = JSON.stringify(renderer.toJSON());
  assert.ok(jsonStr.includes('Catálogo de Emolumentos'), 'Catalogue view rendered');

  financialObligationClient.listObligations = origListOb;
  feeCatalogueClient.list = origListFee;
});
