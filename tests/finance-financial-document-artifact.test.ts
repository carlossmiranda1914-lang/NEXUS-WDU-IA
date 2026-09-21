import assert from 'node:assert/strict';
import test from 'node:test';
import { FinancialDocumentArtifactService, InMemoryFinancialDocumentArtifactStorage, PostgresFinancialDocumentArtifactStorage } from '../src/modules/finance/financial-document-artifact-service.ts';
import { renderFinancialDocumentPdf } from '../src/modules/finance/financial-document-artifact-renderer.ts';
import { buildFinancialDocumentPresentation } from '../src/modules/finance/financial-document-presentation.ts';
import { createDocumentarySnapshot } from '../src/modules/finance/documentary-snapshot.ts';

const snapshot = () => createDocumentarySnapshot({ issuer: { legalName: 'Escola Nexus', taxIdentifier: null, address: { countryCode: 'PT', line1: 'Rua 1' } }, recipient: { name: 'Maria', authorityId: 'person-1' }, operation: { reference: 'PAY-IMMUTABLE' }, payment: { reference: 'PAY-IMMUTABLE', amount: '10.00', currency: 'EUR' }, totals: { documentTotal: '10.00', currency: 'EUR' }, jurisdiction: { code: 'core', policyVersion: 'core-1' } });
const presentation = () => buildFinancialDocumentPresentation({ document: { documentType: 'receipt', seriesCode: 'REC', sequenceNumber: 7, issuedAt: new Date('2026-09-09T10:00:00.000Z'), status: 'issued' }, snapshot: snapshot() });

test('F7-05 defines a versioned, non-destructive Financial Document artifact authority', () => {
  assert.equal(typeof FinancialDocumentArtifactService, 'function');
  assert.equal(typeof FinancialDocumentArtifactService.prototype.generate, 'function');
  assert.equal(typeof FinancialDocumentArtifactService.prototype.retrieve, 'function');
});

test('F7-05 renders a real PDF only from immutable documentary input', () => {
  const bytes = renderFinancialDocumentPdf({ presentation: presentation() });
  assert.ok(bytes.byteLength > 200);
  assert.equal(bytes.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.match(bytes.toString('latin1'), /PAY-IMMUTABLE/);
  assert.match(bytes.toString('latin1'), /Escola Nexus/);
  assert.match(bytes.toString('latin1'), /10,00 EUR/, 'artifact presentation formats the immutable exact amount for people without changing the snapshot');
  assert.doesNotMatch(bytes.toString('latin1'), /Document id:|Provenance:|Policy provenance:|Renderer:|template:|person-1/i);
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
    if (sql.includes('FROM finance_financial_documents d')) return { rows: [{ id: 'document-1', document_type: 'receipt', sequence_number: '7', issued_at: new Date('2026-09-09T10:00:00.000Z'), documentary_snapshot: snapshot(), series_code: 'REC' }] };
    if (sql.includes('FROM finance_financial_document_artifacts')) return { rows: inserted ? [inserted] : [] };
    if (sql.includes('INSERT INTO finance_financial_document_artifacts')) { inserted = { id: artifactId, document_id: 'document-1', render_version: values[2], template_version: values[3], generated_at: new Date(), content_hash: values[4], media_type: values[5], byte_size: values[6], storage_reference: values[7] }; return { rows: [inserted] }; }
    if (sql.includes('finance_audit_records') || sql.includes('finance_outbox')) return { rows: [] };
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

test('Task 7/8 preserves renderer-1 and adds renderer-2 for FR1, CN1 and CN2', async () => {
  const storage = new InMemoryFinancialDocumentArtifactStorage();
  const documents = new Map(['FR1', 'CN1', 'CN2'].map((id, index) => [id, { id, document_type: index ? 'credit_note' : 'receipt', sequence_number: String(index + 1), issued_at: new Date('2026-09-09T10:00:00.000Z'), documentary_snapshot: snapshot(), series_code: index ? 'NC' : 'FR' }]));
  const artifacts = new Map<string, any>(); let nextId = 1;
  const pool: any = { query: async (sql: string, values: any[]) => {
    if (sql.includes('FROM finance_financial_documents d')) return { rows: [documents.get(values[1])] };
    if (sql.includes('FROM finance_financial_document_artifacts') && sql.includes('document_id=$2')) return { rows: [...artifacts.values()].filter(row => row.document_id === values[1] && row.render_version === values[2] && row.template_version === values[3]) };
    if (sql.includes('FROM finance_financial_document_artifacts') && sql.includes('id=$2')) return { rows: [[...artifacts.values()].find(row => row.id === values[1])].filter(Boolean) };
    if (sql.includes('INSERT INTO finance_financial_document_artifacts')) { const row = { id: `artifact-${nextId++}`, document_id: values[1], render_version: values[2], template_version: values[3], generated_at: new Date(), content_hash: values[4], media_type: values[5], byte_size: values[6], storage_reference: values[7] }; artifacts.set(row.id, row); return { rows: [row] }; }
    if (sql.includes('finance_audit_records') || sql.includes('finance_outbox')) return { rows: [] };
    throw new Error(`Unexpected SQL: ${sql}`);
  } };
  const before = JSON.stringify([...documents.values()].map(document => document.documentary_snapshot));
  const service = new FinancialDocumentArtifactService(pool, storage);
  const fr1v2 = await service.generate({ institutionId: 'tenant-1', documentId: 'FR1', renderVersion: 'renderer-2', templateVersion: 'template-1' });
  for (const id of ['CN1', 'CN2']) {
    const v1 = await service.generate({ institutionId: 'tenant-1', documentId: id, renderVersion: 'renderer-1', templateVersion: 'template-1' });
    const v2 = await service.generate({ institutionId: 'tenant-1', documentId: id, renderVersion: 'renderer-2', templateVersion: 'template-1' });
    assert.notEqual(v1.id, v2.id); assert.equal(v1.renderVersion, 'renderer-1'); assert.equal(v2.renderVersion, 'renderer-2');
    assert.equal((await service.retrieve({ institutionId: 'tenant-1', artifactId: v1.id })).subarray(0, 5).toString(), '%PDF-');
    assert.equal((await service.retrieve({ institutionId: 'tenant-1', artifactId: v2.id })).subarray(0, 5).toString(), '%PDF-');
  }
  assert.equal((await service.retrieve({ institutionId: 'tenant-1', artifactId: fr1v2.id })).subarray(0, 5).toString(), '%PDF-');
  assert.equal(JSON.stringify([...documents.values()].map(document => document.documentary_snapshot)), before, 'artifact generation must not mutate documentary snapshots');
});
