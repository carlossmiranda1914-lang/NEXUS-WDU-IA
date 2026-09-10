import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { PostgresFinancialProfileStore } from './financial-context.ts';
import { PostgresFiscalConfigurationStore } from './fiscal-configuration.ts';
import { PostgresFinancialDocumentSeriesStore } from './financial-document-series.ts';
import { canAccessFinancialDocuments } from './financial-document-policy.ts';
import { resolveFinanceReadiness } from './finance-readiness.ts';

export function registerFinanceReadinessRoutes(app: Express, pool: Pool, auth = requireAuth): void {
  app.get('/api/finance/readiness', auth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return void res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado.' });
    if (!canAccessFinancialDocuments(context.role, 'read')) return void res.status(403).json({ code: 'FINANCE_READINESS_FORBIDDEN', error: 'Acesso não autorizado à prontidão financeira.' });
    const at = new Date();
    const profiles = new PostgresFinancialProfileStore(pool);
    const fiscal = new PostgresFiscalConfigurationStore(pool);
    const series = new PostgresFinancialDocumentSeriesStore(pool);
    const readiness = await resolveFinanceReadiness({
      institutionId: context.institutionId,
      at,
      canManageConfiguration: canAccessFinancialDocuments(context.role, 'fiscal_config_manage') && canAccessFinancialDocuments(context.role, 'series_manage'),
      resolveFinancialProfile: () => profiles.resolveEffective(context.institutionId, at),
      resolveFiscalConfiguration: () => fiscal.requireEffective(context.institutionId, at),
      resolveReceiptSeries: () => series.findEffective(context.institutionId, 'receipt', at),
    });
    res.json(readiness);
  });
}
