import assert from 'node:assert/strict';
import { PaymentApiClient, PaymentApiError } from '../src/modules/finance/payment-client.ts';

// 1. Receiver-sensitive fetcher simulating browser window.fetch
const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

function nativeFetch(this: any, input: RequestInfo | URL, init?: RequestInit) {
  if (this !== globalThis && (typeof (globalThis as any).window === 'undefined' || this !== (globalThis as any).window)) {
    throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
  }
  calls.push({ input, init });
  return Promise.resolve(
    new Response(
      JSON.stringify({
        payment: {
          id: '00000000-0000-0000-0000-000000000001',
          paymentReference: 'PAG-000001',
          status: 'confirmed',
          allocationStatus: 'unapplied',
          amount: '100.00',
          currency: 'EUR',
        },
        replayed: false,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  );
}

// Set global fetch to the receiver-sensitive nativeFetch to test default constructor behavior
const originalGlobalFetch = globalThis.fetch;
(globalThis as any).fetch = nativeFetch;

try {
  const client = new PaymentApiClient({
    getToken: async () => 'test-token',
  });

  // Call confirmManualPayment using default fetcher assignment
  const result = await client.confirmManualPayment({
    method: 'cash',
    amount: '100.00',
    currency: 'EUR',
    financialAccountId: '00000000-0000-0000-0000-000000000010',
    payerPersonId: '00000000-0000-0000-0000-000000000020',
  });

  assert.equal(result.payment.paymentReference, 'PAG-000001');
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(call.input, '/api/finance/payments/manual');
  const headers = (call.init?.headers as Record<string, string>) || {};
  assert.equal(headers.Authorization, 'Bearer test-token');
  assert.ok(headers['Idempotency-Key'], 'Idempotency-Key header must be generated');

  // Test error parsing
  function errorNativeFetch(this: any, _input: RequestInfo | URL, _init?: RequestInit) {
    if (this !== globalThis && (typeof (globalThis as any).window === 'undefined' || this !== (globalThis as any).window)) {
      throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          error: 'INVALID_AMOUNT',
          message: 'O montante deve ser superior a zero.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
  }

  (globalThis as any).fetch = errorNativeFetch;
  const errorClient = new PaymentApiClient({
    getToken: async () => 'test-token',
  });

  await assert.rejects(
    () => errorClient.confirmManualPayment({
      method: 'cash',
      amount: '0.00',
      currency: 'EUR',
    }),
    (err: any) => {
      assert.ok(err instanceof PaymentApiError);
      assert.equal(err.status, 400);
      assert.equal(err.code, 'INVALID_AMOUNT');
      assert.match(err.message, /superior a zero/);
      return true;
    }
  );

  console.log('Payment Client Receiver Safety & Fetch Regression: PASS');
} finally {
  globalThis.fetch = originalGlobalFetch;
}
