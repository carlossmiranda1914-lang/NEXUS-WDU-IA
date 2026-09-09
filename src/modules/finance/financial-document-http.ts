import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { canAccessFinancialDocuments } from './financial-document-policy.ts';
import { PostgresFinancialDocumentRepository } from './financial-document-service.ts';
import { createCanonicalFinanceFingerprint, executeIdempotentFinanceCommand } from './finance-command.ts';

type DocumentRow = { id: string; document_type: string; status: string; sequence_number: string; issued_at: Date; source_snapshot: Record<string, unknown>; corrects_document_id: string | null; fiscal_adapter_key: string | null; series_code: string };
const view = (row: DocumentRow) => ({ id: row.id, type: row.document_type, status: row.status, seriesCode: row.series_code, sequenceNumber: Number(row.sequence_number), issuedAt: row.issued_at.toISOString(), sourceSnapshot: row.source_snapshot, correctsDocumentId: row.corrects_document_id, fiscalAdapterKey: row.fiscal_adapter_key });

export function registerFinancialDocumentRoutes(app: Express, pool: Pool, auth = requireAuth): void {
  const actor = (req: AuthRequest, res: Response, action: 'read' | 'issue' | 'correct' | 'fiscal_config_read' | 'fiscal_config_manage' | 'series_read' | 'series_manage' = 'read') => {
    const context = req.institutionalContext;
    if (!context) { res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado.' }); return undefined; }
    if (!canAccessFinancialDocuments(context.role, action)) { res.status(403).json({ code: 'FINANCIAL_DOCUMENT_FORBIDDEN', error: 'Acesso não autorizado a documentos financeiros.' }); return undefined; }
    return context;
  };
  const select = `SELECT d.id,d.document_type,d.status,d.sequence_number,d.issued_at,d.source_snapshot,d.corrects_document_id,d.fiscal_adapter_key,s.code series_code FROM finance_financial_documents d JOIN finance_financial_document_series s ON s.institution_id=d.institution_id AND s.id=d.series_id`;
  app.get('/api/finance/documents', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res); if (!context) return;
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const result = await pool.query<DocumentRow>(`${select} WHERE d.institution_id=$1 ORDER BY d.issued_at DESC,d.id DESC LIMIT $2`, [context.institutionId, limit]);
    res.json({ items: result.rows.map(view), nextCursor: null });
  });
  app.get('/api/finance/documents/:id', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res); if (!context) return;
    const result = await pool.query<DocumentRow>(`${select} WHERE d.institution_id=$1 AND d.id=$2`, [context.institutionId, req.params.id]);
    const row = result.rows[0]; if (!row) return res.status(404).json({ code: 'FINANCIAL_DOCUMENT_NOT_FOUND', error: 'Documento financeiro não encontrado.' });
    res.json(view(row));
  });
  const key = (req: AuthRequest, res: Response) => { const value = req.header('Idempotency-Key')?.trim(); if (!value) { res.status(422).json({ code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'O cabeçalho Idempotency-Key é obrigatório.' }); return undefined; } return value; };
  const handleCommand = (res: Response, error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Finance command fingerprint conflict') return res.status(409).json({ code: 'FINANCIAL_DOCUMENT_CONFLICT', error: 'Conflito de idempotência.' });
    if (/SOURCE_NOT_ELIGIBLE|SOURCE_NOT_FOUND|ORIGINAL_NOT_FOUND|SERIES_NOT_EFFECTIVE/.test(message)) return res.status(404).json({ code: 'FINANCIAL_DOCUMENT_NOT_FOUND', error: 'Documento ou recurso financeiro não encontrado.' });
    return res.status(422).json({ code: 'FINANCIAL_DOCUMENT_VALIDATION', error: 'O pedido de documento financeiro não é elegível.' });
  };
  app.post('/api/finance/documents/issue', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res, 'issue'); const idempotencyKey = key(req, res); if (!context || !idempotencyKey) return;
    try { const result = await new PostgresFinancialDocumentRepository(pool as Pool).issue({ institutionId: context.institutionId, sourceInstitutionId: context.institutionId, sourceType: 'payment', sourceId: req.body?.sourceId, seriesId: req.body?.seriesId, documentType: req.body?.documentType, idempotencyKey }); res.status(result.replayed ? 200 : 201).json(result); } catch (error) { handleCommand(res, error); }
  });
  app.post('/api/finance/documents/:id/corrections', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res, 'correct'); const idempotencyKey = key(req, res); if (!context || !idempotencyKey) return;
    try { const result = await new PostgresFinancialDocumentRepository(pool as Pool).issueCorrection({ institutionId: context.institutionId, originalDocumentId: req.params.id, seriesId: req.body?.seriesId, documentType: req.body?.documentType, idempotencyKey }); res.status(result.replayed ? 200 : 201).json(result); } catch (error) { handleCommand(res, error); }
  });
  app.get('/api/finance/fiscal-configurations', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res, 'fiscal_config_read'); if (!context) return;
    const result = await pool.query(`SELECT id,version,adapter_key,operational_configuration,effective_from,effective_to FROM finance_fiscal_configuration_versions WHERE institution_id=$1 ORDER BY version DESC`, [context.institutionId]); res.json({ items: result.rows });
  });
  app.post('/api/finance/fiscal-configurations', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res, 'fiscal_config_manage'); if (!context) return;
    const idempotencyKey = key(req, res); if (!idempotencyKey) return;
    const command = { version: req.body?.version, adapterKey: req.body?.adapterKey, operationalConfiguration: req.body?.operationalConfiguration ?? {}, effectiveFrom: req.body?.effectiveFrom, effectiveTo: req.body?.effectiveTo ?? null };
    try { const result = await executeIdempotentFinanceCommand({ pool, identity: { institutionId: context.institutionId, operationNamespace: 'financial_document_fiscal_configuration', idempotencyKey, canonicalFingerprint: createCanonicalFinanceFingerprint(command) }, execute: async client => { const inserted = await client.query<{ id: string; version: number; adapter_key: string; effective_from: Date; effective_to: Date | null }>(`INSERT INTO finance_fiscal_configuration_versions(institution_id,version,adapter_key,operational_configuration,effective_from,effective_to) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,version,adapter_key,effective_from,effective_to`, [context.institutionId, command.version, command.adapterKey, command.operationalConfiguration, command.effectiveFrom, command.effectiveTo]); return { resultRef: inserted.rows[0]!.id, result: inserted.rows[0]! }; }, loadResult: async (client, id) => { const loaded = await client.query<{ id: string; version: number; adapter_key: string; effective_from: Date; effective_to: Date | null }>('SELECT id,version,adapter_key,effective_from,effective_to FROM finance_fiscal_configuration_versions WHERE institution_id=$1 AND id=$2', [context.institutionId, id]); if (!loaded.rows[0]) throw new Error('FISCAL_CONFIGURATION_RESULT_MISSING'); return loaded.rows[0]; } }); res.status(result.replayed ? 200 : 201).json(result.result); } catch { res.status(422).json({ code: 'FISCAL_CONFIGURATION_VALIDATION', error: 'Configuração fiscal inválida.' }); }
  });
  app.get('/api/finance/document-series', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res, 'series_read'); if (!context) return;
    const result = await pool.query(`SELECT id,code,document_type,status,effective_from,effective_to,fiscal_configuration_id FROM finance_financial_document_series WHERE institution_id=$1 ORDER BY code`, [context.institutionId]); res.json({ items: result.rows });
  });
  app.post('/api/finance/document-series', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res, 'series_manage'); if (!context) return;
    const idempotencyKey = key(req, res); if (!idempotencyKey) return;
    const command = { code: req.body?.code, documentType: req.body?.documentType ?? 'receipt', status: req.body?.status ?? 'active', effectiveFrom: req.body?.effectiveFrom, effectiveTo: req.body?.effectiveTo ?? null, fiscalConfigurationId: req.body?.fiscalConfigurationId ?? null };
    try { const result = await executeIdempotentFinanceCommand({ pool, identity: { institutionId: context.institutionId, operationNamespace: 'financial_document_series_configuration', idempotencyKey, canonicalFingerprint: createCanonicalFinanceFingerprint(command) }, execute: async client => { const inserted = await client.query<{ id: string; code: string; document_type: string; status: string; effective_from: Date; effective_to: Date | null; fiscal_configuration_id: string | null }>(`INSERT INTO finance_financial_document_series(institution_id,code,document_type,status,effective_from,effective_to,fiscal_configuration_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,code,document_type,status,effective_from,effective_to,fiscal_configuration_id`, [context.institutionId, command.code, command.documentType, command.status, command.effectiveFrom, command.effectiveTo, command.fiscalConfigurationId]); return { resultRef: inserted.rows[0]!.id, result: inserted.rows[0]! }; }, loadResult: async (client, id) => { const loaded = await client.query<{ id: string; code: string; document_type: string; status: string; effective_from: Date; effective_to: Date | null; fiscal_configuration_id: string | null }>('SELECT id,code,document_type,status,effective_from,effective_to,fiscal_configuration_id FROM finance_financial_document_series WHERE institution_id=$1 AND id=$2', [context.institutionId, id]); if (!loaded.rows[0]) throw new Error('FINANCIAL_DOCUMENT_SERIES_RESULT_MISSING'); return loaded.rows[0]; } }); res.status(result.replayed ? 200 : 201).json(result.result); } catch { res.status(422).json({ code: 'FINANCIAL_DOCUMENT_SERIES_VALIDATION', error: 'Série documental inválida.' }); }
  });
}
