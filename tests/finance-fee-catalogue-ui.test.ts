import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { FinanceFeeCatalogueWorkspace } from '../src/components/finance/fee-catalogue/FinanceFeeCatalogueWorkspace.tsx';
import type { FeeCatalogueRecord, FeeTypeRecord } from '../src/modules/finance/fee-catalogue-client.ts';

const sampleTypes: FeeTypeRecord[] = [
  {
    id: 'type-001',
    canonicalKey: 'tuition',
    source: 'nexus_base',
    displayName: 'Propina / Mensalidade',
    codePrefix: 'PROP',
    status: 'active',
  },
  {
    id: 'type-002',
    canonicalKey: 'document',
    source: 'nexus_base',
    displayName: 'Certificados / Documentos',
    codePrefix: 'DOC',
    status: 'active',
  },
  {
    id: 'type-003',
    canonicalKey: null,
    source: 'institution_custom',
    displayName: 'Laboratório',
    codePrefix: 'LAB',
    status: 'active',
  },
];

const sampleItems: FeeCatalogueRecord[] = [
  {
    id: 'fee-item-001',
    feeTypeId: 'type-001',
    feeType: sampleTypes[0],
    code: 'PROP-000001',
    status: 'active',
    currentVersion: 1,
    current: {
      feeTypeId: 'type-001',
      feeType: sampleTypes[0],
      name: 'Propina Anual 2026/2027',
      kind: 'tuition',
      description: 'Propina regular anual',
      money: { amount: '150.00', currency: 'EUR' },
      effectiveFrom: '2026-09-01T00:00:00.000Z',
    },
    history: [
      {
        id: 'ver-001',
        feeTypeId: 'type-001',
        feeType: sampleTypes[0],
        version: 1,
        name: 'Propina Anual 2026/2027',
        kind: 'tuition',
        description: 'Versão original',
        money: { amount: '150.00', currency: 'EUR' },
        effectiveFrom: '2026-09-01T00:00:00.000Z',
        effectiveTo: null,
      },
    ],
  },
  {
    id: 'fee-item-002',
    feeTypeId: 'type-002',
    feeType: sampleTypes[1],
    code: 'DOC-000001',
    status: 'inactive',
    currentVersion: 2,
    current: {
      feeTypeId: 'type-002',
      feeType: sampleTypes[1],
      name: 'Certidão de Matrícula',
      kind: 'document',
      description: null,
      money: { amount: '20.00', currency: 'EUR' },
      effectiveFrom: '2026-09-02T10:00:00.000Z',
    },
    history: [
      {
        id: 'ver-002-v1',
        feeTypeId: 'type-002',
        feeType: sampleTypes[1],
        version: 1,
        name: 'Certidão de Matrícula v1',
        kind: 'document',
        description: 'Versão anterior',
        money: { amount: '15.00', currency: 'EUR' },
        effectiveFrom: '2026-09-01T00:00:00.000Z',
        effectiveTo: '2026-09-02T10:00:00.000Z',
      },
      {
        id: 'ver-002-v2',
        feeTypeId: 'type-002',
        feeType: sampleTypes[1],
        version: 2,
        name: 'Certidão de Matrícula',
        kind: 'document',
        description: null,
        money: { amount: '20.00', currency: 'EUR' },
        effectiveFrom: '2026-09-02T10:00:00.000Z',
        effectiveTo: null,
      },
    ],
  },
];

const originalFetch = globalThis.fetch;
let itemsStore = [...sampleItems];
let typesStore = [...sampleTypes];
let recordedRequests: { url: string; method: string; body: any; headers: any }[] = [];
let failNextLoad = false;

