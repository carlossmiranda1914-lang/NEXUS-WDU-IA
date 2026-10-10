import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { FinanceOperationalContextWorkspace } from '../src/components/finance/operational/FinanceOperationalContextWorkspace.tsx';
import { FinanceOperationalContextClient } from '../src/modules/finance/finance-operational-context-client.ts';
import { FinancePaymentCreateView } from '../src/components/finance/payments/FinancePaymentCreateView.tsx';
import { FinanceWorkspace } from '../src/components/finance/FinanceWorkspace.tsx';
import { FinancePaymentsWorkspace } from '../src/components/finance/payments/FinancePaymentsWorkspace.tsx';
import { financeReadinessClient } from '../src/modules/finance/finance-readiness-client.ts';
import type { FinanceOperationalContext } from '../src/modules/finance/finance-operational-context-model.ts';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

function extractText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(' ');
  if (node.props && node.props.children) return extractText(node.props.children);
  return '';
}

const contextA: FinanceOperationalContext = {
  financialAccount: {
    id: '00000000-0000-0000-0000-00000000000A',
    accountNumber: 'CTA-000001',
    name: 'Conta Familiar A',
    status: 'active',
  },
  responsiblePerson: {
    personId: '00000000-0000-0000-0000-00000000001A',
    displayName: 'Responsável A',
    role: 'primary_debtor',
  },
  students: [
    {
      personId: '00000000-0000-0000-0000-00000000002A',
      displayName: 'Aluno A',
      enrollmentId: '00000000-0000-0000-0000-00000000003A',
      enrollmentStatus: 'active',
    },
  ],
  openObligations: [
    {
      id: '00000000-0000-0000-0000-00000000004A',
      description: 'Cobrança A - Mensalidade 10º Ano',
      amount: { amount: '150', currency: 'EUR' },
      effectiveAt: '2026-09-01T00:00:00.000Z',
      dueAt: '2026-09-30T00:00:00.000Z',
      status: 'open',
    },
  ],
  confirmedUnallocatedPayments: [
    {
      id: '00000000-0000-0000-0000-00000000005A',
      paymentReference: 'PAG-000001',
      amount: { amount: '50', currency: 'EUR' },
      method: 'cash',
      effectiveAt: '2026-09-02T00:00:00.000Z',
      status: 'confirmed',
      allocationStatus: 'unapplied',
    },
  ],
  history: [
    {
      id: '00000000-0000-0000-0000-00000000004A',
      occurredAt: '2026-09-01T00:00:00.000Z',
      kind: 'obligation',
      obligation: {
        id: '00000000-0000-0000-0000-00000000004A',
        description: 'Cobrança A - Mensalidade 10º Ano',
        amount: { amount: '150', currency: 'EUR' },
        effectiveAt: '2026-09-01T00:00:00.000Z',
        status: 'open',
      },
    },
    {
      id: '00000000-0000-0000-0000-00000000005A',
      occurredAt: '2026-09-02T00:00:00.000Z',
      kind: 'payment',
      payment: {
        id: '00000000-0000-0000-0000-00000000005A',
        paymentReference: 'PAG-000001',
        amount: { amount: '50', currency: 'EUR' },
        method: 'cash',
        effectiveAt: '2026-09-02T00:00:00.000Z',
        status: 'confirmed',
        allocationStatus: 'unapplied',
      },
    },
  ],
};

