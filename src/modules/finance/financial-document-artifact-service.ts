import type { Pool } from 'pg';

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
  constructor(private readonly pool: Pool, private readonly storage: FinancialDocumentArtifactStorage = new InMemoryFinancialDocumentArtifactStorage()) { void this.pool; void this.storage; }

  async generate(): Promise<FinancialDocumentArtifact> { throw new Error('FINANCIAL_DOCUMENT_ARTIFACT_GENERATION_NOT_IMPLEMENTED'); }
  async retrieve(): Promise<Buffer> { throw new Error('FINANCIAL_DOCUMENT_ARTIFACT_RETRIEVAL_NOT_IMPLEMENTED'); }
}
