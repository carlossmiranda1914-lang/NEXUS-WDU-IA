import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  AdyenAdapter,
  calculateAdyenHmac,
  formatAdyenMinorUnits,
} from '../src/modules/finance/providers/adyen-adapter.ts';
import type { PaymentProviderConfig } from '../src/modules/finance/payment-provider-model.ts';
import { PaymentValidationError } from '../src/modules/finance/payment-model.ts';

const mockHmacKeyHex = '44782F3DEBEA52232C80CA829978C2E75CBE1441F10F0945B97F36E493D6BDD2'; // 32-byte hex key
const mockConfig: PaymentProviderConfig = {
  id: '00000000-0000-0000-0000-000000000801',
  institutionId: '00000000-0000-0000-0000-000000000001',
  providerKey: 'adyen',
  environment: 'test',
  status: 'active',
  merchantAccountRef: 'TestMerchantPT',
  supportedCurrencies: ['EUR', 'USD', 'JPY', 'BHD'],
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
  assert.ok(normalized.candidate.providerOccurredAt instanceof Date);
}

// 3. P0-01 Proof: Missing secret fails even in test environment
{
  const validPayload = JSON.stringify({
    notificationItems: [{ NotificationRequestItem: { pspReference: '123' } }],
  });
  const noSecretAuth = await adapter.authenticateWebhook(Buffer.from(validPayload), {}, mockConfig, undefined);
  assert.equal(noSecretAuth.valid, false, 'Adyen test mode must not bypass auth without secret');
}

// 4. Rejection of invalid HMAC
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

// 5. P0-03 Proof: Mismatched merchantAccountCode rejected
{
  const foreignMerchantPayload = JSON.stringify({
    notificationItems: [
      {
        NotificationRequestItem: {
          merchantAccountCode: 'ForeignMerchantAccount',
          pspReference: '8815123456780001',
          eventCode: 'AUTHORISATION',
          success: 'true',
          amount: { currency: 'EUR', value: 1000 },
        },
      },
    ],
  });
  await assert.rejects(
    () => adapter.parseAndNormalizeEvent(Buffer.from(foreignMerchantPayload), {}, mockConfig),
    (err: any) => err instanceof PaymentValidationError && /não corresponde à conta/i.test(err.message)
  );
}

// 6. P1-A Proof: Minor units conversion according to official Adyen currency table
{
  // 2-decimals standard & Adyen exceptions: EUR, CLP, ISK, AOA
  assert.equal(formatAdyenMinorUnits(12550, 'EUR'), '125.50');
  assert.equal(formatAdyenMinorUnits('50', 'EUR'), '0.50');
  assert.equal(formatAdyenMinorUnits(100000, 'CLP'), '1000.00'); // Adyen CLP = 2 decimals
  assert.equal(formatAdyenMinorUnits(12500, 'ISK'), '125.00');  // Adyen ISK = 2 decimals
  assert.equal(formatAdyenMinorUnits(100000, 'AOA'), '1000.00');

  // 0-decimals standard & Adyen exceptions: JPY, CVE, IDR, KRW
  assert.equal(formatAdyenMinorUnits(1500, 'JPY'), '1500');
  assert.equal(formatAdyenMinorUnits(5000, 'CVE'), '5000');     // Adyen CVE = 0 decimals
  assert.equal(formatAdyenMinorUnits(250000, 'IDR'), '250000'); // Adyen IDR = 0 decimals
  assert.equal(formatAdyenMinorUnits('1200', 'KRW'), '1200');

  // 3-decimals: BHD, KWD, OMR
  assert.equal(formatAdyenMinorUnits(12345, 'BHD'), '12.345');
  assert.equal(formatAdyenMinorUnits(500, 'KWD'), '0.500');

  // Invalid / missing currency rejected
  assert.throws(() => formatAdyenMinorUnits(100, ''), /moeda/i);
  assert.throws(() => formatAdyenMinorUnits(100, 'INVALID'), /moeda/i);
  assert.throws(() => formatAdyenMinorUnits(100, '12'), /moeda/i);
}

// 7. P1-06 Proof: Missing eventDate does not fabricate occurrence time
{
  const noDatePayload = JSON.stringify({
    notificationItems: [
      {
        NotificationRequestItem: {
          merchantAccountCode: 'TestMerchantPT',
          pspReference: '8815123456780002',
          eventCode: 'AUTHORISATION',
          success: 'true',
          amount: { currency: 'EUR', value: 2500 },
        },
      },
    ],
  });

  const parsed = await adapter.parseAndNormalizeEvent(Buffer.from(noDatePayload), {}, mockConfig);
  assert.ok(parsed);
  assert.equal(parsed.candidate?.providerOccurredAt, undefined, 'Missing provider date must not invent occurrence time');
}

// 8. Non-confirmation event (e.g. success = 'false' or eventCode = 'CANCEL_OR_REFUND')
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
