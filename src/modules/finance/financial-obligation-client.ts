import { auth } from '../../lib/firebase.ts';
import type { FinancialAccount } from './financial-account-model.ts';
import type { FinancialObligation } from './financial-obligation-model.ts';

export type FinancialAccountRecord = FinancialAccount;
export type FinancialObligationRecord = FinancialObligation;

export type PersonOptionRecord = {
  id: string;
  name: string;
  email: string | null;
};

export class FinancialObligationApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'FinancialObligationApiError';
  }
}

export type FinancialObligationRequestOptions = {
  fetcher?: typeof fetch;
  getToken?: () => Promise<string | null | undefined>;
};

const defaultGetToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
};

function resolveOptions(options?: FinancialObligationRequestOptions | typeof fetch): {
  fetcher: typeof fetch;
  getToken: () => Promise<string | null | undefined>;
} {
  if (typeof options === 'function') {
    return { fetcher: options, getToken: defaultGetToken };
  }
  return {
    fetcher: options?.fetcher || fetch,
    getToken: options?.getToken || defaultGetToken,
  };
}

async function request(
  fullPath: string,
  init?: RequestInit,
  fetcher: typeof fetch = fetch,
  getToken: () => Promise<string | null | undefined> = defaultGetToken,
) {
  const token = await getToken().catch(() => null);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers as Record<string, string> || {}),
  };

  const res = await fetcher(fullPath, {
    ...init,
    headers,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new FinancialObligationApiError(res.status, body.code || 'REQUEST_FAILED', body.error || 'Pedido falhou');
  }
  return body;
}

const key = () => crypto.randomUUID();

export const financialObligationClient = {
  // Accounts
  listAccounts: (status = 'all', options?: FinancialObligationRequestOptions | typeof fetch) => {
    const { fetcher, getToken } = resolveOptions(options);
    return request(`/api/finance/financial-accounts?status=${status}`, undefined, fetcher, getToken);
  },
  getAccount: (id: string, options?: FinancialObligationRequestOptions | typeof fetch) => {
    const { fetcher, getToken } = resolveOptions(options);
    return request(`/api/finance/financial-accounts/${id}`, undefined, fetcher, getToken);
  },
  createAccount: (body: { personId: string; role?: string }, options?: FinancialObligationRequestOptions | typeof fetch) => {
    const { fetcher, getToken } = resolveOptions(options);
    return request('/api/finance/financial-accounts', { method: 'POST', headers: { 'Idempotency-Key': key() }, body: JSON.stringify(body) }, fetcher, getToken);
  },
  setAccountStatus: (id: string, active: boolean, options?: FinancialObligationRequestOptions | typeof fetch) => {
    const { fetcher, getToken } = resolveOptions(options);
    return request(`/api/finance/financial-accounts/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'POST', headers: { 'Idempotency-Key': key() } }, fetcher, getToken);
  },
  listPersonOptions: (options?: FinancialObligationRequestOptions | typeof fetch) => {
    const { fetcher, getToken } = resolveOptions(options);
    return request('/api/finance/financial-accounts/persons', undefined, fetcher, getToken);
  },

  // Obligations
  listObligations: (filters?: { status?: string; financialAccountId?: string }, options?: FinancialObligationRequestOptions | typeof fetch) => {
    const { fetcher, getToken } = resolveOptions(options);
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters?.financialAccountId) params.set('financialAccountId', filters.financialAccountId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/finance/obligations${qs}`, undefined, fetcher, getToken);
  },
  getObligation: (id: string, options?: FinancialObligationRequestOptions | typeof fetch) => {
    const { fetcher, getToken } = resolveOptions(options);
    return request(`/api/finance/obligations/${id}`, undefined, fetcher, getToken);
  },
  createObligation: (body: unknown, options?: FinancialObligationRequestOptions | typeof fetch) => {
    const { fetcher, getToken } = resolveOptions(options);
    return request('/api/finance/obligations', { method: 'POST', headers: { 'Idempotency-Key': key() }, body: JSON.stringify(body) }, fetcher, getToken);
  },
};
