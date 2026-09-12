import React, { useState, useEffect, useCallback } from 'react';
import type { Payment } from '../../../modules/finance/payment-model.ts';
import { paymentClient } from '../../../modules/finance/payment-client.ts';
import { FinancePaymentsListView } from './FinancePaymentsListView.tsx';
import { FinancePaymentCreateView } from './FinancePaymentCreateView.tsx';
import { FinancePaymentProvidersView } from './FinancePaymentProvidersView.tsx';
import { financialDocumentClient, type FinancialDocumentReadinessProjection, type ReceiptPreissuePreview } from '../../../modules/finance/financial-document-client.ts';
import { browserDocumentIntentStorage, resolvePersistentDocumentIntentKey } from '../../../modules/finance/financial-document-intent.ts';
import { financeReadinessClient, type FinanceReadinessDto } from '../../../modules/finance/finance-readiness-client.ts';
import { formatFinanceMoney } from '../../../modules/finance/money-presentation.ts';

export type PaymentSubView = 'list' | 'create' | 'providers';

export interface FinancePaymentsWorkspaceProps {
  theme?: string;
  onOpenFinanceConfiguration?: () => void;
  onOpenFinancialDocuments?: (documentId: string) => void;
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

export function FinancePaymentsWorkspace({ theme = 'light', onOpenFinanceConfiguration, onOpenFinancialDocuments, initialPaymentReference }: FinancePaymentsWorkspaceProps) {
  const [view, setView] = useState<PaymentSubView>('list');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuanceNotice, setIssuanceNotice] = useState<string | null>(null);
  const [canIssueDocument, setCanIssueDocument] = useState(false);
  const [readiness, setReadiness] = useState<FinanceReadinessDto | null>(null);
  const [receiptDocumentReadiness, setReceiptDocumentReadiness] = useState<FinancialDocumentReadinessProjection | null>(null);
  const [receiptEligibility, setReceiptEligibility] = useState<Record<string, { eligible: boolean; reason?: string }>>({});
  const [previewPayment, setPreviewPayment] = useState<Payment | null>(null);
  const [issuedDocumentId, setIssuedDocumentId] = useState<string | null>(null);
  const [previewReadiness, setPreviewReadiness] = useState<ReceiptPreissuePreview | null>(null);

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
    if (!initialPaymentReference) return;
    const payment = payments.find(candidate => candidate.paymentReference === initialPaymentReference);
    if (payment) setPreviewPayment(payment);
  }, [initialPaymentReference, payments]);
  useEffect(() => { financialDocumentClient.capabilities().then(capabilities => setCanIssueDocument(capabilities.issue)).catch(() => setCanIssueDocument(false)); }, []);
  useEffect(() => { financeReadinessClient.get().then(setReadiness).catch(() => setReadiness(null)); }, []);
  useEffect(() => { financialDocumentClient.documentReadiness('receipt').then(setReceiptDocumentReadiness).catch(() => setReceiptDocumentReadiness(null)); }, []);
  useEffect(() => { if (!previewPayment) return void setPreviewReadiness(null); financialDocumentClient.receiptPreview(previewPayment.id).then(setPreviewReadiness).catch(() => setPreviewReadiness(null)); }, [previewPayment]);
  useEffect(() => { if (readiness?.status !== 'READY' || receiptDocumentReadiness?.status !== 'READY' || !canIssueDocument || payments.length === 0) return; financialDocumentClient.listActiveReceiptSeries().then(async series => { const selected = series[0]; if (!selected) return; const entries = await Promise.all(payments.map(async payment => { const result = await financialDocumentClient.receiptEligibility({ paymentId: payment.id, seriesId: selected.id }); return [payment.id, result.status === 'ELIGIBLE' ? { eligible: true } : { eligible: false, reason: result.reasonCode }] as const; })); setReceiptEligibility(Object.fromEntries(entries)); }).catch(() => setReceiptEligibility({})); }, [readiness?.status, receiptDocumentReadiness?.status, canIssueDocument, payments]);

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

  return (
    <div className="w-full">
      {readiness?.status === 'INCOMPLETE' && <section className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"><strong>Configuração necessária</strong><p>Os recebimentos estão disponíveis, mas ainda não é possível emitir recibos oficiais.</p>{readiness.canManageConfiguration && <button type="button" onClick={onOpenFinanceConfiguration} className="mt-2 rounded-md border px-3 py-1">Concluir configuração</button>}</section>}
      {receiptDocumentReadiness?.status === 'BLOCKED' && <section className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"><strong>Emissão oficial indisponível</strong><p>{receiptPreviewBlockMessage(receiptDocumentReadiness.reasonCode)}</p><p className="mt-1">Não será atribuído qualquer número de recibo enquanto este requisito não estiver concluído.</p></section>}
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
          onPreviewReceipt={setPreviewPayment}
          canIssueReceipt={payment => receiptEligibility[payment.id]?.eligible === true}
          receiptBlockReason={payment => receiptEligibilityMessage(receiptEligibility[payment.id]?.reason, canIssueDocument)}
      />
      {previewPayment && <section data-testid="receipt-pre-issue-preview" className="mt-4 rounded-lg border p-4 text-sm"><h3 className="font-semibold">Pré-visualização — ainda não emitido</h3><p>Recibo · Pagamento: {previewReadiness?.payment.reference ?? previewPayment.paymentReference}</p><p>Data do pagamento: {new Date(previewReadiness?.payment.date ?? previewPayment.effectiveAt).toLocaleDateString('pt-PT')}</p><p>Valor: {formatFinanceMoney({ amount: previewReadiness?.payment.amount ?? previewPayment.amount, currency: previewReadiness?.payment.currency ?? previewPayment.currency })}</p><p>Estado do pagamento: {previewReadiness?.payment.confirmationState === 'CONFIRMED' ? 'Confirmado' : 'Não confirmado'}</p><p>Emitente: {previewReadiness?.issuer?.legalName ?? 'Ainda não configurado'}</p><p>Pagador: {previewReadiness?.parties.payer ?? 'Ainda não identificado'}</p><p>Destinatário: {previewReadiness?.parties.recipient ?? 'Ainda não identificado'}</p><p>Fonte elegível: {previewReadiness?.sourceEligibility === 'ELIGIBLE' ? 'Sim' : 'Não'}</p><p>Número oficial: ainda não atribuído</p><p>Código QR oficial: ainda não disponível</p>{previewReadiness?.settlement && <div className="mt-2"><p className="font-medium">Liquidação:</p>{previewReadiness.settlement.allocations.map((allocation, index) => <p key={index}>Antes {formatFinanceMoney(allocation.before)} · Regularizado {formatFinanceMoney(allocation.movement)} · Após {formatFinanceMoney(allocation.after)}</p>)}{previewReadiness.settlement.unallocated && <p>Valor não aplicado: {formatFinanceMoney(previewReadiness.settlement.unallocated)}</p>}</div>}<p className="mt-2 text-zinc-600">{previewReadiness?.readiness.status === 'READY' && previewReadiness.sourceEligibility === 'ELIGIBLE' ? 'A emissão oficial pode ser confirmada.' : receiptPreviewBlockMessage(previewReadiness?.blockingReason ?? previewReadiness?.readiness.reasonCode)}</p></section>}
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
