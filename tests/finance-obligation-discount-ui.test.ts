import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { FinanceObligationDiscountView } from '../src/components/finance/operational/FinanceObligationDiscountView.tsx';
import { FinanceOperationalTruthPanels } from '../src/components/finance/operational/FinanceOperationalTruthPanels.tsx';
import type { FinanceOperationalObligation } from '../src/modules/finance/finance-operational-context-model.ts';
import type { DiscountPolicyApiClient } from '../src/modules/finance/discount-policy-client.ts';
import type { DiscountPolicySummary } from '../src/modules/finance/discount-policy-model.ts';

const samplePolicies: DiscountPolicySummary[] = [
  {
    id: 'pol-001',
    institutionId: 'inst-001',
    code: 'BOLSA-20',
    name: 'Bolsa de Mérito 20%',
    description: null,
    status: 'active',
    currentVersion: 1,
    createdAt: new Date(),
    actorPersonId: 'p-1',
    latestVersion: {
      id: 'ver-001',
      institutionId: 'inst-001',
      policyId: 'pol-001',
      version: 1,
      name: 'Bolsa de Mérito 20%',
      description: null,
      calculationMode: 'percentage',
      value: '20',
      currency: null,
      effectiveFrom: null,
      effectiveTo: null,
      createdAt: new Date(),
      actorPersonId: 'p-1',
    },
    currentApplicableVersion: {
      id: 'ver-001',
      institutionId: 'inst-001',
      policyId: 'pol-001',
      version: 1,
      name: 'Bolsa de Mérito 20%',
      description: null,
      calculationMode: 'percentage',
      value: '20',
      currency: null,
      effectiveFrom: null,
      effectiveTo: null,
      createdAt: new Date(),
      actorPersonId: 'p-1',
    },
  },
  {
    id: 'pol-002',
    institutionId: 'inst-001',
    code: 'EXCEDENTE-70',
    name: 'Desconto Fixo 70 EUR',
    description: null,
    status: 'active',
    currentVersion: 1,
    createdAt: new Date(),
    actorPersonId: 'p-1',
    latestVersion: {
      id: 'ver-002',
      institutionId: 'inst-001',
      policyId: 'pol-002',
      version: 1,
      name: 'Desconto Fixo 70 EUR',
      description: null,
      calculationMode: 'fixed_amount',
      value: '70',
      currency: 'EUR',
      effectiveFrom: null,
      effectiveTo: null,
      createdAt: new Date(),
      actorPersonId: 'p-1',
    },
    currentApplicableVersion: {
      id: 'ver-002',
      institutionId: 'inst-001',
      policyId: 'pol-002',
      version: 1,
      name: 'Desconto Fixo 70 EUR',
      description: null,
      calculationMode: 'fixed_amount',
      value: '70',
      currency: 'EUR',
      effectiveFrom: null,
      effectiveTo: null,
      createdAt: new Date(),
      actorPersonId: 'p-1',
    },
  },
];

function createMockPolicyClient(): DiscountPolicyApiClient {
  return {
    listDiscountPolicies: async () => samplePolicies,
  } as any;
}

const sampleObligation: FinanceOperationalObligation = {
  id: 'ob-100',
  description: 'Propina de Frequência — 1º Semestre',
  amount: { amount: '100.00', currency: 'EUR' },
  original: { amount: '100.00', currency: 'EUR' },
  effectiveDue: { amount: '100.00', currency: 'EUR' },
  covered: { amount: '40.00', currency: 'EUR' },
  uncovered: { amount: '60.00', currency: 'EUR' },
  remainingCoverable: { amount: '60.00', currency: 'EUR' },
  effectiveAt: '2026-09-01T00:00:00Z',
  status: 'open',
};

const sampleObligationWithActiveDiscount: FinanceOperationalObligation = {
  ...sampleObligation,
  id: 'ob-200',
  description: 'Propina de Frequência — Aluno com Bolsa',
  effectiveDue: { amount: '80.00', currency: 'EUR' },
  uncovered: { amount: '40.00', currency: 'EUR' },
  remainingCoverable: { amount: '40.00', currency: 'EUR' },
  activeDiscount: {
    id: 'disc-001',
    policyId: 'pol-001',
    policyCode: 'BOLSA-20',
    policyName: 'Bolsa de Mérito 20%',
    amount: { amount: '20.00', currency: 'EUR' },
    appliedAt: '2026-09-02T00:00:00Z',
    reason: 'Bolsa de Mérito Semestre 1',
  },
};


