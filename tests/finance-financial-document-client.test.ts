import test from 'node:test';
import assert from 'node:assert/strict';
import { FinancialDocumentClient } from '../src/modules/finance/financial-document-client.ts';

const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
const unavailable = () => ({ ok: false, status: 422, json: async () => ({ code: 'FINANCIAL_DOCUMENT_VALIDATION' }) }) as Response;
const authenticationRequired = () => ({ ok: false, status: 401, json: async () => ({ error: 'Unauthorized: Missing token' }) }) as Response;

test('F7-06 delegates receipt issuance and credit-note correction through idempotent authoritative HTTP commands', async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const client = new FinancialDocumentClient(async (path, init) => { calls.push({ path: String(path), init }); return response({ id: 'doc-1', sequenceNumber: 7, replayed: false }); }, async () => 'token');
  await client.issueReceipt({ sourceId: 'pay-1', seriesId: 'series-1', idempotencyKey: 'receipt-stable-key' });
  await client.issueCreditNote({ originalDocumentId: 'doc-1', seriesId: 'credit-series', amount: '10.00', currency: 'EUR', idempotencyKey: 'correction-stable-key' });
  assert.equal(calls[0]?.path, '/api/finance/documents/issue'); assert.equal((calls[0]?.init?.headers as Record<string, string>)['Idempotency-Key'], 'receipt-stable-key'); assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), { sourceId: 'pay-1', seriesId: 'series-1', documentType: 'receipt' });
  assert.equal(calls[1]?.path, '/api/finance/documents/doc-1/credit-note'); assert.equal((calls[1]?.init?.headers as Record<string, string>)['Idempotency-Key'], 'correction-stable-key'); assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), { seriesId: 'credit-series', amount: '10.00', currency: 'EUR' });
});

test('P01 asks the server for credit-note readiness before the browser exposes an issuance form', async () => {
  const calls: string[] = [];
  const client = new FinancialDocumentClient(async path => { calls.push(String(path)); return response({ status: 'ELIGIBLE', seriesId: 'credit-series', currency: 'EUR', maximumAmount: '100' }); }, async () => 'token');
  assert.deepEqual(await client.creditNoteReadiness('original-1'), { status: 'ELIGIBLE', seriesId: 'credit-series', currency: 'EUR', maximumAmount: '100' });
  assert.deepEqual(calls, ['/api/finance/documents/original-1/credit-note-readiness']);
});

test('F7-06 only presents active receipt and credit-note series returned by the server', async () => {
  const client = new FinancialDocumentClient(async () => response({ items: [{ id: 'receipt', document_type: 'receipt', status: 'active' }, { id: 'inactive', document_type: 'receipt', status: 'inactive' }, { id: 'credit', document_type: 'credit_note', status: 'active' }] }), async () => null);
  assert.deepEqual((await client.listActiveReceiptSeries()).map(item => item.id), ['receipt']);
  assert.deepEqual((await client.listActiveCorrectionSeries()).map(item => item.id), ['credit']);
});

test('receipt preview reads per-document readiness exclusively from the server', async () => {
  const calls: string[] = [];
  const client = new FinancialDocumentClient(async (path) => { calls.push(String(path)); return response({ documentType: 'receipt', status: 'BLOCKED', reasonCode: 'AGT_ONBOARDING_REQUIRED', prerequisites: {} }); }, async () => 'token');
  const readiness = await client.documentReadiness('receipt');
  assert.equal(readiness.reasonCode, 'AGT_ONBOARDING_REQUIRED');
  assert.deepEqual(calls, ['/api/finance/readiness/documents/receipt']);
});

test('F7-06 turns unavailable issuance into an actionable configuration result', async () => {
  const client = new FinancialDocumentClient(async () => unavailable(), async () => null);
  await assert.rejects(() => client.issueReceipt({ sourceId: 'pay-1', seriesId: 'series-1', idempotencyKey: 'receipt-stable-key' }), /configuração fiscal e a série efetiva/);
});

test('F7-06 preserves a safe server eligibility code instead of collapsing an official issuance rejection', async () => {
  const client = new FinancialDocumentClient(async () => ({
    ok: false,
    status: 422,
    json: async () => ({ code: 'FISCAL_ADAPTER_UNSUPPORTED_JURISDICTION' }),
  }) as Response, async () => null);

  await assert.rejects(
    () => client.issueReceipt({ sourceId: 'pay-1', seriesId: 'series-1', idempotencyKey: 'receipt-stable-key' }),
    (error: unknown) => error instanceof Error
      && (error as Error & { code?: string }).code === 'FISCAL_ADAPTER_UNSUPPORTED_JURISDICTION'
      && /adaptador jurisdicional aprovado/.test(error.message),
  );
});

test('F7-06 preserves an authentication-required list failure for safe UAT diagnosis', async () => {
  const client = new FinancialDocumentClient(async () => authenticationRequired(), async () => null);
  await assert.rejects(() => client.list(), /FINANCIAL_DOCUMENT_AUTH_REQUIRED/);
});

test('F7-06 default browser fetch preserves the global receiver', async () => {
  const originalFetch = globalThis.fetch;
  const receiverSensitiveFetch = async function (this: unknown) {
    if (this !== globalThis) throw new TypeError('Illegal invocation');
    return response({ items: [] });
  } as typeof fetch;
  globalThis.fetch = receiverSensitiveFetch;
  try {
    const client = new FinancialDocumentClient(undefined, async () => null);
    assert.deepEqual(await client.list(), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('invoice preview and issuance send only source identity, series and idempotency intent', async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const client = new FinancialDocumentClient(async (path, init) => { calls.push({ path: String(path), init }); return response({ documentType: 'invoice', id: 'invoice-1', sequenceNumber: 1, replayed: false }); }, async () => 'token');
  await client.invoicePreview('obligation-1');
  await client.issueInvoice({ obligationId: 'obligation-1', seriesId: 'invoice-series-1', idempotencyKey: 'invoice-key' });
  assert.equal(calls[0]?.path, '/api/finance/obligations/obligation-1/invoice-preview');
  assert.equal(calls[1]?.path, '/api/finance/documents/invoice');
  assert.equal((calls[1]?.init?.headers as Record<string, string>)['Idempotency-Key'], 'invoice-key');
  assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), { obligationId: 'obligation-1', seriesId: 'invoice-series-1' });
});

test('Factura-Recibo issuance sends the authoritative payment and obligation relationship only', async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const client = new FinancialDocumentClient(async (path, init) => { calls.push({ path: String(path), init }); return response({ id: 'invoice-receipt-1', sequenceNumber: 1, replayed: false }); }, async () => 'token');
  await client.issueInvoiceReceipt({ paymentId: 'payment-1', obligationId: 'obligation-1', seriesId: 'series-1', idempotencyKey: 'invoice-receipt-key' });
  assert.equal(calls[0]?.path, '/api/finance/documents/invoice-receipt');
  assert.equal((calls[0]?.init?.headers as Record<string, string>)['Idempotency-Key'], 'invoice-receipt-key');
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), { paymentId: 'payment-1', obligationId: 'obligation-1', seriesId: 'series-1' });
});

test('Factura-Recibo preview sends only the payment and obligation identifiers', async () => {
  const calls: string[] = [];
  const client = new FinancialDocumentClient(async path => { calls.push(String(path)); return response({ mode: 'preview', documentType: 'invoice_receipt' }); }, async () => 'token');
  await client.invoiceReceiptPreview({ paymentId: 'payment-1', obligationId: 'obligation-1' });
  assert.deepEqual(calls, ['/api/finance/payments/payment-1/obligations/obligation-1/invoice-receipt-preview']);
});
