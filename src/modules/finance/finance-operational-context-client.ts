import { auth } from '../../lib/firebase.ts';
import type { FinanceOperationalContext } from './finance-operational-context-model.ts';
import type { FinancialAccount } from './financial-account-model.ts';

export class FinanceOperationalContextApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'FinanceOperationalContextApiError';
  }
}

export type FinanceOperationalContextClientOptions = {
  fetcher?: typeof fetch;
  getToken?: () => Promise<string | null | undefined>;
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

export class FinanceOperationalContextClient {
  private readonly fetcher: typeof fetch;
  private readonly getToken: () => Promise<string | null | undefined>;

  constructor(options?: FinanceOperationalContextClientOptions) {
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
        errBody = { error: res.statusText };
      }
      const code = errBody?.code || (res.status === 401 ? 'UNAUTHORIZED' : res.status === 403 ? 'FORBIDDEN' : 'API_ERROR');
      const message = errBody?.error || errBody?.message || `HTTP ${res.status}`;
      throw new FinanceOperationalContextApiError(res.status, code, message);
    }

    return res.json() as Promise<T>;
  }

  async getByFinancialAccountId(financialAccountId: string): Promise<FinanceOperationalContext> {
    const encodedId = encodeURIComponent(financialAccountId);
    return this.request<FinanceOperationalContext>(
      `/api/finance/operational-context?financialAccountId=${encodedId}`
    );
  }

  async listFinancialAccounts(status: string = 'active'): Promise<FinancialAccount[]> {
    const encodedStatus = encodeURIComponent(status);
    return this.request<FinancialAccount[]>(
      `/api/finance/accounts?status=${encodedStatus}`
    );
  }
}
