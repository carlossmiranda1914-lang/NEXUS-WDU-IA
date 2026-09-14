import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workspace = await readFile(new URL('../src/components/finance/payments/FinancePaymentsWorkspace.tsx', import.meta.url), 'utf8');
const list = await readFile(new URL('../src/components/finance/payments/FinancePaymentsListView.tsx', import.meta.url), 'utf8');
const surface = await readFile(new URL('../src/components/finance/documents/InvoiceReceiptDocumentSurface.tsx', import.meta.url), 'utf8');
const client = await readFile(new URL('../src/modules/finance/financial-document-client.ts', import.meta.url), 'utf8');

assert.match(list, /preview-invoice-receipt-\$\{p\.id\}/, 'a confirmed payment exposes the Factura-Recibo preview entry point');
assert.match(list, /issue-invoice-receipt-\$\{p\.id\}/, 'an authoritative-ready confirmed payment exposes the Factura-Recibo issuance entry point');
assert.match(workspace, /allocationClient\.listForPayment\(payment\.id\)/, 'the current canonical allocation relation is used only to select the source relationship');
assert.match(workspace, /financialDocumentClient\.invoiceReceiptPreview\(/, 'the preview facts are requested from the Finance server boundary');
assert.match(workspace, /invoiceReceiptPreview\.readiness\.status/, 'issuance readiness is displayed outside the factual document body from the server projection');
assert.match(workspace, /financialDocumentClient\.issueInvoiceReceipt\(/, 'the workspace delegates issuance through the canonical Finance command');
assert.match(workspace, /listActiveInvoiceReceiptSeries\(/, 'the workspace obtains only active server-projected Factura-Recibo series candidates');
assert.match(workspace, /invoice-receipt-preview-readiness/, 'readiness has an explicit independent presentation region');
assert.match(surface, /Pré-visualização — ainda não emitida/, 'the factual surface is unambiguously non-official');
assert.doesNotMatch(surface, /QR|Número oficial|Emitir/, 'the pre-issue surface never resembles or triggers an issued fiscal document');
assert.match(client, /officialDocumentCreated: false; definitiveNumberAllocated: false; sourceEligibility: 'ELIGIBLE'; readiness:/, 'the client contract requires server-derived readiness and no issuance side effects');

console.log('FINANCE_INVOICE_RECEIPT_PREVIEW_UI_CONTRACT=PASS');
