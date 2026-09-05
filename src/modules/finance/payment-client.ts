import { auth } from '../../lib/firebase.ts';
import type { Payment, ManualPaymentMethod } from './payment-model.ts';
import type {
  PaymentProviderConfigPublicProjection,
  PaymentProviderKey,
  SavePaymentProviderConfigInput,
} from './payment-provider-model.ts';

export class PaymentApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'PaymentApiError';
  }
}

export type PaymentClientOptions = {
  fetcher?: typeof fetch;
  getToken?: () => Promise<string | null | undefined>;
};

export type CreateManualPaymentClientInput = {
  method: ManualPaymentMethod;
  amount: string;
  currency: string;
  financialAccountId?: string;
  payerPersonId?: string;
  manualEvidenceRef?: string;
  notes?: string;
  effectiveAt?: string | Date;
};

const defaultGetToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
};

const defaultFetch: typeof fetch = (input, init) => {
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    return window.fetch(input, init);
  }
  return globalThis.fetch(input, init);
};

export class PaymentApiClient {
  private readonly fetcher: typeof fetch;
  private readonly getToken: () => Promise<string | null | undefined>;

  constructor(options?: PaymentClientOptions) {
    this.fetcher = options?.fetcher || defaultFetch;
    this.getToken = options?.getToken || defaultGetToken;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.getToken().catch(() => null);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((init?.headers as Record<string, string>) || {}),
    };

    const res = await this.fetcher(path, {
      ...init,
      headers,
    });

    if (!res.ok) {
      let errBody: any = {};
      try {
        errBody = await res.json();
      } catch {
        // ignore parse error
      }
      const code = errBody?.code 
        || (typeof errBody?.error === 'string' && /^[A-Z0-9_]+$/.test(errBody.error) ? errBody.error : undefined)
        || (res.status === 401 ? 'UNAUTHORIZED' : res.status === 403 ? 'PAYMENT_FORBIDDEN' : 'PAYMENT_ERROR');
      const message = errBody?.message || errBody?.error || `Erro HTTP ${res.status}`;
      throw new PaymentApiError(res.status, code, message);
    }

    return res.json();
  }

  async listPayments(options?: { status?: string; financialAccountId?: string; sourceType?: string }): Promise<Payment[]> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.financialAccountId) params.set('financialAccountId', options.financialAccountId);
    if (options?.sourceType) params.set('sourceType', options.sourceType);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Payment[]>(`/api/finance/payments${query}`);
  }

  async getPayment(id: string): Promise<Payment> {
    return this.request<Payment>(`/api/finance/payments/${encodeURIComponent(id)}`);
  }

  async confirmManualPayment(
    input: CreateManualPaymentClientInput,
    idempotencyKey?: string
  ): Promise<{ payment: Payment; replayed: boolean }> {
    const idemp = idempotencyKey || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? `pay-manual-${crypto.randomUUID()}` : `pay-manual-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`);
    return this.request<{ payment: Payment; replayed: boolean }>('/api/finance/payments/manual', {
      method: 'POST',
      headers: {
        'Idempotency-Key': idemp,
      },
      body: JSON.stringify(input),
    });
  }

  async listProviderConfigs(): Promise<PaymentProviderConfigPublicProjection[]> {
    return this.request<PaymentProviderConfigPublicProjection[]>('/api/finance/providers/configs');
  }

  async getProviderConfig(providerKey: PaymentProviderKey): Promise<PaymentProviderConfigPublicProjection> {
    return this.request<PaymentProviderConfigPublicProjection>(`/api/finance/providers/configs/${encodeURIComponent(providerKey)}`);
  }

  async saveProviderConfig(
    providerKey: PaymentProviderKey,
    input: Partial<SavePaymentProviderConfigInput>
  ): Promise<PaymentProviderConfigPublicProjection> {
    return this.request<PaymentProviderConfigPublicProjection>(`/api/finance/providers/configs/${encodeURIComponent(providerKey)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }
}

export const paymentClient = new PaymentApiClient();
