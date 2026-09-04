import React, { useEffect, useState, useCallback } from 'react';
import { feeCatalogueClient, type FeeCatalogueRecord } from '../modules/finance/fee-catalogue-client.ts';

interface WorkspaceProps {
  theme?: string;
}

const blank = {
  code: '',
  name: '',
  description: '',
  kind: 'fee',
  amount: '',
  currency: 'EUR',
  effectiveFrom: '',
};

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function FinanceFeeCatalogueWorkspace(_props: WorkspaceProps) {
  const [items, setItems] = useState<FeeCatalogueRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FeeCatalogueRecord | null>(null);
  const [form, setForm] = useState(blank);
  const [submitting, setSubmitting] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<FeeCatalogueRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await feeCatalogueClient.list(statusFilter)) as FeeCatalogueRecord[];
      setItems(data);
    } catch (err: any) {
      setError(err?.message || 'Falha de rede ao carregar catálogo');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadHistory = async (id: string) => {
    if (expandedHistoryId === id) {
      setExpandedHistoryId(null);
      setHistoryItems(null);
      return;
    }
    try {
      const full = (await feeCatalogueClient.get(id, true)) as FeeCatalogueRecord;
      setExpandedHistoryId(id);
      setHistoryItems(full);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar histórico de versões');
    }
  };

  const startEdit = (item: FeeCatalogueRecord) => {
    const currentEffectiveFrom = new Date(item.current.effectiveFrom);
    const now = new Date();
    // Suggest next valid timestamp strictly posterior to current version effectiveFrom
    const defaultDate = now.getTime() > currentEffectiveFrom.getTime()
      ? now
      : new Date(currentEffectiveFrom.getTime() + 60 * 60 * 1000);

    setEditing(item);
    setForm({
      code: item.code,
      name: item.current.name,
      description: item.current.description || '',
      kind: item.current.kind,
      amount: item.current.money.amount,
      currency: item.current.money.currency,
      effectiveFrom: toLocalDatetimeString(defaultDate),
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm(blank);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const normalizedAmount = form.amount.trim().replace(',', '.');
    const effectiveDate = form.effectiveFrom ? new Date(form.effectiveFrom) : new Date();

    if (Number.isNaN(effectiveDate.getTime())) {
      setError('Data efetiva inválida.');
      setSubmitting(false);
      return;
    }

    try {
      if (editing) {
        await feeCatalogueClient.update(editing.id, {
          expectedVersion: editing.currentVersion,
          name: form.name.trim(),
          description: form.description.trim() || null,
          kind: form.kind.trim(),
          amount: normalizedAmount,
          currency: form.currency.trim().toUpperCase(),
          effectiveFrom: effectiveDate.toISOString(),
        });
      } else {
        await feeCatalogueClient.create({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          description: form.description.trim() || null,
          kind: form.kind.trim(),
          amount: normalizedAmount,
          currency: form.currency.trim().toUpperCase(),
          effectiveFrom: effectiveDate.toISOString(),
        });
      }
      setEditing(null);
      setForm(blank);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Erro ao gravar catálogo');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && items.length === 0) {
    return (
      <main className="p-6 max-w-6xl mx-auto text-zinc-100">
        <h2 className="text-xl font-bold tracking-tight text-white mb-4">Fee / Emolument Catalogue</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-10 bg-zinc-800 rounded w-1/4"></div>
          <div className="h-32 bg-zinc-800/60 rounded"></div>
          <div className="h-24 bg-zinc-800/40 rounded"></div>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto text-zinc-100">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-800 mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Fee / Emolument Catalogue</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Governação institucional de preços, versões temporais e ciclo de vida de propinas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-zinc-700/60 bg-zinc-900/60 p-1 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-md transition-colors ${
                statusFilter === 'all' ? 'bg-emerald-500/20 text-emerald-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-md transition-colors ${
                statusFilter === 'active' ? 'bg-emerald-500/20 text-emerald-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Ativos
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1 rounded-md transition-colors ${
                statusFilter === 'inactive' ? 'bg-zinc-700 text-zinc-200 font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Inativos
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm(blank);
              setError(null);
            }}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            + Novo Emolumento
          </button>
        </div>
      </header>

      {error && (
        <div className="p-4 mb-6 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-sm flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="font-semibold text-xs tracking-wider uppercase text-rose-400 mb-0.5">Erro Operacional</p>
            <p>{error}</p>
            {error.includes('Falha de rede') && (
              <button
                type="button"
                onClick={load}
                className="mt-3 underline text-sm hover:text-rose-300"
              >
                Tentar novamente
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs px-2 py-1 rounded border border-rose-800/50"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Structured Create vs Edit Form */}
      <form onSubmit={submit} className="border border-zinc-700/60 rounded-xl p-5 mb-8 bg-zinc-900/60 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div>
            <h3 className="font-semibold text-sm text-zinc-200">
              {editing ? `Publicar nova versão de ${editing.code}` : 'Novo emolumento / taxa'}
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {editing
                ? `Cria uma versão subsequente (v${editing.currentVersion + 1}) preservando a rastreabilidade histórica.`
                : 'Define os parâmetros monetários e a data de vigência do novo item (v1).'}
            </p>
          </div>
          {editing && (
            <span className="text-xs px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
              Modo Edição • v{editing.currentVersion} $\rightarrow$ v{editing.currentVersion + 1}
            </span>
          )}
        </div>

        {editing && (
          <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800 text-xs text-zinc-300 space-y-1">
            <p>
              <span className="text-zinc-500 font-medium">Versão atual em vigor:</span>{' '}
              <strong className="text-zinc-200">v{editing.currentVersion}</strong> ({editing.current.name})
            </p>
            <p>
              <span className="text-zinc-500 font-medium">Ativa desde:</span>{' '}
              <span className="font-mono text-emerald-400">{new Date(editing.current.effectiveFrom).toLocaleString('pt-PT')}</span>
            </p>
            <p className="text-[11px] text-amber-400/90 pt-1">
              $\bullet$ A nova data de início deve ser estritamente posterior a{' '}
              <strong>{new Date(editing.current.effectiveFrom).toLocaleString('pt-PT')}</strong>.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1 font-medium">Código</label>
            <input
              required
              disabled={!!editing}
              value={form.code}
              placeholder="Ex: PROP-MENSAL"
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
              className="w-full p-2 border border-zinc-700 rounded-lg bg-zinc-950 text-sm disabled:opacity-50 font-mono uppercase"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1 font-medium">Nome</label>
            <input
              required
              value={form.name}
              placeholder="Ex: Propinas Mensais"
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full p-2 border border-zinc-700 rounded-lg bg-zinc-950 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1 font-medium">Tipo</label>
            <input
              required
              value={form.kind}
              placeholder="Ex: tuition, fee, service"
              onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value }))}
              className="w-full p-2 border border-zinc-700 rounded-lg bg-zinc-950 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1 font-medium">Montante</label>
            <input
              required
              value={form.amount}
              placeholder="Ex: 50.00"
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              className="w-full p-2 border border-zinc-700 rounded-lg bg-zinc-950 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1 font-medium">Moeda</label>
            <input
              required
              value={form.currency}
              placeholder="EUR"
              onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
              className="w-full p-2 border border-zinc-700 rounded-lg bg-zinc-950 text-sm font-mono uppercase"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1 font-medium">
              {editing ? 'Data Efetiva (início da nova versão)' : 'Data Efetiva (início v1)'}
            </label>
            <input
              required
              type="datetime-local"
              value={form.effectiveFrom}
              onChange={(e) => setForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
              className="w-full p-2 border border-zinc-700 rounded-lg bg-zinc-950 text-sm font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-400 mb-1 font-medium">Descrição (opcional)</label>
            <input
              value={form.description || ''}
              placeholder="Descrição ou termos adicionais de cobrança"
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full p-2 border border-zinc-700 rounded-lg bg-zinc-950 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-3 border-t border-zinc-800">
          {editing && (
            <button
              type="button"
              onClick={cancelEdit}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 shadow"
          >
            {submitting ? 'A processar...' : editing ? 'Guardar nova versão' : 'Criar catálogo'}
          </button>
        </div>
      </form>

      {/* Catalogue List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-300 tracking-wide">
            Emolumentos Registados ({items.length})
          </h3>
        </div>

        {items.length === 0 ? (
          <div className="border border-zinc-800 rounded-xl p-8 text-center bg-zinc-900/20">
            <p className="text-zinc-400 text-sm">Ainda não existem emolumentos neste catálogo.</p>
            <p className="text-zinc-500 text-xs mt-1">Utilize o formulário acima para registar a primeira taxa.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((i) => (
              <article
                key={i.id}
                className="border border-zinc-700/40 rounded-xl p-4 bg-zinc-900/40 hover:border-zinc-700 transition-all shadow-sm flex flex-col gap-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm tracking-wide font-mono text-white">{i.code}</span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-sm font-medium text-zinc-200">{i.current.name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          i.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-700/30 text-zinc-400 border border-zinc-600/30'
                        }`}
                      >
                        {i.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/50 font-mono">
                        v{i.currentVersion}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-emerald-400 font-semibold">
                        {i.current.money.amount} {i.current.money.currency}
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="capitalize text-zinc-300">{i.current.kind}</span>
                      <span className="text-zinc-600">•</span>
                      <span>Desde: {new Date(i.current.effectiveFrom).toLocaleDateString('pt-PT')}</span>
                      {i.current.description && (
                        <>
                          <span className="text-zinc-600">•</span>
                          <span className="italic text-zinc-400">{i.current.description}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => loadHistory(i.id)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors"
                    >
                      {expandedHistoryId === i.id ? 'Ocultar Histórico' : 'Histórico'}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(i)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void feeCatalogueClient
                          .setStatus(i.id, i.status === 'inactive')
                          .then(load)
                          .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao alterar estado'))
                      }
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        i.status === 'active'
                          ? 'border-zinc-700 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-300'
                          : 'border-emerald-700/60 hover:bg-emerald-950/40 text-emerald-400'
                      }`}
                    >
                      {i.status === 'active' ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>

                {/* Expanded Version History */}
                {expandedHistoryId === i.id && historyItems?.history && (
                  <div className="mt-2 pt-3 border-t border-zinc-800/80 bg-zinc-950/50 rounded-lg p-3 space-y-2">
                    <h4 className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">
                      Histórico de Versões ({historyItems.history.length})
                    </h4>
                    <div className="divide-y divide-zinc-800/60">
                      {historyItems.history.map((ver) => (
                        <div key={ver.version} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-zinc-300">v{ver.version}</span>
                            <span className="text-zinc-200">{ver.name}</span>
                            <span className="font-mono text-emerald-400">
                              {ver.money.amount} {ver.money.currency}
                            </span>
                            {ver.description && <span className="text-zinc-500 italic">({ver.description})</span>}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono">
                            {new Date(ver.effectiveFrom).toLocaleDateString('pt-PT')}
                            {ver.effectiveTo ? ` $\rightarrow$ ${new Date(ver.effectiveTo).toLocaleDateString('pt-PT')}` : ' $\rightarrow$ Atualidade'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default FinanceFeeCatalogueWorkspace;
