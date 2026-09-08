import React, { useState, useEffect, useRef } from 'react';
import type { FinanceOperationalObligation } from '../../../modules/finance/finance-operational-context-model.ts';
import {
  discountPolicyClient,
  type DiscountPolicyApiClient,
} from '../../../modules/finance/discount-policy-client.ts';
import type { DiscountPolicySummary } from '../../../modules/finance/discount-policy-model.ts';
import { Money } from '../../../modules/finance/money.ts';
import { ExactDecimal } from '../../../modules/finance/exact-decimal.ts';
import { quantizeMoneyCandidate } from '../../../modules/finance/quantization.ts';

export interface FinanceObligationDiscountViewProps {
  theme?: string;
  mode?: 'apply' | 'revoke';
  obligation: FinanceOperationalObligation;
  policyClient?: DiscountPolicyApiClient;
  onCancel: () => void;
  onApply: (obligationId: string, policyId: string, reason: string) => Promise<void>;
  onRevoke: (obligationId: string, discountId: string, reason: string) => Promise<void>;
}

export function FinanceObligationDiscountView({
  theme = 'light',
  mode: initialMode,
  obligation,
  policyClient = discountPolicyClient,
  onCancel,
  onApply,
  onRevoke,
}: FinanceObligationDiscountViewProps) {
  const isLight = theme === 'light';
  const isRevokeMode = initialMode === 'revoke' || (Boolean(obligation.activeDiscount) && initialMode !== 'apply');

  const [policies, setPolicies] = useState<readonly DiscountPolicySummary[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(!isRevokeMode);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const drawerRef = useRef<HTMLElement>(null);
  const firstInputRef = useRef<HTMLSelectElement | HTMLTextAreaElement | null>(null);

  const currency = obligation.amount?.currency || 'EUR';
  const originalStr = obligation.original?.amount || obligation.amount.amount || '0';
  const effectiveDueStr = obligation.effectiveDue?.amount || originalStr;
  const coveredStr = obligation.covered?.amount || '0';
  const remainingStr = obligation.remainingCoverable?.amount || obligation.uncovered?.amount || '0';

  // Load policies on mount if applying
  useEffect(() => {
    if (!isRevokeMode) {
      setLoadingPolicies(true);
      policyClient
        .listDiscountPolicies()
        .then((data) => {
          const active = data.filter((p) => p.status === 'active');
          setPolicies(active);
          if (active.length > 0) {
            setSelectedPolicyId(active[0].id);
          }
        })
        .catch((err: any) => {
          setError(err?.message || 'Falha ao carregar políticas de desconto.');
        })
        .finally(() => {
          setLoadingPolicies(false);
        });
    }
  }, [isRevokeMode, policyClient]);

  // Focus trap / initial focus
  useEffect(() => {
    const timer = setTimeout(() => {
      firstInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId);
  const activeVersion = selectedPolicy?.currentApplicableVersion || selectedPolicy?.latestVersion;

  // Calculate live preview for Apply mode
  const applyPreview = (() => {
    if (isRevokeMode || !activeVersion) return null;
    try {
      const origMoney = Money.parse(originalStr, currency);
      const effDueMoney = Money.parse(effectiveDueStr, currency);
      const coveredMoney = Money.parse(coveredStr, currency);

      let discountMoney: Money;
      if (activeVersion.calculationMode === 'percentage') {
        const rate = Number(activeVersion.value);
        const decDue = ExactDecimal.parse(effDueMoney.canonicalAmount(), 30, 12);
        const decRate = ExactDecimal.parse(rate.toString(), 30, 12);
        const multiplied = decDue.multiply(decRate, 30, 12);
        const dividedBy100 = ExactDecimal.fromParts(multiplied.coefficient, multiplied.scale + 2, 30, 12);
        discountMoney = quantizeMoneyCandidate(dividedBy100, currency, 2, 'half_up');
      } else {
        discountMoney = Money.parse(ExactDecimal.parse(activeVersion.value, 30, 12).toCanonicalString(), currency);
      }

      const projectedDue = effDueMoney.subtract(discountMoney);
      const projectedRemaining = projectedDue.subtract(coveredMoney);
      const belowCovered = projectedDue.compare(coveredMoney) < 0;

      return {
        discountAmount: discountMoney.canonicalAmount(),
        newDue: projectedDue.canonicalAmount(),
        newRemaining: projectedRemaining.compare(Money.parse('0', currency)) < 0 ? '0.00' : projectedRemaining.canonicalAmount(),
        belowCovered,
      };
    } catch {
      return { invalid: true as const, belowCovered: false };
    }
  })();

  // Calculate live preview for Revoke mode
  const revokePreview = (() => {
    if (!isRevokeMode || !obligation.activeDiscount) return null;
    try {
      const effDueMoney = Money.parse(effectiveDueStr, currency);
      const discountMoney = Money.parse(obligation.activeDiscount.amount.amount, currency);
      const coveredMoney = Money.parse(coveredStr, currency);

      const restoredDue = effDueMoney.add(discountMoney);
      const restoredRemaining = restoredDue.subtract(coveredMoney);

      return {
        restoredDue: restoredDue.canonicalAmount(),
        restoredRemaining: restoredRemaining.canonicalAmount(),
      };
    } catch {
      return null;
    }
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('O motivo é obrigatório.');
      return;
    }

    if (isRevokeMode) {
      if (!obligation.activeDiscount) {
        setError('Não existe desconto ativo para revogar.');
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        await onRevoke(obligation.id, obligation.activeDiscount.id, reason.trim());
      } catch (err: any) {
        setError(err?.message || 'Falha ao revogar desconto.');
      } finally {
        setSubmitting(false);
      }
    } else {
      if (!selectedPolicyId) {
        setError('Selecione uma política de desconto.');
        return;
      }
      if (applyPreview && 'belowCovered' in applyPreview && applyPreview.belowCovered) {
        setError('O desconto selecionado excede o limite disponível para esta cobrança (já coberto por recebimentos).');
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        await onApply(obligation.id, selectedPolicyId, reason.trim());
      } catch (err: any) {
        setError(err?.message || 'Falha ao aplicar desconto.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const suggestions = isRevokeMode
    ? ['Perda de bolsa de estudo', 'Alteração de escalão social', 'Cancelamento autorizado', 'Correção administrativa']
    : ['Bolsa de Mérito Semestre 1', 'Desconto Protocolo Institucional', 'Desconto Familiar / Irmãos', 'Apoio Social'];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-[2px] motion-reduce:backdrop-blur-none transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={isRevokeMode ? 'Revogar desconto institucional' : 'Aplicar desconto institucional'}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
        className={`relative flex h-full w-full max-w-lg flex-col border-l shadow-2xl transition-transform duration-200 motion-reduce:transition-none ${
          isLight
            ? 'border-zinc-200 bg-white text-zinc-900'
            : 'border-zinc-800 bg-zinc-900 text-zinc-100'
        }`}
      >
        {/* Drawer Header (UX-01) */}
        <div
          className={`flex items-start justify-between border-b px-6 py-5 ${
            isLight ? 'border-zinc-100 bg-zinc-50/70' : 'border-zinc-800 bg-zinc-950/40'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span
                className={`inline-flex items-center justify-center h-8 w-8 rounded-xl font-bold text-xs ${
                  isRevokeMode
                    ? isLight ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                    : isLight ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                }`}
              >
                {isRevokeMode ? '↺' : '%'}
              </span>
              <h2 className="text-base font-bold tracking-tight">
                {isRevokeMode ? 'Revogar desconto institucional' : 'Aplicar desconto institucional'}
              </h2>
            </div>
            <p className={`text-xs leading-relaxed ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{obligation.description}</span>
              {' · '}Concessão fundamentada e registada em histórico financeiro.
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
          data-testid="obligation-discount-form"
          className="flex flex-1 flex-col justify-between overflow-y-auto"
        >
          <div className="space-y-5 p-6 text-xs">
            {/* Obligation Financial Context Card (UX-02) */}
            <div>
              <span className={`block font-bold uppercase tracking-wider text-[11px] mb-2 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                1. Enquadramento da Cobrança
              </span>
              <div
                data-testid="discount-current-position"
                className={`grid grid-cols-2 gap-3 rounded-xl border p-3.5 ${
                  isLight
                    ? 'border-zinc-200 bg-zinc-50/80 text-zinc-700'
                    : 'border-zinc-800 bg-zinc-950/60 text-zinc-300'
                }`}
              >
                <div className="space-y-0.5">
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Valor original</span>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {`${originalStr} ${currency}`}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Já coberto</span>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    {`${coveredStr} ${currency}`}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Valor devido atual</span>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {`${effectiveDueStr} ${currency}`}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Restante por cobrir</span>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {`${remainingStr} ${currency}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Apply Mode: Policy Selector (UX-02, UX-03) */}
            {!isRevokeMode && (
              <div className="space-y-2">
                <label
                  htmlFor="policy-select"
                  className={`block font-bold uppercase tracking-wider text-[11px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}
                >
                  2. Política Institucional de Desconto *
                </label>
                {loadingPolicies ? (
                  <div className="animate-pulse h-10 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
                ) : policies.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Não existem políticas de desconto ativas disponíveis.
                  </p>
                ) : (
                  <select
                    id="policy-select"
                    ref={firstInputRef as any}
                    value={selectedPolicyId}
                    onChange={(e) => setSelectedPolicyId(e.target.value)}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                      isLight
                        ? 'border-zinc-300 bg-white text-zinc-900'
                        : 'border-zinc-700 bg-zinc-950 text-zinc-100'
                    }`}
                  >
                    {policies.map((p) => {
                      const ver = p.currentApplicableVersion || p.latestVersion;
                      const valStr =
                        ver.calculationMode === 'percentage'
                          ? `${ver.value}%`
                          : `${ver.value} ${ver.currency || currency}`;
                      return (
                        <option key={p.id} value={p.id}>
                          {`${p.code} — ${p.name} (${valStr})`}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            )}

            {/* Revoke Mode: Active Discount Summary (UX-02) */}
            {isRevokeMode && obligation.activeDiscount && (
              <div className="space-y-2">
                <span className={`block font-bold uppercase tracking-wider text-[11px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  2. Desconto Ativo a Revogar
                </span>
                <div
                  className={`rounded-xl border p-4 space-y-2 ${
                    isLight
                      ? 'border-amber-200 bg-amber-50/60 text-amber-900'
                      : 'border-amber-800/60 bg-amber-950/40 text-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">Desconto Ativo</span>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-200/60 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                      {obligation.activeDiscount.policyCode}
                    </span>
                  </div>
                  <p className="text-sm font-semibold">{obligation.activeDiscount.policyName}</p>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-200 dark:border-amber-800/60">
                    <span>Valor concedido:</span>
                    <span className="font-bold font-mono">
                      {`-${obligation.activeDiscount.amount.amount} ${obligation.activeDiscount.amount.currency}`}
                    </span>
                  </div>
                  {obligation.activeDiscount.reason && (
                    <p className="text-[11px] italic text-zinc-600 dark:text-zinc-400">
                      {`Motivo anterior: ${obligation.activeDiscount.reason}`}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Live Financial Projection (UX-02, UX-03) */}
            {!isRevokeMode && applyPreview && !('invalid' in applyPreview) && (
              <div className="space-y-2">
                <span className={`block font-bold uppercase tracking-wider text-[11px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  3. Projeção do Impacto Financeiro
                </span>
                <div
                  data-testid="discount-projected-position"
                  className={`rounded-xl border p-4 space-y-2.5 transition-all duration-150 motion-reduce:transition-none ${
                    applyPreview.belowCovered
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
                      Projeção Financeira
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        applyPreview.belowCovered
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                      }`}
                    >
                      {`Desconto: -${applyPreview.discountAmount} ${currency}`}
                    </span>
                  </div>

                  <p className="text-base font-bold tracking-tight">
                    {`${effectiveDueStr} ${currency} → ${applyPreview.newDue} ${currency}`}
                  </p>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-200/60 dark:border-zinc-800/80">
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Já coberto <strong>{`${coveredStr} ${currency}`}</strong>
                    </span>
                    <span className="text-zinc-900 dark:text-zinc-100 font-semibold">
                      {`Restante a liquidar: ${applyPreview.newRemaining} ${currency}`}
                    </span>
                  </div>

                  {applyPreview.belowCovered && (
                    <div className="p-2.5 rounded-lg bg-rose-100/80 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs">
                      <p className="font-bold">⚠️ Aviso de Limite (Covered Floor):</p>
                      <p className="mt-0.5">
                        {`O desconto (-${applyPreview.discountAmount} ${currency}) excede o valor por cobrir (${remainingStr} ${currency}).`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Revoke Mode: Restored Balance Projection (UX-02) */}
            {isRevokeMode && revokePreview && (
              <div className="space-y-2">
                <span className={`block font-bold uppercase tracking-wider text-[11px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  3. Restauro de Saldo Projetado
                </span>
                <div
                  data-testid="discount-revoked-projected-position"
                  className={`rounded-xl border p-4 space-y-2.5 ${
                    isLight
                      ? 'border-zinc-200/90 bg-zinc-50/50 text-zinc-900'
                      : 'border-zinc-800/60 bg-zinc-950/30 text-zinc-100'
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Restauro de Saldo
                  </span>
                  <p className="text-base font-bold tracking-tight">
                    {`${effectiveDueStr} ${currency} → ${revokePreview.restoredDue} ${currency}`}
                  </p>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-200/60 dark:border-zinc-800/80">
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Já coberto <strong>{`${coveredStr} ${currency}`}</strong>
                    </span>
                    <span className="text-zinc-900 dark:text-zinc-100 font-semibold">
                      {`Novo restante: ${revokePreview.restoredRemaining} ${currency}`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Reason & Guidance (UX-02, UX-04) */}
            <div className="space-y-2">
              <label
                htmlFor="discount-reason-input"
                className={`block font-bold uppercase tracking-wider text-[11px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}
              >
                4. Motivo / Justificação Operacional *
              </label>
              <textarea
                id="discount-reason-input"
                ref={isRevokeMode ? (firstInputRef as any) : undefined}
                aria-label="Motivo obrigatório"
                rows={2}
                placeholder="Indique a justificação formal..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                  isLight
                    ? 'border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600'
                }`}
              />

              {/* Suggestions */}
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
            </div>

            {/* Error Message with preserved form state (UX-04) */}
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
              disabled={
                submitting ||
                (!isRevokeMode && Boolean(applyPreview && 'belowCovered' in applyPreview && applyPreview.belowCovered))
              }
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none ${
                isRevokeMode
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {submitting ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>{isRevokeMode ? 'A revogar desconto...' : 'A aplicar desconto...'}</span>
                </>
              ) : isRevokeMode ? (
                'Confirmar Revogação'
              ) : (
                'Confirmar Desconto'
              )}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}

export default FinanceObligationDiscountView;
