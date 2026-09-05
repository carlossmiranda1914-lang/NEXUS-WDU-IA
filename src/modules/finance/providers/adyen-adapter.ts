import { createHash, createHmac } from 'node:crypto';
import type {
  PaymentProviderAdapter,
  ProviderAuthResult,
  ProviderNormalizedEvent,
  ProviderPaymentCandidate,
} from './payment-provider-adapter.ts';
import type { PaymentProviderConfig } from '../payment-provider-model.ts';
import { Money } from '../money.ts';
import { PaymentValidationError } from '../payment-model.ts';

export interface AdyenHmacFields {
  pspReference: string;
  originalReference: string;
  merchantAccountCode: string;
  merchantReference: string;
  value: string;
  currency: string;
  eventCode: string;
  success: string;
}

function escapeAdyenField(val: string): string {
  if (val === null || val === undefined) return '';
  return String(val).replaceAll('\\', '\\\\').replaceAll(':', '\\:');
}

export function calculateAdyenHmac(fields: AdyenHmacFields, hmacKeyHex: string): string {
  const values = [
    fields.pspReference,
    fields.originalReference,
    fields.merchantAccountCode,
    fields.merchantReference,
    fields.value,
    fields.currency,
    fields.eventCode,
    fields.success,
  ];

  const payloadString = values.map(escapeAdyenField).join(':');
  const keyBuffer = Buffer.isBuffer(hmacKeyHex) ? hmacKeyHex : Buffer.from(hmacKeyHex, 'hex');
  return createHmac('sha256', keyBuffer).update(payloadString, 'utf8').digest('base64');
}

export class AdyenAdapter implements PaymentProviderAdapter {
  readonly providerKey = 'adyen' as const;
  readonly status = 'CONTRACT_READY' as const;

  async authenticateWebhook(
    rawBody: Buffer | string,
    _headers: Record<string, string | string[] | undefined>,
    config: PaymentProviderConfig,
    secretValue?: string
  ): Promise<ProviderAuthResult> {
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    let payload: any;
    try {
      payload = JSON.parse(bodyStr);
    } catch {
      return { valid: false, reason: 'Payload JSON inválido.' };
    }

    const items = payload?.notificationItems;
    if (!Array.isArray(items) || items.length === 0) {
      return { valid: false, reason: 'notificationItems ausente ou vazio.' };
    }

    const item = items[0]?.NotificationRequestItem;
    if (!item) {
      return { valid: false, reason: 'NotificationRequestItem ausente.' };
    }

    if (!secretValue) {
      if (config.environment === 'test') {
        return { valid: true };
      }
      return { valid: false, reason: 'Chave HMAC de validação Adyen não configurada.' };
    }

    const hmacSignature = item.additionalData?.hmacSignature;
    if (!hmacSignature) {
      return { valid: false, reason: 'additionalData.hmacSignature ausente.' };
    }

    const fields: AdyenHmacFields = {
      pspReference: item.pspReference ?? '',
      originalReference: item.originalReference ?? '',
      merchantAccountCode: item.merchantAccountCode ?? '',
      merchantReference: item.merchantReference ?? '',
      value: String(item.amount?.value ?? '0'),
      currency: item.amount?.currency ?? '',
      eventCode: item.eventCode ?? '',
      success: String(item.success ?? ''),
    };

    const expectedHmac = calculateAdyenHmac(fields, secretValue);
    if (expectedHmac !== hmacSignature) {
      return { valid: false, reason: 'Assinatura HMAC Adyen inválida.' };
    }

    return { valid: true };
  }

  async parseAndNormalizeEvent(
    rawBody: Buffer | string,
    _headers: Record<string, string | string[] | undefined>,
    _config: PaymentProviderConfig
  ): Promise<ProviderNormalizedEvent | null> {
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    let payload: any;
    try {
      payload = JSON.parse(bodyStr);
    } catch {
      return null;
    }

    const items = payload?.notificationItems;
    if (!Array.isArray(items) || items.length === 0) return null;

    const item = items[0]?.NotificationRequestItem;
    if (!item) return null;

    const pspReference = String(item.pspReference || '');
    if (!pspReference) return null;

    const eventCode = String(item.eventCode || '');
    const success = String(item.success || '').toLowerCase() === 'true';

    const isConfirmed = eventCode === 'AUTHORISATION' && success;
    const rawPayloadDigest = createHash('sha256').update(bodyStr, 'utf8').digest('hex');

    if (!isConfirmed) {
      return {
        providerKey: this.providerKey,
        providerEventId: pspReference,
        eventType: eventCode,
        isConfirmed: false,
        candidate: null,
      };
    }

    const currency = String(item.amount?.currency || 'EUR').toUpperCase();
    const rawValue = BigInt(item.amount?.value ?? 0);
    const whole = rawValue / 100n;
    const fraction = (rawValue % 100n).toString().padStart(2, '0');
    const exactAmountStr = `${whole}.${fraction}`;

    const money = Money.parse(exactAmountStr, currency);

    // Method classification
    const rawMethod = String(item.paymentMethod || 'card').toLowerCase();
    let method = 'card';
    if (rawMethod.includes('mbway')) method = 'mbway';
    else if (rawMethod.includes('multicaixa')) method = 'multicaixa';
    else if (rawMethod.includes('bank') || rawMethod.includes('transfer')) method = 'bank_transfer';

    let occurredAt: Date;
    if (item.eventDate) {
      occurredAt = new Date(item.eventDate);
      if (Number.isNaN(occurredAt.getTime())) occurredAt = new Date();
    } else {
      occurredAt = new Date();
    }

    let financialAccountId: string | undefined = undefined;
    const merchantRef = String(item.merchantReference || '');
    const accMatch = merchantRef.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (accMatch) {
      financialAccountId = accMatch[1];
    }

    const candidate: ProviderPaymentCandidate = {
      amount: money.canonicalAmount(),
      currency,
      method,
      providerTransactionRef: pspReference,
      providerOccurredAt: occurredAt,
      rawPayloadDigest,
      financialAccountId,
      metadata: {
        merchantAccountCode: item.merchantAccountCode,
        merchantReference: item.merchantReference,
        paymentMethod: item.paymentMethod,
      },
    };

    return {
      providerKey: this.providerKey,
      providerEventId: pspReference,
      eventType: eventCode,
      isConfirmed: true,
      candidate,
    };
  }
}
