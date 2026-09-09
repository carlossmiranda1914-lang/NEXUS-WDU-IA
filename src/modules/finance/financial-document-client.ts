import { auth } from '../../lib/firebase.ts';

export type FinancialDocumentProjection = { id: string; type: string; status: string; seriesCode: string; sequenceNumber: number; issuedAt: string; correctsDocumentId: string | null };
export type FinancialDocumentCapabilities = { issue: boolean; correct: boolean };
export type FinancialDocumentDetail = FinancialDocumentProjection & { sources: Array<{ type: string; id: string; snapshot: Record<string, unknown> }>; corrections: FinancialDocumentProjection[] };
export type FinancialDocumentArtifactProjection = { id: string; document_id: string; render_version: string; template_version: string; generated_at: string; content_hash: string; media_type: string; byte_size: number };
type FinancialDocumentSeriesProjection = { id: string; document_type: string; status: string };
type UatTraceEvent = Record<string, string | number | boolean>;
type UatTraceReporter = (event: UatTraceEvent) => void;

const defaultUatTraceReporter: UatTraceReporter = (event) => {
  const environment = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;
  if (!environment?.DEV) return;
  void fetch('/__uat/trace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) }).catch(() => undefined);
};

export class FinancialDocumentClient {
  constructor(
    private readonly fetcher: typeof fetch = globalThis.fetch,
    private readonly getToken = async () => auth.currentUser?.getIdToken(),
    private readonly trace: UatTraceReporter = defaultUatTraceReporter,
    private readonly userPresent = () => Boolean(auth.currentUser),
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.getToken().catch(() => null);
    const traceId = crypto.randomUUID();
    const method = init?.method || 'GET';
    this.trace({ event: 'FINANCE_DOCUMENT_FETCH_INTENT', traceId, timestamp: new Date().toISOString(), origin: globalThis.location?.origin || 'UNAVAILABLE', method, path, firebaseUserPresent: this.userPresent(), idTokenAvailable: Boolean(token), authorizationPlanned: Boolean(token) });
    let response: Response;
    try {
      response = await this.fetcher(path, { ...init, headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), 'X-Nexus-Uat-Trace': traceId } });
    } catch (error) {
      this.trace({ event: 'FINANCE_DOCUMENT_FETCH_NETWORK_FAILURE', traceId, timestamp: new Date().toISOString(), errorName: error instanceof Error ? error.name : 'UnknownError', networkFailure: true });
      throw error;
    }
    this.trace({ event: 'FINANCE_DOCUMENT_FETCH_RESPONSE', traceId, timestamp: new Date().toISOString(), status: response.status, responseClassification: response.ok ? 'SUCCESS' : 'HTTP_ERROR' });
    if (!response.ok) throw new Error(
      response.status === 401 ? 'FINANCIAL_DOCUMENT_AUTH_REQUIRED'
        : response.status === 403 ? 'FINANCIAL_DOCUMENT_FORBIDDEN'
          : response.status === 409 ? 'FINANCIAL_DOCUMENT_INSTITUTION_SELECTION_REQUIRED'
            : response.status === 422 ? 'Não foi possível concluir a ação. Verifique a configuração fiscal e a série efetiva.'
              : 'FINANCIAL_DOCUMENT_UNAVAILABLE',
    );
    return response.json() as Promise<T>;
  }

  async list(): Promise<FinancialDocumentProjection[]> { return (await this.request<{ items: FinancialDocumentProjection[] }>('/api/finance/documents')).items; }
  async capabilities(): Promise<FinancialDocumentCapabilities> { return (await this.request<{ capabilities: FinancialDocumentCapabilities }>('/api/finance/documents?limit=1')).capabilities; }
  async detail(id: string): Promise<FinancialDocumentDetail> { return this.request<FinancialDocumentDetail>(`/api/finance/documents/${encodeURIComponent(id)}`); }
  async listArtifacts(id: string): Promise<FinancialDocumentArtifactProjection[]> { return (await this.request<{ items: FinancialDocumentArtifactProjection[] }>(`/api/finance/documents/${encodeURIComponent(id)}/artifacts`)).items; }
  async generateArtifact(id: string): Promise<FinancialDocumentArtifactProjection> { return this.request<FinancialDocumentArtifactProjection>(`/api/finance/documents/${encodeURIComponent(id)}/artifacts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ renderVersion: 'renderer-1', templateVersion: 'template-1' }) }); }
  async issueReceipt(input: { sourceId: string; seriesId: string; idempotencyKey: string }): Promise<{ id: string; sequenceNumber: number; replayed: boolean }> {
    return this.request('/api/finance/documents/issue', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': input.idempotencyKey }, body: JSON.stringify({ sourceId: input.sourceId, seriesId: input.seriesId, documentType: 'receipt' }) });
  }
  async listActiveReceiptSeries(): Promise<FinancialDocumentSeriesProjection[]> { return (await this.request<{ items: FinancialDocumentSeriesProjection[] }>('/api/finance/document-series')).items.filter(series => series.document_type === 'receipt' && series.status === 'active'); }
  async listActiveCorrectionSeries(): Promise<FinancialDocumentSeriesProjection[]> { return (await this.request<{ items: FinancialDocumentSeriesProjection[] }>('/api/finance/document-series')).items.filter(series => series.document_type === 'credit_note' && series.status === 'active'); }
  async issueCorrection(input: { originalDocumentId: string; seriesId: string; idempotencyKey: string }): Promise<{ id: string; sequenceNumber: number; originalDocumentId: string; replayed: boolean }> {
    return this.request(`/api/finance/documents/${encodeURIComponent(input.originalDocumentId)}/corrections`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': input.idempotencyKey }, body: JSON.stringify({ seriesId: input.seriesId, documentType: 'credit_note' }) });
  }
  async artifactContent(artifactId: string): Promise<Blob> {
    const token = await this.getToken().catch(() => null);
    const response = await this.fetcher(`/api/finance/document-artifacts/${encodeURIComponent(artifactId)}/content`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) throw new Error('FINANCIAL_DOCUMENT_ARTIFACT_UNAVAILABLE');
    return response.blob();
  }
}

export const financialDocumentClient = new FinancialDocumentClient();
