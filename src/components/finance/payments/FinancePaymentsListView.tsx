import React from 'react';
import type { Payment } from '../../../modules/finance/payment-model.ts';

export interface FinancePaymentsListViewProps {
  payments: Payment[];
  loading: boolean;
  error: string | null;
  theme?: string;
  onRefresh: () => void;
  onOpenCreate: () => void;
  onOpenProviders: () => void;
  onIssueReceipt?: (payment: Payment) => void;
  canIssueReceipt?: (payment: Payment) => boolean;
  receiptBlockReason?: (payment: Payment) => string | undefined;
}

export function FinancePaymentsListView({
  payments,
  loading,
  error,
  theme = 'light',
  onRefresh,
  onOpenCreate,
  onOpenProviders,
  onIssueReceipt,
  canIssueReceipt,
  receiptBlockReason,
}: FinancePaymentsListViewProps) {
  const isLight = theme === 'light';

  const formatMethod = (method: string, sourceType: string) => {
    if (sourceType === 'manual_offline') {
      switch (method) {
        case 'cash': return 'Numerário';
        case 'bank_transfer': return 'Transferência Bancária';
        case 'external_reference': return 'Ref. Externa';
        default: return method;
      }
    }
    return `${method.toUpperCase()} (${sourceType})`;
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={`text-xl font-bold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
            Recebimentos e Pagamentos
          </h2>
          <p className={`text-sm ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Registo canónico de valores recebidos. Pagamentos confirmados permanecem como "Não aplicado".
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenProviders}
            data-testid="finance-payments-providers-btn"
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              isLight
                ? 'border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50'
                : 'border-zinc-700 text-zinc-200 bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            Provedores de Pagamento
          </button>

          <button
            type="button"
            onClick={onOpenCreate}
            data-testid="finance-payments-create-btn"
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Registar Recebimento
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={onRefresh} className="underline hover:no-underline font-medium">
            Tentar novamente
          </button>
        </div>
      )}

      {/* List / Table */}
      <div className={`rounded-xl border overflow-hidden ${isLight ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'}`}>
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-500">A carregar recebimentos...</div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center" data-testid="finance-payments-empty">
            <svg className="w-12 h-12 mx-auto text-zinc-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className={`font-medium ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>Nenhum recebimento registado.</p>
            <p className={`text-sm mt-1 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Utilize o botão acima para registar o primeiro recebimento manual ou configure provedores.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="finance-payments-table">
              <thead className={`text-xs uppercase border-b ${isLight ? 'bg-zinc-50 text-zinc-500 border-zinc-200' : 'bg-zinc-800/60 text-zinc-400 border-zinc-800'}`}>
                <tr>
                  <th className="px-6 py-3">Referência</th>
                  <th className="px-6 py-3">Origem / Método</th>
                  <th className="px-6 py-3">Montante</th>
                  <th className="px-6 py-3">Data Efetiva</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3">Aplicação</th><th className="px-6 py-3">Documento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors" data-testid={`payment-row-${p.id}`}>
                    <td className="px-6 py-4 font-mono font-bold text-zinc-900 dark:text-zinc-100">
                      {p.paymentReference}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {formatMethod(p.method, p.sourceType)}
                      </div>
                      {p.manualEvidenceRef && (
                        <div className="text-xs text-zinc-500 font-mono">Ref: {p.manualEvidenceRef}</div>
                      )}
                      {p.providerTransactionRef && (
                        <div className="text-xs text-zinc-500 font-mono">PSP: {p.providerTransactionRef}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">
                      {p.amount} {p.currency}
                    </td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                      {new Date(p.effectiveAt).toLocaleDateString('pt-PT')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Confirmado
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        title="O valor está confirmado no caixa/banco mas ainda não foi alocado a obrigações específicas."
                      >
                        Não aplicado
                      </span>
                    </td>
                    <td className="px-6 py-4">{p.status === 'confirmed' && onIssueReceipt && (canIssueReceipt?.(p) ?? true) ? <button type="button" data-testid={`issue-receipt-${p.id}`} onClick={() => onIssueReceipt(p)} className="rounded-md border px-2 py-1 text-xs font-semibold">Emitir recibo oficial</button> : <span className="text-xs text-zinc-500">{receiptBlockReason?.(p) ?? 'Emissão não autorizada'}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
