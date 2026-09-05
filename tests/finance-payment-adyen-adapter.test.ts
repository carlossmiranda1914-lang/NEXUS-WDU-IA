import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  AdyenAdapter,
  calculateAdyenHmac,
} from '../src/modules/finance/providers/adyen-adapter.ts';
import type { PaymentProviderConfig } from '../src/modules/finance/payment-provider-model.ts';

const mockHmacKeyHex = '44782F3DEBEA52232C80CA829978C2E75CBE1441F10F0945B97F36E493D6BDD2'; // 32-byte hex key
const mockConfig: PaymentProviderConfig = {
  id: '00000000-0000-0000-0000-000000000801',
  institutionId: '00000000-0000-0000-0000-000000000001',
  providerKey: 'adyen',
  environment: 'test',
  status: 'active',
  merchantAccountRef: 'TestMerchantPT',
  supportedCurrencies: ['EUR', 'USD'],
  enabledMethods: ['card', 'mbway'],
  operationalAvailability: 'available',
  secretReferenceId: 'vault://secrets/adyen/mock',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  configurationMetadata: {},
};

const adapter = new AdyenAdapter();

// 1. HMAC Calculation Verification
{
  const item = {
    pspReference: '8815123456789012',
    originalReference: '',
    merchantAccountCode: 'TestMerchantPT',
    merchantReference: 'NEXUS-PAY-001',
    value: '12550', // 125.50 EUR
    currency: 'EUR',
    eventCode: 'AUTHORISATION',
    success: 'true',
  };

  const computedHmac = calculateAdyenHmac(item, mockHmacKeyHex);
  assert.ok(computedHmac);
  assert.equal(typeof computedHmac, 'string');
}

// 2. Normalization of verified Adyen notification item
{
  const notificationPayload = {
    live: 'false',
    notificationItems: [
      {
        NotificationRequestItem: {
          additionalData: {
            hmacSignature: '',
          },
          amount: {
            currency: 'EUR',
            value: 12550, // 125.50
          },
          eventCode: 'AUTHORISATION',
          eventDate: '2026-09-05T12:00:00+00:00',
          merchantAccountCode: 'TestMerchantPT',
          merchantReference: 'ACC:00000000-0000-0000-0000-000000000055',
          paymentMethod: 'visa',
          pspReference: '8815123456789012',
          success: 'true',
        },
      },
    ],
  };

  const item = notificationPayload.notificationItems[0].NotificationRequestItem;
  const hmac = calculateAdyenHmac(
    {
      pspReference: item.pspReference,
      originalReference: '',
      merchantAccountCode: item.merchantAccountCode,
      merchantReference: item.merchantReference,
      value: String(item.amount.value),
      currency: item.amount.currency,
      eventCode: item.eventCode,
      success: item.success,
    },
    mockHmacKeyHex
  );
  item.additionalData.hmacSignature = hmac;

  const rawBody = Buffer.from(JSON.stringify(notificationPayload), 'utf8');

  // Authenticate webhook
  const authRes = await adapter.authenticateWebhook(rawBody, {}, mockConfig, mockHmacKeyHex);
  assert.equal(authRes.valid, true);

  // Parse and normalize
  const normalized = await adapter.parseAndNormalizeEvent(rawBody, {}, mockConfig);
  assert.ok(normalized);
  assert.equal(normalized.providerKey, 'adyen');
  assert.equal(normalized.providerEventId, '8815123456789012');
  assert.equal(normalized.eventType, 'AUTHORISATION');
  assert.equal(normalized.isConfirmed, true);
  assert.ok(normalized.candidate);
  assert.equal(normalized.candidate.amount, '125.5');
  assert.equal(normalized.candidate.currency, 'EUR');
  assert.equal(normalized.candidate.method, 'card');
  assert.equal(normalized.candidate.providerTransactionRef, '8815123456789012');
  assert.equal(normalized.candidate.financialAccountId, '00000000-0000-0000-0000-000000000055');
}

// 3. Rejection of invalid HMAC
{
  const badPayload = JSON.stringify({
    live: 'false',
    notificationItems: [
      {
        NotificationRequestItem: {
          additionalData: {
            hmacSignature: 'invalid-signature-1234567890abcdef',
          },
          amount: { currency: 'EUR', value: 1000 },
          eventCode: 'AUTHORISATION',
          eventDate: '2026-09-05T12:00:00+00:00',
          merchantAccountCode: 'TestMerchantPT',
          merchantReference: 'REF',
          paymentMethod: 'visa',
          pspReference: '8815123456789999',
          success: 'true',
        },
      },
    ],
  });

  const authBad = await adapter.authenticateWebhook(Buffer.from(badPayload), {}, mockConfig, mockHmacKeyHex);
  assert.equal(authBad.valid, false);
}

// 4. Non-confirmation event (e.g. success = 'false' or eventCode = 'CANCEL_OR_REFUND')
{
  const declinedPayload = JSON.stringify({
    live: 'false',
    notificationItems: [
      {
        NotificationRequestItem: {
          additionalData: {},
          amount: { currency: 'EUR', value: 5000 },
          eventCode: 'AUTHORISATION',
          eventDate: '2026-09-05T12:00:00+00:00',
          merchantAccountCode: 'TestMerchantPT',
          merchantReference: 'REF',
          paymentMethod: 'visa',
          pspReference: '8815123456780000',
          success: 'false',
        },
      },
    ],
  });

  const normalized = await adapter.parseAndNormalizeEvent(Buffer.from(declinedPayload), {}, mockConfig);
  assert.ok(normalized);
  assert.equal(normalized.isConfirmed, false);
  assert.equal(normalized.candidate, null);
}

console.log('Adyen Adapter Deterministic & Contract Tests: PASS');
