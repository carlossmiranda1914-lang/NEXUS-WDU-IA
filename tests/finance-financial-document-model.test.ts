import assert from 'node:assert/strict';
import test from 'node:test';
import { createFinancialDocumentDraft, issueFinancialDocument, createCorrectionDocument } from '../src/modules/finance/financial-document-model.ts';

test('issued financial documents are immutable and corrections preserve the original', () => {
  const draft = createFinancialDocumentDraft({ institutionId: 'institution-a', documentType: 'receipt', sourceSnapshot: { amount: '10.00', currency: 'EUR' } });
  const issued = issueFinancialDocument(draft, { seriesId: 'series-a', sequenceNumber: 1, issuedAt: new Date('2026-09-09T00:00:00Z') });
  assert.throws(() => issueFinancialDocument(issued, { seriesId: 'series-a', sequenceNumber: 2, issuedAt: new Date() }));
  const correction = createCorrectionDocument(issued, { institutionId: 'institution-a', documentType: 'credit_note', sourceSnapshot: { amount: '10.00', currency: 'EUR' } });
  assert.equal(correction.correctsDocumentId, issued.id);
  assert.equal(issued.sequenceNumber, 1);
});
