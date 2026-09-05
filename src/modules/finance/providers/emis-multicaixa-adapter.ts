import { createHash, createHmac } from 'node:crypto';
import type {
  PaymentProviderAdapter,
  ProviderAuthResult,
  ProviderNormalizedEvent,
  ProviderPaymentCandidate,
} from './payment-provider-adapter.ts';
import type { PaymentProviderConfig } from '../payment-provider-model.ts';
import { Money } from '../money.ts';
import { PaymentValidationError } from '../payment-model.ts';

export const EMIS_INTEGRATION_STATUS = 'CONTRACT_READY' as const;

export class EmisMulticaixaAdapter implements PaymentProviderAdapter {
  readonly providerKey = 'emis_multicaixa' as const;
  readonly status = EMIS_INTEGRATION_STATUS;

  async authenticateWebhook(
    rawBody: Buffer | string,
    headers: Record<string, string | string[] | undefined>,
    config: PaymentProviderConfig,
    secretValue?: string
  ): Promise<ProviderAuthResult> {
    const signature = headers['x-emis-signature'] ?? headers['x-signature'];
    if (!signature) {
      // In CONTRACT_READY test mode without secret provided, allow test verification if explicitly in test environment
      if (config.environment === 'test' && !secretValue) {
        return { valid: true };
      }
      return { valid: false, reason: 'Assinatura EMIS ausente.' };
    }

    if (!secretValue) {
      return { valid: false, reason: 'Segredo de autenticação EMIS não configurado.' };
    }

    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
    const expected = createHmac('sha256', secretValue).update(bodyBuffer).digest('hex');
    const givenSig = Array.isArray(signature) ? signature[0] : signature;

    if (expected.toLowerCase() !== givenSig.toLowerCase()) {
      return { valid: false, reason: 'Assinatura EMIS inválida.' };
    }

    return { valid: true };
  }

  async parseAndNormalizeEvent(
    rawBody: Buffer | string,
    _headers: Record<string, string | string[] | undefined>,
    config: PaymentProviderConfig
  ): Promise<ProviderNormalizedEvent | null> {
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    let payload: any;
    try {
      payload = JSON.parse(bodyStr);
    } catch {
      return null;
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const eventId = String(payload.evento_id || payload.eventId || payload.id || '');
    if (!eventId) {
      return null;
    }

    const eventType = String(payload.tipo_evento || payload.eventType || 'EMIS_PAYMENT_EVENT');
    const trx = payload.transacao || payload.transaction || {};

    const rawCurrency = String(trx.moeda || trx.currency || 'AOA').toUpperCase();
    if (rawCurrency !== 'AOA') {
      throw new PaymentValidationError(`A moeda "${rawCurrency}" não é suportada pela rede EMIS/MULTICAIXA (apenas AOA).`);
    }

    const estado = String(trx.estado || trx.status || '').toUpperCase();
    const codigoResposta = String(trx.codigo_resposta || trx.responseCode || '');
    const isConfirmed = (estado === 'SUCESSO' || estado === 'CONFIRMADO') && (codigoResposta === '00' || codigoResposta === '');

    const rawPayloadDigest = createHash('sha256').update(bodyStr, 'utf8').digest('hex');

    if (!isConfirmed) {
      return {
        providerKey: this.providerKey,
        providerEventId: eventId,
        eventType,
        isConfirmed: false,
        candidate: null,
      };
    }

    const rawAmount = String(trx.montante || trx.amount || '0');
    const money = Money.parse(rawAmount, 'AOA');

    // Method normalization
    const canal = String(trx.canal || trx.channel || '').toUpperCase();
    let method = 'multicaixa_express';
    if (canal.includes('REFERENCIA') || canal.includes('REFERENCE')) {
      method = 'multicaixa_reference';
    } else if (canal.includes('GPO') || canal.includes('POS')) {
      method = 'multicaixa_gpo';
    }

    const transactionRef = String(trx.referencia_transacao || trx.transactionReference || trx.referencia || eventId);

    let occurredAt: Date;
    if (trx.data_hora || trx.timestamp) {
      occurredAt = new Date(trx.data_hora || trx.timestamp);
      if (Number.isNaN(occurredAt.getTime())) occurredAt = new Date();
    } else {
      occurredAt = new Date();
    }

    const meta = payload.meta || {};
    const financialAccountId = meta.conta_financeira_id || meta.financialAccountId || undefined;
    const payerPersonId = meta.pessoa_pagadora_id || meta.payerPersonId || undefined;

    const candidate: ProviderPaymentCandidate = {
      amount: money.canonicalAmount(),
      currency: 'AOA',
      method,
      providerTransactionRef: transactionRef,
      providerOccurredAt: occurredAt,
      rawPayloadDigest,
      financialAccountId: typeof financialAccountId === 'string' && financialAccountId.trim() ? financialAccountId.trim() : undefined,
      payerPersonId: typeof payerPersonId === 'string' && payerPersonId.trim() ? payerPersonId.trim() : undefined,
      metadata: {
        terminal: trx.terminal,
        origem: trx.origem_pagamento,
      },
    };

    return {
      providerKey: this.providerKey,
      providerEventId: eventId,
      eventType,
      isConfirmed: true,
      candidate,
    };
  }
}
