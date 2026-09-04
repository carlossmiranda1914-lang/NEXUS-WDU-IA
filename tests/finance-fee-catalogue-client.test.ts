import assert from 'node:assert/strict';
import {
  feeCatalogueClient,
  FeeCatalogueApiError,
  type FeeCatalogueRecord,
} from '../src/modules/finance/fee-catalogue-client.ts';

// 1. list
let capturedUrl: string = '';
let capturedHeaders: Record<string, string> = {};
let capturedMethod: string = 'GET';
let capturedBody: string | undefined = undefined;

const getUrl = (): string => capturedUrl;
const getBody = (): string | undefined => capturedBody;
const getMethod = (): string => capturedMethod;
const getHeaders = (): Record<string, string> => capturedHeaders;

const mockFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  capturedUrl = String(input);
  capturedMethod = init?.method || 'GET';
  capturedHeaders = (init?.headers as Record<string, string>) || {};
  capturedBody = typeof init?.body === 'string' ? init.body : undefined;

  const sampleRecord: FeeCatalogueRecord = {
    id: '00000000-0000-0000-0000-000000000010',
    code: 'PROP-2026',
    status: 'active',
    currentVersion: 1,
    current: {
      name: 'Propina Anual',
      kind: 'tuition',
      money: { amount: '120.00', currency: 'EUR' },
      effectiveFrom: '2026-09-01T00:00:00.000Z',
    },
  };

  if (capturedUrl.includes('error-403')) {
    return new Response(JSON.stringify({ code: 'FEE_CATALOGUE_FORBIDDEN', error: 'Acesso negado' }), { status: 403 });
  }
  if (capturedUrl.includes('error-409')) {
    return new Response(JSON.stringify({ code: 'FEE_CATALOGUE_CONFLICT', error: 'Catalogue version is stale' }), { status: 409 });
  }
  if (capturedUrl.includes('error-422')) {
    return new Response(JSON.stringify({ code: 'FEE_CATALOGUE_VALIDATION', error: 'amount must be positive' }), { status: 422 });
  }

  if (capturedMethod === 'GET' && capturedUrl.includes('/api/finance/fee-catalogue/')) {
    return new Response(JSON.stringify(sampleRecord), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  if (capturedMethod === 'GET') {
    return new Response(JSON.stringify([sampleRecord]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify(sampleRecord), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

// Test list
const listResult = await feeCatalogueClient.list('active', mockFetch);
assert.equal(getUrl(), '/api/finance/fee-catalogue?status=active');
assert.equal(getMethod(), 'GET');
assert.equal(listResult.length, 1);
assert.equal(listResult[0].code, 'PROP-2026');

// Test get
const getItem = await feeCatalogueClient.get('00000000-0000-0000-0000-000000000010', true, mockFetch);
assert.equal(getUrl(), '/api/finance/fee-catalogue/00000000-0000-0000-0000-000000000010?history=true');
assert.equal(getItem.id, '00000000-0000-0000-0000-000000000010');

// Test create
const createInput = {
  code: 'EXAME',
  name: 'Taxa de Exame',
  kind: 'fee',
  amount: '15.00',
  currency: 'EUR',
  effectiveFrom: '2026-09-01T00:00:00.000Z',
};
await feeCatalogueClient.create(createInput, mockFetch);
assert.equal(getUrl(), '/api/finance/fee-catalogue');
assert.equal(getMethod(), 'POST');
assert.ok(getHeaders()['Idempotency-Key'], 'Must include Idempotency-Key on create');
assert.deepEqual(JSON.parse(getBody() || '{}'), createInput);
const createBody = getBody();
if (createBody) {
  assert.ok(!createBody.includes('institutionId'), 'Create body must not carry institutionId authority');
}

// Test update
const updateInput = {
  name: 'Taxa de Exame Recurso',
  kind: 'fee',
  amount: '20.00',
  currency: 'EUR',
  effectiveFrom: '2026-09-02T00:00:00.000Z',
  expectedVersion: 1,
};
await feeCatalogueClient.update('00000000-0000-0000-0000-000000000010', updateInput, mockFetch);
assert.equal(getUrl(), '/api/finance/fee-catalogue/00000000-0000-0000-0000-000000000010');
assert.equal(getMethod(), 'PUT');
assert.ok(getHeaders()['Idempotency-Key'], 'Must include Idempotency-Key on update');
assert.deepEqual(JSON.parse(getBody() || '{}'), updateInput);
const updateBody = getBody();
if (updateBody) {
  assert.ok(!updateBody.includes('institutionId'), 'Update body must not carry institutionId authority');
}

// Test setStatus (activate / deactivate)
await feeCatalogueClient.setStatus('00000000-0000-0000-0000-000000000010', false, mockFetch);
assert.equal(getUrl(), '/api/finance/fee-catalogue/00000000-0000-0000-0000-000000000010/deactivate');
assert.equal(getMethod(), 'POST');
assert.ok(getHeaders()['Idempotency-Key'], 'Must include Idempotency-Key on deactivate');

await feeCatalogueClient.setStatus('00000000-0000-0000-0000-000000000010', true, mockFetch);
assert.equal(getUrl(), '/api/finance/fee-catalogue/00000000-0000-0000-0000-000000000010/activate');
assert.equal(getMethod(), 'POST');
assert.ok(getHeaders()['Idempotency-Key'], 'Must include Idempotency-Key on activate');

// Test error handling
await assert.rejects(
  () => feeCatalogueClient.get('error-403', false, mockFetch),
  (err: unknown) => err instanceof FeeCatalogueApiError && err.status === 403 && err.code === 'FEE_CATALOGUE_FORBIDDEN',
);

await assert.rejects(
  () => feeCatalogueClient.get('error-409', false, mockFetch),
  (err: unknown) => err instanceof FeeCatalogueApiError && err.status === 409 && err.code === 'FEE_CATALOGUE_CONFLICT',
);

await assert.rejects(
  () => feeCatalogueClient.get('error-422', false, mockFetch),
  (err: unknown) => err instanceof FeeCatalogueApiError && err.status === 422 && err.code === 'FEE_CATALOGUE_VALIDATION',
);

// Invariant verification: no browser authority injected
assert.ok(!getUrl().includes('institutionId'), 'URL must not carry institutionId override');

console.log('Finance fee catalogue client tests: PASS');
