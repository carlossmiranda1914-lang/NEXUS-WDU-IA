import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { InstitutionLegalProfileRepository } from './institution-legal-profile.ts';
import { PostgresFinancialProfileStore } from '../finance/financial-context.ts';
import { canAccessFinancialDocuments, type FinancialDocumentAction } from '../finance/financial-document-policy.ts';

const contextFor = (req: AuthRequest, res: Response, action: FinancialDocumentAction) => {
  const context = req.institutionalContext;
  if (!context) { res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado.' }); return undefined; }
  if (!canAccessFinancialDocuments(context.role, action)) { res.status(403).json({ code: 'INSTITUTION_CONFIGURATION_FORBIDDEN', error: 'Acesso não autorizado à configuração institucional.' }); return undefined; }
  return context;
};

const legalInput = (body: any, institutionId: string) => ({
  institutionId, legalName: String(body?.legalName ?? '').trim(), taxIdentifier: typeof body?.taxIdentifier === 'string' ? body.taxIdentifier.trim() || null : null,
  registeredAddress: body?.registeredAddress, legalEmail: typeof body?.legalEmail === 'string' ? body.legalEmail.trim() || null : null,
  legalPhone: typeof body?.legalPhone === 'string' ? body.legalPhone.trim() || null : null, logoAssetReference: null,
  effectiveFrom: new Date(body?.effectiveFrom),
});

export function registerInstitutionConfigurationRoutes(app: Express, pool: Pool, auth = requireAuth): void {
  const legal = new InstitutionLegalProfileRepository(pool);
  const financial = new PostgresFinancialProfileStore(pool);
  app.get('/api/institution/legal-profile', auth, async (req: AuthRequest, res: Response) => {
    const context = contextFor(req, res, 'legal_profile_read'); if (!context) return;
    res.json({ item: await legal.resolveEffective(context.institutionId, new Date()) });
  });
  app.post('/api/institution/legal-profile', auth, async (req: AuthRequest, res: Response) => {
    const context = contextFor(req, res, 'legal_profile_manage'); if (!context) return;
    const input = legalInput(req.body, context.institutionId);
    if (!input.legalName || !(input.effectiveFrom instanceof Date) || Number.isNaN(input.effectiveFrom.getTime()) || !input.registeredAddress || typeof input.registeredAddress.countryCode !== 'string' || typeof input.registeredAddress.line1 !== 'string') return void res.status(422).json({ code: 'INSTITUTION_LEGAL_PROFILE_INVALID', error: 'O perfil jurídico institucional não é válido.' });
    try { res.status(201).json({ item: await legal.createVersion(input) }); } catch { res.status(422).json({ code: 'INSTITUTION_LEGAL_PROFILE_INVALID', error: 'O perfil jurídico institucional não é válido.' }); }
  });
  app.get('/api/finance/profile', auth, async (req: AuthRequest, res: Response) => {
    const context = contextFor(req, res, 'financial_profile_read'); if (!context) return;
    res.json({ item: await financial.resolveEffective(context.institutionId, new Date()) });
  });
  app.post('/api/finance/profile', auth, async (req: AuthRequest, res: Response) => {
    const context = contextFor(req, res, 'financial_profile_manage'); if (!context) return;
    const body = req.body ?? {};
    try {
      const item = await financial.createVersion({ institutionId: context.institutionId, effectiveFrom: String(body.effectiveFrom ?? ''), primaryJurisdiction: String(body.primaryJurisdiction ?? '').trim(), functionalCurrency: String(body.functionalCurrency ?? '').trim(), financialTimezone: String(body.financialTimezone ?? '').trim(), monetaryPolicyVersion: String(body.monetaryPolicyVersion ?? '').trim(), enabledCurrencies: Array.isArray(body.enabledCurrencies) ? body.enabledCurrencies.map(String) : [] });
      res.status(201).json({ item });
    } catch { res.status(422).json({ code: 'FINANCIAL_PROFILE_INVALID', error: 'O perfil financeiro institucional não é válido.' }); }
  });
}
