import React, { useState, useEffect, useRef } from 'react';
import type { DiscountCalculationMode } from '../../../modules/finance/discount-policy-model.ts';
import type { CreateDiscountPolicyInput } from '../../../modules/finance/discount-policy-client.ts';

export interface FinanceDiscountPolicyCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateDiscountPolicyInput) => Promise<void>;
}

export function FinanceDiscountPolicyCreateDialog({
  isOpen,
  onClose,
  onSubmit,
}: FinanceDiscountPolicyCreateDialogProps) {
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
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const val = Number(formValue);
    if (!formCode.trim()) {
      setFormError('Código da política é obrigatório.');
      return;
    }
    if (!formName.trim()) {
      setFormError('Nome da política é obrigatório.');
      return;
    }
    if (isNaN(val) || val <= 0) {
      setFormError('Valor deve ser um número estritamente positivo.');
      return;
    }
    if (formMode === 'percentage' && val > 100) {
      setFormError('Percentagem não pode exceder 100%.');
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 text-zinc-100">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
          <h3 className="text-base font-bold text-white">Nova Política de Desconto</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg"
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        {formError && (
          <div role="alert" className="mb-4 p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-xs">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-300 font-medium mb-1" htmlFor="policy-code">
              Código da Política *
            </label>
            <input
              ref={firstInputRef}
              id="policy-code"
              type="text"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value.toUpperCase())}
              placeholder="Ex: BOLSA-20"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1" htmlFor="policy-name">
              Nome da Política *
            </label>
            <input
              id="policy-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ex: Bolsa de Mérito 20%"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1" htmlFor="policy-mode">
                Modalidade *
              </label>
              <select
                id="policy-mode"
                value={formMode}
                onChange={(e) => setFormMode(e.target.value as DiscountCalculationMode)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="percentage">Percentagem (%)</option>
                <option value="fixed_amount">Valor Fixo</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1" htmlFor="policy-value">
                Valor {formMode === 'percentage' ? '(%)' : '(Moeda)'} *
              </label>
              <input
                id="policy-value"
                type="number"
                step="any"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder={formMode === 'percentage' ? '20' : '50.00'}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          {formMode === 'fixed_amount' && (
            <div>
              <label className="block text-zinc-300 font-medium mb-1" htmlFor="policy-currency">
                Moeda (3 letras) *
              </label>
              <input
                id="policy-currency"
                type="text"
                maxLength={3}
                value={formCurrency}
                onChange={(e) => setFormCurrency(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1" htmlFor="policy-eff-from">
                Vigência Início
              </label>
              <input
                id="policy-eff-from"
                type="date"
                value={formEffectiveFrom}
                onChange={(e) => setFormEffectiveFrom(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1" htmlFor="policy-eff-to">
                Vigência Fim (Opcional)
              </label>
              <input
                id="policy-eff-to"
                type="date"
                value={formEffectiveTo}
                onChange={(e) => setFormEffectiveTo(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold transition-colors"
            >
              {formSubmitting ? 'A criar...' : 'Criar Política'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
