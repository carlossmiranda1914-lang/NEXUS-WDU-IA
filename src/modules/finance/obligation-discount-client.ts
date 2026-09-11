import { auth } from '../../lib/firebase.ts';
import type {
  ObligationDiscount,
  ObligationDiscountRevocation,
  ApplyObligationDiscountInput,
} from './obligation-discount-model.ts';
import type { ObligationFinancialPosition } from './obligation-financial-position.ts';

export class ObligationDiscountApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'ObligationDiscountApiError';
  }
}

export interface ObligationDiscountClientOptions {
  readonly getToken?: () => Promise<string | null>;
  readonly fetcher?: typeof fetch;
}

export interface ApplyDiscountResponse {
  readonly discount: ObligationDiscount;
  readonly position: ObligationFinancialPosition;
  readonly replayed: boolean;
}

export interface RevokeDiscountResponse {
  readonly revocation: ObligationDiscountRevocation;
  readonly position: ObligationFinancialPosition;
  readonly replayed: boolean;
}

export class ObligationDiscountApiClient {
  private readonly fetcher: typeof fetch;
  private readonly getToken: () => Promise<string | null>;

  constructor(options?: ObligationDiscountClientOptions) {
    this.fetcher =
      options?.fetcher ??
      (typeof window !== 'undefined' ? window.fetch.bind(window) : globalThis.fetch.bind(globalThis));
    this.getToken =
      options?.getToken ??
      (async () => {
        return auth.currentUser?.getIdToken() ?? null;
      });
  }

  async applyDiscount(
    obligationId: string,
    input: { discountPolicyId?: string; discountPolicyVersionId?: string; reason: string },
    idempotencyKey: string
  ): Promise<ApplyDiscountResponse> {
    const token = await this.getToken();
    const response = await this.fetcher(`/api/finance/obligations/${encodeURIComponent(obligationId)}/discounts`, {
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
      throw new ObligationDiscountApiError(
        response.status,
        body.code ?? 'DISCOUNT_ERROR',
        body.error ?? `HTTP ${response.status}`
      );
    }

    return response.json() as Promise<ApplyDiscountResponse>;
  }

  async revokeDiscount(
    obligationId: string,
    discountId: string,
    reason: string,
    idempotencyKey: string
  ): Promise<RevokeDiscountResponse> {
    const token = await this.getToken();
    const response = await this.fetcher(
      `/api/finance/obligations/${encodeURIComponent(obligationId)}/discounts/${encodeURIComponent(discountId)}/revoke`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason }),
      }
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new ObligationDiscountApiError(
        response.status,
        body.code ?? 'DISCOUNT_REVOKE_ERROR',
        body.error ?? `HTTP ${response.status}`
      );
    }

    return response.json() as Promise<RevokeDiscountResponse>;
  }
}

export const obligationDiscountClient = new ObligationDiscountApiClient();
