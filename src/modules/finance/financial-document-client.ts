import { auth } from '../../lib/firebase.ts';

export type FinancialDocumentProjection = { id: string; type: string; status: string; seriesCode: string; sequenceNumber: number; issuedAt: string; correctsDocumentId: string | null };
export type FinancialDocumentCapabilities = { issue: boolean; correct: boolean };
export type FinancialDocumentDetail = FinancialDocumentProjection & { sources: Array<{ type: string; id: string; snapshot: Record<string, unknown> }>; corrections: FinancialDocumentProjection[] };
export type FinancialDocumentArtifactProjection = { id: string; document_id: string; render_version: string; template_version: string; generated_at: string; content_hash: string; media_type: string; byte_size: number };
type FinancialDocumentSeriesProjection = { id: string; document_type: string; status: string };
type UatTraceEvent = Record<string, string | number | boolean>;
type UatTraceReporter = (event: UatTraceEvent) => void;

const safeErrorDetail = (value: unknown) => typeof value === 'string'
  ? value.replace(/Bearer\s+[^\s,;]+/gi, '[REDACTED_CREDENTIAL]').slice(0, 180)
  : 'UNAVAILABLE';

const defaultUatTraceReporter: UatTraceReporter = (event) => {
  const environment = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;
  if (!environment?.DEV) return;
  void fetch('/__uat/trace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) }).catch(() => undefined);
};

export class FinancialDocumentClient {
  private transportControlsCaptured = false;
  constructor(
    private readonly fetcher: typeof fetch = globalThis.fetch,
    private readonly getToken = async () => auth.currentUser?.getIdToken(),
    private readonly trace: UatTraceReporter = defaultUatTraceReporter,
    private readonly userPresent = () => Boolean(auth.currentUser),
  ) {}

  private async captureTransportControls(traceId: string): Promise<void> {
    if (this.transportControlsCaptured) return;
    this.transportControlsCaptured = true;
    const controls: Array<{ name: string; path: string; headers?: HeadersInit }> = [
      { name: 'RUNTIME', path: '/__uat/runtime' },
      { name: 'TRACE', path: '/__uat/trace' },
      { name: 'FINANCE_NO_AUTH', path: '/api/finance/documents' },
      { name: 'FINANCE_DUMMY_AUTH', path: '/api/finance/documents', headers: { Authorization: 'Bearer uat-transport-dummy' } },
    ];
    await Promise.all(controls.map(async (control) => {
      try {
        const response = await this.fetcher(control.path, { method: 'GET', headers: control.headers, credentials: 'same-origin' });
        this.trace({ event: 'FINANCE_DOCUMENT_TRANSPORT_CONTROL', traceId, control: control.name, status: response.status, reachedResponse: true });
      } catch (error) {
        this.trace({ event: 'FINANCE_DOCUMENT_TRANSPORT_CONTROL', traceId, control: control.name, reachedResponse: false, errorName: error instanceof Error ? error.name : 'UnknownError', errorMessage: safeErrorDetail(error instanceof Error ? error.message : undefined) });
      }
    }));
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.getToken().catch(() => null);
    const traceId = crypto.randomUUID();
    const method = init?.method || 'GET';
    const headers = { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), 'X-Nexus-Uat-Trace': traceId };
    const baseOrigin = globalThis.location?.origin || 'http://localhost';
    const resolvedUrl = new URL(path, baseOrigin).toString();
    this.trace({ event: 'FINANCE_DOCUMENT_FETCH_INTENT', traceId, timestamp: new Date().toISOString(), origin: globalThis.location?.origin || 'UNAVAILABLE', method, path, firebaseUserPresent: this.userPresent(), idTokenAvailable: Boolean(token), authorizationPlanned: Boolean(token) });
    try {
      const diagnosticRequest = new Request(resolvedUrl, { ...init, headers });
      this.trace({ event: 'FINANCE_DOCUMENT_REQUEST_CONSTRUCTION', traceId, windowOrigin: globalThis.location?.origin || 'UNAVAILABLE', fetchInputType: 'string', fetchInputSafeValue: path, resolvedRequestUrl: diagnosticRequest.url, requestMethod: diagnosticRequest.method, requestMode: diagnosticRequest.mode, requestCredentialsMode: diagnosticRequest.credentials, requestRedirectMode: diagnosticRequest.redirect, requestCacheMode: diagnosticRequest.cache, authorizationHeaderPresent: diagnosticRequest.headers.has('Authorization'), authorizationHeaderValue: 'REDACTED', requestHeaderNames: Array.from(diagnosticRequest.headers.keys()).join(','), headerNameValid: true, headerValueType: token === null ? 'null' : typeof token, headerValueContainsForbiddenControlCharacters: token === null ? false : /[\u0000-\u001F\u007F]/.test(token), headerObjectConstruction: 'PASS', requestConstruction: 'PASS' });
    } catch (error) {
      this.trace({ event: 'FINANCE_DOCUMENT_REQUEST_CONSTRUCTION', traceId, requestConstruction: 'FAIL', requestConstructionErrorName: error instanceof Error ? error.name : 'UnknownError', requestConstructionSafeMessage: safeErrorDetail(error instanceof Error ? error.message : undefined) });
      throw error;
    }
    const environment = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;
    if (environment?.DEV) await this.captureTransportControls(traceId);
    let response: Response;
    try {
      response = await this.fetcher(path, { ...init, headers });
    } catch (error) {
      const cause = error instanceof Error && 'cause' in error ? error.cause : undefined;
      this.trace({ event: 'FINANCE_DOCUMENT_FETCH_NETWORK_FAILURE', traceId, timestamp: new Date().toISOString(), errorName: error instanceof Error ? error.name : 'UnknownError', errorMessage: safeErrorDetail(error instanceof Error ? error.message : undefined), errorCause: cause instanceof Error ? `${cause.name}: ${safeErrorDetail(cause.message)}` : safeErrorDetail(cause), networkFailure: true });
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
