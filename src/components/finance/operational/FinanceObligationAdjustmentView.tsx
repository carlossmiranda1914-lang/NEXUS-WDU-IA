import React, { useState } from 'react';
import type { FinanceOperationalObligation } from '../../../modules/finance/finance-operational-context-model.ts';
import { Money } from '../../../modules/finance/money.ts';

type Input = {
  direction: 'increase' | 'decrease';
  amount: string;
  currency: string;
  reason: string;
  basisType: 'general' | 'debit_event';
};

export interface FinanceObligationAdjustmentViewProps {
  theme?: string;
  obligations: FinanceOperationalObligation[];
  onCancel: () => void;
  onSubmit: (id: string, input: Input) => Promise<void>;
}

export function FinanceObligationAdjustmentView({
  theme = 'light',
  obligations,
  onCancel,
  onSubmit,
}: FinanceObligationAdjustmentViewProps) {
  const isLight = theme === 'light';
  const [id, setId] = useState(obligations[0]?.id ?? '');
  const [direction, setDirection] = useState<Input['direction']>('decrease');
  const [basisType, setBasisType] = useState<Input['basisType']>('general');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const item = obligations.find((x) => x.id === id);
  const currency = item?.amount.currency ?? 'EUR';
  const original = item?.original?.amount ?? item?.amount.amount ?? '0';
  const effective = item?.effectiveDue?.amount ?? original;
  const covered = item?.covered?.amount ?? '0';
  const remaining = item?.remainingCoverable?.amount ?? item?.uncovered?.amount ?? '0';

  const preview = (() => {
    if (!item || !amount.trim()) return null;
    try {
      const current = Money.parse(effective, currency);
      const alreadyCovered = Money.parse(covered, currency);
      const change = Money.parse(amount, currency);
      if (change.compare(Money.parse('0', currency)) <= 0) throw new Error();
      const projected = direction === 'decrease' ? current.subtract(change) : current.add(change);
      const projectedRemaining = projected.subtract(alreadyCovered);
      return {
        change: change.canonicalAmount(),
        effective: projected.canonicalAmount(),
        remaining: projectedRemaining.canonicalAmount(),
        belowCovered: projectedRemaining.compare(Money.parse('0', currency)) < 0,
      };
    } catch {
      return { invalid: true as const };
    }
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !amount.trim() || !reason.trim()) {
      setError('Indique obrigação, valor e motivo.');
      return;
    }
    if (preview?.invalid) {
      setError('Introduza um valor decimal válido.');
      return;
    }
    if (preview?.belowCovered) {
      setError('A redução projetada ficaria abaixo do valor já coberto.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit(id, {
        direction,
        amount: amount.trim(),
        currency,
        reason: reason.trim(),
        basisType,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registar a correção.');
    } finally {
      setBusy(false);
    }
  };

  const suggestions = [
    'Erro administrativo',
    'Valor lançado incorretamente',
    'Correção autorizada',
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px] motion-reduce:backdrop-blur-none transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Registar correção"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
        className={`relative flex h-full w-full max-w-lg flex-col border-l shadow-2xl transition-transform duration-200 motion-reduce:transition-none ${
          isLight
            ? 'border-zinc-200 bg-white text-zinc-900'
            : 'border-zinc-800 bg-zinc-900 text-zinc-100'
        }`}
      >
        {/* Drawer Header */}
        <div
          className={`flex items-start justify-between border-b px-6 py-5 ${
            isLight ? 'border-zinc-100 bg-zinc-50/50' : 'border-zinc-800/80 bg-zinc-950/40'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center justify-center rounded-md p-1.5 ${
                  isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-950/60 text-emerald-400'
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </span>
              <h2 className="text-base font-bold tracking-tight">Registar correção</h2>
            </div>
            <p className={`text-xs leading-relaxed ${isLight ? 'text-zinc-600' : 'text-zinc-300'}`}>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{item?.description}</span>
              {' · '}Esta correção não altera a cobrança original. Fica registada no histórico.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fechar gaveta"
            className={`-mr-2 -mt-1 rounded-lg p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors ${
              isLight ? 'hover:bg-zinc-100' : 'hover:bg-zinc-800'
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={handleSubmit}
          data-testid="obligation-adjustment-form"
          className="flex flex-1 flex-col justify-between overflow-y-auto"
        >
          <div className="space-y-5 p-6">
            {/* Context Position Summary */}
            <div
              data-testid="adjustment-current-position"
              className={`grid grid-cols-2 gap-3 rounded-xl border p-3.5 text-xs ${
                isLight
                  ? 'border-zinc-200/80 bg-zinc-50/80 text-zinc-700'
                  : 'border-zinc-800 bg-zinc-950/60 text-zinc-300'
              }`}
            >
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Valor original</span>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {original} {currency}
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Já coberto</span>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {covered} {currency}
                </p>
              </div>
            </div>

            {/* Decision: Segmented Control */}
            <fieldset className="space-y-2">
              <legend className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                O que pretende corrigir?
              </legend>
              <div
                className={`grid grid-cols-2 gap-1.5 rounded-xl border p-1 ${
                  isLight ? 'border-zinc-200 bg-zinc-100/80' : 'border-zinc-800 bg-zinc-950'
                }`}
              >
                <button
                  type="button"
                  onClick={() => { setDirection('decrease'); setBasisType('general'); }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all duration-150 motion-reduce:transition-none ${
                    direction === 'decrease'
                      ? isLight
                        ? 'bg-white text-emerald-800 shadow-sm border border-emerald-200/60'
                        : 'bg-zinc-800 text-emerald-300 shadow-sm border border-emerald-800/60'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                  }`}
                >
                  ↓ Reduzir valor
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('increase')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all duration-150 motion-reduce:transition-none ${
                    direction === 'increase'
                      ? isLight
                        ? 'bg-white text-sky-800 shadow-sm border border-sky-200/60'
                        : 'bg-zinc-800 text-sky-300 shadow-sm border border-sky-800/60'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                  }`}
                >
                  ↑ Aumentar valor
                </button>
              </div>
            </fieldset>

            {direction === 'increase' ? (
              <fieldset className="space-y-2" data-testid="adjustment-basis-selector">
                <legend className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Natureza do aumento
                </legend>
                <div className={`grid grid-cols-1 gap-1.5 rounded-xl border p-1 ${isLight ? 'border-zinc-200 bg-zinc-100/80' : 'border-zinc-800 bg-zinc-950'}`}>
                  <button
                    type="button"
                    onClick={() => setBasisType('general')}
                    className={`rounded-lg px-3 py-2 text-left text-xs font-semibold transition-all ${basisType === 'general' ? (isLight ? 'border border-sky-200/60 bg-white text-sky-800 shadow-sm' : 'border border-sky-800/60 bg-zinc-800 text-sky-300 shadow-sm') : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}`}
                  >
                    Ajuste financeiro geral
                  </button>
                  <button
                    type="button"
                    onClick={() => setBasisType('debit_event')}
                    className={`rounded-lg px-3 py-2 text-left text-xs font-semibold transition-all ${basisType === 'debit_event' ? (isLight ? 'border border-sky-200/60 bg-white text-sky-800 shadow-sm' : 'border border-sky-800/60 bg-zinc-800 text-sky-300 shadow-sm') : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}`}
                  >
                    Evento de débito sujeito a validação documental
                  </button>
                </div>
                <p className={`text-xs leading-relaxed ${isLight ? 'text-zinc-600' : 'text-zinc-300'}`}>
                  Esta classificação descreve o facto financeiro; não garante a emissão de qualquer documento.
                </p>
              </fieldset>
            ) : (
              <p className={`text-xs ${isLight ? 'text-zinc-600' : 'text-zinc-300'}`} data-testid="adjustment-general-basis">
                Ajuste financeiro geral
              </p>
            )}

            {/* Value Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="adjustment-amount-input"
                className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
              >
                Quanto pretende corrigir?
              </label>
              <div className="relative">
                <input
                  id="adjustment-amount-input"
                  aria-label="Valor"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                    isLight
                      ? 'border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400'
                      : 'border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600'
                  }`}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">
                  {currency}
                </span>
              </div>
            </div>

            {/* Financial Preview: Antes → Correção → Depois */}
            {preview &&
              ('invalid' in preview ? (
                <div
                  role="alert"
                  className={`rounded-xl border p-3.5 text-xs font-medium ${
                    isLight ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-amber-900/60 bg-amber-950/40 text-amber-300'
                  }`}
                >
                  Introduza um valor decimal válido.
                </div>
              ) : (
                <div
                  data-testid="adjustment-projected-position"
                  className={`rounded-xl border p-4 space-y-2.5 transition-all duration-150 motion-reduce:transition-none ${
                    preview.belowCovered
                      ? isLight
                        ? 'border-rose-300 bg-rose-50/80 text-rose-900'
                        : 'border-rose-800 bg-rose-950/40 text-rose-200'
                      : isLight
                      ? 'border-emerald-200/90 bg-emerald-50/50 text-zinc-900'
                      : 'border-emerald-800/60 bg-emerald-950/30 text-zinc-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Projeção financeira
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        preview.belowCovered
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                          : direction === 'decrease'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                          : 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200'
                      }`}
                    >
                      {direction === 'decrease' ? 'Redução' : 'Aumento'} de {preview.change} {currency}
                    </span>
                  </div>

                  <p className="text-base font-bold tracking-tight">
                    {effective} {currency} → {preview.effective} {currency}
                  </p>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-200/60 dark:border-zinc-800/80">
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Já coberto <strong>{covered} {currency}</strong>
                    </span>
                    <span className="text-zinc-900 dark:text-zinc-100 font-semibold">
                      Ficará por cobrar {preview.remaining} {currency}
                    </span>
                  </div>

                  {preview.belowCovered && (
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 pt-1">
                      Este valor não pode ser reduzido. Máximo: {remaining} {currency}.
                    </p>
                  )}
                </div>
              ))}

            {/* Reason */}
            <div className="space-y-1.5">
              <label
                htmlFor="adjustment-reason-input"
                className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
              >
                Porquê?
              </label>
              <textarea
                id="adjustment-reason-input"
                aria-label="Motivo obrigatório"
                rows={2}
                placeholder="Indique a justificação da correção..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                  isLight
                    ? 'border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600'
                }`}
              />
            </div>

            {/* Reason Suggestions */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Sugestões frequentes
              </span>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((val) => (
                  <button
                    type="button"
                    key={val}
                    onClick={() => setReason(val)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all duration-150 motion-reduce:transition-none ${
                      reason === val
                        ? isLight
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : 'border-emerald-700 bg-emerald-950/60 text-emerald-300'
                        : isLight
                        ? 'border-zinc-200 bg-zinc-50/60 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div
                role="alert"
                className={`rounded-xl border p-3.5 text-xs font-semibold ${
                  isLight
                    ? 'border-rose-200 bg-rose-50 text-rose-800'
                    : 'border-rose-800 bg-rose-950/60 text-rose-300'
                }`}
              >
                {error}
              </div>
            )}
          </div>

          {/* Sticky Footer CTA */}
          <footer
            className={`sticky bottom-0 flex items-center justify-end gap-3 border-t p-4 sm:px-6 ${
              isLight ? 'border-zinc-200 bg-white/95 backdrop-blur-sm' : 'border-zinc-800 bg-zinc-900/95 backdrop-blur-sm'
            }`}
          >
            <button
              type="button"
              onClick={onCancel}
              className={`rounded-xl border px-4 py-2.5 text-xs font-semibold transition-colors ${
                isLight
                  ? 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy || !!(preview && 'belowCovered' in preview && preview.belowCovered)}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none"
            >
              {busy ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>A registar correção...</span>
                </>
              ) : (
                'Confirmar correção'
              )}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}
