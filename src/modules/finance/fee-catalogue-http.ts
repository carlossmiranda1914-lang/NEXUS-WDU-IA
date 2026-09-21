import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { canAccessFeeCatalogue } from './fee-catalogue-policy.ts';
import { PostgresFeeCatalogueRepository, FeeCatalogueConflictError, FeeCatalogueNotFoundError } from './fee-catalogue-repository.ts';
import { FeeCatalogueValidationError } from './fee-catalogue-model.ts';
import type { FinancialProfileStore } from './financial-context.ts';

export function registerFeeCatalogueRoutes(
  app: Express,
  pool: Pool,
  profiles: FinancialProfileStore,
  auth = requireAuth,
): void {
  const repo = new PostgresFeeCatalogueRepository(pool, profiles);

  const actor = (req: AuthRequest, res: Response, write = false) => {
    const c = req.institutionalContext;
    if (!c) {
      res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado' });
      return undefined;
    }
    if (!canAccessFeeCatalogue(c.role, write ? 'write' : 'read')) {
      res.status(403).json({ code: 'FEE_CATALOGUE_FORBIDDEN', error: 'Catalogue access is not permitted' });
      return undefined;
    }
    return c;
  };

  const key = (req: AuthRequest, res: Response) => {
    const v = req.header('Idempotency-Key');
    if (!v) {
      res.status(422).json({ code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'Idempotency-Key is required' });
      return undefined;
    }
    return v;
  };

  const handle = (res: Response, e: unknown) => {
    if (
      e instanceof FeeCatalogueNotFoundError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'FEE_CATALOGUE_NOT_FOUND')
    ) {
      return res.status(404).json({ code: 'FEE_CATALOGUE_NOT_FOUND', error: (e as Error).message || 'Catalogue item not found' });
    }

    if (
      e instanceof FeeCatalogueConflictError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'FEE_CATALOGUE_CONFLICT') ||
      (e instanceof Error && e.message === 'Finance command fingerprint conflict') ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505')
    ) {
      const isUniqueConstraint = typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505';
      const message = isUniqueConstraint
        ? 'Já existe um emolumento ou versão com estes dados identificadores.'
        : e instanceof Error
          ? e.message
          : 'Catalogue conflict';
      return res.status(409).json({ code: 'FEE_CATALOGUE_CONFLICT', error: message });
    }

    if (
      e instanceof FeeCatalogueValidationError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'FEE_CATALOGUE_VALIDATION') ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === '23514') ||
      (e instanceof Error && /currency|Financial|Money|effective|interval|version|amount|decimal|scale|precision|required|positive|inválid|invalid/i.test(e.message))
    ) {
      const isRawDbMessage = e instanceof Error && (e.message.includes('check constraint') || e.message.includes('relation "'));
      const message = isRawDbMessage
        ? 'A data de início da nova versão deve ser estritamente posterior à data de início da versão atual.'
        : e instanceof Error
          ? e.message
          : 'Validação do catálogo falhou';
      return res.status(422).json({ code: 'FEE_CATALOGUE_VALIDATION', error: message });
    }

    console.error('[FEE_CATALOGUE_ERROR]', e);
    return res.status(500).json({ code: 'FEE_CATALOGUE_ERROR', error: 'Catalogue operation failed' });
  };

  app.get('/api/finance/fee-catalogue', auth, async (req: AuthRequest, res) => {
    const a = actor(req, res);
    if (!a) return;
    try {
      const s = req.query.status === 'active' || req.query.status === 'inactive' ? req.query.status : 'all';
      res.json(await repo.list(a, s));
    } catch (e) {
      handle(res, e);
    }
  });

  app.get('/api/finance/fee-catalogue/:id', auth, async (req: AuthRequest, res) => {
    const a = actor(req, res);
    if (!a) return;
    try {
      res.json(await repo.get(a, req.params.id, req.query.history === 'true'));
    } catch (e) {
      handle(res, e);
    }
  });

  app.post('/api/finance/fee-catalogue', auth, async (req: AuthRequest, res) => {
    const a = actor(req, res, true);
    const k = key(req, res);
    if (!a || !k) return;
    try {
      const r = await repo.create(a, req.body, k);
      res.status(r.replayed ? 200 : 201).json(r.result);
    } catch (e) {
      handle(res, e);
    }
  });

  app.put('/api/finance/fee-catalogue/:id', auth, async (req: AuthRequest, res) => {
    const a = actor(req, res, true);
    const k = key(req, res);
    if (!a || !k) return;
    try {
      res.json((await repo.update(a, req.params.id, req.body, k)).result);
    } catch (e) {
      handle(res, e);
    }
  });

  for (const [path, status] of [['activate', 'active'], ['deactivate', 'inactive']] as const) {
    app.post(`/api/finance/fee-catalogue/:id/${path}`, auth, async (req: AuthRequest, res) => {
      const a = actor(req, res, true);
      const k = key(req, res);
      if (!a || !k) return;
      try {
        res.json((await repo.setStatus(a, req.params.id, status, k)).result);
      } catch (e) {
        handle(res, e);
      }
    });
  }
}
