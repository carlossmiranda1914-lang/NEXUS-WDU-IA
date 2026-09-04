import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { act, create } from 'react-test-renderer';
import FinanceFeeCatalogueWorkspace from '../src/components/FinanceFeeCatalogueWorkspace.tsx';
import type { FeeCatalogueRecord } from '../src/modules/finance/fee-catalogue-client.ts';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// 1. Static UI and Contract Safety Checks
const workspaceSource = fs.readFileSync('src/components/FinanceFeeCatalogueWorkspace.tsx', 'utf8');
const clientSource = fs.readFileSync('src/modules/finance/fee-catalogue-client.ts', 'utf8');
const appSource = fs.readFileSync('src/App.tsx', 'utf8');

// Title & Descriptions
assert.ok(workspaceSource.includes('Finance — Fee / Emolument Catalogue'), 'Must contain official title');
assert.ok(workspaceSource.includes('Definições institucionais; não cria obrigações nem pagamentos.'), 'Must state non-journal nature');
assert.ok(workspaceSource.includes('A carregar catálogo...'), 'Must contain loading message');
assert.ok(workspaceSource.includes('Ainda não existem emolumentos neste catálogo.'), 'Must contain empty message');
assert.ok(workspaceSource.includes('Tentar novamente'), 'Must contain retry button');
assert.ok(workspaceSource.includes('Guardar nova versão'), 'Must contain edit version submit');
assert.ok(workspaceSource.includes('Criar catálogo'), 'Must contain create submit');

// Safety: no authority in browser
for (const forbidden of [
  'institutionId:',
  'personId:',
  'journal_entries',
  'finance_general_ledger',
  'outstandingFees',
  'localStorage',
  'executeIdempotentFinanceCommand',
  'PostgresFeeCatalogueRepository',
]) {
  assert.ok(!workspaceSource.includes(forbidden), `Forbidden backend/authority symbol in UI workspace: ${forbidden}`);
}

// Mounted in App.tsx
assert.ok(appSource.includes("const FinanceFeeCatalogueWorkspace = lazy(() => import('./components/FinanceFeeCatalogueWorkspace'));"));
assert.ok(appSource.includes("<FinanceFeeCatalogueWorkspace theme={theme} />"));

// 2. Interactive Component Tests with react-test-renderer
const sampleItems: FeeCatalogueRecord[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    code: 'PROP-2026',
    status: 'active',
    currentVersion: 1,
    current: {
      name: 'Propinas 2026/2027',
      kind: 'tuition',
      description: 'Mensalidade regular',
      money: { amount: '150.00', currency: 'EUR' },
      effectiveFrom: '2026-09-01T00:00:00.000Z',
    },
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    code: 'CERT-01',
    status: 'inactive',
    currentVersion: 2,
    current: {
      name: 'Certificado de Habilitações',
      kind: 'document',
      description: null,
      money: { amount: '25.00', currency: 'EUR' },
      effectiveFrom: '2026-09-01T00:00:00.000Z',
    },
  },
];

let itemsStore = [...sampleItems];
let failNextLoad = false;
let failNextMutation: string | null = null;
const recordedRequests: Array<{ url: string; method: string; body?: any; headers?: any }> = [];

const originalFetch = globalThis.fetch;

