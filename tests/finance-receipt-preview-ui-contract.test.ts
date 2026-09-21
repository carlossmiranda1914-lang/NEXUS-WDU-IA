import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/finance/payments/FinancePaymentsWorkspace.tsx', import.meta.url), 'utf8');
const surface = await readFile(new URL('../src/components/finance/documents/ReceiptDocumentSurface.tsx', import.meta.url), 'utf8');

for (const visibleFact of ['Emitente', 'Pagador', 'Destinatário', 'Pagamento recebido', 'Liquidação e documentos relacionados', 'Valor aplicado', 'Valor não aplicado', 'ainda não atribuído']) {
  assert.match(surface, new RegExp(visibleFact), `the structured non-official preview must expose ${visibleFact}`);
}
assert.match(source, /ReceiptDocumentSurface/, 'the payment preview must use the canonical receipt structure');
assert.match(source, /receipt-preview-readiness/, 'issuance readiness must remain separate from payment facts');
assert.match(source, /receiptPreviewBlockMessage/, 'blocking reasons must be translated at the presentation boundary');
assert.match(source, /documentReadiness\('receipt'\)/, 'institutional receipt blocks must be read from the per-document server readiness projection');
assert.match(source, /AGT_ONBOARDING_REQUIRED/, 'AGT onboarding must receive an actionable human explanation');
assert.doesNotMatch(`${source}\n${surface}`, /adapterKey|snapshotVersion|storageReference/, 'internal authority must never be shown to an operator');
console.log('FINANCE_RECEIPT_PREVIEW_PRODUCT_PROJECTION=PASS');
