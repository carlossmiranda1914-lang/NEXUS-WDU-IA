import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { act, create } from 'react-test-renderer';
import FinanceFeeCatalogueWorkspace from '../src/components/FinanceFeeCatalogueWorkspace.tsx';
import type { FeeCatalogueRecord } from '../src/modules/finance/fee-catalogue-client.ts';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// 1. Static UI and Contract Safety Checks
const workspaceSource = fs.readFileSync('src/components/finance/fee-catalogue/FinanceFeeCatalogueWorkspace.tsx', 'utf8');
const listSource = fs.readFileSync('src/components/finance/fee-catalogue/FeeCatalogueList.tsx', 'utf8');
const createDialogSource = fs.readFileSync('src/components/finance/fee-catalogue/FeeCatalogueCreateDialog.tsx', 'utf8');
const versionDialogSource = fs.readFileSync('src/components/finance/fee-catalogue/FeeCatalogueVersionDialog.tsx', 'utf8');
const historyDialogSource = fs.readFileSync('src/components/finance/fee-catalogue/FeeCatalogueHistoryDialog.tsx', 'utf8');
const clientSource = fs.readFileSync('src/modules/finance/fee-catalogue-client.ts', 'utf8');
const appSource = fs.readFileSync('src/App.tsx', 'utf8');

// Title & Descriptions
assert.ok(listSource.includes('Catálogo de Emolumentos'), 'Must contain official Portuguese title');
assert.ok(listSource.includes('Tentar novamente'), 'Must contain retry button');
assert.ok(listSource.includes('+ Novo emolumento'), 'Must contain primary CTA');

// Auth and Transport Characterization: Client attaches Authorization Bearer token from Firebase auth
assert.ok(clientSource.includes("import { auth } from '../../lib/firebase.ts';"), 'Client must import canonical Firebase auth');
assert.ok(clientSource.includes('auth.currentUser'), 'Client must read current user from Firebase auth');
assert.ok(clientSource.includes('Authorization'), 'Client must attach Authorization header');

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
  assert.ok(!workspaceSource.includes(forbidden), `Forbidden backend/authority symbol in workspace: ${forbidden}`);
  assert.ok(!listSource.includes(forbidden), `Forbidden backend/authority symbol in list: ${forbidden}`);
  assert.ok(!createDialogSource.includes(forbidden), `Forbidden backend/authority symbol in create dialog: ${forbidden}`);
  assert.ok(!versionDialogSource.includes(forbidden), `Forbidden backend/authority symbol in version dialog: ${forbidden}`);
  assert.ok(!historyDialogSource.includes(forbidden), `Forbidden backend/authority symbol in history dialog: ${forbidden}`);
  assert.ok(!clientSource.includes(forbidden), `Forbidden backend/authority symbol in client: ${forbidden}`);
}

// Mounted in App.tsx
assert.ok(appSource.includes("const FinanceFeeCatalogueWorkspace = lazy(() => import('./components/FinanceFeeCatalogueWorkspace'));"));

// 2. Interactive Flow Tests with Mock API
const sampleItems: FeeCatalogueRecord[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    code: 'PROP-2026',
    status: 'active',
    currentVersion: 1,
    current: {
      name: 'Propinas 2026/2027',
      kind: 'tuition',
      description: 'Mensalidade do ano letivo',
      money: { amount: '150.00', currency: 'EUR' },
      effectiveFrom: '2026-08-01T00:00:00.000Z',
      effectiveTo: null,
    },
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    code: 'CERT-01',
    status: 'inactive',
    currentVersion: 2,
    current: {
      name: 'Certificado de Matrícula',
      kind: 'fee',
      description: null,
      money: { amount: '15.00', currency: 'EUR' },
      effectiveFrom: '2026-08-15T00:00:00.000Z',
      effectiveTo: null,
    },
  },
];

let itemsStore = [...sampleItems];
let failNextLoad = false;
let failNextMutation: string | null = null;
const recordedRequests: Array<{ method: string; url: string; headers: Record<string, string>; body?: any }> = [];

const originalFetch = globalThis.fetch;

