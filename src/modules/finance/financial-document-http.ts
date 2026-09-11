import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { canAccessFinancialDocuments } from './financial-document-policy.ts';
import { PostgresFinancialDocumentRepository } from './financial-document-service.ts';
import { canonicalDocumentaryEligibilityReason, resolveReceiptEligibility } from './financial-document-eligibility.ts';
import { FinancialDocumentArtifactService, type FinancialDocumentArtifact } from './financial-document-artifact-service.ts';
import { createCanonicalFinanceFingerprint, executeIdempotentFinanceCommand } from './finance-command.ts';
import { FiscalAdapterRegistry, productionFiscalAdapterRegistry } from './fiscal-adapter-registry.ts';
import { buildFinancialDocumentPresentation } from './financial-document-presentation.ts';
import { decodeDocumentarySnapshot, type DocumentarySnapshot } from './documentary-snapshot.ts';

type DocumentRow = { id: string; document_type: string; status: string; sequence_number: string; issued_at: Date; documentary_snapshot: DocumentarySnapshot | null; corrects_document_id: string | null; series_code: string };
const view = (row: DocumentRow) => {
  const decoded = row.documentary_snapshot ? decodeDocumentarySnapshot(row.documentary_snapshot) : null;
  return { id: row.id, type: row.document_type, status: row.status, seriesCode: row.series_code, sequenceNumber: Number(row.sequence_number), issuedAt: row.issued_at.toISOString(), correctsDocumentId: row.corrects_document_id, snapshotVersion: decoded?.snapshotVersion ?? null, presentation: decoded ? buildFinancialDocumentPresentation({ document: { documentType: row.document_type, seriesCode: row.series_code, sequenceNumber: Number(row.sequence_number), issuedAt: row.issued_at, status: 'issued' }, snapshot: decoded.snapshot }) : null };
};
const artifactView = (artifact: FinancialDocumentArtifact) => ({ id: artifact.id, documentId: artifact.documentId, renderVersion: artifact.renderVersion, templateVersion: artifact.templateVersion, generatedAt: artifact.generatedAt.toISOString(), contentHash: artifact.contentHash, mediaType: artifact.mediaType, byteSize: artifact.byteSize });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const decodeCursor = (value: unknown) => {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,160}$/.test(value)) throw new Error('INVALID_CURSOR');
  const id = Buffer.from(value, 'base64url').toString('utf8');
  if (!uuid.test(id)) throw new Error('INVALID_CURSOR');
  return id;
};
const encodeCursor = (id: string) => Buffer.from(id, 'utf8').toString('base64url');

