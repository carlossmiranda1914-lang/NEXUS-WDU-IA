import assert from 'node:assert/strict';
import { AllocationApiClient, AllocationApiError } from '../src/modules/finance/allocation-client.ts';

let called: { path: string; init?: RequestInit } | undefined;
const client = new AllocationApiClient({
  getToken: async () => 'token',
  fetcher: async (path, init) => { called = { path: String(path), init }; return new Response(JSON.stringify({ allocations: [], replayed: false }), { status: 201, headers: { 'Content-Type': 'application/json' } }); },
});
await client.confirm({ paymentId: 'pay/a', lines: [{ obligationId: 'ob/b', amount: '100.00' }] }, 'key-1');
assert.equal(called?.path, '/api/finance/allocations');
assert.equal((called?.init?.headers as Record<string, string>)['Idempotency-Key'], 'key-1');
assert.equal((called?.init?.headers as Record<string, string>).Authorization, 'Bearer token');
assert.match(String(called?.init?.body), /100\.00/);
const failures = new AllocationApiClient({ getToken: async () => null, fetcher: async () => new Response(JSON.stringify({ code: 'ALLOCATION_CONFLICT', error: 'Conflito' }), { status: 409, headers: { 'Content-Type': 'application/json' } }) });
await assert.rejects(() => failures.reverse('a/b', { amount: '20.00', reason: 'Erro' }, 'key-2'), (error: unknown) => error instanceof AllocationApiError && error.status === 409 && error.code === 'ALLOCATION_CONFLICT');
console.log('finance-allocation-client: PASS');
