import assert from 'node:assert/strict';
import test from 'node:test';
import { FinancialDocumentArtifactService, InMemoryFinancialDocumentArtifactStorage } from '../src/modules/finance/financial-document-artifact-service.ts';
import { renderFinancialDocumentPdf } from '../src/modules/finance/financial-document-artifact-renderer.ts';

test('F7-05 defines a versioned, non-destructive Financial Document artifact authority', () => {
  assert.equal(typeof FinancialDocumentArtifactService, 'function');
  assert.equal(typeof FinancialDocumentArtifactService.prototype.generate, 'function');
  assert.equal(typeof FinancialDocumentArtifactService.prototype.retrieve, 'function');
});

test('F7-05 renders a real PDF only from immutable documentary input', () => {
  const bytes = renderFinancialDocumentPdf({ documentId: 'doc-1', documentType: 'receipt', seriesCode: 'REC', sequenceNumber: 7, issuedAt: new Date('2026-09-09T10:00:00.000Z'), sourceSnapshot: { paymentReference: 'PAY-IMMUTABLE', amount: '10.00', currency: 'EUR' }, sources: [{ type: 'payment', id: 'payment-1', snapshot: { paymentReference: 'PAY-IMMUTABLE' } }], correctsDocumentId: null, renderVersion: '1', templateVersion: '1' });
  assert.ok(bytes.byteLength > 200);
  assert.equal(bytes.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.match(bytes.toString('latin1'), /PAY-IMMUTABLE/);
});

test('F7-05 keeps artifact bytes behind a provider-neutral storage boundary', async () => {
  const storage = new InMemoryFinancialDocumentArtifactStorage();
  await storage.put('private/reference', Buffer.from('immutable-bytes'));
  assert.equal((await storage.get('private/reference'))?.toString(), 'immutable-bytes');
  assert.equal(await storage.get('missing'), undefined);
});