export function registerFinancialDocumentRoutes(app: Express, pool: Pool, auth = requireAuth, fiscalAdapters: FiscalAdapterRegistry = productionFiscalAdapterRegistry): void {
  const actor = (req: AuthRequest, res: Response, action: 'read' | 'issue' | 'correct' | 'fiscal_config_read' | 'fiscal_config_manage' | 'series_read' | 'series_manage' = 'read') => {
    const context = req.institutionalContext;
    if (!context) { res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado.' }); return undefined; }
    if (!canAccessFinancialDocuments(context.role, action)) { res.status(403).json({ code: 'FINANCIAL_DOCUMENT_FORBIDDEN', error: 'Acesso não autorizado a documentos financeiros.' }); return undefined; }
    return context;
  };
  const select = `SELECT d.id,d.document_type,d.status,d.sequence_number,d.issued_at,d.documentary_snapshot,d.corrects_document_id,s.code series_code FROM finance_financial_documents d JOIN finance_financial_document_series s ON s.institution_id=d.institution_id AND s.id=d.series_id`;
  app.get('/api/finance/documents', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res); if (!context) return;
    const parsedLimit = req.query.limit === undefined ? 25 : Number(req.query.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) return res.status(422).json({ code: 'FINANCIAL_DOCUMENT_INVALID_QUERY', error: 'A paginação é inválida.' });
    let cursorId: string | null;
    try { cursorId = decodeCursor(req.query.cursor); } catch { return res.status(422).json({ code: 'FINANCIAL_DOCUMENT_INVALID_CURSOR', error: 'O cursor é inválido.' }); }
    const result = await pool.query<DocumentRow>(`WITH cursor_row AS (SELECT issued_at,id FROM finance_financial_documents WHERE institution_id=$1 AND id=$2) ${select} WHERE d.institution_id=$1 AND ($2::uuid IS NULL OR EXISTS (SELECT 1 FROM cursor_row) AND (d.issued_at,d.id)<(SELECT issued_at,id FROM cursor_row)) ORDER BY d.issued_at DESC,d.id DESC LIMIT $3`, [context.institutionId, cursorId, parsedLimit + 1]);
    const hasMore = result.rows.length > parsedLimit; const rows = hasMore ? result.rows.slice(0, parsedLimit) : result.rows;
    if (cursorId && result.rows.length === 0) { const exists = await pool.query<{ id: string }>('SELECT id FROM finance_financial_documents WHERE institution_id=$1 AND id=$2', [context.institutionId, cursorId]); if (!exists.rows[0]) return res.status(422).json({ code: 'FINANCIAL_DOCUMENT_INVALID_CURSOR', error: 'O cursor é inválido.' }); }
    res.json({ items: rows.map(view), page: { nextCursor: hasMore && rows.length ? encodeCursor(rows[rows.length - 1]!.id) : null }, capabilities: { issue: canAccessFinancialDocuments(context.role, 'issue'), correct: canAccessFinancialDocuments(context.role, 'correct') } });
  });
  app.get('/api/finance/documents/:id', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res); if (!context) return;
    const result = await pool.query<DocumentRow>(`${select} WHERE d.institution_id=$1 AND d.id=$2`, [context.institutionId, req.params.id]);
    const row = result.rows[0]; if (!row) return res.status(404).json({ code: 'FINANCIAL_DOCUMENT_NOT_FOUND', error: 'Documento financeiro não encontrado.' });
    const [sources, corrections] = await Promise.all([
      pool.query<{ source_type: string; snapshot: Record<string, unknown> }>('SELECT source_type,snapshot FROM finance_financial_document_sources WHERE institution_id=$1 AND document_id=$2 ORDER BY source_type,source_id', [context.institutionId, row.id]),
      pool.query<DocumentRow>(`${select} WHERE d.institution_id=$1 AND d.corrects_document_id=$2 ORDER BY d.issued_at ASC,d.id ASC`, [context.institutionId, row.id]),
    ]);
    res.json({ ...view(row), sources: sources.rows.map(source => ({ type: source.source_type, paymentReference: typeof source.snapshot.paymentReference === 'string' ? source.snapshot.paymentReference : null })), corrections: corrections.rows.map(view) });
  });
  const key = (req: AuthRequest, res: Response) => { const value = req.header('Idempotency-Key')?.trim(); if (!value) { res.status(422).json({ code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'O cabeçalho Idempotency-Key é obrigatório.' }); return undefined; } return value; };
  const handleCommand = (res: Response, error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Finance command fingerprint conflict') return res.status(409).json({ code: 'FINANCIAL_DOCUMENT_CONFLICT', error: 'Conflito de idempotência.' });
    if (/SOURCE_NOT_ELIGIBLE|SOURCE_NOT_FOUND|ORIGINAL_NOT_FOUND|SERIES_NOT_EFFECTIVE/.test(message)) return res.status(404).json({ code: 'FINANCIAL_DOCUMENT_NOT_FOUND', error: 'Documento ou recurso financeiro não encontrado.' });
    const safe = canonicalDocumentaryEligibilityReason(error);
    return res.status(422).json({ code: safe, error: 'O pedido de documento financeiro não é elegível.' });
  };
  app.get('/api/finance/payments/:id/receipt-eligibility', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res, 'issue'); if (!context) return;
    const seriesId = typeof req.query.seriesId === 'string' ? req.query.seriesId : '';
    const result = await resolveReceiptEligibility(pool, fiscalAdapters, { institutionId: context.institutionId, paymentId: req.params.id, seriesId, documentType: 'receipt' });
    res.json(result.eligible === true ? { status: 'ELIGIBLE' } : { status: 'BLOCKED', reasonCode: result.reasonCode });
  });
  app.post('/api/finance/documents/issue', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res, 'issue'); const idempotencyKey = key(req, res); if (!context || !idempotencyKey) return;
    try { const result = await new PostgresFinancialDocumentRepository(pool as Pool, fiscalAdapters).issue({ institutionId: context.institutionId, sourceInstitutionId: context.institutionId, sourceType: 'payment', sourceId: req.body?.sourceId, seriesId: req.body?.seriesId, documentType: req.body?.documentType, idempotencyKey }); res.status(result.replayed ? 200 : 201).json(result); } catch (error) { handleCommand(res, error); }
  });
  app.post('/api/finance/documents/:id/corrections', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res, 'correct'); const idempotencyKey = key(req, res); if (!context || !idempotencyKey) return;
    try { const result = await new PostgresFinancialDocumentRepository(pool as Pool, fiscalAdapters).issueCorrection({ institutionId: context.institutionId, originalDocumentId: req.params.id, seriesId: req.body?.seriesId, documentType: req.body?.documentType, idempotencyKey }); res.status(result.replayed ? 200 : 201).json(result); } catch (error) { handleCommand(res, error); }
  });
  app.get('/api/finance/documents/:id/artifacts', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res, 'read'); if (!context) return;
    const artifacts = await pool.query('SELECT id,document_id,render_version,template_version,generated_at,content_hash,media_type,byte_size FROM finance_financial_document_artifacts WHERE institution_id=$1 AND document_id=$2 ORDER BY generated_at DESC', [context.institutionId, req.params.id]);
    res.json({ items: artifacts.rows });
  });
  app.post('/api/finance/documents/:id/artifacts', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res, 'issue'); if (!context) return;
    try { const artifact = await new FinancialDocumentArtifactService(pool).generate({ institutionId: context.institutionId, documentId: req.params.id, renderVersion: req.body?.renderVersion ?? 'renderer-1', templateVersion: req.body?.templateVersion ?? 'template-1' }); res.status(201).json(artifactView(artifact)); } catch (error) { const message = error instanceof Error ? error.message : ''; res.status(message.includes('NOT_FOUND') ? 404 : 422).json({ code: 'FINANCIAL_DOCUMENT_ARTIFACT_VALIDATION', error: 'Não foi possível gerar o artefacto oficial.' }); }
  });
  app.get('/api/finance/document-artifacts/:artifactId/content', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res, 'read'); if (!context) return;
    try { const bytes = await new FinancialDocumentArtifactService(pool).retrieve({ institutionId: context.institutionId, artifactId: req.params.artifactId }); res.type('application/pdf').send(bytes); } catch (error) { const message = error instanceof Error ? error.message : ''; res.status(message.includes('NOT_FOUND') ? 404 : 422).json({ code: 'FINANCIAL_DOCUMENT_ARTIFACT_UNAVAILABLE', error: 'Artefacto oficial indisponível.' }); }
  });
  app.get('/api/finance/fiscal-configurations', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res, 'fiscal_config_read'); if (!context) return;
    const result = await pool.query(`SELECT id,version,adapter_key,operational_configuration,effective_from,effective_to FROM finance_fiscal_configuration_versions WHERE institution_id=$1 ORDER BY version DESC`, [context.institutionId]); res.json({ items: result.rows });
  });
  app.post('/api/finance/fiscal-configurations', auth, async (req: AuthRequest, res) => {
    const context = actor(req, res, 'fiscal_config_manage'); if (!context) return;
    const idempotencyKey = key(req, res); if (!idempotencyKey) return;
    const command = { version: req.body?.version, adapterKey: req.body?.adapterKey, operationalConfiguration: req.body?.operationalConfiguration ?? {}, effectiveFrom: req.body?.effectiveFrom, effectiveTo: req.body?.effectiveTo ?? null };
    // `core` is a synthetic NEXUS_TEST adapter. It is never a production-facing
    // configuration choice and can only be provisioned by an explicitly-authorized test runtime.
    if (!fiscalAdapters.has(command.adapterKey)) {
      return void res.status(422).json({ code: 'FISCAL_ADAPTER_NOT_REGISTERED', error: 'O adaptador fiscal indicado não está autorizado neste ambiente.' });
    }
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
    try { const result = await executeIdempotentFinanceCommand({ pool, identity: { institutionId: context.institutionId, operationNamespace: 'financial_document_series_configuration', idempotencyKey, canonicalFingerprint: createCanonicalFinanceFingerprint(command) }, execute: async client => { const inserted = await client.query<{ id: string; code: string; document_type: string; status: string; effective_from: Date; effective_to: Date | null; fiscal_configuration_id: string | null }>(`INSERT INTO finance_financial_document_series(institution_id,code,document_type,status,effective_from,effective_to,fiscal_configuration_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,code,document_type,status,effective_from,effective_to,fiscal_configuration_id`, [context.institutionId, command.code, command.documentType, command.status, command.effectiveFrom, command.effectiveTo, command.fiscalConfigurationId]); return { resultRef: inserted.rows[0]!.id, result: inserted.rows[0]! }; }, loadResult: async (client, id) => { const loaded = await client.query<{ id: string; code: string; document_type: string; status: string; effective_from: Date; effective_to: Date | null }>('SELECT id,code,document_type,status,effective_from,effective_to FROM finance_financial_document_series WHERE institution_id=$1 AND id=$2', [context.institutionId, id]); if (!loaded.rows[0]) throw new Error('FINANCIAL_DOCUMENT_SERIES_RESULT_MISSING'); return loaded.rows[0]; } }); res.status(result.replayed ? 200 : 201).json(result.result); } catch (error: any) { if (error?.code === '23505') return void res.status(409).json({ code: 'FINANCE_RECEIPT_SERIES_CONFLICT', error: 'Já existe uma série com este código nesta instituição.' }); if (error?.code === '23503') return void res.status(422).json({ code: 'FINANCE_RECEIPT_SERIES_PREREQUISITE', error: 'A configuração fiscal indicada não pertence à instituição.' }); res.status(422).json({ code: 'FINANCE_RECEIPT_SERIES_VALIDATION', error: 'Série documental inválida.' }); }
  });
}
