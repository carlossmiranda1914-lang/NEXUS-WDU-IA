import { auth } from '../../lib/firebase.ts';

export type FinanceReadinessDto = {
  module: 'FINANCE';
  status: 'READY' | 'INCOMPLETE' | 'BLOCKED';
  canManageConfiguration: boolean;
  requirements: Array<{ code: 'FINANCIAL_PROFILE' | 'FISCAL_CONFIGURATION' | 'RECEIPT_SERIES'; state: 'COMPLETE' | 'MISSING' | 'BLOCKED' }>;
};

const defaultFetch: typeof fetch = (input, init) => {
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') return window.fetch(input, init);
  return globalThis.fetch(input, init);
};

export class FinanceReadinessClient {
  constructor(
    private readonly fetcher: typeof fetch = defaultFetch,
    private readonly getToken = async () => auth.currentUser?.getIdToken(),
  ) {}

  async get(): Promise<FinanceReadinessDto> {
    const token = await this.getToken().catch(() => null);
    const response = await this.fetcher('/api/finance/readiness', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) throw new Error(response.status === 401 ? 'FINANCE_READINESS_AUTH_REQUIRED' : response.status === 403 ? 'FINANCE_READINESS_FORBIDDEN' : 'FINANCE_READINESS_UNAVAILABLE');
    return response.json() as Promise<FinanceReadinessDto>;
  }

  async createReceiptSeries(input: { code: string; idempotencyKey: string }): Promise<void> {
    const token = await this.getToken().catch(() => null);
    const response = await this.fetcher('/api/finance/document-series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': input.idempotencyKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ code: input.code, documentType: 'receipt', effectiveFrom: new Date().toISOString() }),
    });
    if (!response.ok) throw new Error('FINANCE_RECEIPT_SERIES_CONFIGURATION_FAILED');
  }
}

export const financeReadinessClient = new FinanceReadinessClient();
