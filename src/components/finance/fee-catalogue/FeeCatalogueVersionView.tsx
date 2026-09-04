import React, { useState } from 'react';
import { feeCatalogueClient, FeeCatalogueApiError, type FeeCatalogueRecord } from '../../../modules/finance/fee-catalogue-client.ts';
import {
  formatDisplayDateTime,
  toLocalDatetimeInputValue,
  parseLocalDatetimeInput,
  nextValidEffectiveFrom,
} from './fee-catalogue-date.ts';

export interface FeeCatalogueVersionViewProps {
  item: FeeCatalogueRecord;
  onBack: () => void;
  onUpdated: () => Promise<void>;
}

export function FeeCatalogueVersionView({ item, onBack, onUpdated }: FeeCatalogueVersionViewProps) {
  const [form, setForm] = useState(() => {
    const suggestedNextDate = nextValidEffectiveFrom(item.current.effectiveFrom, new Date());
    return {
      name: item.current.name,
      description: item.current.description || '',
      kind: item.current.kind,
      amount: item.current.money.amount,
      currency: item.current.money.currency,
      effectiveFrom: suggestedNextDate,
    };
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err: any) {
      if (err instanceof FeeCatalogueApiError) {
        if (err.status === 409) {
          setError(
            'Conflito de versão ou temporal: a versão deste emolumento foi alterada ou o intervalo é inválido. Atualize a página.'
          );
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
    <main className="p-6 max-w-4xl mx-auto text-zinc-100">
      {/* Top contextual back navigation & header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors mb-3 font-medium cursor-pointer"
        >
          <span>←</span> Catálogo de Emolumentos
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-800 gap-2">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold tracking-tight text-white">Publicar Nova Versão</h2>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold">
                {item.code}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Cria uma versão subsequente (<strong className="text-emerald-400">v{item.currentVersion + 1}</strong>) preservando o histórico auditável e a rastreabilidade temporal.
            </p>
          </div>
        </div>
      </div>

      {/* Current Active Version Context Card */}
      <div className="mb-6 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Versão Atual em Vigor (v{item.currentVersion})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="flex flex-col">
            <span className="text-zinc-500">Montante atual:</span>
            <span className="font-mono text-emerald-400 font-semibold text-sm">
              {item.current.money.amount} {item.current.money.currency}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-zinc-500">Vigência iniciada em:</span>
            <span className="font-mono text-zinc-300">
              {formatDisplayDateTime(item.current.effectiveFrom)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-zinc-500">Estado operacional:</span>
            <span className="font-medium text-zinc-300 capitalize">
              {item.status === 'active' ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-amber-400/90 pt-2 border-t border-zinc-800/80 mt-2">
          A nova data de vigência é sugerida automaticamente e deve ser estritamente posterior a {formatDisplayDateTime(item.current.effectiveFrom)}.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs flex items-start justify-between gap-2">
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-900/40 space-y-5">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
              Definição da Nova Versão (v{item.currentVersion + 1})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                  className="w-full p-2.5 border border-zinc-700 rounded-lg bg-zinc-950 text-sm focus:border-emerald-500 focus:outline-hidden text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-300 mb-1 font-medium">Tipo</label>
                <input
                  required
                  value={form.kind}
                  placeholder="Ex: tuition, fee, service"
                  onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value }))}
                  className="w-full p-2.5 border border-zinc-700 rounded-lg bg-zinc-950 text-sm focus:border-emerald-500 focus:outline-hidden text-white"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
              Novos Parâmetros Monetários
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-300 mb-1 font-medium">Novo Montante</label>
                <input
                  required
                  value={form.amount}
                  placeholder="Ex: 85.00"
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full p-2.5 border border-zinc-700 rounded-lg bg-zinc-950 text-sm font-mono focus:border-emerald-500 focus:outline-hidden text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-300 mb-1 font-medium">Moeda</label>
                <input
                  required
                  value={form.currency}
                  placeholder="EUR"
                  onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                  className="w-full p-2.5 border border-zinc-700 rounded-lg bg-zinc-950 text-sm font-mono uppercase focus:border-emerald-500 focus:outline-hidden text-white"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
              Vigência da Nova Versão & Justificação
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-300 mb-1 font-medium">
                  Data Efetiva da Nova Versão (v{item.currentVersion + 1})
                </label>
                <input
                  required
                  type="datetime-local"
                  value={form.effectiveFrom}
                  onChange={(e) => setForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                  className="w-full p-2.5 border border-zinc-700 rounded-lg bg-zinc-950 text-sm font-mono focus:border-emerald-500 focus:outline-hidden text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-300 mb-1 font-medium">Descrição / Notas de alteração</label>
                <input
                  value={form.description}
                  placeholder="Ex: Atualização anual aprovada pela direção"
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full p-2.5 border border-zinc-700 rounded-lg bg-zinc-950 text-sm focus:border-emerald-500 focus:outline-hidden text-white"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors cursor-pointer"
          >
            Voltar ao catálogo
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
          >
            {submitting ? 'A guardar...' : 'Guardar nova versão'}
          </button>
        </div>
      </form>
    </main>
  );
}

export default FeeCatalogueVersionView;

