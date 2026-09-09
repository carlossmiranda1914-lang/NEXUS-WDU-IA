import test from 'node:test';
import assert from 'node:assert/strict';
import { FinancialDocumentClient } from '../src/modules/finance/financial-document-client.ts';

const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

test('F7-07 delegates receipt issuance and correction through idempotent authoritative HTTP commands', async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const client = new FinancialDocumentClient(async (path, init) => { calls.push({ path: String(path), init }); return response({ id: 'doc-1', sequenceNumber: 7, replayed: false }); }, async () => 'token');
  await client.issueReceipt({ sourceId: 'pay-1', seriesId: 'series-1', idempotencyKey: 'receipt-stable-key' });
  await client.issueCorrection({ originalDocumentId: 'doc-1', seriesId: 'credit-series', idempotencyKey: 'correction-stable-key' });
  assert.equal(calls[0]?.path, '/api/finance/documents/issue'); assert.equal((calls[0]?.init?.headers as Record<string, string>)['Idempotency-Key'], 'receipt-stable-key'); assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), { sourceId: 'pay-1', seriesId: 'series-1', documentType: 'receipt' });
  assert.equal(calls[1]?.path, '/api/finance/documents/doc-1/corrections'); assert.equal((calls[1]?.init?.headers as Record<string, string>)['Idempotency-Key'], 'correction-stable-key'); assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), { seriesId: 'credit-series', documentType: 'credit_note' });
});

test('F7-07 only presents active receipt and credit-note series returned by the server', async () => {
  const client = new FinancialDocumentClient(async () => response({ items: [{ id: 'receipt', document_type: 'receipt', status: 'active' }, { id: 'inactive', document_type: 'receipt', status: 'inactive' }, { id: 'credit', document_type: 'credit_note', status: 'active' }] }), async () => null);
  assert.deepEqual((await client.listActiveReceiptSeries()).map(item => item.id), ['receipt']);
  assert.deepEqual((await client.listActiveCorrectionSeries()).map(item => item.id), ['credit']);
});
