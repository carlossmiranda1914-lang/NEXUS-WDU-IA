import React, { useState, useEffect, useRef } from 'react';
import type { DiscountCalculationMode } from '../../../modules/finance/discount-policy-model.ts';
import type { CreateDiscountPolicyInput } from '../../../modules/finance/discount-policy-client.ts';

export interface FinanceDiscountPolicyCreateDialogProps {
  isOpen: boolean;
  theme?: string;
  onClose: () => void;
  onSubmit: (input: CreateDiscountPolicyInput) => Promise<void>;
}

export function FinanceDiscountPolicyCreateDialog({
  isOpen,
  theme = 'light',
  onClose,
  onSubmit,
}: FinanceDiscountPolicyCreateDialogProps) {
  const isLight = theme === 'light';

  const [formCode, setFormCode] = useState('');
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
    if (isOpen) {
      setFormCode('');
      setFormName('');
      setFormDescription('');
      setFormMode('percentage');
      setFormValue('');
      setFormCurrency('EUR');
      setFormEffectiveFrom('');
      setFormEffectiveTo('');
      setFormError(null);
      setFieldErrors({});
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formCode.trim()) {
      errs.code = 'Código da política é obrigatório.';
    } else if (!/^[A-Za-z0-9_-]{2,32}$/.test(formCode.trim())) {
      errs.code = 'Código deve conter 2 a 32 caracteres alfanuméricos (letras, números, hífen).';
    }

    if (!formName.trim()) {
      errs.name = 'Nome da política é obrigatório.';
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
        errs.currency = 'Código de moeda ISO deve ter exatamente 3 letras (Ex: EUR).';
      }
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
      await onSubmit({
        code: formCode.trim().toUpperCase(),
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
      setFormError(err?.message || 'Erro ao criar política de desconto.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nova Política de Desconto"
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
                isLight ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
              }`}
            >
              %
            </span>
            <div>
              <h3 className="text-base font-bold tracking-tight">Nova Política de Desconto</h3>
              <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Defina uma regra institucional de desconto que criará a Versão 1 imutável.
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
          {/* Section 1: Identificação da Política (UX-02) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-1.5 dark:border-zinc-800">
              <span className={`font-bold uppercase tracking-wider text-[11px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                1. Identificação da Política
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <label className="block font-medium mb-1" htmlFor="policy-code">
                  Código Único *
                </label>
                <input
                  ref={firstInputRef}
                  id="policy-code"
                  type="text"
                  value={formCode}
                  onChange={(e) => {
                    setFormCode(e.target.value.toUpperCase());
                    if (fieldErrors.code) setFieldErrors({ ...fieldErrors, code: '' });
                  }}
                  placeholder="Ex: BOLSA-20"
                  className={`w-full px-3 py-2 rounded-lg font-mono uppercase focus:outline-none transition-colors border ${
                    fieldErrors.code
                      ? 'border-red-500 bg-red-50/10'
                      : isLight
                      ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-emerald-600 focus:bg-white'
                      : 'bg-zinc-950 border-zinc-800 text-white focus:border-emerald-500'
                  }`}
                  required
                />
                {fieldErrors.code && (
                  <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{fieldErrors.code}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block font-medium mb-1" htmlFor="policy-name">
                  Nome da Política *
                </label>
                <input
                  id="policy-name"
                  type="text"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' });
                  }}
                  placeholder="Ex: Bolsa de Mérito Académico 20%"
                  className={`w-full px-3 py-2 rounded-lg focus:outline-none transition-colors border ${
                    fieldErrors.name
                      ? 'border-red-500 bg-red-50/10'
                      : isLight
                      ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-emerald-600 focus:bg-white'
                      : 'bg-zinc-950 border-zinc-800 text-white focus:border-emerald-500'
                  }`}
                  required
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{fieldErrors.name}</p>
                )}
              </div>
            </div>

            <div>
              <label className={`block font-medium mb-1 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`} htmlFor="policy-desc">
                Enquadramento / Descrição (Opcional)
              </label>
              <input
                id="policy-desc"
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Ex: Aplicável a estudantes com média igual ou superior a 16 valores."
                className={`w-full px-3 py-2 rounded-lg focus:outline-none transition-colors border ${
                  isLight
                    ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-emerald-600 focus:bg-white'
                    : 'bg-zinc-950 border-zinc-800 text-white focus:border-emerald-500'
                }`}
              />
            </div>
          </div>

          {/* Section 2: Regra Financeira de Desconto (UX-02, UX-03) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-1.5 dark:border-zinc-800">
              <span className={`font-bold uppercase tracking-wider text-[11px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                2. Regra Financeira de Desconto
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium mb-1" htmlFor="policy-mode">
                  Modalidade *
                </label>
                <select
                  id="policy-mode"
                  value={formMode}
                  onChange={(e) => setFormMode(e.target.value as DiscountCalculationMode)}
                  className={`w-full px-3 py-2 rounded-lg focus:outline-none transition-colors border font-medium ${
                    isLight
                      ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-emerald-600'
                      : 'bg-zinc-950 border-zinc-800 text-white focus:border-emerald-500'
                  }`}
                >
                  <option value="percentage">Percentagem (%)</option>
                  <option value="fixed_amount">Valor Fixo (€/Moeda)</option>
                </select>
              </div>

              <div className={formMode === 'fixed_amount' ? 'md:col-span-1' : 'md:col-span-2'}>
                <label className="block font-medium mb-1" htmlFor="policy-value">
                  {formMode === 'percentage' ? 'Percentagem (%) *' : 'Montante Fixo *'}
                </label>
                <div className="relative flex items-center">
                  <input
                    id="policy-value"
                    type="number"
                    step="any"
                    value={formValue}
                    onChange={(e) => {
                      setFormValue(e.target.value);
                      if (fieldErrors.value) setFieldErrors({ ...fieldErrors, value: '' });
                    }}
                    placeholder={formMode === 'percentage' ? '20' : '50.00'}
                    className={`w-full px-3 py-2 pr-8 rounded-lg font-mono focus:outline-none transition-colors border ${
                      fieldErrors.value
                        ? 'border-red-500 bg-red-50/10'
                        : isLight
                        ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-emerald-600 focus:bg-white'
                        : 'bg-zinc-950 border-zinc-800 text-white focus:border-emerald-500'
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
                  <label className="block font-medium mb-1" htmlFor="policy-currency">
                    Moeda ISO (3 letras) *
                  </label>
                  <input
                    id="policy-currency"
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
                        ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-emerald-600'
                        : 'bg-zinc-950 border-zinc-800 text-white focus:border-emerald-500'
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
                3. Período de Vigência
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1" htmlFor="policy-eff-from">
                  Início de Vigência
                </label>
                <input
                  id="policy-eff-from"
                  type="date"
                  value={formEffectiveFrom}
                  onChange={(e) => setFormEffectiveFrom(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg focus:outline-none transition-colors border ${
                    isLight
                      ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-emerald-600'
                      : 'bg-zinc-950 border-zinc-800 text-white focus:border-emerald-500'
                  }`}
                />
                <span className={`block text-[10px] mt-0.5 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Vazio = imediato
                </span>
              </div>

              <div>
                <label className="block font-medium mb-1" htmlFor="policy-eff-to">
                  Término de Vigência (Opcional)
                </label>
                <input
                  id="policy-eff-to"
                  type="date"
                  value={formEffectiveTo}
                  onChange={(e) => setFormEffectiveTo(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg focus:outline-none transition-colors border ${
                    isLight
                      ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-emerald-600'
                      : 'bg-zinc-950 border-zinc-800 text-white focus:border-emerald-500'
                  }`}
                />
                <span className={`block text-[10px] mt-0.5 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Vazio = indeterminado
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Live Summary Card (UX-02) */}
          {formCode && formValue && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                isLight ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-900' : 'bg-emerald-950/20 border-emerald-900/60 text-emerald-300'
              }`}
            >
              <div>
                <span className="font-mono font-bold">{formCode}</span>
                <span className="mx-1.5">·</span>
                <span>{formName || 'Sem nome'}</span>
              </div>
              <span className="font-bold text-sm">
                {formMode === 'percentage' ? `${formValue}%` : `${formValue} ${formCurrency}`}
              </span>
            </div>
          )}

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
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              {formSubmitting ? 'A criar...' : 'Criar Política (v1)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
