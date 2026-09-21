import type {
  PaymentProviderAdapter,
  ProviderAuthResult,
  ProviderNormalizedEvent,
} from './payment-provider-adapter.ts';
import type { PaymentProviderConfig } from '../payment-provider-model.ts';

export const EMIS_INTEGRATION_STATUS = 'AWAITING_AUTHORIZED_PROTOCOL' as const;

/**
 * EmisMulticaixaAdapter
 *
 * Provider adapter contract boundary for EMIS / MULTICAIXA (Angola).
 *
 * NOTE: Concrete protocol semantics, webhook signature algorithms, and payload structures
 * are intentionally uninvented until official technical documentation or authorized PST-SP/PSP
 * integration material is formally provisioned to the project.
 */
export class EmisMulticaixaAdapter implements PaymentProviderAdapter {
  readonly providerKey = 'emis_multicaixa' as const;
  readonly status = EMIS_INTEGRATION_STATUS;

  async authenticateWebhook(
    _rawBody: Buffer | string,
    _headers: Record<string, string | string[] | undefined>,
    _config: PaymentProviderConfig,
    _secretValue?: string
  ): Promise<ProviderAuthResult> {
    return {
      valid: false,
      reason: 'Protocolo de webhook EMIS/MULTICAIXA aguarda documentação e credenciais oficiais autorizadas.',
    };
  }

  async parseAndNormalizeEvent(
    _rawBody: Buffer | string,
    _headers: Record<string, string | string[] | undefined>,
    _config: PaymentProviderConfig
  ): Promise<ProviderNormalizedEvent | null> {
    return null;
  }
}
