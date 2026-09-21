import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import {
  PaymentProviderConfig,
  PaymentProviderKey,
  PaymentProviderEnvironment,
  PaymentProviderStatus,
  PaymentProviderAvailability,
  normalizeSavePaymentProviderConfigInput,
} from './payment-provider-model.ts';
import { requirePaymentRole } from './payment-policy.ts';

export class PaymentProviderConfigNotFoundError extends Error {
  readonly code = 'PAYMENT_PROVIDER_CONFIG_NOT_FOUND';
  constructor(message = 'Configuração do provedor de pagamento não encontrada.') {
    super(message);
    this.name = 'PaymentProviderConfigNotFoundError';
  }
}

interface ProviderConfigRow {
  id: string;
  institution_id: string;
  provider_key: string;
  environment: string;
  status: string;
  merchant_account_ref: string;
  supported_currencies: string[] | string;
  enabled_methods: string[] | string;
  operational_availability: string;
  secret_reference_id: string;
  webhook_endpoint_ref?: string | null;
  configuration_metadata: Record<string, unknown> | string;
  created_at: string | Date;
  updated_at: string | Date;
}

function mapProviderConfig(row: ProviderConfigRow): PaymentProviderConfig {
  const supportedCurrencies = Array.isArray(row.supported_currencies)
    ? row.supported_currencies
    : JSON.parse(String(row.supported_currencies));

  const enabledMethods = Array.isArray(row.enabled_methods)
    ? row.enabled_methods
    : JSON.parse(String(row.enabled_methods));

  const configurationMetadata = typeof row.configuration_metadata === 'object' && row.configuration_metadata !== null
    ? (row.configuration_metadata as Record<string, unknown>)
    : JSON.parse(String(row.configuration_metadata || '{}'));

  return {
    id: String(row.id),
    institutionId: String(row.institution_id),
    providerKey: row.provider_key as PaymentProviderKey,
    environment: row.environment as PaymentProviderEnvironment,
    status: row.status as PaymentProviderStatus,
    merchantAccountRef: String(row.merchant_account_ref),
    supportedCurrencies,
    enabledMethods,
    operationalAvailability: row.operational_availability as PaymentProviderAvailability,
    secretReferenceId: String(row.secret_reference_id),
    webhookEndpointRef: row.webhook_endpoint_ref ? String(row.webhook_endpoint_ref) : undefined,
    configurationMetadata,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(String(row.created_at)).toISOString(),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(String(row.updated_at)).toISOString(),
  };
}

export class PostgresPaymentProviderRepository {
  constructor(private readonly pool: Pool) {}

  async getByProviderKey(
    actor: { institutionId: string },
    providerKey: PaymentProviderKey,
    client: Pool | PoolClient = this.pool
  ): Promise<PaymentProviderConfig | null> {
    const sql = `SELECT * FROM finance_payment_provider_configs WHERE institution_id = $1 AND provider_key = $2`;
    const res = await client.query<ProviderConfigRow>(sql, [actor.institutionId, providerKey]);
    if (!res.rows[0]) return null;
    return mapProviderConfig(res.rows[0]);
  }

  async list(
    actor: { institutionId: string },
    client: Pool | PoolClient = this.pool
  ): Promise<PaymentProviderConfig[]> {
    const sql = `SELECT * FROM finance_payment_provider_configs WHERE institution_id = $1 ORDER BY provider_key ASC`;
    const res = await client.query<ProviderConfigRow>(sql, [actor.institutionId]);
    return res.rows.map(mapProviderConfig);
  }

  async resolveActiveConfig(
    institutionId: string,
    providerKey: PaymentProviderKey,
    client: Pool | PoolClient = this.pool
  ): Promise<PaymentProviderConfig | null> {
    const sql = `SELECT * FROM finance_payment_provider_configs WHERE institution_id = $1 AND provider_key = $2 AND status = 'active'`;
    const res = await client.query<ProviderConfigRow>(sql, [institutionId, providerKey]);
    if (!res.rows[0]) return null;
    return mapProviderConfig(res.rows[0]);
  }

  async save(
    actor: InstitutionalContext,
    rawInput: unknown,
    client: Pool | PoolClient = this.pool
  ): Promise<PaymentProviderConfig> {
    requirePaymentRole(actor.role, 'provider_admin');
    const input = normalizeSavePaymentProviderConfigInput(rawInput);
    const configId = randomUUID();

    const sql = `
      INSERT INTO finance_payment_provider_configs (
        id, institution_id, provider_key, environment, status, merchant_account_ref,
        supported_currencies, enabled_methods, operational_availability, secret_reference_id,
        webhook_endpoint_ref, configuration_metadata, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7::jsonb, $8::jsonb, $9, $10,
        $11, $12::jsonb, NOW(), NOW()
      )
      ON CONFLICT (institution_id, provider_key)
      DO UPDATE SET
        environment = EXCLUDED.environment,
        status = EXCLUDED.status,
        merchant_account_ref = EXCLUDED.merchant_account_ref,
        supported_currencies = EXCLUDED.supported_currencies,
        enabled_methods = EXCLUDED.enabled_methods,
        operational_availability = EXCLUDED.operational_availability,
        secret_reference_id = EXCLUDED.secret_reference_id,
        webhook_endpoint_ref = EXCLUDED.webhook_endpoint_ref,
        configuration_metadata = EXCLUDED.configuration_metadata,
        updated_at = NOW()
      RETURNING *;
    `;

    const params = [
      configId,
      actor.institutionId,
      input.providerKey,
      input.environment,
      input.status,
      input.merchantAccountRef,
      JSON.stringify(input.supportedCurrencies),
      JSON.stringify(input.enabledMethods),
      input.operationalAvailability ?? 'available',
      input.secretReferenceId,
      input.webhookEndpointRef ?? null,
      JSON.stringify(input.configurationMetadata ?? {}),
    ];

    const res = await client.query<ProviderConfigRow>(sql, params);
    return mapProviderConfig(res.rows[0]);
  }
}
