import type { PaymentProviderConfig, PaymentProviderKey } from '../payment-provider-model.ts';

export interface ProviderPaymentCandidate {
  amount: string;
  currency: string;
  method: string;
  providerTransactionRef: string;
  providerOccurredAt?: Date;
  rawPayloadDigest: string;
  financialAccountId?: string;
  payerPersonId?: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderNormalizedEvent {
  providerKey: PaymentProviderKey;
  providerEventId: string;
  eventType: string;
  isConfirmed: boolean;
  candidate: ProviderPaymentCandidate | null;
}

export interface ProviderAuthResult {
  valid: boolean;
  reason?: string;
}

export interface PaymentProviderAdapter {
  readonly providerKey: PaymentProviderKey;
  readonly status: 'CONTRACT_READY' | 'AWAITING_AUTHORIZED_PROTOCOL' | 'LIVE_VERIFIED';

  authenticateWebhook(
    rawBody: Buffer | string,
    headers: Record<string, string | string[] | undefined>,
    config: PaymentProviderConfig,
    secretValue?: string
  ): Promise<ProviderAuthResult>;

  parseAndNormalizeEvent(
    rawBody: Buffer | string,
    headers: Record<string, string | string[] | undefined>,
    config: PaymentProviderConfig
  ): Promise<ProviderNormalizedEvent | null>;
}