test('FinanceOperationalTruthPanels renders contextual actions correctly based on active discount', async () => {
  let applyCalled = false;
  let revokeCalled = false;

  let component: any;
  await act(async () => {
    component = create(
      React.createElement(FinanceOperationalTruthPanels, {
        openObligations: [sampleObligation, sampleObligationWithActiveDiscount],
        confirmedUnallocatedPayments: [],
        onApplyDiscount: (_ob) => {
          applyCalled = true;
        },
        onRevokeDiscount: (_ob) => {
          revokeCalled = true;
        },
      })
    );
  });

  // Open menu for obligation without discount
  const menuBtn1 = component.root.find((el: any) => el.props['data-testid'] === 'obligation-actions-ob-100');
  await act(async () => {
    menuBtn1.props.onClick();
  });

  let text = JSON.stringify(component.toJSON());
  assert.ok(text.includes('Aplicar desconto institucional'), 'Menu contains Aplicar desconto institucional');
  assert.ok(!text.includes('Revogar desconto'), 'Menu does not contain Revogar desconto for clean obligation');

  // Trigger apply discount
  const applyBtn = component.root.findAll(
    (el: any) => el.type === 'button' && el.children && el.children.includes('Aplicar desconto institucional')
  )[0];
  await act(async () => {
    applyBtn.props.onClick();
  });
  assert.ok(applyCalled, 'onApplyDiscount callback was triggered');
});

test('FinanceObligationDiscountView handles Apply Mode with live preview and submit', async () => {
  let appliedPayload: any = null;
  const mockClient = createMockPolicyClient();

  let component: any;
  await act(async () => {
    component = create(
      React.createElement(FinanceObligationDiscountView, {
        mode: 'apply',
        obligation: sampleObligation,
        policyClient: mockClient,
        onCancel: () => {},
        onApply: async (obId, policyId, reason) => {
          appliedPayload = { obId, policyId, reason };
        },
        onRevoke: async () => {},
      })
    );
  });

  // Wait for policyClient.listDiscountPolicies to resolve and re-render
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });

  // Check dialog accessibility and context
  const dialog = component.root.find((el: any) => el.props.role === 'dialog');
  assert.equal(dialog.props['aria-label'], 'Aplicar desconto institucional');

  const text = JSON.stringify(component.toJSON());
  assert.ok(text.includes('BOLSA-20'), 'Policy BOLSA-20 is selected');
  assert.ok(text.includes('20 EUR') || text.includes('20.00 EUR'), 'Preview shows 20 EUR discount');
  assert.ok(text.includes('80.00 EUR') || text.includes('80 EUR'), 'Preview shows due updated from 100 to 80');

  assert.ok(text.includes('40.00 EUR') || text.includes('40 EUR'), 'Preview shows remaining 40 EUR');


  // Fill in reason
  const reasonInput = component.root.find((el: any) => el.props.id === 'discount-reason-input');
  await act(async () => {
    reasonInput.props.onChange({ target: { value: 'Bolsa Mérito 1º Sem' } });
  });

  // Submit form
  const form = component.root.find((el: any) => el.props['data-testid'] === 'obligation-discount-form');
  await act(async () => {
    await form.props.onSubmit({ preventDefault: () => {} });
  });

  assert.ok(appliedPayload, 'onApply was called');
  assert.equal(appliedPayload.obId, 'ob-100');
  assert.equal(appliedPayload.policyId, 'pol-001');
  assert.equal(appliedPayload.reason, 'Bolsa Mérito 1º Sem');
});

test('FinanceObligationDiscountView prevents floor violation by disabling submit and warning', async () => {
  const mockClient = createMockPolicyClient();

  let component: any;
  await act(async () => {
    component = create(
      React.createElement(FinanceObligationDiscountView, {
        mode: 'apply',
        obligation: sampleObligation, // 100 original, 40 covered, 60 remaining
        policyClient: mockClient,
        onCancel: () => {},
        onApply: async () => {},
        onRevoke: async () => {},
      })
    );
  });

  // Change policy to EXCEDENTE-70 (70 EUR fixed > 60 EUR remaining)
  const policySelect = component.root.find((el: any) => el.props.id === 'policy-select');
  await act(async () => {
    policySelect.props.onChange({ target: { value: 'pol-002' } });
  });

  const text = JSON.stringify(component.toJSON());
  assert.ok(text.includes('Aviso de Limite'), 'Floor boundary warning banner is displayed');
  assert.ok(text.includes('excede o valor por cobrir'), 'Warning text explains floor violation');

  // Submit button should be disabled
  const submitBtn = component.root.findAll((el: any) => el.type === 'button' && el.props.type === 'submit')[0];
  assert.ok(submitBtn.props.disabled, 'Submit button is disabled under floor violation');
});

