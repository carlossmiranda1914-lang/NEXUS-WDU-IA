import type { Pool } from 'pg';

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
  constructor(private readonly pool: Pool) { void this.pool; }

  async generate(): Promise<FinancialDocumentArtifact> { throw new Error('FINANCIAL_DOCUMENT_ARTIFACT_GENERATION_NOT_IMPLEMENTED'); }
  async retrieve(): Promise<Buffer> { throw new Error('FINANCIAL_DOCUMENT_ARTIFACT_RETRIEVAL_NOT_IMPLEMENTED'); }
}
