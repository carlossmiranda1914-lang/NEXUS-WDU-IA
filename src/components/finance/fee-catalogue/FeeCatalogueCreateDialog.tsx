import React, { useState, useEffect } from 'react';
import { feeCatalogueClient, FeeCatalogueApiError } from '../../../modules/finance/fee-catalogue-client.ts';
import { toLocalDatetimeInputValue, parseLocalDatetimeInput } from './fee-catalogue-date.ts';

export interface FeeCatalogueCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}

const initialForm = () => ({
  code: '',
  name: '',
  description: '',
  kind: 'fee',
  amount: '',
  currency: 'EUR',
  effectiveFrom: toLocalDatetimeInputValue(new Date()),
});

export function FeeCatalogueCreateDialog({ isOpen, onClose, onCreated }: FeeCatalogueCreateDialogProps) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(initialForm());
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalizedAmount = form.amount.trim().replace(',', '.');
    const parsedDate = form.effectiveFrom ? parseLocalDatetimeInput(form.effectiveFrom) : new Date();

    if (Number.isNaN(parsedDate.getTime())) {
      setError('Data efetiva inválida.');
      return;
    }

    setSubmitting(true);
    try {
      await feeCatalogueClient.create({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        kind: form.kind.trim(),
        amount: normalizedAmount,
        currency: form.currency.trim().toUpperCase(),
        effectiveFrom: parsedDate.toISOString(),
      });
      await onCreated();
      onClose();
    } catch (err: any) {
      if (err instanceof FeeCatalogueApiError) {
        if (err.status === 409) {
          setError('Já existe um emolumento registado com este código.');
        } else {
          setError(err.message || 'Erro ao criar emolumento');
        }
      } else {
        setError(err?.message || 'Erro inesperado ao criar emolumento');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="border border-zinc-700/70 rounded-2xl p-6 bg-zinc-900 shadow-2xl max-w-2xl w-full text-zinc-100 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-zinc-800 pb-3">
          <div>
            <h3 className="font-semibold text-base text-white">Novo emolumento / taxa</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Define os parâmetros monetários e a vigência inicial (v1) do novo emolumento.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-zinc-400 hover:text-zinc-200 text-lg p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold uppercase tracking-wider text-rose-400 text-[10px]">Validação / Erro</p>
              <p className="mt-0.5">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-400 hover:text-rose-200 text-xs px-1.5 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-zinc-300 mb-1 font-medium">Código</label>
              <input
                required
                value={form.code}
                placeholder="Ex: PROP-MENSAL"
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                className="w-full p-2.5 border border-zinc-700 rounded-lg bg-zinc-950 text-sm font-mono uppercase focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs text-zinc-300 mb-1 font-medium">Nome</label>
              <input
                required
                value={form.name}
                placeholder="Ex: Propinas Mensais do Ensino Regular"
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full p-2.5 border border-zinc-700 rounded-lg bg-zinc-950 text-sm focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1 font-medium">Tipo</label>
              <input
                required
                value={form.kind}
                placeholder="Ex: tuition, fee, service"
                onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value }))}
                className="w-full p-2.5 border border-zinc-700 rounded-lg bg-zinc-950 text-sm focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1 font-medium">Montante</label>
              <input
                required
                value={form.amount}
                placeholder="Ex: 75.50"
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                className="w-full p-2.5 border border-zinc-700 rounded-lg bg-zinc-950 text-sm font-mono focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1 font-medium">Moeda</label>
              <input
                required
                value={form.currency}
                placeholder="EUR"
                onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                className="w-full p-2.5 border border-zinc-700 rounded-lg bg-zinc-950 text-sm font-mono uppercase focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs text-zinc-300 mb-1 font-medium">
                Data Efetiva (início da vigência v1)
              </label>
              <input
                required
                type="datetime-local"
                value={form.effectiveFrom}
                onChange={(e) => setForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                className="w-full p-2.5 border border-zinc-700 rounded-lg bg-zinc-950 text-sm font-mono focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs text-zinc-300 mb-1 font-medium">Descrição (opcional)</label>
              <input
                value={form.description}
                placeholder="Notas adicionais ou termos específicos de cobrança"
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full p-2.5 border border-zinc-700 rounded-lg bg-zinc-950 text-sm focus:border-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 shadow-sm"
            >
              {submitting ? 'A criar...' : 'Criar catálogo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
