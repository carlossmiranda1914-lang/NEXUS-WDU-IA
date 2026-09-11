import { auth } from '../../lib/firebase.ts';

export type FinanceReadinessDto = {
  module: 'FINANCE';
  status: 'READY' | 'INCOMPLETE' | 'BLOCKED';
  canManageConfiguration: boolean;
  requirements: Array<{ code: 'FINANCIAL_PROFILE' | 'FISCAL_CONFIGURATION' | 'RECEIPT_SERIES'; state: 'COMPLETE' | 'MISSING' | 'BLOCKED' }>;
  receiptIssuance: { status: 'READY' } | { status: 'BLOCKED'; reasonCode: string };
};

export class FinanceConfigurationError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'FinanceConfigurationError'; }
}

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
    if (!response.ok) throw await configurationError(response, 'FINANCE_RECEIPT_SERIES_CONFIGURATION_FAILED');
  }

  async createFiscalConfiguration(input: { idempotencyKey: string }): Promise<void> {
    const token = await this.getToken().catch(() => null);
    const response = await this.fetcher('/api/finance/fiscal-configurations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': input.idempotencyKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ version: 1, adapterKey: 'core', operationalConfiguration: {}, effectiveFrom: new Date().toISOString() }),
    });
    if (!response.ok) throw await configurationError(response, 'FINANCE_FISCAL_CONFIGURATION_FAILED');
  }
}

async function configurationError(response: Response, fallback: string): Promise<FinanceConfigurationError> {
  const payload = await response.json().catch(() => ({})) as { code?: string };
  const code = payload.code ?? fallback;
  const messages: Record<string, string> = {
    FINANCE_RECEIPT_SERIES_CONFLICT: 'Já existe uma série com este código nesta instituição. Escolha outro identificador.',
    FINANCE_RECEIPT_SERIES_VALIDATION: 'A série não pode ser guardada com estes dados. Confirme o código e tente novamente.',
    FISCAL_CONFIGURATION_CONFLICT: 'Já existe uma configuração fiscal incompatível ou sobreposta. Reveja a configuração atual.',
    FISCAL_CONFIGURATION_VALIDATION: 'A configuração fiscal não é válida para a data indicada.',
    FINANCIAL_DOCUMENT_FORBIDDEN: 'Não tem permissão para concluir a configuração financeira.',
    UNAUTHORIZED: 'Inicie sessão novamente para concluir a configuração.',
  };
  return new FinanceConfigurationError(code, messages[code] ?? 'Ocorreu um erro inesperado ao guardar a configuração. Tente novamente.');
}

export const financeReadinessClient = new FinanceReadinessClient();