const contextB: FinanceOperationalContext = {
  financialAccount: {
    id: '00000000-0000-0000-0000-00000000000B',
    accountNumber: 'CTA-000002',
    name: 'Conta Familiar B',
    status: 'active',
  },
  responsiblePerson: {
    personId: '00000000-0000-0000-0000-00000000001B',
    displayName: 'Responsável B',
    role: 'primary_debtor',
  },
  students: [
    {
      personId: '00000000-0000-0000-0000-00000000002B',
      displayName: 'Aluno B',
      enrollmentId: '00000000-0000-0000-0000-00000000003B',
      enrollmentStatus: 'active',
    },
  ],
  openObligations: [
    {
      id: '00000000-0000-0000-0000-00000000004B',
      description: 'Cobrança B - Propina 11º Ano',
      amount: { amount: '220', currency: 'EUR' },
      effectiveAt: '2026-09-03T00:00:00.000Z',
      dueAt: '2026-10-05T00:00:00.000Z',
      status: 'open',
    },
  ],
  confirmedUnallocatedPayments: [
    {
      id: '00000000-0000-0000-0000-00000000005B',
      paymentReference: 'PAG-000002',
      amount: { amount: '80', currency: 'EUR' },
      method: 'bank_transfer',
      effectiveAt: '2026-09-04T00:00:00.000Z',
      status: 'confirmed',
      allocationStatus: 'unapplied',
    },
  ],
  history: [
    {
      id: '00000000-0000-0000-0000-00000000004B',
      occurredAt: '2026-09-03T00:00:00.000Z',
      kind: 'obligation',
      obligation: {
        id: '00000000-0000-0000-0000-00000000004B',
        description: 'Cobrança B - Propina 11º Ano',
        amount: { amount: '220', currency: 'EUR' },
        effectiveAt: '2026-09-03T00:00:00.000Z',
        status: 'open',
      },
    },
    {
      id: '00000000-0000-0000-0000-00000000005B',
      occurredAt: '2026-09-04T00:00:00.000Z',
      kind: 'payment',
      payment: {
        id: '00000000-0000-0000-0000-00000000005B',
        paymentReference: 'PAG-000002',
        amount: { amount: '80', currency: 'EUR' },
        method: 'bank_transfer',
        effectiveAt: '2026-09-04T00:00:00.000Z',
        status: 'confirmed',
        allocationStatus: 'unapplied',
      },
    },
  ],
};

