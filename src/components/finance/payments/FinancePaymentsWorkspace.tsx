import React, { useState, useEffect, useCallback } from 'react';
import type { Payment } from '../../../modules/finance/payment-model.ts';
import { paymentClient } from '../../../modules/finance/payment-client.ts';
import { FinancePaymentsListView } from './FinancePaymentsListView.tsx';
import { FinancePaymentCreateView } from './FinancePaymentCreateView.tsx';
import { FinancePaymentProvidersView } from './FinancePaymentProvidersView.tsx';
import { financialDocumentClient, type FinancialDocumentReadinessProjection, type InvoiceReceiptPreissuePreview, type ReceiptPreissuePreview } from '../../../modules/finance/financial-document-client.ts';
import { allocationClient } from '../../../modules/finance/allocation-client.ts';
import { browserDocumentIntentStorage, resolvePersistentDocumentIntentKey } from '../../../modules/finance/financial-document-intent.ts';
import { financeReadinessClient, type FinanceReadinessDto } from '../../../modules/finance/finance-readiness-client.ts';
import { ReceiptDocumentSurface } from '../documents/ReceiptDocumentSurface.tsx';
import { InvoiceReceiptDocumentSurface } from '../documents/InvoiceReceiptDocumentSurface.tsx';
import { formatFinanceMoney } from '../../../modules/finance/money-presentation.ts';

export type PaymentSubView = 'list' | 'create' | 'providers';

export interface FinancePaymentsWorkspaceProps {
  theme?: string;
  onOpenFinanceConfiguration?: () => void;
  onOpenFinancialDocuments?: (documentId: string) => void;
  initialPaymentId?: string | null;
  initialPaymentReference?: string | null;
}

const receiptEligibilityMessage = (reason?: string, canIssueDocument = false) => {
  if (!canIssueDocument) return 'A sua associação institucional não tem permissão para emitir recibos.';
  const messages: Record<string, string> = {
    SOURCE_NOT_ELIGIBLE: 'Este pagamento não está elegível para emissão de recibo oficial.',
    RECEIPT_SERIES_NOT_EFFECTIVE: 'Não existe uma série de recibos ativa e efetiva para este pagamento.',
    FISCAL_CONFIGURATION_NOT_EFFECTIVE: 'A instituição não possui configuração fiscal efetiva para emissão oficial.',
    FINANCIAL_PROFILE_NOT_FOUND: 'O perfil financeiro associado a este pagamento não está disponível.',
    AGT_ONBOARDING_REQUIRED: 'A emissão oficial depende da adesão da instituição à AGT.',
    AGT_SIGNING_MATERIAL_REQUIRED: 'A emissão oficial depende do material de assinatura autorizado pela AGT.',
    AGT_PRODUCTION_SERIES_REQUIRED: 'A emissão oficial depende de uma série de recibos atribuída pela AGT.',
    FISCAL_ADAPTER_UNSUPPORTED_JURISDICTION: 'A política documental da instituição não tem uma política aprovada para emissão oficial.',
    FISCAL_CONFIGURATION_ADAPTER_MISMATCH: 'A configuração fiscal ativa não corresponde à política documental da instituição.',
    DOCUMENT_TYPE_UNSUPPORTED: 'A política documental ativa não suporta a emissão deste recibo.',
  };
  return reason ? messages[reason] ?? 'Este pagamento não reúne os requisitos para emissão oficial.' : 'A emissão deste recibo ainda não está disponível.';
};

const receiptPreviewBlockMessage = (reason?: string | null) => ({
  AGT_ONBOARDING_REQUIRED: 'A emissão oficial depende da adesão da instituição à AGT.',
  AGT_SIGNING_MATERIAL_REQUIRED: 'A emissão oficial depende do material de assinatura autorizado pela AGT.',
  AGT_PRODUCTION_SERIES_REQUIRED: 'A emissão oficial depende de uma série de recibos atribuída pela AGT.',
  FISCAL_CONFIGURATION_NOT_EFFECTIVE: 'A configuração fiscal oficial ainda não está disponível para este pagamento.',
  DOCUMENT_PARTY_REQUIRED: 'Ainda falta confirmar as partes obrigatórias do documento.',
  DOCUMENTARY_DATA_REQUIRED: 'Ainda faltam dados documentais obrigatórios para emissão oficial.',
  SOURCE_NOT_ELIGIBLE: 'Este pagamento não está elegível para emissão de recibo oficial.',
}[reason ?? ''] ?? 'A emissão oficial permanece bloqueada até a instituição concluir os requisitos aplicáveis.');

