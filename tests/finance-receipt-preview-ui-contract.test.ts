import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/finance/payments/FinancePaymentsWorkspace.tsx', import.meta.url), 'utf8');

for (const visibleFact of ['Emitente:', 'Pagador:', 'Destinatário:', 'Liquidação:', 'Fonte elegível:', 'Número oficial: ainda não atribuído', 'Código QR oficial: ainda não disponível']) {
  assert.match(source, new RegExp(visibleFact), `the non-official preview must expose server-derived ${visibleFact}`);
}
assert.match(source, /receiptPreviewBlockMessage/, 'blocking reasons must be translated into product language');
assert.match(source, /documentReadiness\('receipt'\)/, 'institutional receipt blocks must be read from the per-document server readiness projection');
assert.match(source, /AGT_ONBOARDING_REQUIRED/, 'AGT onboarding must receive an actionable human explanation');
assert.doesNotMatch(source, /\{previewReadiness\?\.blockingReason\}/, 'raw readiness codes must never be shown to an operator');
console.log('FINANCE_RECEIPT_PREVIEW_PRODUCT_PROJECTION=PASS');
