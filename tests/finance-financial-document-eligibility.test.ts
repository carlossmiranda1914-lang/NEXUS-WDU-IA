import assert from 'node:assert/strict';
import test from 'node:test';
import { FinancialDocumentEligibilityService } from '../src/modules/finance/financial-document-eligibility.ts';

test('F7-02 receipt eligibility fails closed when authoritative payment is absent', async () => {
  const service = new FinancialDocumentEligibilityService({ query: async () => ({ rows: [] }) } as never);
  await assert.rejects(() => service.requireReceipt('institution-a', 'payment-a'), /FINANCIAL_DOCUMENT_RECEIPT_INELIGIBLE/);
});