type ReceiptReadinessPresentation = {
  kind: 'LOCAL_ACTIONABLE' | 'LOCAL_NON_ACTIONABLE' | 'EXTERNAL_DEPENDENCY';
  primary: string;
  secondary: string | null;
  showConfigurationCta: boolean;
};

const externalSecondaryMessage = (reasonCode?: string) => receiptPreviewBlockMessage(reasonCode)
  .replace(/^A emissão oficial depende/, 'A emissão oficial também depende');

export function receiptReadinessPresentation(
  readiness: FinanceReadinessDto | null,
  documentReadiness: Pick<FinancialDocumentReadinessProjection, 'status' | 'reasonCode'> | null,
): ReceiptReadinessPresentation | null {
  if (readiness?.status === 'READY' && documentReadiness?.status === 'READY') return null;

  const missing = readiness?.requirements.filter(requirement => requirement.state === 'MISSING') ?? [];
  const legalMissing = missing.some(requirement => requirement.code === 'INSTITUTION_LEGAL_PROFILE');
  const financialMissing = missing.some(requirement => requirement.code === 'FINANCIAL_PROFILE');
  if (readiness?.canManageConfiguration && (legalMissing || financialMissing)) {
    const profiles = [legalMissing && 'perfil jurídico institucional', financialMissing && 'perfil financeiro institucional'].filter(Boolean);
    return { kind: 'LOCAL_ACTIONABLE', primary: `Falta configurar o ${profiles.join(' e ')}.`, secondary: null, showConfigurationCta: true };
  }

  if (missing.length) {
    const labels = missing.map(requirement => ({
      FISCAL_CONFIGURATION: 'configuração fiscal',
      RECEIPT_SERIES: 'série de recibos',
      INSTITUTION_LEGAL_PROFILE: 'perfil jurídico institucional',
      FINANCIAL_PROFILE: 'perfil financeiro institucional',
    })[requirement.code]);
    const external = documentReadiness?.status === 'BLOCKED' && /^AGT_/.test(documentReadiness.reasonCode ?? '');
    return {
      kind: 'LOCAL_NON_ACTIONABLE',
      primary: `Faltam recursos locais: ${labels.join(' e ')}.`,
      secondary: external ? externalSecondaryMessage(documentReadiness?.reasonCode) : null,
      showConfigurationCta: false,
    };
  }

  if (documentReadiness?.status === 'BLOCKED') {
    return {
      kind: 'EXTERNAL_DEPENDENCY',
      primary: receiptPreviewBlockMessage(documentReadiness.reasonCode),
      secondary: null,
      showConfigurationCta: false,
    };
  }

  return readiness?.status === 'READY' ? null : {
    kind: 'LOCAL_NON_ACTIONABLE',
    primary: 'A emissão permanece bloqueada até os requisitos aplicáveis estarem disponíveis.',
    secondary: null,
    showConfigurationCta: false,
  };
}

