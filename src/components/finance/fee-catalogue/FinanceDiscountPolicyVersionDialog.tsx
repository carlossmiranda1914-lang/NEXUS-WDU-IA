import React, { useState, useEffect, useRef } from 'react';
import type {
  DiscountPolicySummary,
  DiscountCalculationMode,
} from '../../../modules/finance/discount-policy-model.ts';
import type { CreateDiscountPolicyVersionInput } from '../../../modules/finance/discount-policy-client.ts';

export interface FinanceDiscountPolicyVersionDialogProps {
  policy: DiscountPolicySummary | null;
  theme?: string;
  onClose: () => void;
  onSubmit: (policyId: string, input: CreateDiscountPolicyVersionInput) => Promise<void>;
}

export function FinanceDiscountPolicyVersionDialog({
  policy,
  theme = 'light',
  onClose,
  onSubmit,
}: FinanceDiscountPolicyVersionDialogProps) {
  const isLight = theme === 'light';

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMode, setFormMode] = useState<DiscountCalculationMode>('percentage');
  const [formValue, setFormValue] = useState('');
  const [formCurrency, setFormCurrency] = useState('EUR');
  const [formEffectiveFrom, setFormEffectiveFrom] = useState('');
  const [formEffectiveTo, setFormEffectiveTo] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (policy) {
      setFormName(policy.latestVersion.name);
      setFormDescription(policy.latestVersion.description || '');
      setFormMode(policy.latestVersion.calculationMode);
      setFormValue(policy.latestVersion.value);
      setFormCurrency(policy.latestVersion.currency || 'EUR');
      setFormEffectiveFrom('');
      setFormEffectiveTo('');
      setFormError(null);
      setFieldErrors({});
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
    }
  }, [policy]);

  if (!policy) return null;

  const currentVer = policy.latestVersion;
  const nextVerNumber = currentVer.version + 1;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formName.trim()) {
      errs.name = 'Nome da versão é obrigatório.';
    }

    const val = Number(formValue);
    if (!formValue.trim()) {
      errs.value = 'Valor de desconto é obrigatório.';
    } else if (isNaN(val) || val <= 0) {
      errs.value = 'Valor deve ser um número estritamente positivo.';
    } else if (formMode === 'percentage' && val > 100) {
      errs.value = 'Percentagem não pode exceder 100%.';
    }

    if (formMode === 'fixed_amount') {
      if (!formCurrency.trim() || formCurrency.trim().length !== 3) {
        errs.currency = 'Código de moeda ISO deve ter 3 letras (Ex: EUR).';
      }
    }

    if (!formEffectiveFrom) {
      errs.effectiveFrom = 'Data de início de vigência é obrigatória para novas versões.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validate()) {
      return;
    }

    setFormSubmitting(true);
    try {
      await onSubmit(policy.id, {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        calculationMode: formMode,
        value: formValue.trim(),
        currency: formMode === 'fixed_amount' ? formCurrency.trim().toUpperCase() : undefined,
        effectiveFrom: formEffectiveFrom ? new Date(formEffectiveFrom) : undefined,
        effectiveTo: formEffectiveTo ? new Date(formEffectiveTo) : undefined,
      });
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao criar versão da política.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Nova Versão para ${policy.code}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl transition-all ${
          isLight
            ? 'bg-white border-zinc-200 text-zinc-900'
            : 'bg-zinc-900 border-zinc-800 text-zinc-100'
        }`}
      >
        {/* Financial Header Grammar (UX-01) */}
        <div
          className={`flex items-start justify-between border-b px-6 py-4 ${
            isLight ? 'border-zinc-100 bg-zinc-50/70' : 'border-zinc-800 bg-zinc-950/40'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center justify-center h-9 w-9 rounded-xl font-bold text-sm ${
                isLight ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-sky-950/60 text-sky-400 border border-sky-800/60'
              }`}
            >
              v{nextVerNumber}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight">Nova Versão da Política</h3>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                  {policy.code}
                </span>
              </div>
              <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Criação da Versão {nextVerNumber} imutável com janela temporal própria.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors ${
              isLight ? 'hover:bg-zinc-100' : 'hover:bg-zinc-800'
            }`}
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        {/* Global Error Banner if API/Domain failure (UX-04) */}
        {formError && (
          <div
            role="alert"
            className={`mx-6 mt-4 p-3 rounded-xl border text-xs flex items-start gap-2 ${
              isLight
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-red-950/40 border-red-800 text-red-300'
            }`}
          >
            <span className="font-bold shrink-0">⚠️</span>
            <div>
              <p className="font-semibold">Rejeição da Operação</p>
              <p className="mt-0.5">{formError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
          {/* Version Progression Notice (UX-02) */}
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              isLight ? 'bg-zinc-50 border-zinc-200/80 text-zinc-700' : 'bg-zinc-950/60 border-zinc-800 text-zinc-300'
            }`}
          >
            <div>
              <span className={`text-[11px] block ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>Versão atual (v{currentVer.version})</span>
              <span className="font-semibold">{currentVer.name}</span>
            </div>
            <div className="text-right">
              <span className={`text-[11px] block ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>Valor atual</span>
              <span className="font-mono font-bold">
                {currentVer.calculationMode === 'percentage' ? `${currentVer.value}%` : `${currentVer.value} ${currentVer.currency || 'EUR'}`}
              </span>
            </div>
          </div>

          {/* Section 1: Identificação da Nova Versão (UX-02) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-1.5 dark:border-zinc-800">
              <span className={`font-bold uppercase tracking-wider text-[11px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                1. Identificação da Versão {nextVerNumber}
              </span>
            </div>

            <div>
              <label className="block font-medium mb-1" htmlFor="ver-name">
                Nome da Versão *
              </label>
              <input
                ref={firstInputRef}
                id="ver-name"
                type="text"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' });
                }}
                placeholder="Ex: Bolsa de Mérito 25% (Ano Letivo 2027)"
                className={`w-full px-3 py-2 rounded-lg focus:outline-none transition-colors border ${
                  fieldErrors.name
                    ? 'border-red-500 bg-red-50/10'
                    : isLight
                    ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-sky-600 focus:bg-white'
                    : 'bg-zinc-950 border-zinc-800 text-white focus:border-sky-500'
                }`}
                required
              />
              {fieldErrors.name && (
                <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{fieldErrors.name}</p>
              )}
            </div>

            <div>
              <label className={`block font-medium mb-1 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`} htmlFor="ver-desc">
                Notas da Versão (Opcional)
              </label>
              <input
                id="ver-desc"
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Ex: Atualização da taxa aprovada pelo Conselho de Direção."
                className={`w-full px-3 py-2 rounded-lg focus:outline-none transition-colors border ${
                  isLight
                    ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-sky-600 focus:bg-white'
                    : 'bg-zinc-950 border-zinc-800 text-white focus:border-sky-500'
                }`}
              />
            </div>
          </div>

          {/* Section 2: Regra Financeira (UX-02, UX-03) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-1.5 dark:border-zinc-800">
              <span className={`font-bold uppercase tracking-wider text-[11px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                2. Regra Financeira de Desconto
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium mb-1" htmlFor="ver-mode">
                  Modalidade *
                </label>
                <select
                  id="ver-mode"
                  value={formMode}
                  onChange={(e) => setFormMode(e.target.value as DiscountCalculationMode)}
                  className={`w-full px-3 py-2 rounded-lg focus:outline-none transition-colors border font-medium ${
                    isLight
                      ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-sky-600'
                      : 'bg-zinc-950 border-zinc-800 text-white focus:border-sky-500'
                  }`}
                >
                  <option value="percentage">Percentagem (%)</option>
                  <option value="fixed_amount">Valor Fixo (€/Moeda)</option>
                </select>
              </div>

              <div className={formMode === 'fixed_amount' ? 'md:col-span-1' : 'md:col-span-2'}>
                <label className="block font-medium mb-1" htmlFor="ver-value">
                  {formMode === 'percentage' ? 'Percentagem (%) *' : 'Montante Fixo *'}
                </label>
                <div className="relative flex items-center">
                  <input
                    id="ver-value"
                    type="number"
                    step="any"
                    value={formValue}
                    onChange={(e) => {
                      setFormValue(e.target.value);
                      if (fieldErrors.value) setFieldErrors({ ...fieldErrors, value: '' });
                    }}
                    placeholder={formMode === 'percentage' ? '25' : '50.00'}
                    className={`w-full px-3 py-2 pr-8 rounded-lg font-mono focus:outline-none transition-colors border ${
                      fieldErrors.value
                        ? 'border-red-500 bg-red-50/10'
                        : isLight
                        ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-sky-600 focus:bg-white'
                        : 'bg-zinc-950 border-zinc-800 text-white focus:border-sky-500'
                    }`}
                    required
                  />
                  <span className="absolute right-3 font-bold text-zinc-400 select-none">
                    {formMode === 'percentage' ? '%' : formCurrency}
                  </span>
                </div>
                {fieldErrors.value && (
                  <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{fieldErrors.value}</p>
                )}
              </div>

              {formMode === 'fixed_amount' && (
                <div>
                  <label className="block font-medium mb-1" htmlFor="ver-currency">
                    Moeda ISO *
                  </label>
                  <input
                    id="ver-currency"
                    type="text"
                    maxLength={3}
                    value={formCurrency}
                    onChange={(e) => {
                      setFormCurrency(e.target.value.toUpperCase());
                      if (fieldErrors.currency) setFieldErrors({ ...fieldErrors, currency: '' });
                    }}
                    placeholder="EUR"
                    className={`w-full px-3 py-2 rounded-lg font-mono uppercase focus:outline-none transition-colors border ${
                      fieldErrors.currency
                        ? 'border-red-500 bg-red-50/10'
                        : isLight
                        ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-sky-600'
                        : 'bg-zinc-950 border-zinc-800 text-white focus:border-sky-500'
                    }`}
                    required
                  />
                  {fieldErrors.currency && (
                    <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{fieldErrors.currency}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Vigência Temporal (UX-02) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-1.5 dark:border-zinc-800">
              <span className={`font-bold uppercase tracking-wider text-[11px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                3. Período de Vigência da Nova Versão
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1" htmlFor="ver-eff-from">
                  Início de Vigência *
                </label>
                <input
                  id="ver-eff-from"
                  type="date"
                  value={formEffectiveFrom}
                  onChange={(e) => {
                    setFormEffectiveFrom(e.target.value);
                    if (fieldErrors.effectiveFrom) setFieldErrors({ ...fieldErrors, effectiveFrom: '' });
                  }}
                  className={`w-full px-3 py-2 rounded-lg focus:outline-none transition-colors border ${
                    fieldErrors.effectiveFrom
                      ? 'border-red-500 bg-red-50/10'
                      : isLight
                      ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-sky-600'
                      : 'bg-zinc-950 border-zinc-800 text-white focus:border-sky-500'
                  }`}
                  required
                />
                {fieldErrors.effectiveFrom && (
                  <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{fieldErrors.effectiveFrom}</p>
                )}
              </div>

              <div>
                <label className="block font-medium mb-1" htmlFor="ver-eff-to">
                  Término de Vigência (Opcional)
                </label>
                <input
                  id="ver-eff-to"
                  type="date"
                  value={formEffectiveTo}
                  onChange={(e) => setFormEffectiveTo(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg focus:outline-none transition-colors border ${
                    isLight
                      ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-sky-600'
                      : 'bg-zinc-950 border-zinc-800 text-white focus:border-sky-500'
                  }`}
                />
                <span className={`block text-[10px] mt-0.5 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Vazio = indeterminado
                </span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div
            className={`flex items-center justify-end gap-3 pt-4 border-t ${
              isLight ? 'border-zinc-100' : 'border-zinc-800'
            }`}
          >
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                isLight
                  ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              {formSubmitting ? 'A salvar...' : `Criar Versão ${nextVerNumber}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
