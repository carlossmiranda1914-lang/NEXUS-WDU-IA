import assert from 'node:assert/strict';
import { ObligationAdjustmentApiClient, ObligationAdjustmentApiError } from '../src/modules/finance/obligation-adjustment-client.ts';

let called: { path: string; init?: RequestInit } | undefined;
const client = new ObligationAdjustmentApiClient(async (path, init) => { called = { path: String(path), init }; return new Response(JSON.stringify({ adjustment: { id: 'adj-1' }, position: {}, replayed: false }), { status: 201, headers: { 'Content-Type': 'application/json' } }); }, async () => 'token');
const result = await client.record('ob/a', { direction: 'decrease', amount: '20.00', currency: 'EUR', reason: 'Acerto' }, 'key-1');
assert.equal(called?.path, '/api/finance/obligations/ob%2Fa/adjustments');
assert.equal((called?.init?.headers as Record<string, string>)['Idempotency-Key'], 'key-1');
assert.equal((called?.init?.headers as Record<string, string>).Authorization, 'Bearer token');
assert.match(String(called?.init?.body), /20\.00/); assert.equal(result.replayed, false);
const failure = new ObligationAdjustmentApiClient(async () => new Response(JSON.stringify({ code: 'ADJUSTMENT_VALIDATION_ERROR', error: 'Inválido' }), { status: 422, headers: { 'Content-Type': 'application/json' } }), async () => null);
await assert.rejects(() => failure.record('ob', { direction: 'increase', amount: '1', currency: 'EUR', reason: 'x' }, 'key-2'), (error: unknown) => error instanceof ObligationAdjustmentApiError && error.status === 422 && error.code === 'ADJUSTMENT_VALIDATION_ERROR');
console.log('F5_CLIENT_CONTRACT=PASS');
