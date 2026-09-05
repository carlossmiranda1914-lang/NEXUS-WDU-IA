import React from 'react';
import type { FinanceOperationalHistoryItem } from '../../../modules/finance/finance-operational-context-model.ts';

export interface FinanceOperationalHistoryProps {
  theme?: string;
  history: FinanceOperationalHistoryItem[];
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
              Linha temporal cronológica de obrigações e recebimentos
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
                      Obrigação
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

            return null;
          })
        )}
      </div>
    </div>
  );
}