test('FinanceObligationDiscountView preserves operator input on error for immediate retry', async () => {
  const mockClient = createMockPolicyClient();
  let attemptCount = 0;

  let component: any;
  await act(async () => {
    component = create(
      React.createElement(FinanceObligationDiscountView, {
        mode: 'apply',
        obligation: sampleObligation,
        policyClient: mockClient,
        onCancel: () => {},
        onApply: async () => {
          attemptCount++;
          if (attemptCount === 1) {
            throw new Error('Erro temporário de rede no servidor');
          }
        },
        onRevoke: async () => {},
      })
    );
  });

  // Fill in reason
  const reasonInput = component.root.find((el: any) => el.props.id === 'discount-reason-input');
  await act(async () => {
    reasonInput.props.onChange({ target: { value: 'Justificação que não deve ser perdida' } });
  });

  // First submit attempt (fails)
  const form = component.root.find((el: any) => el.props['data-testid'] === 'obligation-discount-form');
  await act(async () => {
    await form.props.onSubmit({ preventDefault: () => {} });
  });

  // Verify error is shown and reason remains in state
  let text = JSON.stringify(component.toJSON());
  assert.ok(text.includes('Erro temporário de rede no servidor'), 'Error message displayed');
  assert.equal(
    component.root.find((el: any) => el.props.id === 'discount-reason-input').props.value,
    'Justificação que não deve ser perdida',
    'Operator-typed reason preserved after error'
  );

  // Second submit attempt (succeeds)
  await act(async () => {
    await form.props.onSubmit({ preventDefault: () => {} });
  });

  assert.equal(attemptCount, 2, 'Successfully retried submission');
});

test('FinanceObligationDiscountView handles Revocation Mode', async () => {
  let revokedPayload: any = null;

  let component: any;
  await act(async () => {
    component = create(
      React.createElement(FinanceObligationDiscountView, {
        mode: 'revoke',
        obligation: sampleObligationWithActiveDiscount,
        onCancel: () => {},
        onApply: async () => {},
        onRevoke: async (obId, discountId, reason) => {
          revokedPayload = { obId, discountId, reason };
        },
      })
    );
  });

  const text = JSON.stringify(component.toJSON());
  if (!text.includes('100.00 EUR')) {
    console.log('TEST 5 TEXT:', text);
  }
  assert.ok(text.includes('Revogar desconto institucional'), 'Revoke header rendered');

  assert.ok(text.includes('BOLSA-20'), 'Active discount code BOLSA-20 is visible');
  assert.ok(text.includes('Restauro de Saldo'), 'Restored balance preview is visible');
  assert.ok(text.includes('100.00 EUR'), 'Restored due value 100.00 EUR is rendered');

  // Fill in revocation reason
  const reasonInput = component.root.find((el: any) => el.props.id === 'discount-reason-input');
  await act(async () => {
    reasonInput.props.onChange({ target: { value: 'Perda de bolsa de estudo' } });
  });

  // Submit revocation
  const form = component.root.find((el: any) => el.props['data-testid'] === 'obligation-discount-form');
  await act(async () => {
    await form.props.onSubmit({ preventDefault: () => {} });
  });

  assert.ok(revokedPayload, 'onRevoke called');
  assert.equal(revokedPayload.obId, 'ob-200');
  assert.equal(revokedPayload.discountId, 'disc-001');
  assert.equal(revokedPayload.reason, 'Perda de bolsa de estudo');
});


test('FinanceObligationDiscountView handles Escape key to cancel', async () => {
  let cancelled = false;

  let component: any;
  await act(async () => {
    component = create(
      React.createElement(FinanceObligationDiscountView, {
        mode: 'apply',
        obligation: sampleObligation,
        policyClient: createMockPolicyClient(),
        onCancel: () => {
          cancelled = true;
        },
        onApply: async () => {},
        onRevoke: async () => {},
      })
    );
  });

  const aside = component.root.find((el: any) => el.type === 'aside');
  await act(async () => {
    aside.props.onKeyDown({ key: 'Escape' });
  });

  assert.ok(cancelled, 'onCancel triggered on Escape key');
});
