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
}

export function FinancePaymentsWorkspace({ theme = 'light', onOpenFinanceConfiguration }: FinancePaymentsWorkspaceProps) {
  const [view, setView] = useState<PaymentSubView>('list');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuanceNotice, setIssuanceNotice] = useState<string | null>(null);
  const [canIssueDocument, setCanIssueDocument] = useState(false);
  const [readiness, setReadiness] = useState<FinanceReadinessDto | null>(null);
  const [receiptEligibility, setReceiptEligibility] = useState<Record<string, boolean>>({});
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
  useEffect(() => { if (readiness?.status !== 'READY' || !canIssueDocument || payments.length === 0) return; financialDocumentClient.listActiveReceiptSeries().then(async series => { const selected = series[0]; if (!selected) return; const entries = await Promise.all(payments.map(async payment => [payment.id, (await financialDocumentClient.receiptEligibility({ paymentId: payment.id, seriesId: selected.id })).status === 'ELIGIBLE'] as const)); setReceiptEligibility(Object.fromEntries(entries)); }).catch(() => setReceiptEligibility({})); }, [readiness?.status, canIssueDocument, payments]);

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
      {readiness?.status === 'BLOCKED' && <section className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"><strong>Emissão oficial indisponível</strong><p>A política documental da instituição não tem um adaptador jurisdicional aprovado. Não será atribuído qualquer número de recibo.</p></section>}
      {view === 'list' && (
        <FinancePaymentsListView
          payments={payments}
          loading={loading}
          error={error}
          theme={theme}
          onRefresh={loadPayments}
          onOpenCreate={() => setView('create')}
          onOpenProviders={() => setView('providers')}
          onIssueReceipt={readiness?.status === 'READY' && canIssueDocument ? issueReceipt : undefined}
          canIssueReceipt={payment => receiptEligibility[payment.id] === true}
        />
      )}

      {issuanceNotice && <p data-testid="financial-document-issuance-notice" className="mt-3 text-sm text-emerald-700">{issuanceNotice}</p>}

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
