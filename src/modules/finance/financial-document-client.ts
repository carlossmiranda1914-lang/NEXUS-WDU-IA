import { auth } from '../../lib/firebase.ts';

export type FinancialDocumentProjection = { id: string; type: string; status: string; seriesCode: string; sequenceNumber: number; issuedAt: string; correctsDocumentId: string | null };
export type FinancialDocumentDetail = FinancialDocumentProjection & { sources: Array<{ type: string; id: string; snapshot: Record<string, unknown> }>; corrections: FinancialDocumentProjection[] };
export type FinancialDocumentArtifactProjection = { id: string; document_id: string; render_version: string; template_version: string; generated_at: string; content_hash: string; media_type: string; byte_size: number };

export class FinancialDocumentClient {
  constructor(private readonly fetcher: typeof fetch = globalThis.fetch, private readonly getToken = async () => auth.currentUser?.getIdToken()) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.getToken().catch(() => null);
    const response = await this.fetcher(path, { ...init, headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    if (!response.ok) throw new Error(response.status === 403 ? 'FINANCIAL_DOCUMENT_FORBIDDEN' : 'FINANCIAL_DOCUMENT_UNAVAILABLE');
    return response.json() as Promise<T>;
  }

  async list(): Promise<FinancialDocumentProjection[]> { return (await this.request<{ items: FinancialDocumentProjection[] }>('/api/finance/documents')).items; }
  async detail(id: string): Promise<FinancialDocumentDetail> { return this.request<FinancialDocumentDetail>(`/api/finance/documents/${encodeURIComponent(id)}`); }
  async listArtifacts(id: string): Promise<FinancialDocumentArtifactProjection[]> { return (await this.request<{ items: FinancialDocumentArtifactProjection[] }>(`/api/finance/documents/${encodeURIComponent(id)}/artifacts`)).items; }
  async issueReceipt(input: { sourceId: string; seriesId: string; idempotencyKey: string }): Promise<{ id: string; sequenceNumber: number; replayed: boolean }> {
    return this.request('/api/finance/documents/issue', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': input.idempotencyKey }, body: JSON.stringify({ sourceId: input.sourceId, seriesId: input.seriesId, documentType: 'receipt' }) });
  }
  async artifactContent(artifactId: string): Promise<Blob> {
    const token = await this.getToken().catch(() => null);
    const response = await this.fetcher(`/api/finance/document-artifacts/${encodeURIComponent(artifactId)}/content`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) throw new Error('FINANCIAL_DOCUMENT_ARTIFACT_UNAVAILABLE');
    return response.blob();
  }
}

export const financialDocumentClient = new FinancialDocumentClient();
