import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { PostgresPaymentProviderRepository } from './payment-provider-repository.ts';
import { PaymentProviderKey } from './payment-provider-model.ts';
import { AdyenAdapter } from './providers/adyen-adapter.ts';
import { EmisMulticaixaAdapter } from './providers/emis-multicaixa-adapter.ts';
import type { PaymentProviderAdapter } from './providers/payment-provider-adapter.ts';
import { confirmIncomingProviderPayment } from './payment-service.ts';
import { ConfirmIncomingPaymentIntent, PaymentValidationError } from './payment-model.ts';
import { Money } from './money.ts';
import { PostgresFinancialProfileStore } from './financial-context.ts';
import { SecretResolver, defaultSecretResolver } from './secret-resolver.ts';

const adapters: Record<PaymentProviderKey, PaymentProviderAdapter> = {
  adyen: new AdyenAdapter(),
  emis_multicaixa: new EmisMulticaixaAdapter(),
};

export function registerPaymentWebhookRoutes(
  app: Express,
  pool: Pool,
  secretResolver: SecretResolver = defaultSecretResolver
): void {
  const providerRepo = new PostgresPaymentProviderRepository(pool);
  const profileStore = new PostgresFinancialProfileStore(pool);

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

    // Resolve webhook secret strictly via server-side secret resolver using config.secretReferenceId
    if (!config.secretReferenceId) {
      res.status(401).json({ error: 'Referência de segredo não configurada para o provedor.' });
      return;
    }

    const secretValue = await secretResolver.resolveSecret(config.secretReferenceId);
    if (!secretValue) {
      res.status(401).json({ error: 'Segredo de autenticação do provedor não encontrado.' });
      return;
    }

    const rawBody = req.body;
    const bodyBuffer = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody), 'utf8');

    // 1. Authenticate webhook using provider adapter and resolved secret
    const authResult = await adapter.authenticateWebhook(bodyBuffer, req.headers, config, secretValue);
    if (!authResult.valid) {
      console.warn(`[WEBHOOK] Authentication failed for provider ${providerKey}: ${authResult.reason}`);
      res.status(401).json({ error: authResult.reason || 'Falha de autenticação do webhook.' });
      return;
    }

    // 2. Parse and normalize event
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
      // Resolve active financial profile version using canonical store (fail closed if missing)
      const effectiveAt = normalized.candidate.providerOccurredAt ?? new Date();
      const profile = await profileStore.resolveEffective(institutionId, effectiveAt);
      if (!profile) {
        console.warn(`[WEBHOOK] Active financial profile for institution ${institutionId} not found.`);
        res.status(422).json({ error: 'Perfil financeiro efetivo não encontrado para a instituição.' });
        return;
      }

      const candidateCurrency = normalized.candidate.currency.toUpperCase();
      if (!profile.enabledCurrencies.includes(candidateCurrency)) {
        res.status(400).json({ error: `A moeda "${candidateCurrency}" não está habilitada no perfil financeiro institucional.` });
        return;
      }

      const intent: ConfirmIncomingPaymentIntent = {
        institutionId,
        sourceType: 'provider',
        method: normalized.candidate.method,
        money: Money.parse(normalized.candidate.amount, candidateCurrency),
        effectiveAt: normalized.candidate.providerOccurredAt ?? new Date(),
        financialAccountId: normalized.candidate.financialAccountId,
        payerPersonId: normalized.candidate.payerPersonId,
        providerKey,
        providerEventId: normalized.providerEventId,
        providerTransactionRef: normalized.candidate.providerTransactionRef,
        providerOccurredAt: normalized.candidate.providerOccurredAt,
        actorKind: 'provider',
        actorPersonId: undefined,
        financialProfileVersion: profile.version,
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
    } catch (e: any) {
      if (e instanceof PaymentValidationError || (e instanceof Error && (/currency/i.test(e.message) || /moeda/i.test(e.message)))) {
        res.status(400).json({ error: e.message });
        return;
      }
      console.error('[WEBHOOK-HTTP] Ingress error:', e);
      res.status(500).json({ error: 'Falha no processamento do webhook.' });
    }
  });
}
