import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { PostgresPaymentProviderRepository } from './payment-provider-repository.ts';
import { PaymentProviderKey } from './payment-provider-model.ts';
import { AdyenAdapter } from './providers/adyen-adapter.ts';
import { EmisMulticaixaAdapter } from './providers/emis-multicaixa-adapter.ts';
import type { PaymentProviderAdapter } from './providers/payment-provider-adapter.ts';
import { confirmIncomingProviderPayment } from './payment-service.ts';
import { ConfirmIncomingPaymentIntent } from './payment-model.ts';
import { Money } from './money.ts';

const adapters: Record<PaymentProviderKey, PaymentProviderAdapter> = {
  adyen: new AdyenAdapter(),
  emis_multicaixa: new EmisMulticaixaAdapter(),
};

export function registerPaymentWebhookRoutes(app: Express, pool: Pool): void {
  const providerRepo = new PostgresPaymentProviderRepository(pool);

  async function handleWebhook(
    providerKey: PaymentProviderKey,
    institutionId: string,
    req: Request,
    res: Response
  ): Promise<void> {
    const adapter = adapters[providerKey];
    if (!adapter) {
      res.status(404).json({ error: `Provedor ${providerKey} não suportado.` });
      return;
    }

    const config = await providerRepo.resolveActiveConfig(institutionId, providerKey);
    if (!config) {
      console.warn(`[WEBHOOK] Active configuration for provider ${providerKey} and institution ${institutionId} not found.`);
      if (providerKey === 'adyen') {
        res.status(200).json({ notificationResponse: '[accepted]' });
      } else {
        res.status(200).json({ status: 'IGNORED' });
      }
      return;
    }

    // Resolve webhook secret (from server environment or config reference)
    let secret: string | undefined = undefined;
    if (providerKey === 'adyen') {
      secret = process.env.ADYEN_HMAC_KEY;
    } else if (providerKey === 'emis_multicaixa') {
      secret = process.env.EMIS_HMAC_KEY;
    }

    const rawBody = req.body;
    const bodyBuffer = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody), 'utf8');

    // 1. Authenticate webhook
    const authResult = await adapter.authenticateWebhook(bodyBuffer, req.headers, config, secret);
    if (!authResult.valid) {
      console.warn(`[WEBHOOK] Authentication failed for provider ${providerKey}: ${authResult.reason}`);
      res.status(401).json({ error: authResult.reason || 'Falha de autenticação do webhook.' });
      return;
    }

    // 2. Parse and normalize
    const normalized = await adapter.parseAndNormalizeEvent(bodyBuffer, req.headers, config);
    if (!normalized) {
      if (providerKey === 'adyen') {
        res.status(200).json({ notificationResponse: '[accepted]' });
      } else {
        res.status(200).json({ status: 'IGNORED' });
      }
      return;
    }

    // 3. If event meets confirmation threshold, confirm payment canonically
    if (normalized.isConfirmed && normalized.candidate) {
      // Resolve active financial profile version
      const profileRes = await pool.query<{ version: number }>(
        `SELECT version FROM finance_profile_versions WHERE institution_id = $1 ORDER BY version DESC LIMIT 1`,
        [institutionId]
      );
      const financialProfileVersion = profileRes.rows[0]?.version ?? 1;

      // Resolve a system or institution actor for provenance
      const actorRes = await pool.query<{ id: string }>(
        `SELECT id FROM people LIMIT 1`
      );
      const actorPersonId = actorRes.rows[0]?.id ?? '00000000-0000-0000-0000-000000000000';

      const intent: ConfirmIncomingPaymentIntent = {
        institutionId,
        sourceType: 'provider',
        method: normalized.candidate.method,
        money: Money.parse(normalized.candidate.amount, normalized.candidate.currency),
        effectiveAt: normalized.candidate.providerOccurredAt,
        financialAccountId: normalized.candidate.financialAccountId,
        payerPersonId: normalized.candidate.payerPersonId,
        providerKey,
        providerEventId: normalized.providerEventId,
        providerTransactionRef: normalized.candidate.providerTransactionRef,
        providerOccurredAt: normalized.candidate.providerOccurredAt,
        actorPersonId,
        financialProfileVersion,
      };

      const idempotencyKey = `${providerKey}:${institutionId}:${normalized.providerEventId}`;
      await confirmIncomingProviderPayment(pool, intent, idempotencyKey);
    }

    // 4. Return safe acknowledgment
    if (providerKey === 'adyen') {
      res.status(200).json({ notificationResponse: '[accepted]' });
    } else {
      res.status(200).json({ status: 'OK', message: 'RECEBIDO' });
    }
  }

  app.post('/api/finance/webhooks/:providerKey/:institutionId', async (req, res) => {
    const providerKey = req.params.providerKey as PaymentProviderKey;
    const institutionId = req.params.institutionId;
    try {
      await handleWebhook(providerKey, institutionId, req, res);
    } catch (e) {
      console.error('[WEBHOOK-HTTP] Ingress error:', e);
      res.status(500).json({ error: 'Falha no processamento do webhook.' });
    }
  });
}
