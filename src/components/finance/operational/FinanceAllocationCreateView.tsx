import React, { useMemo, useState } from 'react';
import { Money } from '../../../modules/finance/money.ts';
import type { FinanceOperationalObligation, FinanceOperationalPayment } from '../../../modules/finance/finance-operational-context-model.ts';
import { allocationClient } from '../../../modules/finance/allocation-client.ts';

export interface FinanceAllocationCreateViewProps { theme?: string; payment: FinanceOperationalPayment; obligations: FinanceOperationalObligation[]; onSuccess: () => void; onCancel: () => void; }
const moneyText = (m: { amount: string; currency: string }) => `${m.amount} ${m.currency}`;
const isPositiveDecimal = (value: string) => /^\d+(?:\.\d+)?$/.test(value.trim()) && Money.parse(value.trim(), 'EUR').compare(Money.parse('0', 'EUR')) > 0;

export function FinanceAllocationCreateView({ theme = 'light', payment, obligations, onSuccess, onCancel }: FinanceAllocationCreateViewProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [review, setReview] = useState(false); const [error, setError] = useState<string | null>(null); const [submitting, setSubmitting] = useState(false);
  const received = payment.received || payment.amount; const unapplied = payment.unapplied || payment.amount;
  const eligible = useMemo(() => obligations.filter((ob) => (ob.uncovered || ob.amount).currency === unapplied.currency && ob.status === 'open' && (ob.uncovered || ob.amount).amount !== '0'), [obligations, unapplied.currency]);
  const lines = eligible.flatMap((ob) => values[ob.id]?.trim() ? [{ obligationId: ob.id, amount: values[ob.id].trim(), currency: unapplied.currency }] : []);
  const total = useMemo(() => { try { return lines.reduce((sum, line) => sum.add(Money.parse(line.amount, unapplied.currency)), Money.parse('0', unapplied.currency)); } catch { return null; } }, [lines, unapplied.currency]);
  const remainder = total ? Money.parse(unapplied.amount, unapplied.currency).subtract(total) : null;
  const validate = () => {
    if (!lines.length || lines.some((line) => !isPositiveDecimal(line.amount))) return 'Introduza pelo menos um valor positivo exato.';
    if (!total || total.compare(Money.parse(unapplied.amount, unapplied.currency)) > 0) return 'O total não pode exceder o valor por associar.';
    for (const line of lines) { const ob = eligible.find((item) => item.id === line.obligationId)!; if (Money.parse(line.amount, unapplied.currency).compare(Money.parse((ob.uncovered || ob.amount).amount, unapplied.currency)) > 0) return 'O valor não pode exceder o valor por cobrir da cobrança.'; }
    return null;
  };
  const beginReview = (event: React.FormEvent) => { event.preventDefault(); const issue = validate(); setError(issue); if (!issue) setReview(true); };
  const confirm = async () => { setSubmitting(true); setError(null); try { await allocationClient.confirm({ paymentId: payment.id, lines, effectiveAt: new Date().toISOString() }); onSuccess(); } catch (e: any) { setError(e?.message || 'Não foi possível confirmar a associação.'); setReview(false); } finally { setSubmitting(false); } };
  return <div data-testid="finance-allocation-create-view" className="space-y-5">
    <div className="flex justify-between"><div><h2 className="text-xl font-bold">Associar recebimento</h2><p className="text-sm text-zinc-500">Escolha explicitamente as cobranças e os valores a associar.</p></div><button type="button" onClick={onCancel}>Voltar</button></div>
    {error && <div role="alert" className="text-sm text-rose-700">{error}</div>}
    {!review ? <form onSubmit={beginReview} className="space-y-4"><div className="grid grid-cols-3 gap-3 text-sm"><div><span>Valor recebido</span><strong className="block">{moneyText(received)}</strong></div><div><span>Valor já associado</span><strong className="block">{moneyText(payment.allocated || { amount: '0', currency: received.currency })}</strong></div><div><span>Valor por associar</span><strong className="block">{moneyText(unapplied)}</strong></div></div><fieldset><legend className="font-semibold">Cobranças elegíveis</legend>{eligible.map((ob) => <label key={ob.id} className="block py-3" data-testid={`allocation-obligation-${ob.id}`}><span className="block">{ob.description} — original: {moneyText(ob.original || ob.amount)} · por cobrir: {moneyText(ob.uncovered || ob.amount)}</span><span>Valor a associar</span><input data-testid={`allocation-amount-${ob.id}`} type="text" inputMode="decimal" value={values[ob.id] || ''} onChange={(e) => setValues({ ...values, [ob.id]: e.target.value })} /></label>)}</fieldset><button data-testid="allocation-review-btn" type="submit">Rever associação</button></form> : <div className="space-y-4"><h3 className="font-bold">Rever associação</h3>{lines.map((line) => <p key={line.obligationId}>{eligible.find((ob) => ob.id === line.obligationId)?.description}: {line.amount} {unapplied.currency}</p>)}<p data-testid="allocation-review-remainder">{remainder?.serialize().amount} {unapplied.currency} por associar</p><p>O servidor confirma a elegibilidade e os valores antes de gravar.</p><button type="button" onClick={() => setReview(false)} disabled={submitting}>Corrigir valores</button><button data-testid="allocation-confirm-btn" type="button" onClick={confirm} disabled={submitting}>{submitting ? 'A confirmar...' : 'Confirmar associação'}</button></div>}
  </div>;
}