test('STALE_A_AFTER_B_BLOCKED: Race condition where Account A resolves after Account B does not overwrite B context', async () => {
  const origGetById = FinanceOperationalContextClient.prototype.getByFinancialAccountId;
  const origSearch = FinanceOperationalContextClient.prototype.searchFinancialAccounts;

  let resolveA!: (ctx: FinanceOperationalContext) => void;
  let resolveB!: (ctx: FinanceOperationalContext) => void;

  const promiseA = new Promise<FinanceOperationalContext>((res) => { resolveA = res; });
  const promiseB = new Promise<FinanceOperationalContext>((res) => { resolveB = res; });

  FinanceOperationalContextClient.prototype.getByFinancialAccountId = async (id: string) => {
    if (id === contextA.financialAccount.id) return promiseA;
    if (id === contextB.financialAccount.id) return promiseB;
    throw new Error('Not found');
  };

  FinanceOperationalContextClient.prototype.searchFinancialAccounts = async () => {
    return [contextA.financialAccount as any, contextB.financialAccount as any];
  };

  try {
    let renderer: any;
    await act(async () => {
      renderer = create(
        React.createElement(FinanceOperationalContextWorkspace, {
          theme: 'light',
          readinessState: { kind: 'READINESS_READY', value: { module: 'FINANCE', status: 'READY', canManageConfiguration: false, requirements: [], receiptIssuance: { status: 'READY' }, localPrerequisitesComplete: true, jurisdictionPolicyAvailable: true, fiscalConfigurationAvailable: true, seriesConfigurationAvailable: true, paymentCurrency: { functionalCurrency: 'EUR', enabledCurrencies: ['EUR'] } } },
        })
      );
      await flush();
    });

    const root = renderer.root;

    // 1. Perform search to get candidate accounts
    const searchForm = root.findByType('form');
    await act(async () => {
      searchForm.props.onSubmit({ preventDefault: () => {} });
      await flush();
    });

    // 2. Select Account A (initiates loadContext for Account A)
    const selectBtnA = root.findByProps({ 'data-testid': `finance-select-account-btn-${contextA.financialAccount.id}` });
    await act(async () => {
      selectBtnA.props.onClick();
      await flush();
    });

    // 3. Before Account A resolves, user switches / selects Account B
    const selectBtnB = root.findByProps({ 'data-testid': `finance-select-account-btn-${contextB.financialAccount.id}` });
    await act(async () => {
      selectBtnB.props.onClick();
      await flush();
    });

    // 4. Resolve Account B FIRST
    await act(async () => {
      resolveB(contextB);
      await flush();
    });

    // 5. Verify Account B context is rendered and visible across all sections
    const assertAccountBContextState = () => {
      // Account Header = B
      const title = root.findByProps({ 'data-testid': 'finance-account-title' });
      const titleText = extractText(title);
      assert.ok(titleText.includes('CTA-000002'), 'Header must display Account B number');
      assert.ok(titleText.includes('Conta Familiar B'), 'Header must display Account B name');
      assert.ok(!titleText.includes('CTA-000001'), 'Header must NOT display Account A number');
      assert.ok(!titleText.includes('Conta Familiar A'), 'Header must NOT display Account A name');

      // Responsible Person = B
      const resp = root.findByProps({ 'data-testid': 'finance-responsible-person-name' });
      assert.equal(resp.props.children, 'Responsável B', 'Responsible person must be B');

      // Associated Student = B
      const headerText = extractText(root.findByProps({ 'data-testid': 'finance-operational-header' }));
      assert.ok(headerText.includes('Aluno B'), 'Associated student must be B');
      assert.ok(!headerText.includes('Aluno A'), 'Associated student must NOT be A');

      // Open Obligations = B
      const obText = extractText(root.findByProps({ 'data-testid': 'finance-panel-open-obligations' }));
      assert.ok(obText.includes('Cobrança B - Propina 11º Ano'), 'Obligations panel must display B charge');
      assert.ok(obText.includes('220'), 'Obligations panel must display B amount');
      assert.ok(!obText.includes('Cobrança A - Mensalidade 10º Ano'), 'Obligations panel must NOT display A charge');

      // Unapplied Payments = B
      const payText = extractText(root.findByProps({ 'data-testid': 'finance-panel-unallocated-payments' }));
      assert.ok(payText.includes('PAG-000002'), 'Payments panel must display B payment ref');
      assert.ok(payText.includes('80'), 'Payments panel must display B payment amount');
      assert.ok(!payText.includes('PAG-000001'), 'Payments panel must NOT display A payment ref');

      // History = B
      const histText = extractText(root.findByProps({ 'data-testid': 'finance-operational-history' }));
      assert.ok(histText.includes('Cobrança B - Propina 11º Ano'), 'History must include B charge');
      assert.ok(histText.includes('PAG-000002'), 'History must include B payment');
      assert.ok(!histText.includes('Cobrança A - Mensalidade 10º Ano'), 'History must NOT include A charge');
      assert.ok(!histText.includes('PAG-000001'), 'History must NOT include A payment');
    };

    assertAccountBContextState();

    // 6. Resolve Account A AFTERWARDS (late delayed response)
    await act(async () => {
      resolveA(contextA);
      await flush();
    });

    // 7. Prove Account A does NOT repaint or overwrite any section
    assertAccountBContextState();

    // 8. Prove Payment Action binds strictly to Account B
    const registerPaymentBtn = root.findByProps({ 'data-testid': 'finance-register-payment-button' });
    assert.ok(registerPaymentBtn);
    await act(async () => {
      registerPaymentBtn.props.onClick();
      await flush();
    });

    const paymentViewText = JSON.stringify(renderer.toJSON());
    assert.ok(paymentViewText.includes('Registar recebimento'), 'Payment view must open');
    assert.ok(paymentViewText.includes('CTA-000002'), 'Payment view must bind to Account B number');
    assert.ok(paymentViewText.includes('Conta Familiar B'), 'Payment view must bind to Account B name');
    assert.ok(paymentViewText.includes('Responsável B'), 'Payment view must bind to Responsável B');
    assert.ok(!paymentViewText.includes('CTA-000001'), 'Payment view must NOT bind to Account A');
    assert.ok(!paymentViewText.includes('Responsável A'), 'Payment view must NOT bind to Responsável A');
    const paymentCreate = root.findByType(FinancePaymentCreateView);
    assert.deepEqual(paymentCreate.props.currencyOptions, ['EUR'], 'Financial Situation payment flow must receive the institutional enabled currencies');
    assert.equal(paymentCreate.props.defaultCurrency, 'EUR', 'Financial Situation payment flow must receive the institutional functional currency');
    const currencySelect = root.findByProps({ 'data-testid': 'finance-payment-currency-select' });
    assert.deepEqual(currencySelect.findAllByType('option').map(option => option.props.value), ['', 'EUR'], 'Financial Situation payment currency selector must render EUR as an option');
  } finally {
    FinanceOperationalContextClient.prototype.getByFinancialAccountId = origGetById;
    FinanceOperationalContextClient.prototype.searchFinancialAccounts = origSearch;
  }
});

