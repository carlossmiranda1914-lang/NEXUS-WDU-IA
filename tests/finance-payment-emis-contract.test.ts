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

// 1. Integration status must be CONTRACT_READY unless certified external PSP credentials exist
assert.equal(adapter.status, 'CONTRACT_READY');
assert.equal(EMIS_INTEGRATION_STATUS, 'CONTRACT_READY');

// 2. Successful EMIS Multicaixa Express payment notification
{
  const emisSuccessPayload = JSON.stringify({
    evento_id: 'EMIS-EVT-987654321',
    tipo_evento: 'PAGAMENTO_CONFIRMADO',
    transacao: {
      referencia_transacao: 'MCX-TRX-20260905-001',
      canal: 'MULTICAIXA_EXPRESS',
      montante: '35000.00',
      moeda: 'AOA',
      estado: 'SUCESSO',
      codigo_resposta: '00',
      data_hora: '2026-09-05T10:30:00Z',
      terminal: 'TERM-0099',
      origem_pagamento: '923000111',
    },
    meta: {
      conta_financeira_id: '00000000-0000-0000-0000-000000000099',
    },
  });

  const parsed = await adapter.parseAndNormalizeEvent(
    Buffer.from(emisSuccessPayload, 'utf8'),
    { 'content-type': 'application/json' },
    mockConfig
  );

  assert.ok(parsed);
  assert.equal(parsed.providerKey, 'emis_multicaixa');
  assert.equal(parsed.providerEventId, 'EMIS-EVT-987654321');
  assert.equal(parsed.isConfirmed, true);
  assert.ok(parsed.candidate);
  assert.equal(parsed.candidate.amount, '35000');
  assert.equal(parsed.candidate.currency, 'AOA');
  assert.equal(parsed.candidate.method, 'multicaixa_express');
  assert.equal(parsed.candidate.providerTransactionRef, 'MCX-TRX-20260905-001');
  assert.equal(parsed.candidate.financialAccountId, '00000000-0000-0000-0000-000000000099');
  assert.ok(parsed.candidate.providerOccurredAt instanceof Date);
}

// 3. Failed/Declined EMIS transaction -> not confirmed, candidate is null
{
  const emisFailedPayload = JSON.stringify({
    evento_id: 'EMIS-EVT-FAILED-001',
    tipo_evento: 'PAGAMENTO_RECUSADO',
    transacao: {
      referencia_transacao: 'MCX-TRX-FAILED-001',
      canal: 'MULTICAIXA_EXPRESS',
      montante: '5000.00',
      moeda: 'AOA',
      estado: 'RECUSADO',
      codigo_resposta: '51',
      data_hora: '2026-09-05T10:35:00Z',
    },
  });

  const parsed = await adapter.parseAndNormalizeEvent(
    Buffer.from(emisFailedPayload, 'utf8'),
    { 'content-type': 'application/json' },
    mockConfig
  );

  assert.ok(parsed);
  assert.equal(parsed.isConfirmed, false);
  assert.equal(parsed.candidate, null);
}

// 4. EMIS reference payment notification
{
  const emisRefPayload = JSON.stringify({
    evento_id: 'EMIS-EVT-REF-112233',
    tipo_evento: 'PAGAMENTO_POR_REFERENCIA',
    transacao: {
      referencia_transacao: 'MCX-REF-998877',
      canal: 'PAGAMENTO_REFERENCIA',
      montante: '150000.00',
      moeda: 'AOA',
      estado: 'SUCESSO',
      codigo_resposta: '00',
      data_hora: '2026-09-05T11:00:00Z',
    },
  });

  const parsed = await adapter.parseAndNormalizeEvent(
    Buffer.from(emisRefPayload, 'utf8'),
    { 'content-type': 'application/json' },
    mockConfig
  );

  assert.ok(parsed);
  assert.equal(parsed.isConfirmed, true);
  assert.ok(parsed.candidate);
  assert.equal(parsed.candidate.amount, '150000');
  assert.equal(parsed.candidate.currency, 'AOA');
  assert.equal(parsed.candidate.method, 'multicaixa_reference');
}

// 5. Invariant: Currency other than AOA is rejected
{
  const emisInvalidCurrencyPayload = JSON.stringify({
    evento_id: 'EMIS-EVT-BAD-CURR',
    tipo_evento: 'PAGAMENTO_CONFIRMADO',
    transacao: {
      referencia_transacao: 'MCX-TRX-BAD',
      canal: 'MULTICAIXA_EXPRESS',
      montante: '100.00',
      moeda: 'USD',
      estado: 'SUCESSO',
      codigo_resposta: '00',
      data_hora: '2026-09-05T10:30:00Z',
    },
  });

  await assert.rejects(
    () => adapter.parseAndNormalizeEvent(
      Buffer.from(emisInvalidCurrencyPayload, 'utf8'),
      { 'content-type': 'application/json' },
      mockConfig
    ),
    /moeda/i
  );
}

console.log('EMIS Multicaixa Angola Contract: PASS');
