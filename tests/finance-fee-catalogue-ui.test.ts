import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { FinanceFeeCatalogueWorkspace } from '../src/components/finance/fee-catalogue/FinanceFeeCatalogueWorkspace.tsx';
import type { FeeCatalogueRecord } from '../src/modules/finance/fee-catalogue-client.ts';

const sampleItems: FeeCatalogueRecord[] = [
  {
    id: 'fee-item-001',
    code: 'PROP-2026',
    status: 'active',
    currentVersion: 1,
    current: {
      name: 'Propina Anual 2026/2027',
      kind: 'tuition',
      description: 'Propina regular anual',
      money: { amount: '150.00', currency: 'EUR' },
      effectiveFrom: '2026-09-01T00:00:00.000Z',
    },
    history: [
      {
        id: 'ver-001',
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
    code: 'CERT-01',
    status: 'inactive',
    currentVersion: 2,
    current: {
      name: 'Certidão de Matrícula',
      kind: 'fee',
      description: null,
      money: { amount: '20.00', currency: 'EUR' },
      effectiveFrom: '2026-09-02T10:00:00.000Z',
    },
    history: [
      {
        id: 'ver-002-v1',
        version: 1,
        name: 'Certidão de Matrícula v1',
        kind: 'fee',
        description: 'Versão anterior',
        money: { amount: '15.00', currency: 'EUR' },
        effectiveFrom: '2026-09-01T00:00:00.000Z',
        effectiveTo: '2026-09-02T10:00:00.000Z',
      },
      {
        id: 'ver-002-v2',
        version: 2,
        name: 'Certidão de Matrícula',
        kind: 'fee',
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

    // POST create
    if (method === 'POST' && url === '/api/finance/fee-catalogue') {
      const newItem: FeeCatalogueRecord = {
        id: `fee-item-${Date.now()}`,
        code: body.code,
        status: 'active',
        currentVersion: 1,
        current: {
          name: body.name,
          kind: body.kind,
          description: body.description || null,
          money: { amount: body.amount, currency: body.currency },
          effectiveFrom: body.effectiveFrom,
        },
        history: [
          {
            id: `ver-${Date.now()}`,
            version: 1,
            name: body.name,
            kind: body.kind,
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
          kind: body.kind,
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

  // Test 1: Loading state & Default List view (NO forms or subviews on default view)
  let renderer: any;
  await act(async () => {
    renderer = create(React.createElement(FinanceFeeCatalogueWorkspace, { theme: 'dark' }));
  });

  const defaultRendered = JSON.stringify(renderer.toJSON());
  assert.ok(defaultRendered.includes('PROP-2026'), 'Must render item PROP-2026');
  assert.ok(defaultRendered.includes('CERT-01'), 'Must render item CERT-01');
  assert.ok(defaultRendered.includes('150.00'), 'Must render item amount');

  // Verify that NO <form> elements are visible on default screen
  const formsOnDefault = renderer.root.findAllByType('form');
  assert.equal(formsOnDefault.length, 0, 'No form elements must occupy space on the default catalogue screen');

  // Verify that NO modal backdrops exist
  assert.ok(!defaultRendered.includes('backdrop-blur'), 'Must not have modal backdrop');

  // Test 2: Error and retry
  failNextLoad = true;
  await act(async () => {
    renderer = create(React.createElement(FinanceFeeCatalogueWorkspace, { theme: 'dark' }));
  });
  let errText = JSON.stringify(renderer.toJSON());
  assert.ok(errText.includes('Network failure') || errText.includes('Falha de rede'), 'Must render load error message');

  // Click retry button
  itemsStore = [...sampleItems];
  const retryBtn = renderer.root.findByProps({ className: 'mt-3 underline text-sm hover:text-rose-300 block' });
  await act(async () => {
    retryBtn.props.onClick();
  });
  const retriedText = JSON.stringify(renderer.toJSON());
  assert.ok(retriedText.includes('PROP-2026'), 'Retry must succeed and render list');

  // Test 3: Create Subview Navigation (Enter -> Cancel -> Re-enter -> Submit -> Return to List)
  const createBtn = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('+ Novo emolumento'))[0];
  assert.ok(createBtn, 'Must have + Novo emolumento primary action button');

  await act(async () => {
    createBtn.props.onClick();
  });

  // Create subview is now active
  let createViewText = JSON.stringify(renderer.toJSON());
  assert.ok(createViewText.includes('Novo Emolumento / Taxa'), 'Must display Novo Emolumento subview title');
  assert.ok(createViewText.includes('Catálogo de Emolumentos'), 'Must display contextual back link');
  assert.ok(!createViewText.includes('PROP-2026'), 'Catalogue list items must not be rendered behind create subview');

  // Test Cancel / Back from Create Subview
  const cancelCreateBtn = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('Voltar ao catálogo'))[0];
  await act(async () => {
    cancelCreateBtn.props.onClick();
  });

  let backToListText = JSON.stringify(renderer.toJSON());
  assert.ok(backToListText.includes('PROP-2026'), 'Back button must return to default catalogue list');
  assert.equal(renderer.root.findAllByType('form').length, 0, 'No forms visible after returning to list');

  // Re-open Create Subview and submit new fee item
  const createBtn2 = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('+ Novo emolumento'))[0];
  await act(async () => {
    createBtn2.props.onClick();
  });

  const createForms = renderer.root.findAllByType('form');
  assert.equal(createForms.length, 1, 'Exactly one creation form subview must be open');

  const createInputs = createForms[0].findAllByType('input');
  // Inputs: code, name, kind, amount, currency, effectiveFrom, description
  await act(async () => {
    createInputs[0].props.onChange({ target: { value: 'SEGURO-ESC' } });
    createInputs[1].props.onChange({ target: { value: 'Seguro Escolar Anual' } });
    createInputs[2].props.onChange({ target: { value: 'insurance' } });
    createInputs[3].props.onChange({ target: { value: '12,50' } }); // Test comma normalization
    createInputs[4].props.onChange({ target: { value: 'EUR' } });
    createInputs[5].props.onChange({ target: { value: '2026-09-01T08:00' } });
    createInputs[6].props.onChange({ target: { value: 'Cobertura anual' } });
  });

  recordedRequests.length = 0;
  await act(async () => {
    createForms[0].props.onSubmit({ preventDefault: () => {} });
  });

  const createReq = recordedRequests.find((r) => r.method === 'POST' && r.url === '/api/finance/fee-catalogue');
  assert.ok(createReq, 'Must have recorded create POST request');
  assert.ok(createReq.headers['Idempotency-Key'], 'Must have Idempotency-Key header');
  assert.equal(createReq.body.code, 'SEGURO-ESC');
  assert.equal(createReq.body.amount, '12.50', 'Comma must be normalized to dot');

  // Subview automatically returns to list view on success
  const formsAfterCreate = renderer.root.findAllByType('form');
  assert.equal(formsAfterCreate.length, 0, 'Must return to list view after successful creation');

  const postCreateText = JSON.stringify(renderer.toJSON());
  assert.ok(postCreateText.includes('SEGURO-ESC'), 'Created item must appear in list');

  // Test 4: Version Publishing Subview Navigation (Enter -> Cancel -> Re-enter -> Edit Amount Only -> Submit -> Return to List)
  const editButtons = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('Editar'));
  assert.ok(editButtons.length >= 1, 'Must have Editar action buttons');

  await act(async () => {
    editButtons[0].props.onClick(); // Click edit on first item
  });

  // Version subview is now active
  let versionViewText = JSON.stringify(renderer.toJSON());
  assert.ok(versionViewText.includes('Publicar Nova Versão'), 'Must display Publicar Nova Versão header');
  assert.ok(versionViewText.includes('PROP-2026'), 'Must display immutable code');
  assert.ok(versionViewText.includes('Versão Atual em Vigor'), 'Must display active version context summary');
  assert.ok(!versionViewText.includes('CERT-01'), 'Other catalogue items must not be rendered behind version subview');

  // Test Cancel / Back from Version Subview
  const cancelVersionBtn = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('Voltar ao catálogo'))[0];
  await act(async () => {
    cancelVersionBtn.props.onClick();
  });

  let backToListFromVersion = JSON.stringify(renderer.toJSON());
  assert.ok(backToListFromVersion.includes('CERT-01'), 'Back button must return to default catalogue list');
  assert.equal(renderer.root.findAllByType('form').length, 0, 'No forms visible after returning to list');

  // Re-open Version Subview and modify ONLY the amount
  const editButtons2 = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('Editar'));
  await act(async () => {
    editButtons2[0].props.onClick();
  });

  const editForms = renderer.root.findAllByType('form');
  assert.equal(editForms.length, 1, 'Exactly one edit version form subview must be open');

  const editInputs = editForms[0].findAllByType('input');
  // First input is disabled code
  assert.equal(editInputs[0].props.disabled, true, 'Code input must be disabled / immutable');

  // Modify ONLY the amount without touching date
  await act(async () => {
    editInputs[3].props.onChange({ target: { value: '185.00' } });
  });

  recordedRequests.length = 0;
  await act(async () => {
    editForms[0].props.onSubmit({ preventDefault: () => {} });
  });

  const updateReq = recordedRequests.find((r) => r.method === 'PUT');
  assert.ok(updateReq, 'Must have recorded PUT update request');
  assert.equal(updateReq.body.expectedVersion, 1);
  assert.equal(updateReq.body.amount, '185.00');
  assert.ok(updateReq.body.effectiveFrom, 'Must have automatic valid effectiveFrom timestamp');

  // Version subview automatically returns to list view on success
  const formsAfterEdit = renderer.root.findAllByType('form');
  assert.equal(formsAfterEdit.length, 0, 'Must return to list view after successful update');

  // Test 5: History Subview Navigation (Enter -> View Timeline -> Back -> Return to List)
  const historyButtons = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('Histórico'));
  assert.ok(historyButtons.length >= 1, 'Must have Histórico action buttons');

  await act(async () => {
    historyButtons[0].props.onClick();
  });

  const historyViewText = JSON.stringify(renderer.toJSON());
  assert.ok(historyViewText.includes('Histórico de Versões'), 'Must render Histórico subview header');
  assert.ok(historyViewText.includes('PROP-2026'), 'Must display code in history header');
  assert.ok(historyViewText.includes('Versão original') || historyViewText.includes('Propina Anual'), 'Must display history details');
  assert.ok(historyViewText.includes('Linha Temporal de Vigência'), 'Must display timeline container');

  // Click Voltar ao catálogo from history subview
  const backHistoryBtn = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('Voltar ao catálogo'))[0];
  await act(async () => {
    backHistoryBtn.props.onClick();
  });

  const afterHistoryClose = JSON.stringify(renderer.toJSON());
  assert.ok(afterHistoryClose.includes('Emolumentos Registados'), 'Must return to default list view');
  assert.ok(!afterHistoryClose.includes('Linha Temporal de Vigência'), 'History subview must not be visible');

  // Test 6: Lifecycle actions (Deactivate / Activate)
  const deactivateBtn = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('Desativar'))[0];
  assert.ok(deactivateBtn, 'Must have Desativar button');

  recordedRequests.length = 0;
  await act(async () => {
    deactivateBtn.props.onClick();
  });

  const deactivateReq = recordedRequests.find((r) => r.method === 'POST' && r.url.endsWith('/deactivate'));
  assert.ok(deactivateReq, 'Must have recorded deactivate request');
  assert.ok(deactivateReq.headers['Idempotency-Key'], 'Must have Idempotency-Key on deactivate');

  console.log('Finance fee catalogue UI tests: PASS');
} finally {
  globalThis.fetch = originalFetch;
}
