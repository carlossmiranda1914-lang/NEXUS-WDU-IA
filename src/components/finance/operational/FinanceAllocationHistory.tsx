import React from 'react';
import type { FinanceOperationalHistoryItem } from '../../../modules/finance/finance-operational-context-model.ts';

export function FinanceAllocationHistory({ history, onReverse }: { history: FinanceOperationalHistoryItem[]; onReverse?: (allocation: Extract<FinanceOperationalHistoryItem, { kind: 'allocation' }>['allocation']) => void }) {
  const allocations = history.filter((item): item is Extract<FinanceOperationalHistoryItem, { kind: 'allocation' }> => item.kind === 'allocation');
  if (!allocations.length) return null;
  return <section data-testid="finance-allocation-history"><h3 className="font-semibold">Histórico de associações</h3>{allocations.map(({ allocation }) => <article key={allocation.id}><p>{allocation.amount.amount} {allocation.amount.currency} associado</p>{allocation.reversals.map((reversal) => <p key={reversal.id}>Reversão: {reversal.amount.amount} {reversal.amount.currency} — {reversal.reason}</p>)}{onReverse && <button data-testid={`allocation-reverse-action-${allocation.id}`} type="button" onClick={() => onReverse(allocation)}>Reverter associação</button>}</article>)}</section>;
}