test('DIRECT_CONTEXT_BYPASSES_GENERIC_SEARCH: Direct studentRef context resolution renders operational context without generic search', async () => {
  const origGetContext = FinanceOperationalContextClient.prototype.getOperationalContext;
  let searchCalled = false;
  const origSearch = FinanceOperationalContextClient.prototype.searchFinancialAccounts;

  FinanceOperationalContextClient.prototype.getOperationalContext = async (query) => {
    if (query.studentRef === 'stu_student_b_12345678') {
      return contextB;
    }
    throw new Error('Not found');
  };

  FinanceOperationalContextClient.prototype.searchFinancialAccounts = async () => {
    searchCalled = true;
    return [];
  };

  try {
    let renderer: any;
    await act(async () => {
      renderer = create(
        React.createElement(FinanceOperationalContextWorkspace, {
          theme: 'light',
          initialContextQuery: { studentRef: 'stu_student_b_12345678' },
        })
      );
      await flush();
    });

    const root = renderer.root;
    // Verify context B was rendered immediately
    const text = JSON.stringify(renderer.toJSON());
    assert.ok(text.includes('CTA-000002'), 'Direct Student context must render Account B number');
    assert.ok(text.includes('Conta Familiar B'), 'Direct Student context must render Account B name');
    assert.ok(text.includes('Responsável B'), 'Direct Student context must render Responsável B');
    assert.ok(text.includes('Aluno B'), 'Direct Student context must render Aluno B');

    // Generic search was NOT rendered or called
    assert.equal(searchCalled, false, 'Generic search must not be invoked during direct student context');
    assert.throws(
      () => root.findByProps({ 'data-testid': 'finance-explicit-account-selection' }),
      'Generic account selection view must NOT be rendered when direct studentRef is provided'
    );
  } finally {
    FinanceOperationalContextClient.prototype.getOperationalContext = origGetContext;
    FinanceOperationalContextClient.prototype.searchFinancialAccounts = origSearch;
  }
});

test('CONTEXTUAL_PAYMENT_LATE_READINESS: EUR is selected after readiness resolves without remounting the payment flow', async () => {
  const origGetById = FinanceOperationalContextClient.prototype.getByFinancialAccountId;
  const origSearch = FinanceOperationalContextClient.prototype.searchFinancialAccounts;

  FinanceOperationalContextClient.prototype.getByFinancialAccountId = async () => contextA;
  FinanceOperationalContextClient.prototype.searchFinancialAccounts = async () => [contextA.financialAccount as any];

  try {
    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(FinanceOperationalContextWorkspace, { theme: 'light', readinessState: { kind: 'READINESS_LOADING' } }));
      await flush();
    });

    const root = renderer.root;
    await act(async () => {
      root.findByType('form').props.onSubmit({ preventDefault: () => {} });
      await flush();
    });
    await act(async () => {
      root.findByProps({ 'data-testid': `finance-select-account-btn-${contextA.financialAccount.id}` }).props.onClick();
      await flush();
    });
    await act(async () => {
      root.findByProps({ 'data-testid': 'finance-register-payment-button' }).props.onClick();
      await flush();
    });

    const currency = () => root.findByProps({ 'data-testid': 'finance-payment-currency-select' });
    assert.equal(currency().props.value, '', 'The form must begin without a currency while readiness is pending');
    assert.deepEqual(currency().findAllByType('option').map(option => option.props.value), ['']);

    await act(async () => {
      renderer.update(React.createElement(FinanceOperationalContextWorkspace, { theme: 'light', readinessState: { kind: 'READINESS_READY', value: { module: 'FINANCE', status: 'READY', canManageConfiguration: false, requirements: [], receiptIssuance: { status: 'READY' }, localPrerequisitesComplete: true, jurisdictionPolicyAvailable: true, fiscalConfigurationAvailable: true, seriesConfigurationAvailable: true, paymentCurrency: { functionalCurrency: 'EUR', enabledCurrencies: ['EUR'] } } } }));
      await flush();
    });

    assert.equal(currency().props.value, 'EUR');
    assert.deepEqual(currency().findAllByType('option').map(option => option.props.value), ['', 'EUR']);
  } finally {
    FinanceOperationalContextClient.prototype.getByFinancialAccountId = origGetById;
    FinanceOperationalContextClient.prototype.searchFinancialAccounts = origSearch;
  }
});

