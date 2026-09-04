import React, { useState, useEffect } from 'react';
import { feeCatalogueClient, FeeCatalogueApiError, type FeeCatalogueRecord } from '../../../modules/finance/fee-catalogue-client.ts';
import { nextValidEffectiveFrom, parseLocalDatetimeInput, formatDisplayDateTime } from './fee-catalogue-date.ts';

export interface FeeCatalogueVersionDialogProps {
  item: FeeCatalogueRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}

export function FeeCatalogueVersionDialog({ item, isOpen, onClose, onUpdated }: FeeCatalogueVersionDialogProps) {
  const [form, setForm] = useState({
    name: '',
    kind: 'fee',
    amount: '',
    currency: 'EUR',
    effectiveFrom: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && item) {
      const suggestedDate = nextValidEffectiveFrom(item.current.effectiveFrom);
      setForm({
        name: item.current.name,
        kind: item.current.kind,
        amount: item.current.money.amount,
        currency: item.current.money.currency,
        effectiveFrom: suggestedDate,
        description: item.current.description || '',
      });
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

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
      await feeCatalogueClient.update(item.id, {
        expectedVersion: item.currentVersion,
        name: form.name.trim(),
        description: form.description.trim() || null,
        kind: form.kind.trim(),
        amount: normalizedAmount,
        currency: form.currency.trim().toUpperCase(),
        effectiveFrom: parsedDate.toISOString(),
      });
      await onUpdated();
      onClose();
    } catch (err: any) {
      if (err instanceof FeeCatalogueApiError) {
        if (err.status === 409) {
          setError('A versão foi alterada concorrentemente. Por favor, feche e recarregue os dados.');
        } else {
          setError(err.message || 'Erro ao publicar nova versão');
        }
      } else {
        setError(err?.message || 'Erro inesperado ao publicar nova versão');
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
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base text-white">Publicar nova versão</h3>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold">
                {item.code}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Cria uma versão subsequente (<strong className="text-emerald-400">v{item.currentVersion + 1}</strong>) preservando o histórico auditável.
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

        {/* Current Active Version Info Box */}
        <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs text-zinc-300 space-y-1.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span>Versão atual em vigor:</span>
            <span className="font-mono text-zinc-200 font-semibold">v{item.currentVersion}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-400">
            <span>Montante atual:</span>
            <span className="font-mono text-emerald-400 font-semibold">{item.current.money.amount} {item.current.money.currency}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-400">
            <span>Vigência iniciada em:</span>
            <span className="font-mono text-zinc-300">{formatDisplayDateTime(item.current.effectiveFrom)}</span>
          </div>
          <p className="text-[11px] text-amber-400/90 pt-1 border-t border-zinc-800/60 mt-1">
            • A nova data de vigência é sugerida automaticamente e deve ser estritamente posterior a {formatDisplayDateTime(item.current.effectiveFrom)}.
          </p>
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
              <label className="block text-xs text-zinc-400 mb-1 font-medium">Código (imutável)</label>
              <input
                disabled
                value={item.code}
                className="w-full p-2.5 border border-zinc-800 rounded-lg bg-zinc-950/60 text-sm font-mono uppercase text-zinc-400 cursor-not-allowed"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs text-zinc-300 mb-1 font-medium">Nome da nova versão</label>
              <input
                required
                value={form.name}
                placeholder="Ex: Propinas Mensais Atualizadas"
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
              <label className="block text-xs text-zinc-300 mb-1 font-medium">Novo Montante</label>
              <input
                required
                value={form.amount}
                placeholder="Ex: 85.00"
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
                Data Efetiva da Nova Versão (v{item.currentVersion + 1})
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
              <label className="block text-xs text-zinc-300 mb-1 font-medium">Descrição / Notas de alteração</label>
              <input
                value={form.description}
                placeholder="Ex: Atualização anual aprovada pela direção"
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
              {submitting ? 'A guardar...' : 'Guardar nova versão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
