import { auth } from '../../lib/firebase.ts';
import type {
  DiscountPolicySummary,
  DiscountPolicy,
  DiscountPolicyVersion,
  CreateDiscountPolicyInput,
  CreateDiscountPolicyVersionInput,
} from './discount-policy-model.ts';

export class DiscountPolicyApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'DiscountPolicyApiError';
  }
}

export interface DiscountPolicyClientOptions {
  readonly getToken?: () => Promise<string | null>;
  readonly fetcher?: typeof fetch;
}

export class DiscountPolicyApiClient {
  private readonly fetcher: typeof fetch;
  private readonly getToken: () => Promise<string | null>;

  constructor(options?: DiscountPolicyClientOptions) {
    this.fetcher =
      options?.fetcher ??
      (typeof window !== 'undefined' ? window.fetch.bind(window) : globalThis.fetch.bind(globalThis));
    this.getToken =
      options?.getToken ??
      (async () => {
        return auth.currentUser?.getIdToken() ?? null;
      });
  }

  async listDiscountPolicies(applicationInstant?: Date): Promise<readonly DiscountPolicySummary[]> {
    const token = await this.getToken();
    const query = applicationInstant ? `?at=${encodeURIComponent(applicationInstant.toISOString())}` : '';
    const response = await this.fetcher(`/api/finance/discount-policies${query}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new DiscountPolicyApiError(
        response.status,
        body.code ?? 'DISCOUNT_POLICY_ERROR',
        body.error ?? `HTTP ${response.status}`
      );
    }

    const data = (await response.json()) as { policies: DiscountPolicySummary[] };
    return data.policies;
  }

  async createDiscountPolicy(
    input: CreateDiscountPolicyInput,
    idempotencyKey: string
  ): Promise<DiscountPolicy & { version: DiscountPolicyVersion }> {
    const token = await this.getToken();
    const response = await this.fetcher('/api/finance/discount-policies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new DiscountPolicyApiError(
        response.status,
        body.code ?? 'DISCOUNT_POLICY_ERROR',
        body.error ?? `HTTP ${response.status}`
      );
    }

    const data = (await response.json()) as { policy: DiscountPolicy & { version: DiscountPolicyVersion } };
    return data.policy;
  }

  async createDiscountPolicyVersion(
    policyId: string,
    input: CreateDiscountPolicyVersionInput,
    idempotencyKey: string
  ): Promise<DiscountPolicyVersion> {
    const token = await this.getToken();
    const response = await this.fetcher(`/api/finance/discount-policies/${encodeURIComponent(policyId)}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new DiscountPolicyApiError(
        response.status,
        body.code ?? 'DISCOUNT_POLICY_ERROR',
        body.error ?? `HTTP ${response.status}`
      );
    }

    const data = (await response.json()) as { version: DiscountPolicyVersion };
    return data.version;
  }

  async archiveDiscountPolicy(policyId: string): Promise<DiscountPolicy> {
    const token = await this.getToken();
    const response = await this.fetcher(`/api/finance/discount-policies/${encodeURIComponent(policyId)}/archive`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new DiscountPolicyApiError(
        response.status,
        body.code ?? 'DISCOUNT_POLICY_ERROR',
        body.error ?? `HTTP ${response.status}`
      );
    }

    const data = (await response.json()) as { policy: DiscountPolicy };
    return data.policy;
  }
}

export const discountPolicyClient = new DiscountPolicyApiClient();
