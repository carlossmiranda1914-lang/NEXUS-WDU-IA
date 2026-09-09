import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { registerFinancialDocumentRoutes } from '../src/modules/finance/financial-document-http.ts';

test('F7-04 Financial Document reads are capability-gated and tenant-scoped', async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const pool: any = { query: async (sql: string, values: unknown[]) => { calls.push({ sql, values }); if (values.includes('foreign')) return { rows: [] }; if (sql.includes('finance_financial_document_sources')) return { rows: [{ source_type: 'payment', source_id: 'payment-a', snapshot: { paymentReference: 'PAY-A' } }] }; if (sql.includes('corrects_document_id=$2')) return { rows: [{ id: 'correction-a', document_type: 'credit_note', status: 'issued', sequence_number: '2', issued_at: new Date(), source_snapshot: {}, corrects_document_id: 'doc-a', fiscal_adapter_key: 'core', series_code: 'A' }] }; return { rows: [{ id: 'doc-a', document_type: 'receipt', status: 'issued', sequence_number: '1', issued_at: new Date(), source_snapshot: {}, corrects_document_id: null, fiscal_adapter_key: 'core', series_code: 'A' }] }; } };
  const app = express();
  const auth: any = (req: any, _res: any, next: any) => { if (req.header('Authorization') === 'Bearer financial') req.institutionalContext = { institutionId: 'tenant-a', role: 'financial' }; if (req.header('Authorization') === 'Bearer director') req.institutionalContext = { institutionId: 'tenant-a', role: 'director' }; next(); };
  registerFinancialDocumentRoutes(app, pool, auth);
  const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    assert.equal((await fetch(`${base}/api/finance/documents`)).status, 401);
    const list = await fetch(`${base}/api/finance/documents?limit=10`, { headers: { Authorization: 'Bearer financial' } });
    assert.equal(list.status, 200); const listPayload = await list.json(); assert.equal(listPayload.items[0].id, 'doc-a'); assert.deepEqual(listPayload.page, { nextCursor: null }, 'Financial Document reads follow the canonical page envelope');
    const detail = await fetch(`${base}/api/finance/documents/foreign`, { headers: { Authorization: 'Bearer financial' } });
    assert.equal(detail.status, 404);
    const ownedDetail = await fetch(`${base}/api/finance/documents/doc-a`, { headers: { Authorization: 'Bearer financial' } }); const ownedPayload = await ownedDetail.json(); assert.equal(ownedDetail.status, 200); assert.deepEqual(ownedPayload.sources, [{ type: 'payment', id: 'payment-a', snapshot: { paymentReference: 'PAY-A' } }]); assert.equal(ownedPayload.corrections[0].id, 'correction-a');
    const deniedIssue = await fetch(`${base}/api/finance/documents/issue`, { method: 'POST', headers: { Authorization: 'Bearer director', 'Idempotency-Key': 'denied' } });
    assert.equal(deniedIssue.status, 403);
    const deniedConfig = await fetch(`${base}/api/finance/fiscal-configurations`, { method: 'POST', headers: { Authorization: 'Bearer financial', 'Idempotency-Key': 'denied' } });
    const deniedSeries = await fetch(`${base}/api/finance/document-series`, { method: 'POST', headers: { Authorization: 'Bearer financial', 'Idempotency-Key': 'denied' } });
    assert.equal(deniedConfig.status, 403); assert.equal(deniedSeries.status, 403);
    assert.ok(calls.every(call => call.values.includes('tenant-a')), 'every lookup must bind the server-derived institution');
  } finally { server.close(); }
});
