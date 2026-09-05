import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { FinancePaymentsWorkspace } from '../src/components/finance/payments/FinancePaymentsWorkspace.tsx';
import { FinancePaymentsListView } from '../src/components/finance/payments/FinancePaymentsListView.tsx';
import { FinancePaymentCreateView } from '../src/components/finance/payments/FinancePaymentCreateView.tsx';
import { FinancePaymentProvidersView } from '../src/components/finance/payments/FinancePaymentProvidersView.tsx';
import { FinanceWorkspace } from '../src/components/finance/FinanceWorkspace.tsx';
import { paymentClient } from '../src/modules/finance/payment-client.ts';
import type { Payment } from '../src/modules/finance/payment-model.ts';
import type { PaymentProviderConfigPublicProjection } from '../src/modules/finance/payment-provider-model.ts';

const samplePayments: Payment[] = [
  {
    id: 'pay-001',
    institutionId: 'inst-001',
    paymentReference: 'PAG-000001',
    journalTransactionId: 'j-001',
    sourceType: 'manual_offline',
    method: 'cash',
    amount: '150',
    currency: 'EUR',
    status: 'confirmed',
    allocationStatus: 'unapplied',
    effectiveAt: '2026-09-05T10:00:00.000Z',
    confirmedAt: '2026-09-05T10:00:00.000Z',
    createdAt: '2026-09-05T10:00:00.000Z',
    financialProfileVersion: 1,
    actorPersonId: 'actor-001',
  },
];

const sampleConfigs: PaymentProviderConfigPublicProjection[] = [
  {
    id: 'cfg-001',
    institutionId: 'inst-001',
    providerKey: 'adyen',
    environment: 'test',
    status: 'active',
    merchantAccountRef: 'MerchantPT',
    supportedCurrencies: ['EUR'],
    enabledMethods: ['card', 'mbway'],
    operationalAvailability: 'available',
    createdAt: '2026-09-05T10:00:00.000Z',
    updatedAt: '2026-09-05T10:00:00.000Z',
  },
];

test('FinancePaymentsListView renders payment records with Confirmado and Não aplicado badges', async () => {
  let component: any;
  await act(async () => {
    component = create(
      React.createElement(FinancePaymentsListView, {
        payments: samplePayments,
        loading: false,
        error: null,
        theme: 'light',
        onRefresh: () => {},
        onOpenCreate: () => {},
        onOpenProviders: () => {},
      })
    );
  });

  const root = component.root;
  const table = root.findByProps({ 'data-testid': 'finance-payments-table' });
  assert.ok(table);

  const text = JSON.stringify(component.toJSON());
  assert.ok(text.includes('PAG-000001'));
  assert.ok(text.includes('150'));
  assert.ok(text.includes('EUR'));
  assert.ok(text.includes('Confirmado'));
  assert.ok(text.includes('Não aplicado'));
});

test('FinancePaymentsListView renders empty state when no payments exist', async () => {
  let component: any;
  await act(async () => {
    component = create(
      React.createElement(FinancePaymentsListView, {
        payments: [],
        loading: false,
        error: null,
        theme: 'light',
        onRefresh: () => {},
        onOpenCreate: () => {},
        onOpenProviders: () => {},
      })
    );
  });

  const root = component.root;
  const emptyState = root.findByProps({ 'data-testid': 'finance-payments-empty' });
  assert.ok(emptyState);
});

test('FinancePaymentCreateView allows validating input and reviewing before submit', async () => {
  let createdPayment: Payment | null = null;
  const origConfirm = paymentClient.confirmManualPayment;
  paymentClient.confirmManualPayment = async (input) => {
    return {
      payment: {
        ...samplePayments[0],
        amount: input.amount,
        currency: input.currency,
        method: input.method,
      },
      replayed: false,
    };
  };

  try {
    let renderer: any;
    await act(async () => {
      renderer = create(
        React.createElement(FinancePaymentCreateView, {
          theme: 'light',
          onSuccess: (p) => { createdPayment = p; },
          onCancel: () => {},
        })
      );
    });

    const root = renderer.root;
    const amountInput = root.findByProps({ 'data-testid': 'finance-payment-amount-input' });
    await act(async () => {
      amountInput.props.onChange({ target: { value: '250.00' } });
    });

    const form = root.findByType('form');
    await act(async () => {
      form.props.onSubmit({ preventDefault: () => {} });
    });

    // Review screen is now shown
    const confirmBtn = root.findByProps({ 'data-testid': 'finance-payment-confirm-btn' });
    assert.ok(confirmBtn);

    await act(async () => {
      confirmBtn.props.onClick();
    });

    assert.ok(createdPayment);
    assert.equal((createdPayment as Payment).amount, '250.00');
  } finally {
    paymentClient.confirmManualPayment = origConfirm;
  }
});

test('FinancePaymentProvidersView displays Adyen and EMIS with contract status badges without exposing secrets', async () => {
  const origList = paymentClient.listProviderConfigs;
  paymentClient.listProviderConfigs = async () => sampleConfigs;

  try {
    let renderer: any;
    await act(async () => {
      renderer = create(
        React.createElement(FinancePaymentProvidersView, {
          theme: 'light',
          onBack: () => {},
        })
      );
    });

    const text = JSON.stringify(renderer.toJSON());
    assert.ok(text.includes('Adyen Payment Gateway'));
    assert.ok(text.includes('EMIS / Rede MULTICAIXA'));
    assert.ok(text.includes('CONTRACT_READY'));
    assert.ok(text.includes('SANDBOX'));

    // Assert no secret tokens or keys in DOM
    assert.ok(!text.includes('secret'));
    assert.ok(!text.includes('vault://'));
  } finally {
    paymentClient.listProviderConfigs = origList;
  }
});

test('FinanceWorkspace switches to Recebimentos tab and renders FinancePaymentsWorkspace', async () => {
  const origList = paymentClient.listPayments;
  paymentClient.listPayments = async () => samplePayments;

  try {
    let renderer: any;
    await act(async () => {
      renderer = create(
        React.createElement(FinanceWorkspace, {
          theme: 'light',
          initialTab: 'catalogue',
        })
      );
    });

    const root = renderer.root;
    const recebimentosTabBtn = root.findByProps({ 'data-testid': 'finance-tab-recebimentos' });
    assert.ok(recebimentosTabBtn);

    await act(async () => {
      recebimentosTabBtn.props.onClick();
    });

    const text = JSON.stringify(renderer.toJSON());
    assert.ok(text.includes('Recebimentos e Pagamentos'));
    assert.ok(text.includes('PAG-000001'));
  } finally {
    paymentClient.listPayments = origList;
  }
});
