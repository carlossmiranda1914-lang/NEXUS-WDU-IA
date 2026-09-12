import { auth } from '../../lib/firebase.ts';

export type FinancialDocumentPresentation = { document: { typeLabel: string; officialNumber: string; issueDate: string; currency: string; statusLabel: string }; issuer: { legalName: string; taxIdentifier: string | null; addressLines: string[] }; recipient: { name: string; operationalReference: string | null }; operation: { reference: string | null }; totals: { documentTotal: string; currency: string }; payment: { reference: string; amount: string; currency: string } | null };
export type FinancialDocumentProjection = { id: string; type: string; status: string; seriesCode: string; sequenceNumber: number; issuedAt: string; correctsDocumentId: string | null; presentation: FinancialDocumentPresentation | null };
export type FinancialDocumentCapabilities = { issue: boolean; correct: boolean };
export type FinancialDocumentDetail = FinancialDocumentProjection & { sources: Array<{ type: string; paymentReference: string | null }>; corrections: FinancialDocumentProjection[] };
export type FinancialDocumentArtifactProjection = { id: string; document_id: string; render_version: string; template_version: string; generated_at: string; content_hash: string; media_type: string; byte_size: number };
type FinancialDocumentSeriesProjection = { id: string; document_type: string; status: string };
export type ReceiptEligibilityProjection = { status: 'ELIGIBLE' } | { status: 'BLOCKED'; reasonCode: string };
export type FinancialDocumentReadinessProjection = { documentType: string; status: 'READY' | 'BLOCKED'; reasonCode?: string; prerequisites: Record<string, boolean> };
export type ReceiptPreissuePreview = { documentType: 'receipt'; officialDocumentCreated: false; definitiveNumberAllocated: false; officialQrAvailable: false; payment: { reference: string; date: string; amount: string; currency: string; confirmationState: string }; sourceEligibility: 'ELIGIBLE' | 'BLOCKED'; readiness: FinancialDocumentReadinessProjection; blockingReason: string | null; series: { available: boolean; reference: string | null }; issuer: { legalName: string; taxIdentifier: string | null; address: string } | null; parties: { payer: string | null; beneficiary: string | null; recipient: string | null }; settlement: { sourceDocuments: Array<{ reference: string }>; allocations: Array<{ before: { amount: string; currency: string }; movement: { amount: string; currency: string }; after: { amount: string; currency: string } }>; unallocated: { amount: string; currency: string } | null } | null; documentaryPrerequisites: { partiesResolved: boolean; documentaryDataComplete: boolean } };

export class FinancialDocumentApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'FinancialDocumentApiError';
  }
}

const defaultFetch: typeof fetch = (input, init) => {
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    return window.fetch(input, init);
  }
  return globalThis.fetch(input, init);
};

export class FinancialDocumentClient {
  constructor(
    private readonly fetcher: typeof fetch = defaultFetch,
    private readonly getToken = async () => auth.currentUser?.getIdToken(),
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.getToken().catch(() => null);
    const response = await this.fetcher(path, { ...init, headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    if (!response.ok) throw await documentApiError(response);
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
  async receiptEligibility(input: { paymentId: string; seriesId: string }): Promise<ReceiptEligibilityProjection> {
    return this.request(`/api/finance/payments/${encodeURIComponent(input.paymentId)}/receipt-eligibility?seriesId=${encodeURIComponent(input.seriesId)}`);
  }
  async documentReadiness(documentType: string): Promise<FinancialDocumentReadinessProjection> { return this.request(`/api/finance/readiness/documents/${encodeURIComponent(documentType)}`); }
  async receiptPreview(paymentId: string): Promise<ReceiptPreissuePreview> { return this.request(`/api/finance/payments/${encodeURIComponent(paymentId)}/receipt-preview`); }
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

async function documentApiError(response: Response): Promise<FinancialDocumentApiError> {
  const payload = await response.json().catch(() => ({})) as { code?: string };
  const fallback = response.status === 401 ? 'FINANCIAL_DOCUMENT_AUTH_REQUIRED'
    : response.status === 403 ? 'FINANCIAL_DOCUMENT_FORBIDDEN'
      : response.status === 409 ? 'FINANCIAL_DOCUMENT_INSTITUTION_SELECTION_REQUIRED'
        : response.status === 422 ? 'FINANCIAL_DOCUMENT_VALIDATION'
          : 'FINANCIAL_DOCUMENT_UNAVAILABLE';
  const code = payload.code ?? fallback;
  const messages: Record<string, string> = {
    FINANCIAL_DOCUMENT_AUTH_REQUIRED: 'FINANCIAL_DOCUMENT_AUTH_REQUIRED',
    FINANCIAL_DOCUMENT_FORBIDDEN: 'FINANCIAL_DOCUMENT_FORBIDDEN',
    FINANCIAL_DOCUMENT_INSTITUTION_SELECTION_REQUIRED: 'FINANCIAL_DOCUMENT_INSTITUTION_SELECTION_REQUIRED',
    FISCAL_ADAPTER_UNSUPPORTED_JURISDICTION: 'A política documental desta instituição não tem um adaptador jurisdicional aprovado para emissão oficial.',
    FISCAL_CONFIGURATION_ADAPTER_MISMATCH: 'A configuração fiscal ativa não corresponde à política documental da instituição.',
    FISCAL_CONFIGURATION_NOT_EFFECTIVE: 'Não existe uma configuração fiscal efetiva para emissão oficial.',
    FINANCIAL_PROFILE_NOT_FOUND: 'Não existe um perfil financeiro efetivo para a origem deste recebimento.',
    RECEIPT_SERIES_NOT_EFFECTIVE: 'Não existe uma série de recibos ativa e efetiva.',
    SOURCE_NOT_ELIGIBLE: 'Este pagamento não é elegível para emissão de recibo oficial.',
    DOCUMENT_TYPE_UNSUPPORTED: 'A política documental ativa não suporta este tipo de documento.',
    FINANCIAL_DOCUMENT_VALIDATION: 'Não foi possível concluir a ação. Verifique a configuração fiscal e a série efetiva.',
  };
  return new FinancialDocumentApiError(code, messages[code] ?? 'Não foi possível concluir a ação financeira.');
}

export const financialDocumentClient = new FinancialDocumentClient();
