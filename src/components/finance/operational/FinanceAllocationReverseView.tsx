import React, { useMemo, useState } from 'react';
import { Money } from '../../../modules/finance/money.ts';
import type { FinanceOperationalHistoryItem } from '../../../modules/finance/finance-operational-context-model.ts';

type AllocationHistory = Extract<FinanceOperationalHistoryItem, { kind: 'allocation' }>['allocation'];
export interface FinanceAllocationReverseViewProps {
  allocation: AllocationHistory;
  onReverse: (request: { amount: string; currency: string; reason: string }) => Promise<void>;
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
  const requestedPreview = (() => { try { return amount.trim() ? Money.parse(amount.trim(), allocation.amount.currency) : Money.parse('0', allocation.amount.currency); } catch { return Money.parse('0', allocation.amount.currency); } })();
  const afterPreview = requestedPreview.compare(remaining) <= 0 ? remaining.subtract(requestedPreview) : remaining;
  const useFull = () => { setAmount(remaining.canonicalAmount()); setError(null); };
  const confirm = async () => {
    const cleanAmount = amount.trim();
    if (!reason.trim()) { setError('A razão da reversão é obrigatória.'); return; }
    try {
      const requested = Money.parse(cleanAmount, allocation.amount.currency);
      if (requested.compare(Money.parse('0', allocation.amount.currency)) <= 0 || requested.compare(remaining) > 0) throw new Error();
    } catch { setError('Indique um valor positivo que não exceda o valor reversível.'); return; }
    setSubmitting(true); setError(null);
    try { await onReverse({ amount: cleanAmount, currency: allocation.amount.currency, reason: reason.trim() }); onSuccess(); }
    catch (cause: any) { setError(cause?.message || 'Não foi possível confirmar a reversão.'); }
    finally { setSubmitting(false); }
  };
  return <section data-testid="finance-allocation-reverse-view" className="mx-auto max-w-4xl space-y-6">
    <header className="rounded-xl border border-amber-300 bg-amber-50 p-5 dark:bg-amber-950"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Correção de associação</p><h2 className="text-2xl font-bold">Reverter associação</h2><p className="mt-2 font-medium">Reverter uma associação não devolve o dinheiro.</p><p className="mt-1 text-sm">O valor deixa de cobrir esta cobrança e volta a ficar disponível para ser associado novamente.</p></div><button type="button" onClick={onCancel} disabled={submitting} className="rounded-md border px-3 py-2 text-sm font-medium">Cancelar</button></div></header>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border p-4"><span className="text-sm text-zinc-600">Associação original</span><strong className="mt-1 block text-lg">{display(allocation.amount)}</strong></div><div className="rounded-lg border p-4"><span className="text-sm text-zinc-600">Já revertido</span><strong className="mt-1 block text-lg">{display(reversed.serialize())}</strong></div><div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950"><span className="text-sm font-medium">Disponível para reversão</span><strong className="mt-1 block text-xl">{display(remaining.serialize())}</strong></div></div>
    {error && <div role="alert" className="text-sm text-rose-700">{error}</div>}
    <div className="rounded-xl border p-5"><label className="block text-sm font-semibold">Valor a reverter<input className="mt-1 w-full rounded-md border px-3 py-2" data-testid="allocation-reversal-amount" type="text" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><button className="mt-2 rounded-md border px-3 py-2 text-sm font-medium" data-testid="allocation-reversal-full" type="button" onClick={useFull} disabled={submitting}>Usar valor reversível</button><label className="mt-4 block text-sm font-semibold">Motivo da reversão<span className="mt-1 block text-xs font-normal text-zinc-600">O motivo é obrigatório para o histórico.</span><input className="mt-1 w-full rounded-md border px-3 py-2" data-testid="allocation-reversal-reason" type="text" value={reason} onChange={(event) => setReason(event.target.value)} /></label></div>
    <section className="rounded-xl border bg-zinc-50 p-5 dark:bg-zinc-900"><h3 className="font-semibold">Impacto da reversão</h3><div className="mt-3 grid gap-3 text-sm sm:grid-cols-3"><div>Valor que será revertido<strong className="block">{display(requestedPreview.serialize())}</strong></div><div>Continuará associado<strong className="block">{display(afterPreview.serialize())}</strong></div><div>Volta a ficar disponível<strong className="block">{display(requestedPreview.serialize())}</strong></div></div><p className="mt-4 text-sm">A associação original continuará visível no histórico.</p></section>
    <button className="w-full rounded-md bg-amber-700 px-4 py-3 font-semibold text-white disabled:opacity-60" data-testid="allocation-reversal-confirm" type="button" onClick={confirm} disabled={submitting}>{submitting ? 'A confirmar...' : 'Confirmar reversão'}</button>
  </section>;
}
