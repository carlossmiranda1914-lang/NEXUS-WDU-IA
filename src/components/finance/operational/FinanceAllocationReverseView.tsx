import React, { useMemo, useState } from 'react';
import { Money } from '../../../modules/finance/money.ts';
import type { FinanceOperationalHistoryItem } from '../../../modules/finance/finance-operational-context-model.ts';

type AllocationHistory = Extract<FinanceOperationalHistoryItem, { kind: 'allocation' }>['allocation'];
export interface FinanceAllocationReverseViewProps {
  allocation: AllocationHistory;
  onReverse: (request: { amount: string; reason: string }) => Promise<void>;
  onSuccess: () => void;
  onCancel: () => void;
}

const display = (money: { amount: string; currency: string }) => `${money.amount} ${money.currency}`;

export function FinanceAllocationReverseView({ allocation, onReverse, onSuccess, onCancel }: FinanceAllocationReverseViewProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const reversed = useMemo(() => allocation.reversals.reduce((total, reversal) => total.add(Money.parse(reversal.amount.amount, reversal.amount.currency)), Money.parse('0', allocation.amount.currency)), [allocation]);
  const remaining = Money.parse(allocation.amount.amount, allocation.amount.currency).subtract(reversed);
  const useFull = () => { setAmount(remaining.canonicalAmount()); setError(null); };
  const confirm = async () => {
    const cleanAmount = amount.trim();
    if (!reason.trim()) { setError('A razão da reversão é obrigatória.'); return; }
    try {
      const requested = Money.parse(cleanAmount, allocation.amount.currency);
      if (requested.compare(Money.parse('0', allocation.amount.currency)) <= 0 || requested.compare(remaining) > 0) throw new Error();
    } catch { setError('Indique um valor positivo que não exceda o valor reversível.'); return; }
    setSubmitting(true); setError(null);
    try { await onReverse({ amount: cleanAmount, reason: reason.trim() }); onSuccess(); }
    catch (cause: any) { setError(cause?.message || 'Não foi possível confirmar a reversão.'); }
    finally { setSubmitting(false); }
  };
  return <section data-testid="finance-allocation-reverse-view" className="space-y-5">
    <div className="flex justify-between"><div><h2 className="text-xl font-bold">Reverter associação</h2><p className="text-sm text-zinc-500">Esta correção cria uma reversão imutável; não altera o recebimento nem a cobrança original.</p></div><button type="button" onClick={onCancel}>Voltar</button></div>
    <div className="grid grid-cols-3 gap-3 text-sm"><div><span>Associação original</span><strong className="block">{display(allocation.amount)} associado</strong></div><div><span>Já revertido</span><strong className="block">{display(reversed.serialize())} já revertido</strong></div><div><span>Disponível para reversão</span><strong className="block">{display(remaining.serialize())} reversível</strong></div></div>
    {error && <div role="alert" className="text-sm text-rose-700">{error}</div>}
    <label className="block text-sm font-medium">Valor a reverter<input data-testid="allocation-reversal-amount" type="text" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
    <button data-testid="allocation-reversal-full" type="button" onClick={useFull} disabled={submitting}>Reverter valor restante</button>
    <label className="block text-sm font-medium">Razão obrigatória<input data-testid="allocation-reversal-reason" type="text" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    <p className="text-sm">Confirma a reversão de {amount || '—'} {allocation.amount.currency}; a associação original permanece no histórico.</p>
    <button data-testid="allocation-reversal-confirm" type="button" onClick={confirm} disabled={submitting}>{submitting ? 'A confirmar...' : 'Confirmar reversão'}</button>
  </section>;
}
