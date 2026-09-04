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

async function request(path: string, init?: RequestInit, fetcher: typeof fetch = fetch) {
  const res = await fetcher(`/api/finance/fee-catalogue${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new FeeCatalogueApiError(res.status, body.code || 'REQUEST_FAILED', body.error || 'Pedido falhou');
  }
  return body;
}

const key = () => crypto.randomUUID();

export const feeCatalogueClient = {
  list: (status = 'all', fetcher?: typeof fetch) => request(`?status=${status}`, undefined, fetcher),
  get: (id: string, history = false, fetcher?: typeof fetch) => request(`/${id}${history ? '?history=true' : ''}`, undefined, fetcher),
  create: (body: unknown, fetcher?: typeof fetch) => request('', { method: 'POST', headers: { 'Idempotency-Key': key() }, body: JSON.stringify(body) }, fetcher),
  update: (id: string, body: unknown, fetcher?: typeof fetch) => request(`/${id}`, { method: 'PUT', headers: { 'Idempotency-Key': key() }, body: JSON.stringify(body) }, fetcher),
  setStatus: (id: string, active: boolean, fetcher?: typeof fetch) => request(`/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'POST', headers: { 'Idempotency-Key': key() } }, fetcher),
};
