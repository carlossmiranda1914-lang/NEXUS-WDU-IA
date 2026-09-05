export class PaymentProviderValidationError extends Error {
  readonly code = 'PAYMENT_PROVIDER_VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProviderValidationError';
  }
}

export type PaymentProviderKey = 'adyen' | 'emis_multicaixa';
export type PaymentProviderEnvironment = 'test' | 'live';
export type PaymentProviderStatus = 'active' | 'inactive' | 'onboarding';
export type PaymentProviderAvailability = 'available' | 'maintenance' | 'degraded' | 'unavailable';

export interface PaymentProviderConfig {
  id: string;
  institutionId: string;
  providerKey: PaymentProviderKey;
  environment: PaymentProviderEnvironment;
  status: PaymentProviderStatus;
  merchantAccountRef: string;
  supportedCurrencies: string[];
  enabledMethods: string[];
  operationalAvailability: PaymentProviderAvailability;
  secretReferenceId: string;
  webhookEndpointRef?: string;
  configurationMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentProviderConfigPublicProjection {
  id: string;
  institutionId: string;
  providerKey: PaymentProviderKey;
  environment: PaymentProviderEnvironment;
  status: PaymentProviderStatus;
  merchantAccountRef: string;
  supportedCurrencies: string[];
  enabledMethods: string[];
  operationalAvailability: PaymentProviderAvailability;
  webhookEndpointRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavePaymentProviderConfigInput {
  providerKey: PaymentProviderKey;
  environment: PaymentProviderEnvironment;
  status: PaymentProviderStatus;
  merchantAccountRef: string;
  supportedCurrencies: string[];
  enabledMethods: string[];
  operationalAvailability?: PaymentProviderAvailability;
  secretReferenceId: string;
  webhookEndpointRef?: string;
  configurationMetadata?: Record<string, unknown>;
}

export function toPublicProviderConfigProjection(config: PaymentProviderConfig): PaymentProviderConfigPublicProjection {
  return {
    id: config.id,
    institutionId: config.institutionId,
    providerKey: config.providerKey,
    environment: config.environment,
    status: config.status,
    merchantAccountRef: config.merchantAccountRef,
    supportedCurrencies: [...config.supportedCurrencies],
    enabledMethods: [...config.enabledMethods],
    operationalAvailability: config.operationalAvailability,
    webhookEndpointRef: config.webhookEndpointRef,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

export function normalizeSavePaymentProviderConfigInput(input: unknown): SavePaymentProviderConfigInput {
  if (typeof input !== 'object' || input === null) {
    throw new PaymentProviderValidationError('Dados de configuração de provedor inválidos.');
  }

  const raw = input as Record<string, unknown>;

  const validProviders: PaymentProviderKey[] = ['adyen', 'emis_multicaixa'];
  if (!validProviders.includes(raw.providerKey as PaymentProviderKey)) {
    throw new PaymentProviderValidationError(`Provedor "${String(raw.providerKey)}" não é suportado. Utilize "adyen" ou "emis_multicaixa".`);
  }
  const providerKey = raw.providerKey as PaymentProviderKey;

  const validEnvironments: PaymentProviderEnvironment[] = ['test', 'live'];
  if (!validEnvironments.includes(raw.environment as PaymentProviderEnvironment)) {
    throw new PaymentProviderValidationError('Ambiente deve ser "test" ou "live".');
  }
  const environment = raw.environment as PaymentProviderEnvironment;

  const validStatuses: PaymentProviderStatus[] = ['active', 'inactive', 'onboarding'];
  if (!validStatuses.includes(raw.status as PaymentProviderStatus)) {
    throw new PaymentProviderValidationError('Estado deve ser "active", "inactive" ou "onboarding".');
  }
  const status = raw.status as PaymentProviderStatus;

  if (typeof raw.merchantAccountRef !== 'string' || !raw.merchantAccountRef.trim()) {
    throw new PaymentProviderValidationError('Referência da conta de comerciante (merchantAccountRef) é obrigatória.');
  }
  const merchantAccountRef = raw.merchantAccountRef.trim();

  if (!Array.isArray(raw.supportedCurrencies) || raw.supportedCurrencies.length === 0) {
    throw new PaymentProviderValidationError('Pelo menos uma moeda suportada deve ser configurada.');
  }
  const supportedCurrencies = raw.supportedCurrencies.map(c => {
    if (typeof c !== 'string' || !/^[A-Z]{3}$/.test(c.trim())) {
      throw new PaymentProviderValidationError(`Moeda "${String(c)}" inválida. Deve ser código ISO de 3 letras.`);
    }
    return c.trim();
  });

  if (!Array.isArray(raw.enabledMethods) || raw.enabledMethods.length === 0) {
    throw new PaymentProviderValidationError('Pelo menos um método de pagamento habilitado deve ser configurado.');
  }
  const enabledMethods = raw.enabledMethods.map(m => {
    if (typeof m !== 'string' || !m.trim()) {
      throw new PaymentProviderValidationError('Método de pagamento inválido.');
    }
    return m.trim();
  });

  let operationalAvailability: PaymentProviderAvailability = 'available';
  if (raw.operationalAvailability !== undefined && raw.operationalAvailability !== null) {
    const validAvailabilities: PaymentProviderAvailability[] = ['available', 'maintenance', 'degraded', 'unavailable'];
    if (!validAvailabilities.includes(raw.operationalAvailability as PaymentProviderAvailability)) {
      throw new PaymentProviderValidationError('Disponibilidade operacional inválida.');
    }
    operationalAvailability = raw.operationalAvailability as PaymentProviderAvailability;
  }

  if (typeof raw.secretReferenceId !== 'string' || !raw.secretReferenceId.trim()) {
    throw new PaymentProviderValidationError('Identificador de referência de segredo (secretReferenceId) é obrigatório.');
  }
  const secretReferenceId = raw.secretReferenceId.trim();

  let webhookEndpointRef: string | undefined = undefined;
  if (typeof raw.webhookEndpointRef === 'string' && raw.webhookEndpointRef.trim()) {
    webhookEndpointRef = raw.webhookEndpointRef.trim();
  }

  const configurationMetadata = typeof raw.configurationMetadata === 'object' && raw.configurationMetadata !== null
    ? (raw.configurationMetadata as Record<string, unknown>)
    : {};

  return {
    providerKey,
    environment,
    status,
    merchantAccountRef,
    supportedCurrencies,
    enabledMethods,
    operationalAvailability,
    secretReferenceId,
    webhookEndpointRef,
    configurationMetadata,
  };
}
