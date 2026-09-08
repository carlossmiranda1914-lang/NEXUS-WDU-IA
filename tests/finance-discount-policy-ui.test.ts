import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { FinanceDiscountPolicyView } from '../src/components/finance/fee-catalogue/FinanceDiscountPolicyView.tsx';
import { FinanceFeeCatalogueWorkspace } from '../src/components/finance/fee-catalogue/FinanceFeeCatalogueWorkspace.tsx';
import type { DiscountPolicySummary } from '../src/modules/finance/discount-policy-model.ts';
import type { DiscountPolicyApiClient } from '../src/modules/finance/discount-policy-client.ts';

const samplePolicies: DiscountPolicySummary[] = [
  {
    id: 'pol-001',
    institutionId: 'inst-001',
    code: 'BOLSA-20',
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    latestVersion: {
      id: 'ver-002',
      institutionId: 'inst-001',
      policyId: 'pol-001',
      version: 2,
      name: 'Bolsa de Mérito 25% (2027)',
      description: 'Aumento para 25%',
      calculationMode: 'percentage',
      value: '25',
      currency: null,
      effectiveFrom: new Date('2027-01-01T00:00:00Z'),
      effectiveTo: null,
      createdAt: new Date('2026-06-01T00:00:00Z'),
      actorPersonId: 'person-001',
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
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      effectiveTo: new Date('2026-12-31T23:59:59Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      actorPersonId: 'person-001',
    },
  },
  {
    id: 'pol-002',
    institutionId: 'inst-001',
    code: 'IRMAOS-10',
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    latestVersion: {
      id: 'ver-003',
      institutionId: 'inst-001',
      policyId: 'pol-002',
      version: 1,
      name: 'Desconto Irmãos 10 EUR',
      description: null,
      calculationMode: 'fixed_amount',
      value: '10',
      currency: 'EUR',
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      effectiveTo: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      actorPersonId: 'person-001',
    },
    currentApplicableVersion: {
      id: 'ver-003',
      institutionId: 'inst-001',
      policyId: 'pol-002',
      version: 1,
      name: 'Desconto Irmãos 10 EUR',
      description: null,
      calculationMode: 'fixed_amount',
      value: '10',
      currency: 'EUR',
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      effectiveTo: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      actorPersonId: 'person-001',
    },
  },
];

function createMockClient(overrides?: Partial<DiscountPolicyApiClient>): DiscountPolicyApiClient {
  return {
    listDiscountPolicies: async () => samplePolicies,
    createDiscountPolicy: async (_input, _key) => {
      return {
        id: 'pol-new',
        institutionId: 'inst-001',
        code: 'NEW-10',
        name: 'New Policy',
        description: null,
        status: 'active' as const,
        currentVersion: 1,
        createdAt: new Date(),
        actorPersonId: 'p-1',
        version: {
          id: 'ver-new',
          institutionId: 'inst-001',
          policyId: 'pol-new',
          version: 1,
          name: 'New Policy',
          description: null,
          calculationMode: 'percentage' as const,
          value: '10',
          currency: null,
          effectiveFrom: null,
          effectiveTo: null,
          createdAt: new Date(),
          actorPersonId: 'p-1',
        },
      };
    },
    createDiscountPolicyVersion: async (_policyId, _input, _key) => {
      return {
        id: 'ver-v2',
        institutionId: 'inst-001',
        policyId: 'pol-001',
        version: 2,
        name: 'Version 2',
        description: null,
        calculationMode: 'percentage' as const,
        value: '25',
        currency: null,
        effectiveFrom: null,
        effectiveTo: null,
        createdAt: new Date(),
        actorPersonId: 'p-1',
      };
    },
    archiveDiscountPolicy: async (policyId) => {
      return {
        id: policyId,
        institutionId: 'inst-001',
        code: 'BOLSA-20',
        name: 'Bolsa de Mérito 20%',
        description: null,
        status: 'archived' as const,
        currentVersion: 1,
        createdAt: new Date(),
        actorPersonId: 'p-1',
      };
    },
    ...overrides,
  } as any;
}

test('FinanceDiscountPolicyView renders policy table with correct badges and scheduled version indication', async () => {
  const mockClient = createMockClient();
  let component: any;

  await act(async () => {
    component = create(React.createElement(FinanceDiscountPolicyView, { client: mockClient }));
  });

  const text = JSON.stringify(component.toJSON());
  assert.ok(text.includes('BOLSA-20'), 'Renders BOLSA-20 code');
  assert.ok(text.includes('Bolsa de Mérito 20%'), 'Renders policy name');
  assert.ok(text.includes('Percentagem (%)'), 'Renders percentage badge');
  assert.ok(text.includes('20%'), 'Renders current rate value');
  assert.ok(text.includes('v2 agendada'), 'Renders scheduled future version badge');
  assert.ok(text.includes('IRMAOS-10'), 'Renders IRMAOS-10 code');
  assert.ok(text.includes('Valor Fixo'), 'Renders fixed amount badge');
  assert.ok(text.includes('10 EUR'), 'Renders fixed amount value');
  assert.ok(text.includes('Ativa'), 'Renders active status badge');
});

test('FinanceDiscountPolicyView renders empty state when no policies exist', async () => {
  const mockClient = createMockClient({
    listDiscountPolicies: async () => [],
  });
  let component: any;

  await act(async () => {
    component = create(React.createElement(FinanceDiscountPolicyView, { client: mockClient }));
  });

  const text = JSON.stringify(component.toJSON());
  assert.ok(text.includes('Nenhuma política de desconto registada'), 'Renders empty state heading');
  assert.ok(text.includes('Criar primeira política'), 'Renders create first policy button');
});

test('FinanceDiscountPolicyView opens Nova Política modal and submits', async () => {
  let createCalledWith: any = null;
  const mockClient = createMockClient({
    createDiscountPolicy: async (input, key) => {
      createCalledWith = { input, key };
      return {} as any;
    },
  });

  let component: any;
  await act(async () => {
    component = create(React.createElement(FinanceDiscountPolicyView, { client: mockClient }));
  });

  const newBtn = component.root.find((el: any) => el.props.id === 'btn-nova-politica-desconto');
  await act(async () => {
    newBtn.props.onClick();
  });

  const modal = component.root.find((el: any) => el.props.role === 'dialog');
  assert.ok(modal, 'Modal dialog is mounted');
  assert.equal(modal.props['aria-label'], 'Nova Política de Desconto');

  const codeInput = component.root.find((el: any) => el.props.id === 'policy-code');
  const nameInput = component.root.find((el: any) => el.props.id === 'policy-name');
  const valueInput = component.root.find((el: any) => el.props.id === 'policy-value');

  await act(async () => {
    codeInput.props.onChange({ target: { value: 'DESCONTO-15' } });
    nameInput.props.onChange({ target: { value: 'Desconto 15%' } });
    valueInput.props.onChange({ target: { value: '15.00' } });
  });

  const form = component.root.find((el: any) => el.type === 'form');
  await act(async () => {
    form.props.onSubmit({ preventDefault: () => {} });
  });

  assert.ok(createCalledWith, 'Client createDiscountPolicy was called');
  assert.equal(createCalledWith.input.code, 'DESCONTO-15');
  assert.equal(createCalledWith.input.name, 'Desconto 15%');
  assert.equal(createCalledWith.input.value, '15.00');
});

test('FinanceDiscountPolicyView handles keyboard Escape to close modal', async () => {
  const mockClient = createMockClient();
  let component: any;

  await act(async () => {
    component = create(React.createElement(FinanceDiscountPolicyView, { client: mockClient }));
  });

  const newBtn = component.root.find((el: any) => el.props.id === 'btn-nova-politica-desconto');
  await act(async () => {
    newBtn.props.onClick();
  });

  assert.ok(component.root.findAll((el: any) => el.props.role === 'dialog').length > 0, 'Modal opened');

  const main = component.root.find((el: any) => el.type === 'main');
  await act(async () => {
    main.props.onKeyDown({ key: 'Escape' });
  });

  assert.equal(
    component.root.findAll((el: any) => el.props.role === 'dialog').length,
    0,
    'Modal closed on Escape key press'
  );
});

test('FinanceDiscountPolicyView opens Nova Versão modal with policy prefilled', async () => {
  const mockClient = createMockClient();
  let component: any;

  await act(async () => {
    component = create(React.createElement(FinanceDiscountPolicyView, { client: mockClient }));
  });

  const versionBtn = component.root.find(
    (el: any) => el.type === 'button' && el.props['aria-label'] === 'Criar nova versão para BOLSA-20'
  );
  assert.ok(versionBtn, 'Found Nova Versão button');

  await act(async () => {
    versionBtn.props.onClick();
  });

  const text = JSON.stringify(component.toJSON());
  assert.ok(text.includes('Nova Versão da Política'), 'Nova Versão modal is rendered');
  assert.ok(text.includes('BOLSA-20'), 'Prefilled policy code BOLSA-20 is visible');
});

test('FinanceDiscountPolicyView opens archive confirmation dialog and confirms', async () => {
  let archivedId: string | null = null;
  const mockClient = createMockClient({
    archiveDiscountPolicy: async (id) => {
      archivedId = id;
      return {} as any;
    },
  });

  let component: any;
  await act(async () => {
    component = create(React.createElement(FinanceDiscountPolicyView, { client: mockClient }));
  });

  const archiveBtn = component.root.find(
    (el: any) => el.type === 'button' && el.props['aria-label'] === 'Arquivar política BOLSA-20'
  );
  await act(async () => {
    archiveBtn.props.onClick();
  });

  const text = JSON.stringify(component.toJSON());
  assert.ok(text.includes('Arquivar Política?'), 'Archive confirmation modal opened');

  const confirmBtn = component.root.find(
    (el: any) => el.type === 'button' && el.children && el.children.includes('Confirmar Arquivamento')
  );
  await act(async () => {
    confirmBtn.props.onClick();
  });

  assert.equal(archivedId, 'pol-001', 'archiveDiscountPolicy was called with pol-001');
});

test('FinanceFeeCatalogueWorkspace allows switching to Políticas de Desconto and back', async () => {
  let component: any;
  await act(async () => {
    component = create(React.createElement(FinanceFeeCatalogueWorkspace, {}));
  });

  let text = JSON.stringify(component.toJSON());
  assert.ok(text.includes('Catálogo de Emolumentos'), 'Catalogue is active');

  const discountTabBtn = component.root.findAll(
    (el: any) => el.type === 'button' && el.children && el.children.includes('Políticas de Desconto')
  )[0];
  assert.ok(discountTabBtn, 'Found Políticas de Desconto tab button');

  await act(async () => {
    discountTabBtn.props.onClick();
  });

  text = JSON.stringify(component.toJSON());
  assert.ok(text.includes('Políticas de Desconto Institucionais'), 'Discount policies view is active');
});

test('F6 product polish gives policy creation a structured financial operation hierarchy', async () => {
  const mockClient = createMockClient();
  let component: any;

  await act(async () => {
    component = create(React.createElement(FinanceDiscountPolicyView, { client: mockClient }));
  });

  const newBtn = component.root.find((el: any) => el.props.id === 'btn-nova-politica-desconto');
  await act(async () => {
    newBtn.props.onClick();
  });

  const text = JSON.stringify(component.toJSON());
  assert.ok(text.includes('1. Identificação'), 'Creation dialog separates identification');
  assert.ok(text.includes('2. Regra financeira'), 'Creation dialog separates the financial rule');
  assert.ok(text.includes('3. Vigência'), 'Creation dialog separates effective dating');
  assert.ok(text.includes('4. Resumo'), 'Creation dialog exposes an operator-facing summary');
  assert.ok(text.includes('data-testid":"policy-value-unit"'), 'Financial value input exposes a dedicated unit adornment');
});
