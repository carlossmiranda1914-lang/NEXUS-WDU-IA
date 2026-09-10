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
  const client = new FinanceReadinessClient(async () => ({ ok: false, status: 403 }) as Response, async () => null);
  await assert.rejects(() => client.get(), /FINANCE_READINESS_FORBIDDEN/);
});

test('Finance readiness client reuses fiscal configuration and receipt-series endpoints without browser authority', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const client = new FinanceReadinessClient(async (input, init) => {
    calls.push({ input, init });
    return { ok: true, json: async () => ready } as Response;
  }, async () => 'token');

  await client.createFiscalConfiguration({ idempotencyKey: 'fiscal-key' });
  await client.createReceiptSeries({ code: 'RECEIPTS', idempotencyKey: 'series-key' });

  assert.equal(calls[0]?.input, '/api/finance/fiscal-configurations');
  assert.equal(calls[1]?.input, '/api/finance/document-series');
  assert.doesNotMatch(JSON.stringify(calls), /institutionId|nextSequenceNumber/);
});
