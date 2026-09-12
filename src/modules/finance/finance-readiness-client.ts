import { auth } from '../../lib/firebase.ts';

export type FinanceReadinessDto = {
  module: 'FINANCE';
  status: 'READY' | 'INCOMPLETE' | 'BLOCKED';
  canManageConfiguration: boolean;
  requirements: Array<{ code: 'INSTITUTION_LEGAL_PROFILE' | 'FINANCIAL_PROFILE' | 'FISCAL_CONFIGURATION' | 'RECEIPT_SERIES'; state: 'COMPLETE' | 'MISSING' | 'BLOCKED' }>;
  receiptIssuance: { status: 'READY' } | { status: 'BLOCKED'; reasonCode: string };
  localPrerequisitesComplete: boolean;
  jurisdictionPolicyAvailable: boolean;
  fiscalConfigurationAvailable: boolean;
  seriesConfigurationAvailable: boolean;
  paymentCurrency?: { functionalCurrency: string; enabledCurrencies: string[] };
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

  async createLegalProfile(input: { legalName: string; taxIdentifier?: string; countryCode: string; addressLine1: string; effectiveFrom: string }): Promise<void> {
    const token = await this.getToken().catch(() => null);
    const response = await this.fetcher('/api/institution/legal-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ legalName: input.legalName, taxIdentifier: input.taxIdentifier, registeredAddress: { countryCode: input.countryCode, line1: input.addressLine1 }, effectiveFrom: input.effectiveFrom }),
    });
    if (!response.ok) throw await configurationError(response, 'INSTITUTION_LEGAL_PROFILE_FAILED');
  }

  async createFinancialProfile(input: { primaryJurisdiction: string; functionalCurrency: string; financialTimezone: string; monetaryPolicyVersion: string; enabledCurrencies: string[]; effectiveFrom: string }): Promise<void> {
    const token = await this.getToken().catch(() => null);
    const response = await this.fetcher('/api/finance/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await configurationError(response, 'FINANCIAL_PROFILE_FAILED');
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
    INSTITUTION_LEGAL_PROFILE_INVALID: 'O perfil jurídico institucional não é válido.',
    FINANCIAL_PROFILE_INVALID: 'O perfil financeiro institucional não é válido.',
  };
  return new FinanceConfigurationError(code, messages[code] ?? 'Ocorreu um erro inesperado ao guardar a configuração. Tente novamente.');
}

export const financeReadinessClient = new FinanceReadinessClient();