function setupMockFetch() {
  globalThis.fetch = (async (urlInput: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof urlInput === 'string' ? urlInput : urlInput.toString();
    const method = init?.method || 'GET';
    const headers = (init?.headers || {}) as Record<string, string>;
    const body = init?.body ? JSON.parse(init.body as string) : undefined;

    recordedRequests.push({ url, method, body, headers });

    if (failNextLoad) {
      failNextLoad = false;
      return new Response(JSON.stringify({ error: 'Network failure' }), { status: 500 });
    }

    // GET /api/finance/fee-types
    if (method === 'GET' && url.startsWith('/api/finance/fee-types') && !url.includes('/type-')) {
      return new Response(JSON.stringify(typesStore), { status: 200 });
    }

    // POST /api/finance/fee-types
    if (method === 'POST' && url === '/api/finance/fee-types') {
      const newType: FeeTypeRecord = {
        id: `type-${Date.now()}`,
        canonicalKey: null,
        source: 'institution_custom',
        displayName: body.displayName,
        codePrefix: body.codePrefix,
        status: 'active',
      };
      typesStore.push(newType);
      return new Response(JSON.stringify(newType), { status: 201 });
    }

    // GET /api/finance/fee-catalogue
    if (method === 'GET' && url.startsWith('/api/finance/fee-catalogue') && !url.includes('/fee-item-')) {
      return new Response(JSON.stringify(itemsStore), { status: 200 });
    }

    // GET /api/finance/fee-catalogue/:id
    if (method === 'GET' && url.includes('/api/finance/fee-catalogue/fee-item-')) {
      const id = url.split('/api/finance/fee-catalogue/')[1].split('?')[0];
      const item = itemsStore.find((x) => x.id === id);
      if (item) {
        return new Response(JSON.stringify(item), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }

    // POST create fee-catalogue (server generates code!)
    if (method === 'POST' && url === '/api/finance/fee-catalogue') {
      const selectedType = typesStore.find((t) => t.id === body.feeTypeId) || typesStore[0];
      const seq = itemsStore.filter((i) => i.feeTypeId === selectedType.id).length + 1;
      const generatedCode = `${selectedType.codePrefix}-${String(seq).padStart(6, '0')}`;

      const newItem: FeeCatalogueRecord = {
        id: `fee-item-${Date.now()}`,
        feeTypeId: selectedType.id,
        feeType: selectedType,
        code: generatedCode,
        status: 'active',
        currentVersion: 1,
        current: {
          feeTypeId: selectedType.id,
          feeType: selectedType,
          name: body.name,
          kind: selectedType.canonicalKey || selectedType.codePrefix,
          description: body.description || null,
          money: { amount: body.amount, currency: body.currency },
          effectiveFrom: body.effectiveFrom,
        },
        history: [
          {
            id: `ver-${Date.now()}`,
            feeTypeId: selectedType.id,
            feeType: selectedType,
            version: 1,
            name: body.name,
            kind: selectedType.canonicalKey || selectedType.codePrefix,
            description: body.description || null,
            money: { amount: body.amount, currency: body.currency },
            effectiveFrom: body.effectiveFrom,
            effectiveTo: null,
          },
        ],
      };
      itemsStore.push(newItem);
      return new Response(JSON.stringify(newItem), { status: 201 });
    }

    // PUT update (publish new version)
    if (method === 'PUT' && url.startsWith('/api/finance/fee-catalogue/')) {
      const id = url.split('/api/finance/fee-catalogue/')[1];
      const item = itemsStore.find((x) => x.id === id);
      if (item) {
        item.currentVersion += 1;
        item.current = {
          name: body.name,
          kind: item.current.kind,
          description: body.description || null,
          money: { amount: body.amount, currency: body.currency },
          effectiveFrom: body.effectiveFrom,
        };
        return new Response(JSON.stringify(item), { status: 200 });
      }
    }

    // POST activate / deactivate
    if (method === 'POST' && url.endsWith('/activate')) {
      const id = url.split('/api/finance/fee-catalogue/')[1].split('/')[0];
      const item = itemsStore.find((x) => x.id === id);
      if (item) item.status = 'active';
      return new Response(JSON.stringify(item), { status: 200 });
    }

    if (method === 'POST' && url.endsWith('/deactivate')) {
      const id = url.split('/api/finance/fee-catalogue/')[1].split('/')[0];
      const item = itemsStore.find((x) => x.id === id);
      if (item) item.status = 'inactive';
      return new Response(JSON.stringify(item), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }) as any;
}

try {
  setupMockFetch();

  // Test 1: Loading state & Default List view (renders generated codes, no forms)
  let renderer: any;
  await act(async () => {
    renderer = create(React.createElement(FinanceFeeCatalogueWorkspace, { theme: 'dark' }));
  });

  const defaultRendered = JSON.stringify(renderer.toJSON());
  assert.ok(defaultRendered.includes('PROP-000001'), 'Must render item PROP-000001');
  assert.ok(defaultRendered.includes('DOC-000001'), 'Must render item DOC-000001');
  assert.ok(defaultRendered.includes('Propina / Mensalidade'), 'Must render Fee Type designation');
  assert.ok(defaultRendered.includes('Gerir tipos'), 'Must have Gerir tipos button');

  // Verify that NO <form> elements are visible on default screen
  const formsOnDefault = renderer.root.findAllByType('form');
  assert.equal(formsOnDefault.length, 0, 'No form elements on default screen');

  // Test 2: Fee Types Subview Navigation (`Gerir tipos`)
  const typesBtn = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('Gerir tipos'))[0];
  assert.ok(typesBtn, 'Must have Gerir tipos button in list header');

  await act(async () => {
    typesBtn.props.onClick();
  });

  let typesViewText = JSON.stringify(renderer.toJSON());
  assert.ok(typesViewText.includes('Tipos de Emolumento'), 'Must display Tipos de Emolumento subview');
  assert.ok(typesViewText.includes('Propina / Mensalidade'), 'Must display baseline type');
  assert.ok(typesViewText.includes('PROP'), 'Must display prefix PROP');

  // Test Adding Custom Type in Types Subview
  const typeForms = renderer.root.findAllByType('form');
  assert.equal(typeForms.length, 1, 'Must have custom fee type form');
  const typeInputs = typeForms[0].findAllByType('input');
  await act(async () => {
    typeInputs[0].props.onChange({ target: { value: 'Transporte Escolar Especial' } });
    typeInputs[1].props.onChange({ target: { value: 'TRAN' } });
  });

  await act(async () => {
    typeForms[0].props.onSubmit({ preventDefault: () => {} });
  });

  // Return to list from Types subview
  const backFromTypesBtn = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('Voltar ao catálogo'))[0];
  await act(async () => {
    backFromTypesBtn.props.onClick();
  });

  let backToListText = JSON.stringify(renderer.toJSON());
  assert.ok(backToListText.includes('PROP-000001'), 'Must return to catalogue list');

  // Test 3: Create Subview Navigation with Governed Fee Type Combobox & Server Code Generation
  const createBtn = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('+ Novo emolumento'))[0];
  await act(async () => {
    createBtn.props.onClick();
  });

  let createViewText = JSON.stringify(renderer.toJSON());
  assert.ok(createViewText.includes('Novo Emolumento / Taxa'), 'Must display Novo Emolumento subview');

  const createForms = renderer.root.findAllByType('form');
  assert.equal(createForms.length, 1);

  // Assert NO manual code input field exists!
  const createInputs = createForms[0].findAllByType('input');
  const placeholders = createInputs.map((i: any) => i.props.placeholder || '');
  assert.ok(!placeholders.some((p: string) => p.includes('PROP-MENSAL')), 'Manual code input must NOT exist');

  // Select fee type and fill other fields
  const selects = createForms[0].findAllByType('select');
  assert.equal(selects.length, 1, 'Must have Fee Type select');

  await act(async () => {
    selects[0].props.onChange({ target: { value: 'type-003' } }); // Select LAB type
  });

  // Inputs: name, amount, currency, effectiveFrom, description
  await act(async () => {
    createInputs[0].props.onChange({ target: { value: 'Taxa de Laboratório' } });
    createInputs[1].props.onChange({ target: { value: '45,50' } }); // Test comma
    createInputs[2].props.onChange({ target: { value: 'EUR' } });
    createInputs[3].props.onChange({ target: { value: '2026-09-01T08:00' } });
    createInputs[4].props.onChange({ target: { value: 'Uso de laboratório' } });
  });

  recordedRequests.length = 0;
  await act(async () => {
    createForms[0].props.onSubmit({ preventDefault: () => {} });
  });

  const createReq = recordedRequests.find((r) => r.method === 'POST' && r.url === '/api/finance/fee-catalogue');
  assert.ok(createReq, 'Must have recorded create POST request');
  assert.equal(createReq.body.feeTypeId, 'type-003');
  assert.equal(createReq.body.amount, '45.50');
  assert.equal(createReq.body.code, undefined, 'Browser must NOT send code authority');

  // Returned to list view with generated LAB-000001 code
  const postCreateText = JSON.stringify(renderer.toJSON());
  assert.ok(postCreateText.includes('LAB-000001'), 'Created item must have backend-generated code LAB-000001');

  // Test 4: Version Subview (Edit amount only, immutable code preserved)
  const editButtons = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('Editar'));
  await act(async () => {
    editButtons[0].props.onClick();
  });

  let versionViewText = JSON.stringify(renderer.toJSON());
  assert.ok(versionViewText.includes('Publicar Nova Versão'), 'Must display version subview');
  assert.ok(versionViewText.includes('PROP-000001'), 'Must display immutable code');

  const editForms = renderer.root.findAllByType('form');
  const editInputs = editForms[0].findAllByType('input');
  assert.equal(editInputs[0].props.disabled, true, 'Code input must be disabled / immutable');

  // Modify ONLY amount
  await act(async () => {
    editInputs[2].props.onChange({ target: { value: '185.00' } });
  });

  recordedRequests.length = 0;
  await act(async () => {
    editForms[0].props.onSubmit({ preventDefault: () => {} });
  });

  const updateReq = recordedRequests.find((r) => r.method === 'PUT');
  assert.ok(updateReq, 'Must record PUT update request');
  assert.equal(updateReq.body.expectedVersion, 1);
  assert.equal(updateReq.body.amount, '185.00');

  // Test 5: History Subview
  const historyButtons = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('Histórico'));
  await act(async () => {
    historyButtons[0].props.onClick();
  });

  const historyText = JSON.stringify(renderer.toJSON());
  assert.ok(historyText.includes('Histórico de Versões'), 'Must open history subview');
  assert.ok(historyText.includes('PROP-000001'), 'Must display code in history');

  const backHistoryBtn = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('Voltar ao catálogo'))[0];
  await act(async () => {
    backHistoryBtn.props.onClick();
  });

  // Test 6: Lifecycle Deactivate / Activate
  const deactivateBtn = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('Desativar'))[0];
  recordedRequests.length = 0;
  await act(async () => {
    deactivateBtn.props.onClick();
  });

  const deactReq = recordedRequests.find((r) => r.method === 'POST' && r.url.endsWith('/deactivate'));
  assert.ok(deactReq, 'Must record deactivate request');
  assert.ok(deactReq.headers['Idempotency-Key']);

  console.log('Finance fee catalogue UI tests: PASS');
} finally {
  globalThis.fetch = originalFetch;
}