function setupMockFetch() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || 'GET';
    const headers = (init?.headers as Record<string, string>) || {};
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const req = { url, method, headers, body };
    recordedRequests.push(req);

    if (failNextLoad && method === 'GET') {
      failNextLoad = false;
      return new Response(JSON.stringify({ code: 'LOAD_ERROR', error: 'Falha de rede ao carregar' }), { status: 500 });
    }

    if (failNextMutation && method !== 'GET') {
      const code = failNextMutation;
      failNextMutation = null;
      if (code === '403') {
        return new Response(JSON.stringify({ code: 'FEE_CATALOGUE_FORBIDDEN', error: 'Acesso não autorizado' }), { status: 403 });
      }
      if (code === '409') {
        return new Response(JSON.stringify({ code: 'FEE_CATALOGUE_CONFLICT', error: 'Catalogue version is stale' }), { status: 409 });
      }
      return new Response(JSON.stringify({ code: 'ERROR', error: 'Erro de mutação' }), { status: 500 });
    }

    // GET list
    if (method === 'GET' && url.includes('/api/finance/fee-catalogue')) {
      return new Response(JSON.stringify(itemsStore), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST create
    if (method === 'POST' && url === '/api/finance/fee-catalogue') {
      const created: FeeCatalogueRecord = {
        id: '00000000-0000-0000-0000-000000000003',
        code: body.code.toUpperCase(),
        status: 'active',
        currentVersion: 1,
        current: {
          name: body.name,
          kind: body.kind,
          description: body.description || null,
          money: { amount: body.amount, currency: body.currency },
          effectiveFrom: body.effectiveFrom,
        },
      };
      itemsStore.push(created);
      return new Response(JSON.stringify(created), { status: 201 });
    }

    // PUT update
    if (method === 'PUT' && url.startsWith('/api/finance/fee-catalogue/')) {
      const id = url.split('/')[4];
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
      const id = url.split('/')[4];
      const item = itemsStore.find((x) => x.id === id);
      if (item) item.status = 'active';
      return new Response(JSON.stringify(item), { status: 200 });
    }

    if (method === 'POST' && url.endsWith('/deactivate')) {
      const id = url.split('/')[4];
      const item = itemsStore.find((x) => x.id === id);
      if (item) item.status = 'inactive';
      return new Response(JSON.stringify(item), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }) as any;
}

try {
  setupMockFetch();

  // Test 1: Loading state & List rendering
  let renderer: any;
  await act(async () => {
    renderer = create(React.createElement(FinanceFeeCatalogueWorkspace, { theme: 'dark' }));
  });

  const renderedText = JSON.stringify(renderer.toJSON());
  assert.ok(renderedText.includes('PROP-2026'), 'Must render item PROP-2026');
  assert.ok(renderedText.includes('CERT-01'), 'Must render item CERT-01');
  assert.ok(renderedText.includes('150.00'), 'Must render item amount');

  // Test 2: Empty state
  itemsStore = [];
  await act(async () => {
    renderer = create(React.createElement(FinanceFeeCatalogueWorkspace, { theme: 'dark' }));
  });
  const emptyText = JSON.stringify(renderer.toJSON());
  assert.ok(emptyText.includes('Ainda não existem emolumentos neste catálogo.'), 'Must render empty state message');

  // Test 3: Error and retry
  failNextLoad = true;
  await act(async () => {
    renderer = create(React.createElement(FinanceFeeCatalogueWorkspace, { theme: 'dark' }));
  });
  let errText = JSON.stringify(renderer.toJSON());
  assert.ok(errText.includes('Falha de rede ao carregar'), 'Must render load error message');

  // Click retry button
  itemsStore = [...sampleItems];
  const retryBtn = renderer.root.findByProps({ className: 'mt-3 underline text-sm hover:text-rose-300' });
  await act(async () => {
    retryBtn.props.onClick();
  });
  const retriedText = JSON.stringify(renderer.toJSON());
  assert.ok(retriedText.includes('PROP-2026'), 'Retry must succeed and render list');

  // Test 4: Create flow
  const formElement = renderer.root.findByType('form');
  const inputs = renderer.root.findAllByType('input');
  // Form fields: code, name, kind, amount, currency, effectiveFrom, description
  await act(async () => {
    inputs[0].props.onChange({ target: { value: 'SEGURO-ESC' } });
    inputs[1].props.onChange({ target: { value: 'Seguro Escolar' } });
    inputs[2].props.onChange({ target: { value: 'insurance' } });
    inputs[3].props.onChange({ target: { value: '12.50' } });
    inputs[4].props.onChange({ target: { value: 'EUR' } });
    inputs[5].props.onChange({ target: { value: '2026-09-01T08:00' } });
    inputs[6].props.onChange({ target: { value: 'Cobertura anual' } });
  });

  recordedRequests.length = 0;
  await act(async () => {
    formElement.props.onSubmit({ preventDefault: () => {} });
  });

  const createReq = recordedRequests.find((r) => r.method === 'POST' && r.url === '/api/finance/fee-catalogue');
  assert.ok(createReq, 'Must have recorded create POST request');
  assert.ok(createReq.headers['Idempotency-Key'], 'Must have Idempotency-Key');
  assert.equal(createReq.body.code, 'SEGURO-ESC');
  const postCreateText = JSON.stringify(renderer.toJSON());
  assert.ok(postCreateText.includes('SEGURO-ESC'), 'Created item must appear in list');

  // Test 5: Edit item flow
  const editButtons = renderer.root.findAll((node: any) => node.type === 'button' && node.children.includes('Editar'));
  assert.ok(editButtons.length >= 1, 'Must have Editar buttons');

  await act(async () => {
    editButtons[0].props.onClick();
  });

  // Verify form heading changed to edit mode
  let editFormText = JSON.stringify(renderer.toJSON());
  assert.ok(editFormText.includes('Editar versão de PROP-2026'), 'Form must show edit header');
  assert.ok(editFormText.includes('Guardar nova versão'), 'Submit button must say Guardar nova versão');

  // Submit edit
  const updatedInputs = renderer.root.findAllByType('input');
  await act(async () => {
    updatedInputs[1].props.onChange({ target: { value: 'Propinas 2026 Atualizadas' } });
  });

  recordedRequests.length = 0;
  await act(async () => {
    renderer.root.findByType('form').props.onSubmit({ preventDefault: () => {} });
  });

  const updateReq = recordedRequests.find((r) => r.method === 'PUT');
  assert.ok(updateReq, 'Must have recorded PUT update request');
  assert.ok(updateReq.url.includes('00000000-0000-0000-0000-000000000001'));
  assert.equal(updateReq.body.expectedVersion, 1);
  assert.equal(updateReq.body.name, 'Propinas 2026 Atualizadas');

  // Test 6: Lifecycle actions (Deactivate / Activate)
  const deactivateBtn = renderer.root.findAll((node: any) => node.type === 'button' && node.children.includes('Desativar'))[0];
  assert.ok(deactivateBtn, 'Must have Desativar button for active item');

  recordedRequests.length = 0;
  await act(async () => {
    deactivateBtn.props.onClick();
  });

  const deactivateReq = recordedRequests.find((r) => r.method === 'POST' && r.url.endsWith('/deactivate'));
  assert.ok(deactivateReq, 'Must have recorded deactivate request');
  assert.ok(deactivateReq.headers['Idempotency-Key'], 'Must have Idempotency-Key on deactivate');

  // Test 7: Conflict handling (409)
  failNextMutation = '409';
  const editButtons2 = renderer.root.findAll((node: any) => node.type === 'button' && node.children.includes('Editar'));
  await act(async () => {
    editButtons2[0].props.onClick();
  });
  await act(async () => {
    renderer.root.findByType('form').props.onSubmit({ preventDefault: () => {} });
  });
  const conflictText = JSON.stringify(renderer.toJSON());
  assert.ok(conflictText.includes('Catalogue version is stale') || conflictText.includes('Erro ao guardar'), 'Conflict error must be presented to user');

  // Test 8: Forbidden handling (403)
  failNextMutation = '403';
  await act(async () => {
    editButtons2[0].props.onClick();
  });
  await act(async () => {
    renderer.root.findByType('form').props.onSubmit({ preventDefault: () => {} });
  });
  const forbiddenText = JSON.stringify(renderer.toJSON());
  assert.ok(forbiddenText.includes('Acesso não autorizado') || forbiddenText.includes('Erro ao guardar'), 'Forbidden error must be presented to user');

  console.log('Finance fee catalogue UI tests: PASS');
} finally {
  globalThis.fetch = originalFetch;
}
