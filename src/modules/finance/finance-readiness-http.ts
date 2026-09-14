import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { PostgresFinancialProfileStore } from './financial-context.ts';
import { PostgresFiscalConfigurationStore } from './fiscal-configuration.ts';
import { PostgresFinancialDocumentSeriesStore } from './financial-document-series.ts';
import { canAccessFinancialDocuments } from './financial-document-policy.ts';
import { resolveFinanceDocumentReadiness, resolveFinanceReadiness } from './finance-readiness.ts';
import { FiscalAdapterRegistry, productionFiscalAdapterRegistry } from './fiscal-adapter-registry.ts';
import { InstitutionLegalProfileRepository } from '../institution/institution-legal-profile.ts';
import { isAngolaProductionJurisdiction } from './jurisdictions/angola/angola-document-policy.ts';

export function registerFinanceReadinessRoutes(app: Express, pool: Pool, auth = requireAuth, fiscalAdapters: FiscalAdapterRegistry = productionFiscalAdapterRegistry): void {
  const contextForReadiness = (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) { res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado.' }); return undefined; }
    if (!canAccessFinancialDocuments(context.role, 'read')) { res.status(403).json({ code: 'FINANCE_READINESS_FORBIDDEN', error: 'Acesso não autorizado à prontidão financeira.' }); return undefined; }
    return context;
  };
  app.get('/api/finance/readiness', auth, async (req: AuthRequest, res: Response) => {
    const context = contextForReadiness(req, res); if (!context) return;
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
  app.get('/api/finance/readiness/documents/:documentType', auth, async (req: AuthRequest, res: Response) => {
    const context = contextForReadiness(req, res); if (!context) return;
    const at = new Date();
    const profiles = new PostgresFinancialProfileStore(pool);
    const fiscal = new PostgresFiscalConfigurationStore(pool);
    const series = new PostgresFinancialDocumentSeriesStore(pool);
    const legalProfiles = new InstitutionLegalProfileRepository(pool);
    const [legalProfile, financialProfile, fiscalConfiguration, effectiveSeries] = await Promise.all([
      legalProfiles.resolveEffective(context.institutionId, at),
      profiles.resolveEffective(context.institutionId, at),
      fiscal.requireEffective(context.institutionId, at).catch(() => null),
      series.findEffective(context.institutionId, req.params.documentType, at),
    ]);
    // There is intentionally no browser-writable source for AGT onboarding,
    // signing material, or AGT-issued-series attestation. Their absence must
    // therefore remain explicit rather than being inferred from local config.
    const institutionFactsPresent = Boolean(
      legalProfile?.legalName.trim() && legalProfile.taxIdentifier?.trim()
      && legalProfile.registeredAddress.countryCode.trim() && legalProfile.registeredAddress.line1.trim(),
    );
    const response = resolveFinanceDocumentReadiness({
      documentType: req.params.documentType,
      primaryJurisdiction: financialProfile?.primaryJurisdiction ?? null,
      legalProfilePresent: Boolean(legalProfile),
      financialProfilePresent: Boolean(financialProfile),
      institutionFactsPresent,
      agtOnboardingPresent: false,
      signingMaterialPresent: false,
      fiscalConfigurationPresent: Boolean(fiscalConfiguration),
      productionSeriesDocumentTypes: effectiveSeries && fiscalConfiguration && effectiveSeries.fiscalConfigurationId === fiscalConfiguration.id ? [effectiveSeries.documentType] : [],
      jurisdictionPolicyAvailable: Boolean(financialProfile && fiscalAdapters.supportsJurisdiction(financialProfile.primaryJurisdiction)),
      externalProductionPrerequisitesRequired: isAngolaProductionJurisdiction(financialProfile?.primaryJurisdiction ?? null),
    });
    res.json(response);
  });
}
