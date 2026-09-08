import React from 'react';
import type { FinanceOperationalHistoryItem } from '../../../modules/finance/finance-operational-context-model.ts';

export interface FinanceOperationalHistoryProps {
  theme?: string;
  history: FinanceOperationalHistoryItem[];
  onReverse?: (allocation: Extract<FinanceOperationalHistoryItem, { kind: 'allocation' }>['allocation']) => void;
}

function formatMoney(amount: string, currency: string): string {
  const num = Number(amount);
  if (isNaN(num)) return `${amount} ${currency}`;
  return `${num.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
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
      return 'Dinheiro';
    case 'bank_transfer':
      return 'Transferência';
    case 'pos_terminal':
      return 'POS';
    case 'check':
      return 'Cheque';
    default:
      return method;
  }
}

export function FinanceOperationalHistory({
  theme = 'light',
  history,
  onReverse,
}: FinanceOperationalHistoryProps) {
  const isLight = theme === 'light';

  return (
    <div
      data-testid="finance-operational-history"
      className={`p-6 rounded-xl border ${
        isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-zinc-800'
      }`}
    >
      <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${isLight ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-800 text-zinc-300'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className={`font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
              Histórico financeiro
            </h3>
            <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Linha temporal cronológica de cobranças e recebimentos
            </p>
          </div>
        </div>
        <span className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {history.length} {history.length === 1 ? 'registo' : 'registos'}
        </span>
      </div>

      <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800/80">
        {history.length === 0 ? (
          <div className="py-12 text-center">
            <svg className="w-8 h-8 mx-auto mb-2 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className={`text-sm ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Nenhum movimento histórico registado para esta conta.
            </p>
          </div>
        ) : (
          history.map((item) => {
            if (item.kind === 'obligation') {
              const ob = item.obligation;
              return (
                <div
                  key={`ob-${item.id}`}
                  data-testid={`history-item-obligation-${item.id}`}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                      isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-950/80 text-amber-300'
                    }`}>
                      Cobrança
                    </span>
                    <div>
                      <p className={`text-sm font-medium ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
                        {ob.description}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {formatDate(item.occurredAt)} · Estado: {ob.status === 'open' ? 'Em aberto' : ob.status}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
                      {formatMoney(ob.amount.amount, ob.amount.currency)}
                    </span>
                  </div>
                </div>
              );
            }

            if (item.kind === 'payment') {
              const pay = item.payment;
              return (
                <div
                  key={`pay-${item.id}`}
                  data-testid={`history-item-payment-${item.id}`}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                      isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950/80 text-emerald-300'
                    }`}>
                      Recebimento
                    </span>
                    <div>
                      <p className={`text-sm font-medium ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
                        {pay.paymentReference} · {methodLabel(pay.method)}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {formatDate(item.occurredAt)} · Confirmado (Não aplicado)
                        {pay.payerPersonName ? ` · Pagador: ${pay.payerPersonName}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      +{formatMoney(pay.amount.amount, pay.amount.currency)}
                    </span>
                  </div>
                </div>
              );
            }

            if (item.kind === 'allocation') {
              const allocation = item.allocation;
              return (
                <article
                  key={`allocation-${item.id}`}
                  data-testid={`history-item-allocation-${item.id}`}
                  className={`border-l-2 py-3.5 pl-4 ${
                    isLight ? 'border-sky-300 text-zinc-900' : 'border-sky-700 text-zinc-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${isLight ? 'bg-sky-100 text-sky-800' : 'bg-sky-950/80 text-sky-200'}`}>Recebimento associado</span>
                      <div><p className="text-sm font-medium">Associação registada</p><p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>{formatDate(item.occurredAt)}</p></div>
                    </div>
                    <strong className={`shrink-0 text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{formatMoney(allocation.amount.amount, allocation.amount.currency)}</strong>
                  </div>
                  {allocation.reversals.map((reversal) => (
                    <div key={reversal.id} data-testid={`history-item-reversal-${reversal.id}`} className={`ml-5 mt-2 border-l-2 py-2 pl-3 text-sm ${isLight ? 'border-amber-300 text-zinc-700' : 'border-amber-700 text-zinc-200'}`}>
                      <div className="flex items-center justify-between gap-3"><span className="font-semibold">Associação revertida</span><strong>{formatMoney(reversal.amount.amount, reversal.amount.currency)}</strong></div>
                      <p className={`mt-1 text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>{formatDate(reversal.occurredAt || reversal.effectiveAt)} · Motivo: {reversal.reason}</p>
                    </div>
                  ))}
                  {onReverse && <button data-testid={`allocation-reverse-action-${allocation.id}`} type="button" onClick={() => onReverse(allocation)} className={`mt-3 rounded-md border px-3 py-2 text-sm font-medium ${isLight ? 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50' : 'border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'}`}>Reverter associação</button>}
                </article>
              );
            }

            if (item.kind === 'adjustment') {
              const adjustment = item.adjustment;
              const direction = adjustment.direction === 'increase' ? 'Aumento do valor devido' : 'Redução do valor devido';
              return (
                <article
                  key={`adjustment-${item.id}`}
                  data-testid={`history-item-adjustment-${item.id}`}
                  className={`border-l-2 py-3.5 pl-4 ${
                    isLight ? 'border-violet-300 text-zinc-900' : 'border-violet-700 text-zinc-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${isLight ? 'bg-violet-100 text-violet-800' : 'bg-violet-950/80 text-violet-200'}`}>Correção registada</span>
                      <p className="mt-2 text-sm font-medium">{adjustment.obligationDescription} · {direction}</p>
                      <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>{formatDate(item.occurredAt)} · Motivo: {adjustment.reason}</p>
                      {adjustment.compensatesAdjustmentId && <p className={`mt-1 text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>Compensa uma correção anterior.</p>}
                    </div>
                    <strong className={`shrink-0 text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{adjustment.direction === 'increase' ? '+' : '-'}{formatMoney(adjustment.amount.amount, adjustment.amount.currency)}</strong>
                  </div>
                </article>
              );
            }

            if (item.kind === 'discount_applied') {
              const discount = item.discount;
              return (
                <article
                  key={`discount-applied-${item.id}`}
                  data-testid={`history-item-discount-applied-${item.id}`}
                  className={`border-l-2 py-3.5 pl-4 ${
                    isLight ? 'border-emerald-400 text-zinc-900' : 'border-emerald-600 text-zinc-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950/80 text-emerald-300'}`}>
                          Desconto aplicado
                        </span>
                        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {discount.policyCode}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-medium">
                        {discount.policyName}
                        {discount.obligationDescription ? ` · ${discount.obligationDescription}` : ''}
                      </p>
                      <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {formatDate(item.occurredAt)} · Motivo: {discount.reason}
                        {discount.actorName ? ` · Operador: ${discount.actorName}` : ''}
                      </p>
                    </div>
                    <strong className="shrink-0 text-sm text-emerald-600 dark:text-emerald-400">
                      -{formatMoney(discount.amount.amount, discount.amount.currency)}
                    </strong>
                  </div>
                </article>
              );
            }

            if (item.kind === 'discount_revoked') {
              const revocation = item.revocation;
              return (
                <article
                  key={`discount-revoked-${item.id}`}
                  data-testid={`history-item-discount-revoked-${item.id}`}
                  className={`border-l-2 py-3.5 pl-4 ${
                    isLight ? 'border-amber-400 text-zinc-900' : 'border-amber-600 text-zinc-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-950/80 text-amber-300'}`}>
                        Desconto revogado
                      </span>
                      <p className="mt-1.5 text-sm font-medium">
                        {revocation.obligationDescription ? `${revocation.obligationDescription} · ` : ''}Restauro de saldo devido
                      </p>
                      <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {formatDate(item.occurredAt)} · Motivo: {revocation.reason}
                        {revocation.actorName ? ` · Operador: ${revocation.actorName}` : ''}
                      </p>
                    </div>
                    <strong className={`shrink-0 text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
                      +{formatMoney(revocation.amount.amount, revocation.amount.currency)}
                    </strong>
                  </div>
                </article>
              );
            }

            return null;
          })
        )}
      </div>
    </div>
  );
}

export default FinanceOperationalHistory;
