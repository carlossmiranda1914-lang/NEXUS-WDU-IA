import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { canAccessFeeCatalogue } from './fee-catalogue-policy.ts';
import {
  PostgresFeeTypeRepository,
  FeeTypeConflictError,
  FeeTypeNotFoundError,
} from './fee-type-repository.ts';
import { FeeTypeValidationError } from './fee-type-model.ts';

export function registerFeeTypeRoutes(
  app: Express,
  pool: Pool,
  auth = requireAuth,
): void {
  const repo = new PostgresFeeTypeRepository(pool);

  const actor = (req: AuthRequest, res: Response, write = false) => {
    const c = req.institutionalContext;
    if (!c) return undefined;
    if (!canAccessFeeCatalogue(c.role, write ? 'write' : 'read')) {
      res.status(403).json({ code: 'FEE_TYPE_FORBIDDEN', error: 'Acesso não autorizado a tipos de emolumento' });
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
      e instanceof FeeTypeNotFoundError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'FEE_TYPE_NOT_FOUND')
    ) {
      return res.status(404).json({ code: 'FEE_TYPE_NOT_FOUND', error: (e as Error).message || 'Tipo de emolumento não encontrado' });
    }

    if (
      e instanceof FeeTypeConflictError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'FEE_TYPE_CONFLICT') ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505')
    ) {
      const isUniqueConstraint = typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505';
      const message = isUniqueConstraint
        ? 'Já existe um tipo de emolumento com este prefixo nesta instituição.'
        : e instanceof Error
          ? e.message
          : 'Conflito de tipo de emolumento';
      return res.status(409).json({ code: 'FEE_TYPE_CONFLICT', error: message });
    }

    if (
      e instanceof FeeTypeValidationError ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'FEE_TYPE_VALIDATION') ||
      (typeof e === 'object' && e !== null && (e as { code?: string }).code === '23514')
    ) {
      return res.status(422).json({ code: 'FEE_TYPE_VALIDATION', error: (e as Error).message || 'Validação falhou' });
    }

    console.error('[FEE_TYPE_ERROR]', e);
    return res.status(500).json({ code: 'FEE_TYPE_ERROR', error: 'Operação de tipo de emolumento falhou' });
  };

  app.get('/api/finance/fee-types', auth, async (req: AuthRequest, res) => {
    const a = actor(req, res);
    if (!a) return;
    try {
      const s = req.query.status === 'active' || req.query.status === 'inactive' ? req.query.status : 'all';
      res.json(await repo.list(a, s));
    } catch (e) {
      handle(res, e);
    }
  });

  app.get('/api/finance/fee-types/:id', auth, async (req: AuthRequest, res) => {
    const a = actor(req, res);
    if (!a) return;
    try {
      res.json(await repo.getById(a, req.params.id));
    } catch (e) {
      handle(res, e);
    }
  });

  app.post('/api/finance/fee-types', auth, async (req: AuthRequest, res) => {
    const a = actor(req, res, true);
    if (!a) return;
    const k = key(req, res);
    if (!k) return;
    try {
      const created = await repo.create(a, req.body, k);
      res.status(created.replayed ? 200 : 201).json(created.result);
    } catch (e) {
      handle(res, e);
    }
  });

  app.put('/api/finance/fee-types/:id', auth, async (req: AuthRequest, res) => {
    const a = actor(req, res, true);
    if (!a) return;
    const k = key(req, res);
    if (!k) return;
    try {
      const updated = await repo.update(a, req.params.id, req.body, k);
      res.json(updated.result);
    } catch (e) {
      handle(res, e);
    }
  });

  for (const path of ['activate', 'deactivate'] as const) {
    app.post(`/api/finance/fee-types/:id/${path}`, auth, async (req: AuthRequest, res) => {
      const a = actor(req, res, true);
      if (!a) return;
      const k = key(req, res);
      if (!k) return;
      try {
        const toggled = await repo.setStatus(a, req.params.id, path === 'activate' ? 'active' : 'inactive', k);
        res.json(toggled.result);
      } catch (e) {
        handle(res, e);
      }
    });
  }
}
