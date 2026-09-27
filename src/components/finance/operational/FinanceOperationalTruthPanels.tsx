import React, { useState } from 'react';
import type {
  FinanceOperationalObligation,
  FinanceOperationalPayment,
} from '../../../modules/finance/finance-operational-context-model.ts';

export interface FinanceOperationalTruthPanelsProps {
  theme?: string;
  openObligations: FinanceOperationalObligation[];
  confirmedUnallocatedPayments: FinanceOperationalPayment[];
  onAllocatePayment?: (paymentId: string) => void;
  onRegisterAdjustment?: (obligation: FinanceOperationalObligation) => void;
  onApplyDiscount?: (obligation: FinanceOperationalObligation) => void;
  onRevokeDiscount?: (obligation: FinanceOperationalObligation) => void;
  onOpenObligation?: (obligationId: string) => void;
  onOpenPayment?: (paymentId: string) => void;
}

function formatMoney(amount: string, currency: string): string {
  // Values here are canonical Money strings; presentation must not turn them
  // into floating-point authority.
  return `${amount} ${currency}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function methodLabel(method: string): string {
  switch (method) {
    case 'cash':
      return 'Dinheiro / Numerário';
    case 'bank_transfer':
      return 'Transferência Bancária';
    case 'pos_terminal':
      return 'Terminal POS';
    case 'check':
      return 'Cheque';
    default:
      return method;
  }
}

export function FinanceOperationalTruthPanels({
  theme = 'light',
  openObligations,
  confirmedUnallocatedPayments,
  onAllocatePayment,
  onRegisterAdjustment,
  onApplyDiscount,
  onRevokeDiscount,
  onOpenObligation,
  onOpenPayment,
}: FinanceOperationalTruthPanelsProps) {
  const isLight = theme === 'light';
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Panel 1: Cobranças em aberto */}
      <div
        data-testid="finance-panel-open-obligations"
        className={`p-6 rounded-xl border flex flex-col justify-between ${
          isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg ${isLight ? 'bg-amber-50 text-amber-600' : 'bg-amber-950/40 text-amber-400'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className={`font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
                  Cobranças em aberto
                </h3>
                <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Valores devidos pendentes nesta conta
                </p>
              </div>
            </div>
            <span
              data-testid="open-obligations-count"
              className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                openObligations.length > 0
                  ? isLight
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                  : isLight
                  ? 'bg-zinc-100 text-zinc-600'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {openObligations.length} {openObligations.length === 1 ? 'item' : 'itens'}
            </span>
          </div>

          <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-[380px] overflow-y-auto">
            {openObligations.length === 0 ? (
              <div className="py-12 text-center">
                <svg className="w-8 h-8 mx-auto mb-2 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className={`text-sm ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Não existem cobranças em aberto para esta conta.
                </p>
              </div>
            ) : (
              openObligations.map((ob) => (
                <div key={ob.id} data-testid={`obligation-item-${ob.id}`} className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <p className={`text-sm font-medium ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
                      {ob.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                      <span>Emitido: {formatDate(ob.effectiveAt)}</span>
                      {ob.dueAt && (
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          Vencimento: {formatDate(ob.dueAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
                      Original: {formatMoney((ob.original || ob.amount).amount, (ob.original || ob.amount).currency)}
                    </span>
                    {ob.covered && ob.uncovered && (
                      <span className="block text-xs text-zinc-500">
                        Coberto: {formatMoney(ob.covered.amount, ob.covered.currency)} · Por cobrir: {formatMoney(ob.uncovered.amount, ob.uncovered.currency)}
                      </span>
                    )}
                    {(onRegisterAdjustment || onApplyDiscount || onRevokeDiscount || onOpenObligation) && (
                      <div className="relative mt-2 inline-block">
                        <button
                          type="button"
                          data-testid={`obligation-actions-${ob.id}`}
                          aria-label={`Mais ações para ${ob.description}`}
                          aria-expanded={openMenuId === ob.id}
                          onClick={() => setOpenMenuId(openMenuId === ob.id ? null : ob.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') setOpenMenuId(null);
                          }}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                            isLight
                              ? 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 shadow-xs'
                              : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                          }`}
                        >
                          Ações ▾
                        </button>
                        {openMenuId === ob.id && (
                          <div
                            role="menu"
                            className={`absolute right-0 z-20 mt-1 min-w-56 rounded-xl border p-1.5 shadow-xl ${
                              isLight ? 'border-zinc-200 bg-white text-zinc-900' : 'border-zinc-700 bg-zinc-900 text-zinc-100'
                            }`}
                          >
                            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 mb-1">
                              Operações da Cobrança
                            </div>
                            {onOpenObligation && <button type="button" role="menuitem" data-testid={`open-obligation-${ob.id}`} onClick={() => { setOpenMenuId(null); onOpenObligation(ob.id); }} className="w-full rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800">Abrir obrigação</button>}

                            {!ob.activeDiscount && onApplyDiscount && (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  onApplyDiscount(ob);
                                }}
                                className="w-full rounded-lg px-2.5 py-2 text-left text-xs flex items-center gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors group"
                              >
                                <span className="inline-flex items-center justify-center h-5 w-5 rounded font-bold text-[11px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                                  %
                                </span>
                                <div>
                                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                                    Aplicar desconto institucional
                                  </p>
                                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                    Conceder bolsa ou redução regrada
                                  </p>
                                </div>
                              </button>
                            )}

                            {onRegisterAdjustment && (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  onRegisterAdjustment(ob);
                                }}
                                className="w-full rounded-lg px-2.5 py-2 text-left text-xs flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              >
                                <span className="inline-flex items-center justify-center h-5 w-5 rounded font-bold text-[11px] bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200">
                                  ±
                                </span>
                                <div>
                                  <p className="font-medium text-zinc-800 dark:text-zinc-200">
                                    Registar correção
                                  </p>
                                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                    Ajuste de valor por erro ou retificação
                                  </p>
                                </div>
                              </button>
                            )}

                            {ob.activeDiscount && onRevokeDiscount && (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  onRevokeDiscount(ob);
                                }}
                                className="w-full rounded-lg px-2.5 py-2 text-left text-xs flex items-center gap-2 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors border-t border-zinc-100 dark:border-zinc-800 mt-1 pt-1.5"
                              >
                                <span className="inline-flex items-center justify-center h-5 w-5 rounded font-bold text-[11px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                  ↺
                                </span>
                                <div>
                                  <p className="font-semibold text-amber-700 dark:text-amber-400">
                                    Revogar desconto
                                  </p>
                                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                    Restaurar saldo ({ob.activeDiscount.policyCode})
                                  </p>
                                </div>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Panel 2: Recebimentos por associar */}
      <div
        data-testid="finance-panel-unallocated-payments"
        className={`p-6 rounded-xl border flex flex-col justify-between ${
          isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg ${isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-950/40 text-emerald-400'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className={`font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
                  Recebimentos por associar
                </h3>
                <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Pagamentos recebidos que ainda não foram associados a uma cobrança.
                </p>
              </div>
            </div>
            <span
              data-testid="unallocated-payments-count"
              className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                confirmedUnallocatedPayments.length > 0
                  ? isLight
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                  : isLight
                  ? 'bg-zinc-100 text-zinc-600'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {confirmedUnallocatedPayments.length} {confirmedUnallocatedPayments.length === 1 ? 'recebimento' : 'recebimentos'}
            </span>
          </div>

          <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-[380px] overflow-y-auto">
            {confirmedUnallocatedPayments.length === 0 ? (
              <div className="py-12 text-center">
                <svg className="w-8 h-8 mx-auto mb-2 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className={`text-sm ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Não existem recebimentos por associar.
                </p>
              </div>
            ) : (
              confirmedUnallocatedPayments.map((pay) => (
                <div key={pay.id} data-testid={`payment-item-${pay.id}`} className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                        {pay.paymentReference}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                        Confirmado · {pay.allocationPosition === 'partially_allocated' ? 'Parcialmente associado' : 'Por associar'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                      <span>Método: {methodLabel(pay.method)}</span>
                      <span>Data: {formatDate(pay.effectiveAt)}</span>
                      {pay.payerPersonName && <span>Pagador: {pay.payerPersonName}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      Valor recebido: +{formatMoney((pay.received || pay.amount).amount, (pay.received || pay.amount).currency)}
                    </span>
                    {pay.allocated && pay.unapplied && <span className="block text-xs text-zinc-500">Já associado: {formatMoney(pay.allocated.amount, pay.allocated.currency)} · Por associar: {formatMoney(pay.unapplied.amount, pay.unapplied.currency)}</span>}
                    {pay.status === 'confirmed' && (pay.unapplied || pay.amount).amount !== '0' && onAllocatePayment && <button type="button" data-testid={`allocate-payment-${pay.id}`} onClick={() => onAllocatePayment(pay.id)} className="mt-2 text-xs font-semibold text-emerald-700">Associar recebimento</button>}
                    {onOpenPayment && <button type="button" data-testid={`open-payment-${pay.id}`} onClick={() => onOpenPayment(pay.id)} className="ml-3 mt-2 text-xs font-semibold text-emerald-700">Abrir pagamento</button>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FinanceOperationalTruthPanels;
