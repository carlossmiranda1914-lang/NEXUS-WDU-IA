import assert from 'node:assert/strict';
import test from 'node:test';
import { FinancialDocumentEligibilityService } from '../src/modules/finance/financial-document-eligibility.ts';
import { createSyntheticUatFiscalAdapterRegistry } from '../src/modules/finance/fiscal-adapter-registry.ts';

test('F7-02 receipt eligibility fails closed when authoritative payment is absent', async () => {
  const service = new FinancialDocumentEligibilityService({ query: async () => ({ rows: [] }) } as never, createSyntheticUatFiscalAdapterRegistry());
  await assert.rejects(() => service.requireReceipt('institution-a', 'payment-a'), /FINANCIAL_DOCUMENT_RECEIPT_INELIGIBLE/);
});

test('F7-02 invoice eligibility fails closed when authoritative obligation is absent', async () => {
  const service = new FinancialDocumentEligibilityService({ query: async () => ({ rows: [] }) } as never, createSyntheticUatFiscalAdapterRegistry());
  await assert.rejects(() => service.requireInvoice('institution-a', 'obligation-a'), /FINANCIAL_DOCUMENT_INVOICE_INELIGIBLE/);
});

test('F7-02 invoice-receipt eligibility requires an authoritative settlement relationship', async () => {
  const service = new FinancialDocumentEligibilityService({ query: async () => ({ rows: [] }) } as never, createSyntheticUatFiscalAdapterRegistry());
  await assert.rejects(() => service.requireInvoiceReceipt('institution-a', 'payment-a', 'obligation-a'), /FINANCIAL_DOCUMENT_INVOICE_RECEIPT_INELIGIBLE/);
});
