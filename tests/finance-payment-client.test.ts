import assert from 'node:assert/strict';
import {
  PaymentApiClient,
  PaymentApiError,
  type PaymentClientOptions,
} from '../src/modules/finance/payment-client.ts';
import type { Payment } from '../src/modules/finance/payment-model.ts';
import type { PaymentProviderConfigPublicProjection } from '../src/modules/finance/payment-provider-model.ts';

const mockPayment: Payment = {
  id: '00000000-0000-0000-0000-000000000010',
  institutionId: '00000000-0000-0000-0000-000000000001',
  paymentReference: 'PAG-000001',
  journalTransactionId: '00000000-0000-0000-0000-000000000020',
  sourceType: 'manual_offline',
  method: 'cash',
  amount: '120.00',
  currency: 'EUR',
  status: 'confirmed',
  allocationStatus: 'unapplied',
  effectiveAt: '2026-09-05T10:00:00.000Z',
  confirmedAt: '2026-09-05T10:00:00.000Z',
  createdAt: '2026-09-05T10:00:00.000Z',
  financialProfileVersion: 1,
  actorKind: 'human',
  actorPersonId: '00000000-0000-0000-0000-000000000030',
};

const mockProviderConfig: PaymentProviderConfigPublicProjection = {
  id: '00000000-0000-0000-0000-000000000040',
  institutionId: '00000000-0000-0000-0000-000000000001',
  providerKey: 'adyen',
  environment: 'test',
  status: 'active',
  merchantAccountRef: 'MerchantTest',
  supportedCurrencies: ['EUR'],
  enabledMethods: ['card'],
  operationalAvailability: 'available',
  createdAt: '2026-09-05T10:00:00.000Z',
  updatedAt: '2026-09-05T10:00:00.000Z',
};

// 1. listPayments sends Bearer token
{
  let requestedUrl = '';
  let authHeader = '';

  const mockFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = String(input);
    authHeader = (init?.headers as Record<string, string>)?.Authorization || '';
    return new Response(JSON.stringify([mockPayment]), { status: 200 });
  };

  const client = new PaymentApiClient({
    fetcher: mockFetch,
    getToken: async () => 'test-firebase-token',
  });

  const list = await client.listPayments();
  assert.equal(list.length, 1);
  assert.equal(list[0].paymentReference, 'PAG-000001');
  assert.equal(requestedUrl, '/api/finance/payments');
  assert.equal(authHeader, 'Bearer test-firebase-token');
}

// 2. confirmManualPayment adds Idempotency-Key
{
  let sentIdempKey = '';
  let sentBody: any = null;

  const mockFetch: typeof fetch = async (_input, init) => {
    sentIdempKey = (init?.headers as Record<string, string>)?.['Idempotency-Key'] || '';
    sentBody = JSON.parse(String(init?.body || '{}'));
    return new Response(JSON.stringify({ payment: mockPayment, replayed: false }), { status: 201 });
  };

  const client = new PaymentApiClient({
    fetcher: mockFetch,
    getToken: async () => 'test-token',
  });

  const res = await client.confirmManualPayment({
    method: 'cash',
    amount: '120.00',
    currency: 'EUR',
    notes: 'Pagamento teste',
  });

  assert.equal(res.replayed, false);
  assert.equal(res.payment.paymentReference, 'PAG-000001');
  assert.ok(sentIdempKey.startsWith('pay-manual-'));
  assert.equal(sentBody.amount, '120.00');
  assert.equal(sentBody.method, 'cash');
}

// 3. Error mapping into PaymentApiError
{
  const mockFetch: typeof fetch = async () => {
    return new Response(JSON.stringify({ code: 'PAYMENT_FORBIDDEN', error: 'Acesso negado' }), { status: 403 });
  };

  const client = new PaymentApiClient({
    fetcher: mockFetch,
    getToken: async () => 'test-token',
  });

  await assert.rejects(
    () => client.listPayments(),
    (err: any) => err instanceof PaymentApiError && err.status === 403 && err.code === 'PAYMENT_FORBIDDEN'
  );
}

// 4. Provider configs list and save
{
  const mockFetch: typeof fetch = async (input, init) => {
    if (init?.method === 'PUT') {
      return new Response(JSON.stringify(mockProviderConfig), { status: 200 });
    }
    return new Response(JSON.stringify([mockProviderConfig]), { status: 200 });
  };

  const client = new PaymentApiClient({
    fetcher: mockFetch,
    getToken: async () => 'test-token',
  });

  const configs = await client.listProviderConfigs();
  assert.equal(configs.length, 1);
  assert.equal(configs[0].providerKey, 'adyen');

  const saved = await client.saveProviderConfig('adyen', {
    environment: 'test',
    status: 'active',
    merchantAccountRef: 'MerchantTest',
    supportedCurrencies: ['EUR'],
    enabledMethods: ['card'],
    secretReferenceId: 'vault://test',
  });
  assert.equal(saved.providerKey, 'adyen');
}

console.log('Finance Payment Client Tests: PASS');
