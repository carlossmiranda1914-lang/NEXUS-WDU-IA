import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { registerFinancialDocumentRoutes } from '../src/modules/finance/financial-document-http.ts';

test('F7-04 Financial Document reads are capability-gated and tenant-scoped', async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const pool: any = { query: async (sql: string, values: unknown[]) => { calls.push({ sql, values }); return { rows: values.includes('foreign') ? [] : [{ id: 'doc-a', document_type: 'receipt', status: 'issued', sequence_number: '1', issued_at: new Date(), source_snapshot: {}, corrects_document_id: null, fiscal_adapter_key: 'core', series_code: 'A' }] }; } };
  const app = express();
  const auth: any = (req: any, _res: any, next: any) => { if (req.header('Authorization') === 'Bearer financial') req.institutionalContext = { institutionId: 'tenant-a', role: 'financial' }; if (req.header('Authorization') === 'Bearer director') req.institutionalContext = { institutionId: 'tenant-a', role: 'director' }; next(); };
  registerFinancialDocumentRoutes(app, pool, auth);
  const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    assert.equal((await fetch(`${base}/api/finance/documents`)).status, 401);
    const list = await fetch(`${base}/api/finance/documents?limit=10`, { headers: { Authorization: 'Bearer financial' } });
    assert.equal(list.status, 200); assert.equal((await list.json()).items[0].id, 'doc-a');
    const detail = await fetch(`${base}/api/finance/documents/foreign`, { headers: { Authorization: 'Bearer financial' } });
    assert.equal(detail.status, 404);
    const deniedIssue = await fetch(`${base}/api/finance/documents/issue`, { method: 'POST', headers: { Authorization: 'Bearer director', 'Idempotency-Key': 'denied' } });
    assert.equal(deniedIssue.status, 403);
    assert.ok(calls.every(call => call.values.includes('tenant-a')), 'every lookup must bind the server-derived institution');
  } finally { server.close(); }
});
