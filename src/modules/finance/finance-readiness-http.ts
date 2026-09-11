import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { PostgresFinancialProfileStore } from './financial-context.ts';
import { PostgresFiscalConfigurationStore } from './fiscal-configuration.ts';
import { PostgresFinancialDocumentSeriesStore } from './financial-document-series.ts';
import { canAccessFinancialDocuments } from './financial-document-policy.ts';
import { resolveFinanceReadiness } from './finance-readiness.ts';
import { FiscalAdapterRegistry, productionFiscalAdapterRegistry } from './fiscal-adapter-registry.ts';
import { InstitutionLegalProfileRepository } from '../institution/institution-legal-profile.ts';

export function registerFinanceReadinessRoutes(app: Express, pool: Pool, auth = requireAuth, fiscalAdapters: FiscalAdapterRegistry = productionFiscalAdapterRegistry): void {
  app.get('/api/finance/readiness', auth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return void res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado.' });
    if (!canAccessFinancialDocuments(context.role, 'read')) return void res.status(403).json({ code: 'FINANCE_READINESS_FORBIDDEN', error: 'Acesso não autorizado à prontidão financeira.' });
    const at = new Date();
    const profiles = new PostgresFinancialProfileStore(pool);
    const fiscal = new PostgresFiscalConfigurationStore(pool);
    const series = new PostgresFinancialDocumentSeriesStore(pool);
    const legalProfiles = new InstitutionLegalProfileRepository(pool);
    const readiness = await resolveFinanceReadiness({
      institutionId: context.institutionId,
      at,
      canManageConfiguration: canAccessFinancialDocuments(context.role, 'fiscal_config_manage') && canAccessFinancialDocuments(context.role, 'series_manage'),
      resolveFinancialProfile: () => profiles.resolveEffective(context.institutionId, at),
      resolveFiscalConfiguration: () => fiscal.requireEffective(context.institutionId, at),
      resolveReceiptSeries: () => series.findEffective(context.institutionId, 'receipt', at),
      resolveInstitutionLegalProfile: () => legalProfiles.resolveEffective(context.institutionId, at),
      isJurisdictionPolicyAvailable: (profile) => Boolean(profile && fiscalAdapters.supportsJurisdiction((profile as { primaryJurisdiction: string }).primaryJurisdiction)),
      resolveReceiptIssuance: async () => {
        const [profile, configuration, receiptSeries] = await Promise.all([
          profiles.resolveEffective(context.institutionId, at),
          fiscal.requireEffective(context.institutionId, at),
          series.findEffective(context.institutionId, 'receipt', at),
        ]);
        if (!profile) throw new Error('FINANCIAL_PROFILE_NOT_FOUND');
        if (!receiptSeries) throw new Error('RECEIPT_SERIES_NOT_EFFECTIVE');
        fiscalAdapters.select(profile, configuration);
      },
    });
    res.json(readiness);
  });
}
