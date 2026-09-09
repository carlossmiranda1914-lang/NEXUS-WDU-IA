import { auth } from '../../lib/firebase.ts';

export type FinancialDocumentProjection = { id: string; type: string; status: string; seriesCode: string; sequenceNumber: number; issuedAt: string; correctsDocumentId: string | null };

export class FinancialDocumentClient {
  constructor(private readonly fetcher: typeof fetch = globalThis.fetch, private readonly getToken = async () => auth.currentUser?.getIdToken()) {}

  private async request<T>(path: string): Promise<T> {
    const token = await this.getToken().catch(() => null);
    const response = await this.fetcher(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) throw new Error(response.status === 403 ? 'FINANCIAL_DOCUMENT_FORBIDDEN' : 'FINANCIAL_DOCUMENT_UNAVAILABLE');
    return response.json() as Promise<T>;
  }

  async list(): Promise<FinancialDocumentProjection[]> { return (await this.request<{ items: FinancialDocumentProjection[] }>('/api/finance/documents')).items; }
  async artifactContent(artifactId: string): Promise<Blob> {
    const token = await this.getToken().catch(() => null);
    const response = await this.fetcher(`/api/finance/document-artifacts/${encodeURIComponent(artifactId)}/content`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) throw new Error('FINANCIAL_DOCUMENT_ARTIFACT_UNAVAILABLE');
    return response.blob();
  }
}

export const financialDocumentClient = new FinancialDocumentClient();
