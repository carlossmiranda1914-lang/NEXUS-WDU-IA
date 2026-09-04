import { auth } from '../../lib/firebase.ts';

export class FeeCatalogueApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'FeeCatalogueApiError';
  }
}

export type FeeCatalogueRecord = {
  id: string;
  institutionId?: string;
  code: string;
  status: 'active' | 'inactive';
  currentVersion: number;
  createdAt?: string;
  updatedAt?: string;
  current: {
    id?: string;
    version?: number;
    name: string;
    description?: string | null;
    kind: string;
    money: { amount: string; currency: string };
    effectiveFrom: string;
    effectiveTo?: string | null;
  };
  history?: Array<{
    id?: string;
    version: number;
    name: string;
    description?: string | null;
    kind: string;
    money: { amount: string; currency: string };
    effectiveFrom: string;
    effectiveTo?: string | null;
  }>;
};

export type FeeCatalogueRequestOptions = {
  fetcher?: typeof fetch;
  getToken?: () => Promise<string | null | undefined>;
};

const defaultGetToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
};

function resolveOptions(options?: FeeCatalogueRequestOptions | typeof fetch): {
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
  path: string,
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

  const res = await fetcher(`/api/finance/fee-catalogue${path}`, {
    ...init,
    headers,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new FeeCatalogueApiError(res.status, body.code || 'REQUEST_FAILED', body.error || 'Pedido falhou');
  }
  return body;
}

const key = () => crypto.randomUUID();

export const feeCatalogueClient = {
  list: (status = 'all', options?: FeeCatalogueRequestOptions | typeof fetch) => {
    const { fetcher, getToken } = resolveOptions(options);
    return request(`?status=${status}`, undefined, fetcher, getToken);
  },
  get: (id: string, history = false, options?: FeeCatalogueRequestOptions | typeof fetch) => {
    const { fetcher, getToken } = resolveOptions(options);
    return request(`/${id}${history ? '?history=true' : ''}`, undefined, fetcher, getToken);
  },
  create: (body: unknown, options?: FeeCatalogueRequestOptions | typeof fetch) => {
    const { fetcher, getToken } = resolveOptions(options);
    return request('', { method: 'POST', headers: { 'Idempotency-Key': key() }, body: JSON.stringify(body) }, fetcher, getToken);
  },
  update: (id: string, body: unknown, options?: FeeCatalogueRequestOptions | typeof fetch) => {
    const { fetcher, getToken } = resolveOptions(options);
    return request(`/${id}`, { method: 'PUT', headers: { 'Idempotency-Key': key() }, body: JSON.stringify(body) }, fetcher, getToken);
  },
  setStatus: (id: string, active: boolean, options?: FeeCatalogueRequestOptions | typeof fetch) => {
    const { fetcher, getToken } = resolveOptions(options);
    return request(`/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'POST', headers: { 'Idempotency-Key': key() } }, fetcher, getToken);
  },
};
