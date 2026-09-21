import assert from 'node:assert/strict';
import {
  feeCatalogueClient,
  FeeCatalogueApiError,
  type FeeCatalogueRecord,
  type FeeTypeRecord,
} from '../src/modules/finance/fee-catalogue-client.ts';

let capturedUrl: string = '';
let capturedHeaders: Record<string, string> = {};
let capturedMethod: string = 'GET';
let capturedBody: string | undefined = undefined;

const getUrl = (): string => capturedUrl;
const getBody = (): string | undefined => capturedBody;
const getMethod = (): string => capturedMethod;
const getHeaders = (): Record<string, string> => capturedHeaders;

const sampleRecord: FeeCatalogueRecord = {
  id: '00000000-0000-0000-0000-000000000010',
  feeTypeId: '00000000-0000-0000-0000-000000000001',
  feeType: {
    id: '00000000-0000-0000-0000-000000000001',
    displayName: 'Propina / Mensalidade',
    codePrefix: 'PROP',
  },
  code: 'PROP-000001',
  status: 'active',
  currentVersion: 1,
  current: {
    name: 'Propina Anual',
    kind: 'tuition',
    money: { amount: '120.00', currency: 'EUR' },
    effectiveFrom: '2026-09-01T00:00:00.000Z',
  },
};

const sampleTypeRecord: FeeTypeRecord = {
  id: '00000000-0000-0000-0000-000000000001',
  canonicalKey: 'tuition',
  source: 'nexus_base',
  displayName: 'Propina / Mensalidade',
  codePrefix: 'PROP',
  status: 'active',
};

const mockFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  capturedUrl = String(input);
  capturedMethod = init?.method || 'GET';
  capturedHeaders = (init?.headers as Record<string, string>) || {};
  capturedBody = typeof init?.body === 'string' ? init.body : undefined;

  if (capturedUrl.includes('error-401-unauthorized')) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Missing token' }), { status: 401 });
  }
  if (capturedUrl.includes('error-403')) {
    return new Response(JSON.stringify({ code: 'FEE_CATALOGUE_FORBIDDEN', error: 'Acesso negado' }), { status: 403 });
  }
  if (capturedUrl.includes('error-409')) {
    return new Response(JSON.stringify({ code: 'FEE_CATALOGUE_CONFLICT', error: 'Catalogue version is stale' }), { status: 409 });
  }
  if (capturedUrl.includes('error-422')) {
    return new Response(JSON.stringify({ code: 'FEE_CATALOGUE_VALIDATION', error: 'amount must be positive' }), { status: 422 });
  }

  if (capturedUrl.includes('/api/finance/fee-types')) {
    if (capturedMethod === 'POST' || capturedMethod === 'PUT') {
      return new Response(JSON.stringify(sampleTypeRecord), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify([sampleTypeRecord]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  if (capturedMethod === 'GET' && capturedUrl.includes('/api/finance/fee-catalogue/')) {
    return new Response(JSON.stringify(sampleRecord), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  if (capturedMethod === 'GET') {
    return new Response(JSON.stringify([sampleRecord]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify(sampleRecord), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

// 1. Authenticated token transport test
const fakeToken = 'nexus-session-token-abc123xyz';
const authOptions = {
  fetcher: mockFetch,
  getToken: async () => fakeToken,
};

const authList = await feeCatalogueClient.list('active', authOptions);
assert.equal(getUrl(), '/api/finance/fee-catalogue?status=active');
assert.equal(getMethod(), 'GET');
assert.equal(getHeaders()['Authorization'], `Bearer ${fakeToken}`, 'Must transport Authorization Bearer token when authenticated');
assert.equal(authList.length, 1);
assert.equal(authList[0].code, 'PROP-000001');

// 2. Unauthenticated state characterization (no token -> no Authorization header)
const unauthOptions = {
  fetcher: mockFetch,
  getToken: async () => null,
};
await feeCatalogueClient.list('all', unauthOptions);
assert.equal(getHeaders()['Authorization'], undefined, 'Must not attach Authorization header when unauthenticated');

// 3. Unauthenticated 401 error preserved from backend
await assert.rejects(
  () => feeCatalogueClient.get('error-401-unauthorized', false, unauthOptions),
  (err: unknown) => err instanceof FeeCatalogueApiError && err.status === 401 && err.message === 'Unauthorized: Missing token',
  '401 Missing token must be preserved and thrown as FeeCatalogueApiError',
);

// 4. Test get with auth
const getItem = await feeCatalogueClient.get('00000000-0000-0000-0000-000000000010', true, authOptions);
assert.equal(getUrl(), '/api/finance/fee-catalogue/00000000-0000-0000-0000-000000000010?history=true');
assert.equal(getItem.id, '00000000-0000-0000-0000-000000000010');
assert.equal(getHeaders()['Authorization'], `Bearer ${fakeToken}`);

// 5. Test create with auth + idempotency
const createInput = {
  feeTypeId: '00000000-0000-0000-0000-000000000001',
  name: 'Taxa de Exame',
  amount: '15.00',
  currency: 'EUR',
  effectiveFrom: '2026-09-01T00:00:00.000Z',
};
await feeCatalogueClient.create(createInput, authOptions);
assert.equal(getUrl(), '/api/finance/fee-catalogue');
assert.equal(getMethod(), 'POST');
assert.equal(getHeaders()['Authorization'], `Bearer ${fakeToken}`);
assert.ok(getHeaders()['Idempotency-Key'], 'Must include Idempotency-Key on create');
assert.deepEqual(JSON.parse(getBody() || '{}'), createInput);
const createBody = getBody();
if (createBody) {
  assert.ok(!createBody.includes('institutionId'), 'Create body must not carry institutionId authority');
}

// 6. Test update with auth + idempotency
const updateInput = {
  name: 'Taxa de Exame Recurso',
  amount: '20.00',
  currency: 'EUR',
  effectiveFrom: '2026-09-02T00:00:00.000Z',
  expectedVersion: 1,
};
await feeCatalogueClient.update('00000000-0000-0000-0000-000000000010', updateInput, authOptions);
assert.equal(getUrl(), '/api/finance/fee-catalogue/00000000-0000-0000-0000-000000000010');
assert.equal(getMethod(), 'PUT');
assert.equal(getHeaders()['Authorization'], `Bearer ${fakeToken}`);
assert.ok(getHeaders()['Idempotency-Key'], 'Must include Idempotency-Key on update');
assert.deepEqual(JSON.parse(getBody() || '{}'), updateInput);

// 7. Test Fee Types client methods
const typesList = await feeCatalogueClient.listTypes('active', authOptions);
assert.equal(getUrl(), '/api/finance/fee-types?status=active');
assert.equal(typesList.length, 1);
assert.equal(typesList[0].codePrefix, 'PROP');

await feeCatalogueClient.createType({ displayName: 'Lab', codePrefix: 'LAB' }, authOptions);
assert.equal(getUrl(), '/api/finance/fee-types');
assert.equal(getMethod(), 'POST');
assert.ok(getHeaders()['Idempotency-Key']);

await feeCatalogueClient.setTypeStatus('00000000-0000-0000-0000-000000000001', false, authOptions);
assert.equal(getUrl(), '/api/finance/fee-types/00000000-0000-0000-0000-000000000001/deactivate');
assert.equal(getMethod(), 'POST');

// 8. Test setStatus (activate / deactivate) on items
await feeCatalogueClient.setStatus('00000000-0000-0000-0000-000000000010', false, authOptions);
assert.equal(getUrl(), '/api/finance/fee-catalogue/00000000-0000-0000-0000-000000000010/deactivate');
assert.equal(getMethod(), 'POST');
assert.equal(getHeaders()['Authorization'], `Bearer ${fakeToken}`);
assert.ok(getHeaders()['Idempotency-Key'], 'Must include Idempotency-Key on deactivate');

// 9. Test error handling
await assert.rejects(
  () => feeCatalogueClient.get('error-403', false, authOptions),
  (err: unknown) => err instanceof FeeCatalogueApiError && err.status === 403 && err.code === 'FEE_CATALOGUE_FORBIDDEN',
);

await assert.rejects(
  () => feeCatalogueClient.get('error-409', false, authOptions),
  (err: unknown) => err instanceof FeeCatalogueApiError && err.status === 409 && err.code === 'FEE_CATALOGUE_CONFLICT',
);

await assert.rejects(
  () => feeCatalogueClient.get('error-422', false, authOptions),
  (err: unknown) => err instanceof FeeCatalogueApiError && err.status === 422 && err.code === 'FEE_CATALOGUE_VALIDATION',
);

console.log('Finance fee catalogue client tests: PASS');
