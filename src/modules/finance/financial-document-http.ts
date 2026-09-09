import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { canAccessFinancialDocuments } from './financial-document-policy.ts';

type DocumentRow = { id: string; document_type: string; status: string; sequence_number: string; issued_at: Date; source_snapshot: Record<string, unknown>; corrects_document_id: string | null; fiscal_adapter_key: string | null; series_code: string };
const view = (row: DocumentRow) => ({ id: row.id, type: row.document_type, status: row.status, seriesCode: row.series_code, sequenceNumber: Number(row.sequence_number), issuedAt: row.issued_at.toISOString(), sourceSnapshot: row.source_snapshot, correctsDocumentId: row.corrects_document_id, fiscalAdapterKey: row.fiscal_adapter_key });

export function registerFinancialDocumentRoutes(app: Express, pool: Pick<Pool, 'query'>, auth = requireAuth): void {
  const actor = (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) { res.status(401).json({ code: 'UNAUTHORIZED', error: 'Contexto institucional não encontrado.' }); return undefined; }
    if (!canAccessFinancialDocuments(context.role, 'read')) { res.status(403).json({ code: 'FINANCIAL_DOCUMENT_FORBIDDEN', error: 'Acesso não autorizado a documentos financeiros.' }); return undefined; }
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
}
