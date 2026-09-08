import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { canAccessPayments } from './payment-policy.ts';
import { PostgresDiscountPolicyRepository } from './discount-policy-repository.ts';

export function registerDiscountPolicyRoutes(app: Express, pool: Pool, auth = requireAuth) {
  const repository = new PostgresDiscountPolicyRepository(pool);

  // 1. List Discount Policies
  app.get('/api/finance/discount-policies', auth, async (req: AuthRequest, res: Response) => {
    const actor = req.institutionalContext;
    if (!actor) {
      return res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado.' });
    }
    if (!canAccessPayments(actor.role, 'read')) {
      return res.status(403).json({ code: 'FORBIDDEN', error: 'Acesso não autorizado a políticas de desconto.' });
    }

    try {
      const at = req.query.at ? new Date(String(req.query.at)) : undefined;
      const policies = await repository.listDiscountPolicies(actor.institutionId, at);
      return res.status(200).json({ policies });
    } catch (error: any) {
      console.error('[DISCOUNT-POLICY-HTTP-LIST]', error);
      return res.status(500).json({ code: 'DISCOUNT_POLICY_ERROR', error: 'Falha ao listar políticas de desconto.' });
    }
  });

  // 2. Create Discount Policy (Initial Version)
  app.post('/api/finance/discount-policies', auth, async (req: AuthRequest, res: Response) => {
    const actor = req.institutionalContext;
    if (!actor) {
      return res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado.' });
    }
    if (!canAccessPayments(actor.role, 'write')) {
      return res.status(403).json({ code: 'FORBIDDEN', error: 'Acesso não autorizado a criar políticas de desconto.' });
    }

    try {
      const policy = await repository.createDiscountPolicy(actor, req.body);
      return res.status(201).json({ policy });
    } catch (error: any) {
      const message = error instanceof Error ? error.message : '';
      if (error?.code === '23505' || /duplicate key|unique|already exists|conflict/i.test(message)) {
        return res.status(409).json({ code: 'DISCOUNT_POLICY_CODE_CONFLICT', error: 'Código de política já existe.' });
      }
      if (/overlapping|overlap/i.test(message)) {
        return res.status(422).json({ code: 'DISCOUNT_POLICY_OVERLAPPING_INTERVAL', error: message });
      }
      if (/strictly positive|percentage rate|requires a 3-letter|invalid calculation/i.test(message)) {
        return res.status(422).json({ code: 'DISCOUNT_POLICY_VALIDATION_ERROR', error: message });
      }
      console.error('[DISCOUNT-POLICY-HTTP-CREATE]', error);
      return res.status(500).json({ code: 'DISCOUNT_POLICY_ERROR', error: 'Falha ao criar política de desconto.' });
    }
  });

  // 3. Create Discount Policy Version
  app.post('/api/finance/discount-policies/:id/versions', auth, async (req: AuthRequest, res: Response) => {
    const actor = req.institutionalContext;
    if (!actor) {
      return res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado.' });
    }
    if (!canAccessPayments(actor.role, 'write')) {
      return res.status(403).json({ code: 'FORBIDDEN', error: 'Acesso não autorizado a versionar políticas de desconto.' });
    }

    try {
      const version = await repository.createDiscountPolicyVersion(actor, req.params.id, req.body);
      return res.status(201).json({ version });
    } catch (error: any) {
      const message = error instanceof Error ? error.message : '';
      if (/not found/i.test(message)) {
        return res.status(404).json({ code: 'DISCOUNT_POLICY_NOT_FOUND', error: 'Política de desconto não encontrada.' });
      }
      if (/archived/i.test(message)) {
        return res.status(422).json({ code: 'DISCOUNT_POLICY_ARCHIVED', error: 'Não é possível versionar uma política arquivada.' });
      }
      if (/overlapping|overlap/i.test(message)) {
        return res.status(422).json({ code: 'DISCOUNT_POLICY_OVERLAPPING_INTERVAL', error: message });
      }
      if (/strictly positive|percentage rate|requires a 3-letter|invalid calculation/i.test(message)) {
        return res.status(422).json({ code: 'DISCOUNT_POLICY_VALIDATION_ERROR', error: message });
      }
      console.error('[DISCOUNT-POLICY-HTTP-VERSION]', error);
      return res.status(500).json({ code: 'DISCOUNT_POLICY_ERROR', error: 'Falha ao criar versão da política de desconto.' });
    }
  });

  // 4. Archive Discount Policy
  app.patch('/api/finance/discount-policies/:id/archive', auth, async (req: AuthRequest, res: Response) => {
    const actor = req.institutionalContext;
    if (!actor) {
      return res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado.' });
    }
    if (!canAccessPayments(actor.role, 'write')) {
      return res.status(403).json({ code: 'FORBIDDEN', error: 'Acesso não autorizado a arquivar políticas de desconto.' });
    }

    try {
      const policy = await repository.archiveDiscountPolicy(actor, req.params.id);
      return res.status(200).json({ policy });
    } catch (error: any) {
      const message = error instanceof Error ? error.message : '';
      if (/not found/i.test(message)) {
        return res.status(404).json({ code: 'DISCOUNT_POLICY_NOT_FOUND', error: 'Política de desconto não encontrada.' });
      }
      console.error('[DISCOUNT-POLICY-HTTP-ARCHIVE]', error);
      return res.status(500).json({ code: 'DISCOUNT_POLICY_ERROR', error: 'Falha ao arquivar política de desconto.' });
    }
  });
}
