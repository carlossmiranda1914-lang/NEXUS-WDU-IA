import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Payment } from '../../../modules/finance/payment-model.ts';
import { paymentClient } from '../../../modules/finance/payment-client.ts';
import { FinancePaymentsListView } from './FinancePaymentsListView.tsx';
import { FinancePaymentCreateView } from './FinancePaymentCreateView.tsx';
import { FinancePaymentProvidersView } from './FinancePaymentProvidersView.tsx';
import { financialDocumentClient } from '../../../modules/finance/financial-document-client.ts';
import { financeReadinessClient, type FinanceReadinessDto } from '../../../modules/finance/finance-readiness-client.ts';

export type PaymentSubView = 'list' | 'create' | 'providers';

export interface FinancePaymentsWorkspaceProps {
  theme?: string;
  onOpenFinanceConfiguration?: () => void;
  onOpenFinancialDocuments?: () => void;
}

const receiptEligibilityMessage = (reason?: string, canIssueDocument = false) => {
  if (!canIssueDocument) return 'A sua associação institucional não tem permissão para emitir recibos.';
  const messages: Record<string, string> = {
    SOURCE_NOT_ELIGIBLE: 'Este pagamento não está elegível para emissão de recibo oficial.',
    RECEIPT_SERIES_NOT_EFFECTIVE: 'Não existe uma série de recibos ativa e efetiva para este pagamento.',
    FISCAL_CONFIGURATION_NOT_EFFECTIVE: 'A instituição não possui configuração fiscal efetiva para emissão oficial.',
    FINANCIAL_PROFILE_NOT_FOUND: 'O perfil financeiro associado a este pagamento não está disponível.',
    FISCAL_ADAPTER_UNSUPPORTED_JURISDICTION: 'A política documental da instituição não tem um adaptador jurisdicional aprovado.',
    FISCAL_CONFIGURATION_ADAPTER_MISMATCH: 'A configuração fiscal ativa não corresponde à política documental da instituição.',
    DOCUMENT_TYPE_UNSUPPORTED: 'A política documental ativa não suporta a emissão deste recibo.',
  };
  return reason ? messages[reason] ?? 'Este pagamento não reúne os requisitos para emissão oficial.' : 'A emissão deste recibo ainda não está disponível.';
};

export function FinancePaymentsWorkspace({ theme = 'light', onOpenFinanceConfiguration, onOpenFinancialDocuments }: FinancePaymentsWorkspaceProps) {
  const [view, setView] = useState<PaymentSubView>('list');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuanceNotice, setIssuanceNotice] = useState<string | null>(null);
  const [canIssueDocument, setCanIssueDocument] = useState(false);
  const [readiness, setReadiness] = useState<FinanceReadinessDto | null>(null);
  const [receiptEligibility, setReceiptEligibility] = useState<Record<string, { eligible: boolean; reason?: string }>>({});
  const receiptKeys = useRef(new Map<string, string>());

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
  useEffect(() => { financialDocumentClient.capabilities().then(capabilities => setCanIssueDocument(capabilities.issue)).catch(() => setCanIssueDocument(false)); }, []);
  useEffect(() => { financeReadinessClient.get().then(setReadiness).catch(() => setReadiness(null)); }, []);
  useEffect(() => { if (readiness?.status !== 'READY' || readiness?.receiptIssuance.status !== 'READY' || !canIssueDocument || payments.length === 0) return; financialDocumentClient.listActiveReceiptSeries().then(async series => { const selected = series[0]; if (!selected) return; const entries = await Promise.all(payments.map(async payment => { const result = await financialDocumentClient.receiptEligibility({ paymentId: payment.id, seriesId: selected.id }); return [payment.id, result.status === 'ELIGIBLE' ? { eligible: true } : { eligible: false, reason: result.reasonCode }] as const; })); setReceiptEligibility(Object.fromEntries(entries)); }).catch(() => setReceiptEligibility({})); }, [readiness?.status, readiness?.receiptIssuance.status, canIssueDocument, payments]);

  const handleCreated = (newPayment: Payment) => {
    setPayments((prev) => [newPayment, ...prev]);
    setView('list');
  };
  const issueReceipt = async (payment: Payment) => {
    setError(null); setIssuanceNotice(null);
    try {
      const series = await financialDocumentClient.listActiveReceiptSeries();
      const selected = series[0]; if (!selected) throw new Error('Não existe uma série de recibos efetiva configurada.');
      const key = receiptKeys.current.get(payment.id) ?? `document-receipt-${crypto.randomUUID()}`;
      receiptKeys.current.set(payment.id, key);
      const result = await financialDocumentClient.issueReceipt({ sourceId: payment.id, seriesId: selected.id, idempotencyKey: key });
      setIssuanceNotice(`Recibo oficial ${result.replayed ? 'recuperado' : 'emitido'}: n.º ${result.sequenceNumber}.`);
    } catch (err: any) { setError(err?.message || 'Não foi possível emitir o recibo oficial. Tente novamente para recuperar a operação.'); }
  };

  return (
    <div className="w-full">
      {readiness?.status === 'INCOMPLETE' && <section className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"><strong>Configuração necessária</strong><p>Os recebimentos estão disponíveis, mas ainda não é possível emitir recibos oficiais.</p>{readiness.canManageConfiguration && <button type="button" onClick={onOpenFinanceConfiguration} className="mt-2 rounded-md border px-3 py-1">Concluir configuração</button>}</section>}
      {readiness?.receiptIssuance.status === 'BLOCKED' && <section className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"><strong>Emissão oficial indisponível</strong><p>A política documental da instituição não tem um adaptador jurisdicional aprovado. Não será atribuído qualquer número de recibo.</p></section>}
      {view === 'list' && (
        <FinancePaymentsListView
          payments={payments}
          loading={loading}
          error={error}
          theme={theme}
          onRefresh={loadPayments}
          onOpenCreate={() => setView('create')}
          onOpenProviders={() => setView('providers')}
          onIssueReceipt={readiness?.status === 'READY' && readiness?.receiptIssuance.status === 'READY' && canIssueDocument ? issueReceipt : undefined}
          canIssueReceipt={payment => receiptEligibility[payment.id]?.eligible === true}
          receiptBlockReason={payment => receiptEligibilityMessage(receiptEligibility[payment.id]?.reason, canIssueDocument)}
        />
      )}

      {issuanceNotice && <div data-testid="financial-document-issuance-notice" className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><p>{issuanceNotice}</p>{onOpenFinancialDocuments && <button type="button" onClick={onOpenFinancialDocuments} className="rounded-md border border-emerald-300 bg-white px-3 py-1 font-semibold text-emerald-800">Abrir documento financeiro</button>}</div>}

      {view === 'create' && (
        <FinancePaymentCreateView
          theme={theme}
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