function setupMockFetch() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || 'GET';
    const headers = (init?.headers as Record<string, string>) || {};
    let body: any = undefined;
    if (init?.body) {
      try {
        body = JSON.parse(String(init.body));
      } catch {
        body = init.body;
      }
    }

    recordedRequests.push({ method, url, headers, body });

    if (failNextLoad && method === 'GET') {
      failNextLoad = false;
      return new Response(JSON.stringify({ error: 'Network failure' }), { status: 500 });
    }

    if (failNextMutation) {
      const code = failNextMutation;
      failNextMutation = null;
      if (code === '409') {
        return new Response(JSON.stringify({ code: 'FEE_CATALOGUE_CONFLICT', error: 'Catalogue version is stale' }), { status: 409 });
      }
      if (code === '403') {
        return new Response(JSON.stringify({ code: 'FEE_CATALOGUE_FORBIDDEN', error: 'Acesso não permitido' }), { status: 403 });
      }
      if (code === '422') {
        return new Response(JSON.stringify({ code: 'FEE_CATALOGUE_VALIDATION', error: 'A data de início deve ser estritamente posterior' }), { status: 422 });
      }
    }

    // GET list
    if (method === 'GET' && url.includes('/api/finance/fee-catalogue?status=')) {
      const statusParam = url.split('status=')[1];
      let res = itemsStore;
      if (statusParam === 'active') res = itemsStore.filter((x) => x.status === 'active');
      if (statusParam === 'inactive') res = itemsStore.filter((x) => x.status === 'inactive');
      return new Response(JSON.stringify(res), { status: 200 });
    }

    // GET detail with history
    if (method === 'GET' && url.includes('?history=true')) {
      const id = url.split('/api/finance/fee-catalogue/')[1].split('?')[0];
      const item = itemsStore.find((x) => x.id === id);
      if (item) {
        const withHistory: FeeCatalogueRecord = {
          ...item,
          history: [
            {
              version: item.currentVersion,
              name: item.current.name,
              kind: item.current.kind,
              description: item.current.description,
              money: item.current.money,
              effectiveFrom: item.current.effectiveFrom,
              effectiveTo: null,
            },
            ...(item.currentVersion > 1
              ? [
                  {
                    version: 1,
                    name: `${item.current.name} v1`,
                    kind: item.current.kind,
                    description: 'Versão original',
                    money: { amount: '100.00', currency: item.current.money.currency },
                    effectiveFrom: '2026-01-01T00:00:00.000Z',
                    effectiveTo: item.current.effectiveFrom,
                  },
                ]
              : []),
          ],
        };
        return new Response(JSON.stringify(withHistory), { status: 200 });
      }
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

  // Test 1: Loading state & Default List view (NO forms present on default view)
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

  // Test 3: Creation flow via dedicated dialog
  const createBtn = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('+ Novo emolumento'))[0];
  assert.ok(createBtn, 'Must have + Novo emolumento primary action button');

  await act(async () => {
    createBtn.props.onClick();
  });

  // Creation dialog is now open
  const createForms = renderer.root.findAllByType('form');
  assert.equal(createForms.length, 1, 'Exactly one creation form dialog must be open');

  const createInputs = createForms[0].findAllByType('input');
  // Inputs: code, name, kind, amount, currency, effectiveFrom, description
  await act(async () => {
    createInputs[0].props.onChange({ target: { value: 'SEGURO-ESC' } });
    createInputs[1].props.onChange({ target: { value: 'Seguro Escolar Anual' } });
    createInputs[2].props.onChange({ target: { value: 'insurance' } });
    createInputs[3].props.onChange({ target: { value: '12,50' } }); // Test comma
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

  // Creation dialog closed automatically on success
  const formsAfterCreate = renderer.root.findAllByType('form');
  assert.equal(formsAfterCreate.length, 0, 'Creation dialog must close after successful creation');

  const postCreateText = JSON.stringify(renderer.toJSON());
  assert.ok(postCreateText.includes('SEGURO-ESC'), 'Created item must appear in list');

  // Test 4: Version publishing flow (Edit amount only without touching date)
  const editButtons = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('Editar'));
  assert.ok(editButtons.length >= 1, 'Must have Editar action buttons');

  await act(async () => {
    editButtons[0].props.onClick(); // Click edit on first item
  });

  // Version dialog is now open
  const editForms = renderer.root.findAllByType('form');
  assert.equal(editForms.length, 1, 'Exactly one edit version dialog must be open');

  const editInputs = editForms[0].findAllByType('input');
  // First input is disabled code
  assert.equal(editInputs[0].props.disabled, true, 'Code input must be disabled / immutable');

  // Modify ONLY the amount
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

  // Version dialog closed automatically on success
  const formsAfterEdit = renderer.root.findAllByType('form');
  assert.equal(formsAfterEdit.length, 0, 'Version dialog must close after successful update');

  // Test 5: History dialog flow
  const historyButtons = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('Histórico'));
  assert.ok(historyButtons.length >= 1, 'Must have Histórico action buttons');

  await act(async () => {
    historyButtons[0].props.onClick();
  });

  const historyText = JSON.stringify(renderer.toJSON());
  assert.ok(historyText.includes('Histórico de Versões'), 'Must open Histórico dialog');
  assert.ok(historyText.includes('Versão original') || historyText.includes('PROP-2026'), 'Must display history details');

  // Close history dialog
  const closeHistoryBtn = renderer.root.findAll((node: any) => node.type === 'button' && node.children?.includes('Fechar'))[0];
  await act(async () => {
    closeHistoryBtn.props.onClick();
  });
  const afterHistoryClose = JSON.stringify(renderer.toJSON());
  assert.ok(!afterHistoryClose.includes('Histórico de Versões'), 'Histórico dialog must close');

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
