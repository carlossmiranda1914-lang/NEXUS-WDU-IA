import type { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { renderFinancialDocumentPdf } from './financial-document-artifact-renderer.ts';
import { buildFinancialDocumentPresentation } from './financial-document-presentation.ts';
import type { DocumentarySnapshot } from './documentary-snapshot.ts';

export interface FinancialDocumentArtifactStorage {
  put(storageReference: string, bytes: Buffer): Promise<void>;
  get(storageReference: string): Promise<Buffer | undefined>;
}

/** Deterministic test adapter; production authority remains provider-neutral. */
export class InMemoryFinancialDocumentArtifactStorage implements FinancialDocumentArtifactStorage {
  private readonly objects = new Map<string, Buffer>();
  async put(storageReference: string, bytes: Buffer): Promise<void> { this.objects.set(storageReference, Buffer.from(bytes)); }
  async get(storageReference: string): Promise<Buffer | undefined> { const bytes = this.objects.get(storageReference); return bytes && Buffer.from(bytes); }
}

/** Durable local implementation of the neutral storage contract for the current Finance slice. */
export class PostgresFinancialDocumentArtifactStorage implements FinancialDocumentArtifactStorage {
  constructor(private readonly pool: Pool) {}
  async put(storageReference: string, bytes: Buffer): Promise<void> {
    await this.pool.query('INSERT INTO finance_financial_document_artifact_blobs(storage_reference,content) VALUES($1,$2)', [storageReference, bytes]);
  }
  async get(storageReference: string): Promise<Buffer | undefined> {
    const result = await this.pool.query<{ content: Buffer }>('SELECT content FROM finance_financial_document_artifact_blobs WHERE storage_reference=$1', [storageReference]);
    return result.rows[0]?.content && Buffer.from(result.rows[0].content);
  }
}

export type FinancialDocumentArtifact = {
  id: string;
  documentId: string;
  renderVersion: string;
  templateVersion: string;
  generatedAt: Date;
  contentHash: string;
  mediaType: string;
  byteSize: number;
  storageReference: string;
};

/** F7-05 boundary: representation evidence is versioned and never replaces the Financial Document fact. */
export class FinancialDocumentArtifactService {
  constructor(private readonly pool: Pool, private readonly storage: FinancialDocumentArtifactStorage = new PostgresFinancialDocumentArtifactStorage(pool)) { void this.pool; void this.storage; }

  async generate(input: { institutionId: string; documentId: string; renderVersion: string; templateVersion: string }): Promise<FinancialDocumentArtifact> {
    const document = await this.pool.query<any>('SELECT d.id,d.document_type,d.sequence_number,d.issued_at,d.documentary_snapshot,s.code series_code FROM finance_financial_documents d JOIN finance_financial_document_series s ON s.institution_id=d.institution_id AND s.id=d.series_id WHERE d.institution_id=$1 AND d.id=$2 AND d.status=\'issued\'', [input.institutionId, input.documentId]);
    const row = document.rows[0]; if (!row) throw new Error('FINANCIAL_DOCUMENT_ARTIFACT_DOCUMENT_NOT_FOUND');
    if (!row.documentary_snapshot) throw new Error('FINANCIAL_DOCUMENT_DOCUMENTARY_SNAPSHOT_REQUIRED');
    const existing = await this.pool.query<any>('SELECT id,document_id,render_version,template_version,generated_at,content_hash,media_type,byte_size,storage_reference FROM finance_financial_document_artifacts WHERE institution_id=$1 AND document_id=$2 AND render_version=$3 AND template_version=$4', [input.institutionId, input.documentId, input.renderVersion, input.templateVersion]);
    if (existing.rows[0]) return this.map(existing.rows[0]);
    const presentation = buildFinancialDocumentPresentation({ document: { documentType: row.document_type, seriesCode: row.series_code, sequenceNumber: Number(row.sequence_number), issuedAt: row.issued_at, status: 'issued' }, snapshot: row.documentary_snapshot as DocumentarySnapshot });
    const bytes = renderFinancialDocumentPdf({ presentation });
    const contentHash = createHash('sha256').update(bytes).digest('hex');
    const storageReference = `financial-document-artifacts/${input.institutionId}/${input.documentId}/${input.renderVersion}/${input.templateVersion}/${contentHash}.pdf`;
    try { await this.storage.put(storageReference, bytes); } catch (error) {
      const failure = error instanceof Error ? error.message : 'ARTIFACT_STORAGE_FAILURE';
      await Promise.all([
        this.pool.query("INSERT INTO finance_audit_records(institution_id,event_type,metadata) VALUES($1,'financial_document_artifact_generation_failed',$2)", [input.institutionId, { documentId: input.documentId, renderVersion: input.renderVersion, templateVersion: input.templateVersion, failure }]),
        this.pool.query("INSERT INTO finance_outbox(institution_id,topic,aggregate_id,payload) VALUES($1,'financial_document_artifact_generation_failed',$2,$3)", [input.institutionId, input.documentId, { documentId: input.documentId, renderVersion: input.renderVersion, templateVersion: input.templateVersion, failure }]),
      ]);
      throw error;
    }
    const inserted = await this.pool.query<any>('INSERT INTO finance_financial_document_artifacts(institution_id,document_id,render_version,template_version,content_hash,media_type,byte_size,storage_reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,document_id,render_version,template_version,generated_at,content_hash,media_type,byte_size,storage_reference', [input.institutionId, input.documentId, input.renderVersion, input.templateVersion, contentHash, 'application/pdf', bytes.byteLength, storageReference]);
    const artifact = this.map(inserted.rows[0]!);
    await Promise.all([
      this.pool.query("INSERT INTO finance_audit_records(institution_id,event_type,metadata) VALUES($1,'financial_document_artifact_generated',$2)", [input.institutionId, { artifactId: artifact.id, documentId: input.documentId, renderVersion: input.renderVersion, templateVersion: input.templateVersion }]),
      this.pool.query("INSERT INTO finance_outbox(institution_id,topic,aggregate_id,payload) VALUES($1,'financial_document_artifact_generated',$2,$3)", [input.institutionId, artifact.id, { artifactId: artifact.id, documentId: input.documentId, renderVersion: input.renderVersion, templateVersion: input.templateVersion }]),
    ]);
    return artifact;
  }

  async retrieve(input: { institutionId: string; artifactId: string }): Promise<Buffer> {
    const artifact = await this.pool.query<any>('SELECT id,document_id,render_version,template_version,generated_at,content_hash,media_type,byte_size,storage_reference FROM finance_financial_document_artifacts WHERE institution_id=$1 AND id=$2', [input.institutionId, input.artifactId]);
    const row = artifact.rows[0]; if (!row) throw new Error('FINANCIAL_DOCUMENT_ARTIFACT_NOT_FOUND');
    const bytes = await this.storage.get(row.storage_reference); if (!bytes) throw new Error('FINANCIAL_DOCUMENT_ARTIFACT_MISSING');
    if (bytes.byteLength !== Number(row.byte_size) || createHash('sha256').update(bytes).digest('hex') !== row.content_hash) throw new Error('FINANCIAL_DOCUMENT_ARTIFACT_INTEGRITY_MISMATCH');
    return bytes;
  }

  private map(row: any): FinancialDocumentArtifact { return { id: row.id, documentId: row.document_id, renderVersion: row.render_version, templateVersion: row.template_version, generatedAt: row.generated_at, contentHash: row.content_hash, mediaType: row.media_type, byteSize: Number(row.byte_size), storageReference: row.storage_reference }; }
}
