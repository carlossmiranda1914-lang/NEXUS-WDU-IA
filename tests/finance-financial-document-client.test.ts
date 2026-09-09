import test from 'node:test';
import assert from 'node:assert/strict';
import { FinancialDocumentClient } from '../src/modules/finance/financial-document-client.ts';

const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
const unavailable = () => ({ ok: false, status: 422, json: async () => ({ code: 'FINANCIAL_DOCUMENT_VALIDATION' }) }) as Response;
const authenticationRequired = () => ({ ok: false, status: 401, json: async () => ({ error: 'Unauthorized: Missing token' }) }) as Response;

test('F7-06 delegates receipt issuance and correction through idempotent authoritative HTTP commands', async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const client = new FinancialDocumentClient(async (path, init) => { calls.push({ path: String(path), init }); return response({ id: 'doc-1', sequenceNumber: 7, replayed: false }); }, async () => 'token');
  await client.issueReceipt({ sourceId: 'pay-1', seriesId: 'series-1', idempotencyKey: 'receipt-stable-key' });
  await client.issueCorrection({ originalDocumentId: 'doc-1', seriesId: 'credit-series', idempotencyKey: 'correction-stable-key' });
  assert.equal(calls[0]?.path, '/api/finance/documents/issue'); assert.equal((calls[0]?.init?.headers as Record<string, string>)['Idempotency-Key'], 'receipt-stable-key'); assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), { sourceId: 'pay-1', seriesId: 'series-1', documentType: 'receipt' });
  assert.equal(calls[1]?.path, '/api/finance/documents/doc-1/corrections'); assert.equal((calls[1]?.init?.headers as Record<string, string>)['Idempotency-Key'], 'correction-stable-key'); assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), { seriesId: 'credit-series', documentType: 'credit_note' });
});

test('F7-06 only presents active receipt and credit-note series returned by the server', async () => {
  const client = new FinancialDocumentClient(async () => response({ items: [{ id: 'receipt', document_type: 'receipt', status: 'active' }, { id: 'inactive', document_type: 'receipt', status: 'inactive' }, { id: 'credit', document_type: 'credit_note', status: 'active' }] }), async () => null);
  assert.deepEqual((await client.listActiveReceiptSeries()).map(item => item.id), ['receipt']);
  assert.deepEqual((await client.listActiveCorrectionSeries()).map(item => item.id), ['credit']);
});

test('F7-06 turns unavailable issuance into an actionable configuration result', async () => {
  const client = new FinancialDocumentClient(async () => unavailable(), async () => null);
  await assert.rejects(() => client.issueReceipt({ sourceId: 'pay-1', seriesId: 'series-1', idempotencyKey: 'receipt-stable-key' }), /configuração fiscal e a série efetiva/);
});

test('F7-06 preserves an authentication-required list failure for safe UAT diagnosis', async () => {
  const client = new FinancialDocumentClient(async () => authenticationRequired(), async () => null);
  await assert.rejects(() => client.list(), /FINANCIAL_DOCUMENT_AUTH_REQUIRED/);
});

test('F7-06 emits only safe correlated UAT fetch events', async () => {
  const events: Array<Record<string, unknown>> = [];
  const client = new FinancialDocumentClient(async () => authenticationRequired(), async () => 'secret-token', (event) => events.push(event), () => true);
  await assert.rejects(() => client.list(), /FINANCIAL_DOCUMENT_AUTH_REQUIRED/);
  assert.equal(events[0]?.event, 'FINANCE_DOCUMENT_FETCH_INTENT');
  assert.equal(events[0]?.authorizationPlanned, true);
  const responseEvent = events.find(event => event.event === 'FINANCE_DOCUMENT_FETCH_RESPONSE');
  assert.equal(responseEvent?.status, 401);
  assert.equal(events[0]?.traceId, responseEvent?.traceId);
  assert.doesNotMatch(JSON.stringify(events), /secret-token|Bearer|authorization:/i);
});

test('F7-06 diagnostics characterize request construction and sanitize transport errors', async () => {
  const events: Array<Record<string, unknown>> = [];
  const client = new FinancialDocumentClient(async () => { throw new TypeError('Failed to fetch Bearer secret-token'); }, async () => 'secret-token', (event) => events.push(event), () => true);
  await assert.rejects(() => client.list(), TypeError);
  const construction = events.find(event => event.event === 'FINANCE_DOCUMENT_REQUEST_CONSTRUCTION');
  const failure = events.find(event => event.event === 'FINANCE_DOCUMENT_FETCH_NETWORK_FAILURE');
  assert.equal(construction?.requestConstruction, 'PASS');
  assert.equal(construction?.requestHeaderNames, 'authorization,x-nexus-uat-trace');
  assert.equal(failure?.errorName, 'TypeError');
  assert.doesNotMatch(String(failure?.errorMessage), /secret-token|Bearer/i);
});

test('F7-06 invokes its stored fetch function as a client method', async () => {
  const events: Array<Record<string, unknown>> = [];
  const receiverSensitiveFetch = async function (this: unknown) {
    if (this !== globalThis) throw new TypeError('Illegal invocation');
    return response({ items: [] });
  } as typeof fetch;
  const client = new FinancialDocumentClient(receiverSensitiveFetch, async () => null, (event) => events.push(event));
  await assert.rejects(() => client.list(), /Illegal invocation/);
  const failure = events.find(event => event.event === 'FINANCE_DOCUMENT_FETCH_NETWORK_FAILURE');
  assert.equal(failure?.errorName, 'TypeError');
  assert.equal(failure?.errorMessage, 'Illegal invocation');
});

test('F7-06 default browser fetch preserves the global receiver', async () => {
  const originalFetch = globalThis.fetch;
  const receiverSensitiveFetch = async function (this: unknown) {
    if (this !== globalThis) throw new TypeError('Illegal invocation');
    return response({ items: [] });
  } as typeof fetch;
  globalThis.fetch = receiverSensitiveFetch;
  try {
    const client = new FinancialDocumentClient(undefined, async () => null, () => undefined);
    assert.deepEqual(await client.list(), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