test('FINANCE_WORKSPACE_CONTEXTUAL_PAYMENT_LATE_READINESS: parent-owned EUR reaches the mounted Financial Situation payment selector', async () => {
  const origGetById = FinanceOperationalContextClient.prototype.getByFinancialAccountId;
  const origSearch = FinanceOperationalContextClient.prototype.searchFinancialAccounts;
  const origReadiness = financeReadinessClient.get;
  let resolveReadiness!: (value: any) => void;
  let readinessRequests = 0;

  FinanceOperationalContextClient.prototype.getByFinancialAccountId = async () => contextA;
  FinanceOperationalContextClient.prototype.searchFinancialAccounts = async () => [contextA.financialAccount as any];
  financeReadinessClient.get = () => {
    readinessRequests += 1;
    return new Promise(resolve => { resolveReadiness = resolve; });
  };

  try {
    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(FinanceWorkspace, { theme: 'light' }));
      await flush();
    });

    const root = renderer.root;
    await act(async () => {
      root.findByType('form').props.onSubmit({ preventDefault: () => {} });
      await flush();
    });
    await act(async () => {
      root.findByProps({ 'data-testid': `finance-select-account-btn-${contextA.financialAccount.id}` }).props.onClick();
      await flush();
    });
    await act(async () => {
      root.findByProps({ 'data-testid': 'finance-register-payment-button' }).props.onClick();
      await flush();
    });

    const currency = () => root.findByProps({ 'data-testid': 'finance-payment-currency-select' });
    assert.deepEqual(currency().findAllByType('option').map(option => option.props.value), ['']);
    assert.match(JSON.stringify(renderer.toJSON()), /CTA-000001/);
    assert.equal(readinessRequests, 1, 'Financial Situation must not create an independent readiness request');

    await act(async () => {
      resolveReadiness({
        module: 'FINANCE', status: 'READY', canManageConfiguration: false, requirements: [], receiptIssuance: { status: 'READY' },
        localPrerequisitesComplete: true, jurisdictionPolicyAvailable: true, fiscalConfigurationAvailable: true, seriesConfigurationAvailable: true,
        paymentCurrency: { functionalCurrency: 'EUR', enabledCurrencies: ['EUR'] },
      });
      await flush();
    });

    assert.equal(currency().props.value, 'EUR');
    assert.deepEqual(currency().findAllByType('option').map(option => option.props.value), ['', 'EUR']);
    assert.match(JSON.stringify(renderer.toJSON()), /CTA-000001/, 'Readiness updates must preserve the contextual account');
    assert.equal(readinessRequests, 1);

    await act(async () => {
      root.findByProps({ 'data-testid': 'finance-tab-recebimentos' }).props.onClick();
      await flush();
    });
    const payments = root.findByType(FinancePaymentsWorkspace);
    assert.equal(payments.props.readinessState.kind, 'READINESS_READY');
    assert.deepEqual(payments.props.readinessState.value.paymentCurrency.enabledCurrencies, ['EUR']);
    assert.equal(readinessRequests, 1);
  } finally {
    FinanceOperationalContextClient.prototype.getByFinancialAccountId = origGetById;
    FinanceOperationalContextClient.prototype.searchFinancialAccounts = origSearch;
    financeReadinessClient.get = origReadiness;
  }
});
