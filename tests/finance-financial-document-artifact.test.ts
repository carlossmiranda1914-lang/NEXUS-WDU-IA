import assert from 'node:assert/strict';
import test from 'node:test';
import { FinancialDocumentArtifactService, InMemoryFinancialDocumentArtifactStorage, PostgresFinancialDocumentArtifactStorage } from '../src/modules/finance/financial-document-artifact-service.ts';
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

test('F7-05 exposes a durable PostgreSQL storage adapter without provider-specific Finance authority', () => {
  assert.equal(typeof PostgresFinancialDocumentArtifactStorage, 'function');
});

test('F7-05 persists a hash-verified PDF artifact from an issued immutable document', async () => {
  const storage = new InMemoryFinancialDocumentArtifactStorage(); const artifactId = 'artifact-1'; let inserted: any;
  const pool: any = { query: async (sql: string, values: unknown[]) => {
    if (sql.includes('FROM finance_financial_documents d')) return { rows: [{ id: 'document-1', document_type: 'receipt', sequence_number: '7', issued_at: new Date('2026-09-09T10:00:00.000Z'), source_snapshot: { paymentReference: 'PAY-IMMUTABLE', amount: '10.00', currency: 'EUR' }, corrects_document_id: null, series_code: 'REC' }] };
    if (sql.includes('FROM finance_financial_document_sources')) return { rows: [{ source_type: 'payment', source_id: 'payment-1', snapshot: { paymentReference: 'PAY-IMMUTABLE' } }] };
    if (sql.includes('FROM finance_financial_document_artifacts')) return { rows: inserted ? [inserted] : [] };
    if (sql.includes('INSERT INTO finance_financial_document_artifacts')) { inserted = { id: artifactId, document_id: 'document-1', render_version: values[2], template_version: values[3], generated_at: new Date(), content_hash: values[4], media_type: values[5], byte_size: values[6], storage_reference: values[7] }; return { rows: [inserted] }; }
    throw new Error(`Unexpected SQL: ${sql}`);
  } };
  const service = new FinancialDocumentArtifactService(pool, storage);
  const artifact = await service.generate({ institutionId: 'tenant-1', documentId: 'document-1', renderVersion: 'renderer-1', templateVersion: 'template-1' });
  assert.equal(artifact.id, artifactId); assert.equal(artifact.mediaType, 'application/pdf'); assert.ok(artifact.contentHash.length === 64); assert.equal((await service.retrieve({ institutionId: 'tenant-1', artifactId })).subarray(0, 5).toString(), '%PDF-');
});

test('F7-05 fails closed for missing or integrity-mismatched stored bytes', async () => {
  const row = { id: 'artifact-1', document_id: 'document-1', render_version: 'renderer-1', template_version: 'template-1', generated_at: new Date(), content_hash: '0'.repeat(64), media_type: 'application/pdf', byte_size: 5, storage_reference: 'private/reference' };
  const pool: any = { query: async () => ({ rows: [row] }) };
  const missing = new FinancialDocumentArtifactService(pool, { put: async () => undefined, get: async () => undefined });
  await assert.rejects(() => missing.retrieve({ institutionId: 'tenant-1', artifactId: row.id }), /ARTIFACT_MISSING/);
  const tampered = new FinancialDocumentArtifactService(pool, { put: async () => undefined, get: async () => Buffer.from('wrong') });
  await assert.rejects(() => tampered.retrieve({ institutionId: 'tenant-1', artifactId: row.id }), /INTEGRITY_MISMATCH/);
});
