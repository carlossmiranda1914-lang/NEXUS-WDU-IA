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

  async getByStudentRef(studentRef: string): Promise<FinanceOperationalContext> {
    const encodedRef = encodeURIComponent(studentRef);
    return this.request<FinanceOperationalContext>(
      `/api/finance/operational-context?studentRef=${encodedRef}`
    );
  }

  async getByEnrollmentId(enrollmentId: string): Promise<FinanceOperationalContext> {
    const encodedId = encodeURIComponent(enrollmentId);
    return this.request<FinanceOperationalContext>(
      `/api/finance/operational-context?enrollmentId=${encodedId}`
    );
  }

  async getOperationalContext(query: {
    financialAccountId?: string;
    studentRef?: string;
    enrollmentId?: string;
  }): Promise<FinanceOperationalContext> {
    if (query.financialAccountId) {
      return this.getByFinancialAccountId(query.financialAccountId);
    }
    if (query.studentRef) {
      return this.getByStudentRef(query.studentRef);
    }
    if (query.enrollmentId) {
      return this.getByEnrollmentId(query.enrollmentId);
    }
    throw new FinanceOperationalContextApiError(
      400,
      'INVALID_CONTEXT_QUERY',
      'É necessário indicar uma conta financeira, aluno ou matrícula para obter o contexto operacional.'
    );
  }

  async searchFinancialAccounts(options: {
    q?: string;
    status?: string;
    limit?: number;
  }): Promise<FinancialAccount[]> {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.q && options.q.trim()) params.set('q', options.q.trim());
    if (typeof options.limit === 'number' && !Number.isNaN(options.limit)) {
      params.set('limit', String(options.limit));
    }
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return this.request<FinancialAccount[]>(`/api/finance/financial-accounts${queryStr}`);
  }

  async listFinancialAccounts(
    statusOrOptions: string | { status?: string; q?: string; limit?: number } = 'active'
  ): Promise<FinancialAccount[]> {
    if (typeof statusOrOptions === 'object' && statusOrOptions !== null) {
      return this.searchFinancialAccounts(statusOrOptions);
    }
    const status = typeof statusOrOptions === 'string' ? statusOrOptions : 'active';
    const encodedStatus = encodeURIComponent(status);
    return this.request<FinancialAccount[]>(
      `/api/finance/financial-accounts?status=${encodedStatus}`
    );
  }
}
