import assert from 'node:assert/strict';
import test from 'node:test';
import { FinanceReadinessClient } from '../src/modules/finance/finance-readiness-client.ts';

const ready = { module: 'FINANCE' as const, status: 'READY' as const, canManageConfiguration: true, requirements: [] };

test('Finance readiness client dispatches through a receiver-safe default fetch and never sends tenant authority', async () => {
  const originalFetch = globalThis.fetch;
  const calls: RequestInit[] = [];
  globalThis.fetch = (async function (this: unknown, _input: RequestInfo | URL, init?: RequestInit) {
    assert.equal(this, globalThis);
    calls.push(init ?? {});
    return { ok: true, json: async () => ready } as Response;
  }) as typeof fetch;
  try {
    const client = new FinanceReadinessClient(undefined, async () => 'token');
    assert.deepEqual(await client.get(), ready);
    assert.equal((calls[0]?.headers as Record<string, string>).Authorization, 'Bearer token');
    assert.equal(JSON.stringify(calls[0]), JSON.stringify({ headers: { Authorization: 'Bearer token' } }));
  } finally { globalThis.fetch = originalFetch; }
});

test('Finance readiness client preserves safe authorization errors', async () => {
  const client = new FinanceReadinessClient(async () => ({ ok: false, status: 403 }) as Response, async () => 'token');
  await assert.rejects(() => client.get(), /FINANCE_READINESS_FORBIDDEN/);
});

test('Finance readiness client has finite, distinct authenticated token outcomes and never falls back to an anonymous request', async () => {
  const calls: unknown[] = [];
  const successful = new FinanceReadinessClient(async (...args) => {
    calls.push(args);
    return { ok: true, json: async () => ready } as Response;
  }, async () => 'token', 20);
  assert.deepEqual(await successful.get(), ready);
  assert.equal(calls.length, 1);

  const rejected = new FinanceReadinessClient(async () => ({ ok: true, json: async () => ready }) as Response, async () => { throw new Error('firebase unavailable'); }, 20);
  await assert.rejects(() => rejected.get(), /TOKEN_ACQUISITION_FAILED/);

  const pendingCalls: unknown[] = [];
  const timedOut = new FinanceReadinessClient(async (...args) => {
    pendingCalls.push(args);
    return { ok: true, json: async () => ready } as Response;
  }, async () => await new Promise<string>(() => {}), 20);
  await assert.rejects(() => timedOut.get(), /TOKEN_ACQUISITION_TIMEOUT/);
  assert.equal(pendingCalls.length, 0, 'a token timeout must not become an anonymous readiness request');

  const missingCalls: unknown[] = [];
  const missing = new FinanceReadinessClient(async (...args) => {
    missingCalls.push(args);
    return { ok: true, json: async () => ready } as Response;
  }, async () => null, 20);
  await assert.rejects(() => missing.get(), /AUTH_USER_MISSING/);
  assert.equal(missingCalls.length, 0, 'a missing user must not become an anonymous readiness request');

  const unauthorized = new FinanceReadinessClient(async () => ({ ok: false, status: 401 }) as Response, async () => 'token', 20);
  await assert.rejects(() => unauthorized.get(), /FINANCE_READINESS_AUTH_REQUIRED/);
});

test('Finance readiness client creates only local institutional prerequisites without browser authority', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const client = new FinanceReadinessClient(async (input, init) => {
    calls.push({ input, init });
    return { ok: true, json: async () => ready } as Response;
  }, async () => 'token');

  await client.createLegalProfile({ legalName: 'Nexus', countryCode: 'AO', addressLine1: 'Rua', effectiveFrom: '2026-01-01T00:00:00.000Z' });
  await client.createFinancialProfile({ primaryJurisdiction: 'AO', functionalCurrency: 'AOA', financialTimezone: 'Africa/Luanda', monetaryPolicyVersion: 'v1', enabledCurrencies: ['AOA'], effectiveFrom: '2026-01-01T00:00:00.000Z' });

  assert.equal(calls[0]?.input, '/api/institution/legal-profile');
  assert.equal(calls[1]?.input, '/api/finance/profile');
  assert.doesNotMatch(JSON.stringify(calls), /institutionId|nextSequenceNumber|adapterKey|core/);
});

test('Finance readiness client exposes existing fiscal and series commands without browser-derived authority', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const client = new FinanceReadinessClient(async (input, init) => {
    calls.push({ input, init });
    return { ok: true, json: async () => ({ id: 'result' }) } as Response;
  }, async () => 'token');

  await client.createFiscalConfiguration({ version: 1, operationalConfiguration: {}, effectiveFrom: '2026-01-01T00:00:00.000Z', idempotencyKey: 'fiscal-ui-1' });
  await client.createDocumentSeries({ code: 'UAT-R', documentType: 'receipt', effectiveFrom: '2026-01-01T00:00:00.000Z', idempotencyKey: 'series-ui-1' });

  assert.equal(calls[0]?.input, '/api/finance/fiscal-configurations');
  assert.equal(calls[1]?.input, '/api/finance/document-series');
  assert.equal((calls[0]?.init?.headers as Record<string, string>)['Idempotency-Key'], 'fiscal-ui-1');
  assert.equal((calls[1]?.init?.headers as Record<string, string>)['Idempotency-Key'], 'series-ui-1');
  assert.doesNotMatch(JSON.stringify(calls), /institutionId|adapterKey|nextSequenceNumber|core/);
});
