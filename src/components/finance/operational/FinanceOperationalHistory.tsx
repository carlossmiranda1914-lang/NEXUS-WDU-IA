import React from 'react';
import type { FinanceOperationalHistoryItem } from '../../../modules/finance/finance-operational-context-model.ts';

export interface FinanceOperationalHistoryProps {
  theme?: string;
  history: FinanceOperationalHistoryItem[];
  onReverse?: (allocation: Extract<FinanceOperationalHistoryItem, { kind: 'allocation' }>['allocation']) => void;
  onIssueDebitNote?: (adjustment: Extract<FinanceOperationalHistoryItem, { kind: 'adjustment' }>['adjustment'] & { id: string }) => void;
  eligibleDebitNoteAdjustmentIds?: ReadonlySet<string>;
  onOpenObligation?: (obligationId: string) => void;
  onOpenPayment?: (paymentId: string) => void;
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
      hour: '2-digit',
      minute: '2-digit',
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

function allocationLabel(position: 'unapplied' | 'partially_allocated' | 'fully_allocated' | undefined): string {
  switch (position) {
    case 'unapplied': return 'Não aplicado';
    case 'partially_allocated': return 'Parcialmente aplicado';
    case 'fully_allocated': return 'Aplicado';
    default: return 'Estado de aplicação indisponível';
  }
}

export function FinanceOperationalHistory({
  theme = 'light',
  history,
  onReverse,
  onIssueDebitNote,
  eligibleDebitNoteAdjustmentIds = new Set(),
  onOpenObligation,
  onOpenPayment,
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
              Histórico Financeiro
            </h3>
            <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Movimentos cronológicos imutáveis: cobranças, recebimentos, correções e concessões
            </p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
          isLight ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-800 text-zinc-400'
        }`}>
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
                  className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 px-2 rounded-lg transition-colors"
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
                    <span className={`text-sm font-semibold font-mono ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
                      {formatMoney(ob.amount.amount, ob.amount.currency)}
                    </span>
                    {onOpenObligation && <button type="button" data-testid={`history-open-obligation-${ob.id}`} onClick={() => onOpenObligation(ob.id)} className="ml-3 text-xs font-semibold text-emerald-700">Abrir obrigação</button>}
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
                  className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 px-2 rounded-lg transition-colors"
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
                        {formatDate(item.occurredAt)} · Confirmado · Aplicação: {allocationLabel(pay.allocationPosition)}
                        {pay.payerPersonName ? ` · Pagador: ${pay.payerPersonName}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                      +{formatMoney(pay.amount.amount, pay.amount.currency)}
                    </span>
                    {onOpenPayment && <button type="button" data-testid={`history-open-payment-${pay.id}`} onClick={() => onOpenPayment(pay.id)} className="ml-3 text-xs font-semibold text-emerald-700">Abrir pagamento</button>}
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
                  className={`border-l-2 py-3.5 pl-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 rounded-r-lg transition-colors ${
                    isLight ? 'border-sky-300 text-zinc-900' : 'border-sky-700 text-zinc-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${isLight ? 'bg-sky-100 text-sky-800' : 'bg-sky-950/80 text-sky-200'}`}>
                        Associação
                      </span>
                      <div>
                        <p className="text-sm font-medium">Recebimento associado à cobrança</p>
                        <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          {formatDate(item.occurredAt)}
                        </p>
                      </div>
                    </div>
                    <strong className={`shrink-0 text-sm font-mono ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
                      {formatMoney(allocation.amount.amount, allocation.amount.currency)}
                    </strong>
                  </div>
                  {allocation.reversals.map((reversal) => (
                    <div key={reversal.id} data-testid={`history-item-reversal-${reversal.id}`} className={`ml-5 mt-2 border-l-2 py-2 pl-3 text-sm ${isLight ? 'border-amber-300 text-zinc-700' : 'border-amber-700 text-zinc-200'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-xs text-amber-700 dark:text-amber-400">↺ Associação revertida</span>
                        <strong className="font-mono text-xs">{formatMoney(reversal.amount.amount, reversal.amount.currency)}</strong>
                      </div>
                      <p className={`mt-1 text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {formatDate(reversal.occurredAt || reversal.effectiveAt)} · Motivo: {reversal.reason}
                      </p>
                    </div>
                  ))}
                  {onReverse && (
                    <button
                      data-testid={`allocation-reverse-action-${allocation.id}`}
                      type="button"
                      onClick={() => onReverse(allocation)}
                      className={`mt-3 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isLight ? 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50' : 'border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                      }`}
                    >
                      Reverter associação
                    </button>
                  )}
                  {(onOpenPayment || onOpenObligation) && <div className="mt-3 flex gap-3 text-xs font-semibold text-emerald-700">{onOpenPayment && <button type="button" data-testid={`allocation-open-payment-${allocation.id}`} onClick={() => onOpenPayment(allocation.paymentId)}>Abrir pagamento</button>}{onOpenObligation && <button type="button" data-testid={`allocation-open-obligation-${allocation.id}`} onClick={() => onOpenObligation(allocation.obligationId)}>Abrir obrigação</button>}</div>}
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
                  className={`border-l-2 py-3.5 pl-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 rounded-r-lg transition-colors ${
                    isLight ? 'border-violet-300 text-zinc-900' : 'border-violet-700 text-zinc-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${isLight ? 'bg-violet-100 text-violet-800' : 'bg-violet-950/80 text-violet-200'}`}>
                          Correção registada
                        </span>
                        <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
                          {adjustment.direction === 'increase' ? '↑ Aumento' : '↓ Redução'}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-medium">{adjustment.obligationDescription} · {direction}</p>
                      <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>{formatDate(item.occurredAt)} · Motivo: {adjustment.reason}</p>
                      {adjustment.compensatesAdjustmentId && <p className={`mt-1 text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>Compensa uma correção anterior.</p>}
                      {adjustment.basisType === 'debit_event' && <p className="mt-1 text-xs font-semibold text-violet-700">Evento de débito sujeito a validação documental.</p>}
                    </div>
                    <strong className={`shrink-0 text-sm font-mono ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
                      {adjustment.direction === 'increase' ? '+' : '-'}{formatMoney(adjustment.amount.amount, adjustment.amount.currency)}
                    </strong>
                  </div>
                  {eligibleDebitNoteAdjustmentIds.has(item.id) && onIssueDebitNote && <button type="button" data-testid={`debit-note-action-${item.id}`} onClick={() => onIssueDebitNote({ ...adjustment, id: item.id })} className="mt-2 rounded-md border px-3 py-1.5 text-xs font-medium">Emitir Nota de Débito</button>}
                </article>
              );
            }

            if (item.kind === 'discount_applied') {
              const discount = item.discount;
              return (
                <article
                  key={`discount-applied-${item.id}`}
                  data-testid={`history-item-discount-applied-${item.id}`}
                  className={`border-l-2 py-3.5 pl-4 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 rounded-r-lg transition-colors ${
                    isLight ? 'border-emerald-500 text-zinc-900' : 'border-emerald-500 text-zinc-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950/80 text-emerald-300'}`}>
                          % Desconto aplicado
                        </span>
                        <span className="font-mono text-xs font-bold px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
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
                    <strong className="shrink-0 text-sm font-mono text-emerald-600 dark:text-emerald-400 font-bold">
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
                  className={`border-l-2 py-3.5 pl-4 hover:bg-amber-50/30 dark:hover:bg-amber-950/10 rounded-r-lg transition-colors ${
                    isLight ? 'border-amber-500 text-zinc-900' : 'border-amber-500 text-zinc-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-950/80 text-amber-300'}`}>
                          ↺ Desconto revogado
                        </span>
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                          Restauro de saldo devido
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-medium">
                        {revocation.obligationDescription ? `${revocation.obligationDescription} · ` : ''}Compensação financeira
                      </p>
                      <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {formatDate(item.occurredAt)} · Motivo: {revocation.reason}
                        {revocation.actorName ? ` · Operador: ${revocation.actorName}` : ''}
                      </p>
                    </div>
                    <strong className={`shrink-0 text-sm font-mono ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
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
