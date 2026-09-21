import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { canAccessPayments } from './payment-policy.ts';
import {
  PostgresPaymentProviderRepository,
  PaymentProviderConfigNotFoundError,
} from './payment-provider-repository.ts';
import {
  PaymentProviderKey,
  PaymentProviderValidationError,
  toPublicProviderConfigProjection,
} from './payment-provider-model.ts';

export function registerPaymentProviderRoutes(
  app: Express,
  pool: Pool,
  auth = requireAuth
): void {
  const repo = new PostgresPaymentProviderRepository(pool);

  const actor = (req: AuthRequest, res: Response, admin = false) => {
    const c = req.institutionalContext;
    if (!c) {
      res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado.' });
      return undefined;
    }
    if (!canAccessPayments(c.role, admin ? 'provider_admin' : 'read')) {
      res.status(403).json({ code: 'PAYMENT_PROVIDER_FORBIDDEN', error: 'Acesso não autorizado à administração de provedores.' });
      return undefined;
    }
    return c;
  };

  const handle = (res: Response, e: unknown) => {
    if (
      e instanceof PaymentProviderConfigNotFoundError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'PAYMENT_PROVIDER_CONFIG_NOT_FOUND')
    ) {
      return res.status(404).json({ code: 'PAYMENT_PROVIDER_CONFIG_NOT_FOUND', error: (e as Error).message || 'Configuração de provedor não encontrada.' });
    }

    if (
      e instanceof PaymentProviderValidationError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'PAYMENT_PROVIDER_VALIDATION_ERROR')
    ) {
      return res.status(422).json({ code: 'PAYMENT_PROVIDER_VALIDATION_ERROR', error: (e as Error).message || 'Dados de configuração de provedor inválidos.' });
    }

    console.error('[PAYMENT-PROVIDER-HTTP] Unexpected error:', e);
    return res.status(500).json({ code: 'PAYMENT_PROVIDER_ERROR', error: 'Operação de configuração de provedor falhou.' });
  };

  app.get('/api/finance/providers/configs', auth, async (req: AuthRequest, res) => {
    const actorCtx = actor(req, res, false);
    if (!actorCtx) return;
    try {
      const configs = await repo.list(actorCtx);
      res.json(configs.map(toPublicProviderConfigProjection));
    } catch (e) {
      handle(res, e);
    }
  });

  app.get('/api/finance/providers/configs/:providerKey', auth, async (req: AuthRequest, res) => {
    const actorCtx = actor(req, res, false);
    if (!actorCtx) return;
    try {
      const providerKey = req.params.providerKey as PaymentProviderKey;
      const config = await repo.getByProviderKey(actorCtx, providerKey);
      if (!config) {
        return res.status(404).json({ code: 'PAYMENT_PROVIDER_CONFIG_NOT_FOUND', error: 'Configuração de provedor não encontrada.' });
      }
      res.json(toPublicProviderConfigProjection(config));
    } catch (e) {
      handle(res, e);
    }
  });

  app.put('/api/finance/providers/configs/:providerKey', auth, async (req: AuthRequest, res) => {
    const actorCtx = actor(req, res, true);
    if (!actorCtx) return;
    try {
      const providerKey = req.params.providerKey as PaymentProviderKey;
      const saved = await repo.save(actorCtx, {
        ...req.body,
        providerKey,
      });
      res.json(toPublicProviderConfigProjection(saved));
    } catch (e) {
      handle(res, e);
    }
  });
}