export function FinancePaymentsWorkspace({ theme = 'light', onOpenFinanceConfiguration, onOpenFinancialDocuments, initialPaymentId, initialPaymentReference }: FinancePaymentsWorkspaceProps) {
  const [view, setView] = useState<PaymentSubView>('list');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuanceNotice, setIssuanceNotice] = useState<string | null>(null);
  const [canIssueDocument, setCanIssueDocument] = useState(false);
  const [readiness, setReadiness] = useState<FinanceReadinessDto | null>(null);
  const [receiptDocumentReadiness, setReceiptDocumentReadiness] = useState<FinancialDocumentReadinessProjection | null>(null);
  const [invoiceReceiptDocumentReadiness, setInvoiceReceiptDocumentReadiness] = useState<FinancialDocumentReadinessProjection | null>(null);
  const [receiptEligibility, setReceiptEligibility] = useState<Record<string, { eligible: boolean; reason?: string }>>({});
  const [invoiceReceiptEligibility, setInvoiceReceiptEligibility] = useState<Record<string, { eligible: boolean }>>({});
  const [previewPayment, setPreviewPayment] = useState<Payment | null>(null);
  const [issuedDocumentId, setIssuedDocumentId] = useState<string | null>(null);
  const [previewReadiness, setPreviewReadiness] = useState<ReceiptPreissuePreview | null>(null);
  const [invoiceReceiptPreview, setInvoiceReceiptPreview] = useState<InvoiceReceiptPreissuePreview | null>(null);
  const receiptReadinessState = receiptReadinessPresentation(readiness, receiptDocumentReadiness);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await paymentClient.listPayments();
      setPayments(data);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar pagamentos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);
  useEffect(() => {
    if (!initialPaymentId && !initialPaymentReference) return;
    const payment = payments.find(candidate => candidate.id === initialPaymentId || candidate.paymentReference === initialPaymentReference);
    if (payment) setPreviewPayment(payment);
  }, [initialPaymentId, initialPaymentReference, payments]);
  useEffect(() => { financialDocumentClient.capabilities().then(capabilities => setCanIssueDocument(capabilities.issue)).catch(() => setCanIssueDocument(false)); }, []);
  useEffect(() => { financeReadinessClient.get().then(setReadiness).catch(() => setReadiness(null)); }, []);
  useEffect(() => { financialDocumentClient.documentReadiness('receipt').then(setReceiptDocumentReadiness).catch(() => setReceiptDocumentReadiness(null)); }, []);
  useEffect(() => { financialDocumentClient.documentReadiness('invoice_receipt').then(setInvoiceReceiptDocumentReadiness).catch(() => setInvoiceReceiptDocumentReadiness(null)); }, []);
  useEffect(() => { if (!previewPayment) return void setPreviewReadiness(null); financialDocumentClient.receiptPreview(previewPayment.id).then(setPreviewReadiness).catch(() => setPreviewReadiness(null)); }, [previewPayment]);
  useEffect(() => { if (readiness?.status !== 'READY' || receiptDocumentReadiness?.status !== 'READY' || !canIssueDocument || payments.length === 0) return; financialDocumentClient.listActiveReceiptSeries().then(async series => { const selected = series[0]; if (!selected) return; const entries = await Promise.all(payments.map(async payment => { const result = await financialDocumentClient.receiptEligibility({ paymentId: payment.id, seriesId: selected.id }); return [payment.id, result.status === 'ELIGIBLE' ? { eligible: true } : { eligible: false, reason: result.reasonCode }] as const; })); setReceiptEligibility(Object.fromEntries(entries)); }).catch(() => setReceiptEligibility({})); }, [readiness?.status, receiptDocumentReadiness?.status, canIssueDocument, payments]);
  useEffect(() => { if (readiness?.status !== 'READY' || invoiceReceiptDocumentReadiness?.status !== 'READY' || !canIssueDocument || payments.length === 0) return void setInvoiceReceiptEligibility({}); financialDocumentClient.listActiveInvoiceReceiptSeries().then(async series => { if (!series[0]) return void setInvoiceReceiptEligibility({}); const entries = await Promise.all(payments.map(async payment => { const { allocations } = await allocationClient.listForPayment(payment.id); const relationship = allocations[0]; if (!relationship) return [payment.id, { eligible: false }] as const; const preview = await financialDocumentClient.invoiceReceiptPreview({ paymentId: payment.id, obligationId: relationship.obligationId }); return [payment.id, { eligible: preview.sourceEligibility === 'ELIGIBLE' && preview.readiness.status === 'READY' }] as const; })); setInvoiceReceiptEligibility(Object.fromEntries(entries)); }).catch(() => setInvoiceReceiptEligibility({})); }, [readiness?.status, invoiceReceiptDocumentReadiness?.status, canIssueDocument, payments]);

  const handleCreated = (newPayment: Payment) => {
    setPayments((prev) => [newPayment, ...prev]);
    setView('list');
  };
  const issueReceipt = async (payment: Payment) => {
    setError(null); setIssuanceNotice(null);
    try {
      const series = await financialDocumentClient.listActiveReceiptSeries();
      const selected = series[0]; if (!selected) throw new Error('Não existe uma série de recibos efetiva configurada.');
      const key = resolvePersistentDocumentIntentKey(
        browserDocumentIntentStorage(),
        `finance-document-intent:receipt:${payment.id}:${selected.id}`,
        () => `document-receipt-${crypto.randomUUID()}`,
      );
      const result = await financialDocumentClient.issueReceipt({ sourceId: payment.id, seriesId: selected.id, idempotencyKey: key });
      setIssuedDocumentId(result.id); setIssuanceNotice(`Recibo oficial ${result.replayed ? 'recuperado' : 'emitido'}: n.º ${result.sequenceNumber}.`);
    } catch (err: any) { setError(err?.message || 'Não foi possível emitir o recibo oficial. Tente novamente para recuperar a operação.'); }
  };
  const previewInvoiceReceipt = async (payment: Payment) => {
    setError(null); setInvoiceReceiptPreview(null);
    try {
      const { allocations } = await allocationClient.listForPayment(payment.id);
      const relationship = allocations[0];
      if (!relationship) throw new Error('Este pagamento não possui uma alocação ativa para pré-visualizar uma Factura-Recibo.');
      setInvoiceReceiptPreview(await financialDocumentClient.invoiceReceiptPreview({ paymentId: payment.id, obligationId: relationship.obligationId }));
    } catch (err: any) { setError(err?.message || 'A relação financeira não está disponível para pré-visualização.'); }
  };
  const issueInvoiceReceipt = async (payment: Payment) => {
    setError(null); setIssuanceNotice(null);
    try {
      const [{ allocations }, series] = await Promise.all([allocationClient.listForPayment(payment.id), financialDocumentClient.listActiveInvoiceReceiptSeries()]);
      const relationship = allocations[0], selected = series[0];
      if (!relationship) throw new Error('Este pagamento não possui uma alocação ativa para emitir uma Factura-Recibo.');
      if (!selected) throw new Error('Não existe uma série de Factura-Recibo efetiva configurada.');
      const key = resolvePersistentDocumentIntentKey(browserDocumentIntentStorage(), `finance-document-intent:invoice-receipt:${payment.id}:${relationship.obligationId}:${selected.id}`, () => `document-invoice-receipt-${crypto.randomUUID()}`);
      const result = await financialDocumentClient.issueInvoiceReceipt({ paymentId: payment.id, obligationId: relationship.obligationId, seriesId: selected.id, idempotencyKey: key });
      setIssuedDocumentId(result.id); setIssuanceNotice(`Factura-Recibo ${result.replayed ? 'recuperada' : 'emitida'}: n.º ${result.sequenceNumber}.`);
    } catch (err: any) { setError(err?.message || 'Não foi possível emitir a Factura-Recibo. Tente novamente para recuperar a operação.'); }
  };

  return (
    <div className="w-full">
      {receiptReadinessState && <section data-testid="receipt-readiness-state" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"><strong>{receiptReadinessState.kind === 'LOCAL_ACTIONABLE' ? 'Configuração necessária' : receiptReadinessState.kind === 'LOCAL_NON_ACTIONABLE' ? 'Configuração local pendente' : 'Emissão oficial indisponível'}</strong><p>{receiptReadinessState.primary}</p>{receiptReadinessState.secondary && <p className="mt-1 text-zinc-700">{receiptReadinessState.secondary}</p>}{receiptReadinessState.showConfigurationCta && <button type="button" onClick={onOpenFinanceConfiguration} className="mt-2 rounded-md border px-3 py-1">Concluir configuração</button>}</section>}
      {view === 'list' && <>
        <FinancePaymentsListView
          payments={payments}
          loading={loading}
          error={error}
          theme={theme}
          onRefresh={loadPayments}
          onOpenCreate={() => setView('create')}
          onOpenProviders={() => setView('providers')}
          onIssueReceipt={readiness?.status === 'READY' && receiptDocumentReadiness?.status === 'READY' && canIssueDocument ? issueReceipt : undefined}
          onIssueInvoiceReceipt={readiness?.status === 'READY' && invoiceReceiptDocumentReadiness?.status === 'READY' && canIssueDocument ? issueInvoiceReceipt : undefined}
          onPreviewReceipt={setPreviewPayment}
          onPreviewInvoiceReceipt={previewInvoiceReceipt}
          canIssueReceipt={payment => receiptEligibility[payment.id]?.eligible === true}
          canIssueInvoiceReceipt={payment => invoiceReceiptEligibility[payment.id]?.eligible === true}
          receiptBlockReason={payment => receiptEligibilityMessage(receiptEligibility[payment.id]?.reason, canIssueDocument)}
      />
      {previewPayment && <section data-testid="receipt-pre-issue-preview" className="mt-4 space-y-4"><header data-testid="selected-payment-context" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm"><strong>A visualizar pagamento</strong><p className="mt-1">{previewPayment.paymentReference} · {formatFinanceMoney(previewPayment)} · {new Date(previewPayment.effectiveAt).toLocaleDateString('pt-PT')}</p></header>{previewReadiness ? <><ReceiptDocumentSurface model={{ mode: 'preview', status: previewReadiness.payment.confirmationState === 'CONFIRMED' ? 'Confirmado' : 'Não confirmado', payment: previewReadiness.payment, issuer: previewReadiness.issuer, payer: previewReadiness.parties.payer, recipient: previewReadiness.parties.recipient, settlement: previewReadiness.settlement }} /><section data-testid="receipt-preview-readiness" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"><h3 className="font-semibold">Estado de emissão</h3><p>{previewReadiness.sourceEligibility === 'ELIGIBLE' ? 'Fonte elegível para emissão.' : 'A fonte ainda não está elegível para emissão.'}</p><p className="mt-1 text-zinc-700">{previewReadiness.readiness.status === 'READY' && previewReadiness.sourceEligibility === 'ELIGIBLE' ? 'A emissão oficial pode ser confirmada.' : receiptPreviewBlockMessage(previewReadiness.blockingReason ?? previewReadiness.readiness.reasonCode)}</p></section></> : <div className="rounded-lg border p-4 text-sm">A carregar a pré-visualização autorizada do recibo.</div>}</section>}
      {invoiceReceiptPreview && <section data-testid="invoice-receipt-pre-issue-preview" className="mt-4 space-y-4"><InvoiceReceiptDocumentSurface model={invoiceReceiptPreview} /><section data-testid="invoice-receipt-preview-readiness" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"><h3 className="font-semibold">Estado de emissão</h3><p>{invoiceReceiptPreview.readiness.status === 'READY' ? 'A emissão oficial pode ser confirmada.' : receiptPreviewBlockMessage(invoiceReceiptPreview.blockingReason ?? invoiceReceiptPreview.readiness.reasonCode)}</p></section></section>}
      </>}

      {issuanceNotice && <div data-testid="financial-document-issuance-notice" className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><p>{issuanceNotice}</p>{onOpenFinancialDocuments && issuedDocumentId && <button type="button" onClick={() => onOpenFinancialDocuments(issuedDocumentId)} className="rounded-md border border-emerald-300 bg-white px-3 py-1 font-semibold text-emerald-800">Abrir documento financeiro</button>}</div>}

      {view === 'create' && (
        <FinancePaymentCreateView
          theme={theme}
          defaultCurrency={readiness?.paymentCurrency?.functionalCurrency}
          currencyOptions={readiness?.paymentCurrency?.enabledCurrencies}
          onSuccess={handleCreated}
          onCancel={() => setView('list')}
        />
      )}

      {view === 'providers' && (
        <FinancePaymentProvidersView
          theme={theme}
          onBack={() => setView('list')}
        />
      )}
    </div>
  );
}

export default FinancePaymentsWorkspace;
