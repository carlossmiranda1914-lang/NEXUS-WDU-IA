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
