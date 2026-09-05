import { strict as assert } from 'node:assert';
import { financialObligationClient } from '../src/modules/finance/financial-obligation-client.ts';

let capturedUrl = '';
let capturedInit: any = null;

const fakeFetcher: typeof fetch = (async (input: any, init?: any) => {
  capturedUrl = String(input);
  capturedInit = init;
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, url: capturedUrl }),
  } as any;
}) as any;

const fakeGetToken = async () => 'test-bearer-token';

// 1. List accounts sends bearer token and correct path
await financialObligationClient.listAccounts('active', { fetcher: fakeFetcher, getToken: fakeGetToken });
assert.equal(capturedUrl, '/api/finance/financial-accounts?status=active');
assert.equal(capturedInit?.headers?.Authorization, 'Bearer test-bearer-token');

// 2. Create account sends Idempotency-Key
await financialObligationClient.createAccount({ personId: '00000000-0000-0000-0000-000000000001' }, { fetcher: fakeFetcher, getToken: fakeGetToken });
assert.equal(capturedUrl, '/api/finance/financial-accounts');
assert.equal(capturedInit?.method, 'POST');
assert.ok(capturedInit?.headers?.['Idempotency-Key']);

// 3. List obligations with filters
await financialObligationClient.listObligations({ status: 'open', financialAccountId: 'acc-123' }, { fetcher: fakeFetcher, getToken: fakeGetToken });
assert.equal(capturedUrl, '/api/finance/obligations?status=open&financialAccountId=acc-123');

// 4. Create obligation sends Idempotency-Key
await financialObligationClient.createObligation({ financialAccountId: 'acc-123', feeCatalogueItemId: 'fee-123' }, { fetcher: fakeFetcher, getToken: fakeGetToken });
assert.equal(capturedUrl, '/api/finance/obligations');
assert.equal(capturedInit?.method, 'POST');
assert.ok(capturedInit?.headers?.['Idempotency-Key']);

// 5. Cancel obligation sends reason
await financialObligationClient.cancelObligation('obl-123', 'Motivo teste', { fetcher: fakeFetcher, getToken: fakeGetToken });
assert.equal(capturedUrl, '/api/finance/obligations/obl-123/cancel');
assert.equal(capturedInit?.method, 'POST');
assert.equal(JSON.parse(capturedInit?.body).reason, 'Motivo teste');

console.log('Finance financial obligation client tests: PASS');
