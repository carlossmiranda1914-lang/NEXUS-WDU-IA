import React, { useEffect, useState } from 'react';
import { feeCatalogueClient, type FeeCatalogueRecord } from '../modules/finance/fee-catalogue-client.ts';

const blank = {
  code: '',
  name: '',
  description: '',
  kind: 'fee',
  amount: '',
  currency: 'EUR',
  effectiveFrom: new Date().toISOString().slice(0, 16),
};

export default function FinanceFeeCatalogueWorkspace({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  const [items, setItems] = useState<FeeCatalogueRecord[]>([]);
  const [form, setForm] = useState<any>(blank);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<FeeCatalogueRecord | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await feeCatalogueClient.list());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar catálogo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await feeCatalogueClient.update(editing.id, { ...form, expectedVersion: editing.currentVersion });
      } else {
        await feeCatalogueClient.create(form);
      }
      setForm(blank);
      setEditing(null);
      setError('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  if (loading) {
    return (
      <main className="p-6 text-zinc-400" role="status">
        A carregar catálogo...
      </main>
    );
  }

  if (error && items.length === 0) {
    return (
      <main className="p-6" role="alert">
        <p className="text-rose-400">{error}</p>
        <button onClick={() => void load()} className="mt-3 underline text-sm hover:text-rose-300">
          Tentar novamente
        </button>
      </main>
    );
  }

  const isLight = theme === 'light';

  return (
    <main className={`p-6 max-w-5xl mx-auto text-left ${isLight ? 'text-slate-900' : 'text-zinc-100'}`}>
      <header className="mb-6">
        <h2 className="text-xl font-bold">Finance — Fee / Emolument Catalogue</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Definições institucionais; não cria obrigações nem pagamentos.
        </p>
      </header>

      {error && (
        <div role="alert" className="p-3 mb-4 rounded border border-rose-500/30 bg-rose-500/10 text-rose-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="border border-zinc-700/40 rounded-lg p-4 mb-6 bg-zinc-900/50 space-y-4">
        <h3 className="font-semibold text-sm text-zinc-300">
          {editing ? `Editar versão de ${editing.code}` : 'Novo emolumento / taxa'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Código</label>
            <input
              required
              disabled={!!editing}
              value={form.code}
              placeholder="Ex: PROP-MENSAL"
              onChange={(e) => setForm((prev: any) => ({ ...prev, code: e.target.value }))}
              className="w-full p-2 border border-zinc-700 rounded bg-zinc-900 text-sm disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Nome</label>
            <input
              required
              value={form.name}
              placeholder="Ex: Propinas Mensais"
              onChange={(e) => setForm((prev: any) => ({ ...prev, name: e.target.value }))}
              className="w-full p-2 border border-zinc-700 rounded bg-zinc-900 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Tipo</label>
            <input
              required
              value={form.kind}
              placeholder="Ex: tuition, fee, service"
              onChange={(e) => setForm((prev: any) => ({ ...prev, kind: e.target.value }))}
              className="w-full p-2 border border-zinc-700 rounded bg-zinc-900 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Montante</label>
            <input
              required
              value={form.amount}
              placeholder="Ex: 50.00"
              onChange={(e) => setForm((prev: any) => ({ ...prev, amount: e.target.value }))}
              className="w-full p-2 border border-zinc-700 rounded bg-zinc-900 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Moeda</label>
            <input
              required
              value={form.currency}
              placeholder="EUR"
              onChange={(e) => setForm((prev: any) => ({ ...prev, currency: e.target.value }))}
              className="w-full p-2 border border-zinc-700 rounded bg-zinc-900 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Data Efetiva</label>
            <input
              required
              type="datetime-local"
              value={form.effectiveFrom}
              onChange={(e) => setForm((prev: any) => ({ ...prev, effectiveFrom: e.target.value }))}
              className="w-full p-2 border border-zinc-700 rounded bg-zinc-900 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-400 mb-1">Descrição (opcional)</label>
            <input
              value={form.description || ''}
              placeholder="Descrição ou notas adicionais"
              onChange={(e) => setForm((prev: any) => ({ ...prev, description: e.target.value }))}
              className="w-full p-2 border border-zinc-700 rounded bg-zinc-900 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(blank);
              }}
              className="px-4 py-2 text-sm rounded border border-zinc-700 hover:bg-zinc-800"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium rounded bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {editing ? 'Guardar nova versão' : 'Criar catálogo'}
          </button>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="text-zinc-400 text-sm py-4">Ainda não existem emolumentos neste catálogo.</p>
      ) : (
        <div className="space-y-3">
          {items.map((i) => (
            <article
              key={i.id}
              className="border border-zinc-700/40 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/30"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-wide">{i.code}</span>
                  <span className="text-zinc-500">•</span>
                  <span className="text-sm">{i.current.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      i.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                    }`}
                  >
                    {i.status}
                  </span>
                </div>
                <div className="text-xs text-zinc-400 mt-1 flex flex-wrap gap-2">
                  <span>
                    {i.current.money.amount} {i.current.money.currency}
                  </span>
                  <span>•</span>
                  <span>{i.current.kind}</span>
                  <span>•</span>
                  <span>v{i.currentVersion}</span>
                  {i.current.description && (
                    <>
                      <span>•</span>
                      <span className="italic">{i.current.description}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(i);
                    setForm({
                      code: i.code,
                      name: i.current.name,
                      description: i.current.description || '',
                      kind: i.current.kind,
                      amount: i.current.money.amount,
                      currency: i.current.money.currency,
                      effectiveFrom: new Date().toISOString().slice(0, 16),
                    });
                  }}
                  className="px-3 py-1.5 text-xs rounded border border-zinc-700 hover:bg-zinc-800"
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
                  className="px-3 py-1.5 text-xs rounded border border-zinc-700 hover:bg-zinc-800"
                >
                  {i.status === 'active' ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
