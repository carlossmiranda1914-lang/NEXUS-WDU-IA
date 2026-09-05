import assert from 'node:assert/strict';
import {
  EmisMulticaixaAdapter,
  EMIS_INTEGRATION_STATUS,
} from '../src/modules/finance/providers/emis-multicaixa-adapter.ts';
import type { PaymentProviderConfig } from '../src/modules/finance/payment-provider-model.ts';

const mockConfig: PaymentProviderConfig = {
  id: '00000000-0000-0000-0000-000000000701',
  institutionId: '00000000-0000-0000-0000-000000000001',
  providerKey: 'emis_multicaixa',
  environment: 'test',
  status: 'active',
  merchantAccountRef: 'EMIS_MERCHANT_AO_001',
  supportedCurrencies: ['AOA'],
  enabledMethods: ['multicaixa_express', 'multicaixa_reference', 'multicaixa_gpo'],
  operationalAvailability: 'available',
  secretReferenceId: 'vault://secrets/emis/mock',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  configurationMetadata: {},
};

const adapter = new EmisMulticaixaAdapter();

// 1. P0-02 Proof: Integration status is AWAITING_AUTHORIZED_PROTOCOL
assert.equal(adapter.status, 'AWAITING_AUTHORIZED_PROTOCOL');
assert.equal(EMIS_INTEGRATION_STATUS, 'AWAITING_AUTHORIZED_PROTOCOL');

// 2. Webhook authentication fails closed without authorized protocol
{
  const authRes = await adapter.authenticateWebhook(
    Buffer.from('{}'),
    {},
    mockConfig,
    'mock-secret'
  );
  assert.equal(authRes.valid, false);
  assert.match(authRes.reason || '', /aguarda documentação/i);
}

// 3. Normalization returns null without invented protocol payload
{
  const parsed = await adapter.parseAndNormalizeEvent(
    Buffer.from('{}'),
    {},
    mockConfig
  );
  assert.equal(parsed, null);
}

console.log('EMIS Multicaixa Angola Contract Boundary: PASS');
