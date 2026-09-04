import React from 'react';
import type { FeeCatalogueRecord } from '../../../modules/finance/fee-catalogue-client.ts';
import { formatDisplayDate } from './fee-catalogue-date.ts';

export interface FeeCatalogueListProps {
  items: FeeCatalogueRecord[];
  loading: boolean;
  error: string | null;
  statusFilter: 'all' | 'active' | 'inactive';
  onStatusFilterChange: (filter: 'all' | 'active' | 'inactive') => void;
  onOpenCreate: () => void;
  onOpenTypes: () => void;
  onOpenEdit: (item: FeeCatalogueRecord) => void;
  onOpenHistory: (item: FeeCatalogueRecord) => void;
  onToggleStatus: (item: FeeCatalogueRecord) => Promise<void>;
  onRetry: () => void;
  onDismissError: () => void;
}

export function FeeCatalogueList({
  items,
  loading,
  error,
  statusFilter,
  onStatusFilterChange,
  onOpenCreate,
  onOpenTypes,
  onOpenEdit,
  onOpenHistory,
  onToggleStatus,
  onRetry,
  onDismissError,
}: FeeCatalogueListProps) {
  if (loading && items.length === 0) {
    return (
      <main className="p-6 max-w-6xl mx-auto text-zinc-100">
        <h2 className="text-xl font-bold tracking-tight text-white mb-4">Catálogo de Emolumentos</h2>
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
          <h2 className="text-xl font-bold tracking-tight text-white">Catálogo de Emolumentos</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Definições financeiras institucionais e vigência temporal de propinas. Não gera cobranças ou pagamentos diretos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-zinc-700/60 bg-zinc-900/60 p-1 text-xs">
            <button
              type="button"
              onClick={() => onStatusFilterChange('all')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-emerald-500/20 text-emerald-400 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => onStatusFilterChange('active')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-emerald-500/20 text-emerald-400 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Ativos
            </button>
            <button
              type="button"
              onClick={() => onStatusFilterChange('inactive')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-zinc-700 text-zinc-200 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Inativos
            </button>
          </div>
          <button
            type="button"
            onClick={onOpenTypes}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-colors cursor-pointer"
          >
            Gerir tipos
          </button>
          <button
            type="button"
            onClick={onOpenCreate}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm cursor-pointer"
          >
            + Novo emolumento
          </button>
        </div>
      </header>

      {error && (
        <div className="p-4 mb-6 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-sm flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="font-semibold text-xs tracking-wider uppercase text-rose-400 mb-0.5">Erro Operacional</p>
            <p>{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 underline text-sm hover:text-rose-300 block cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            className="text-rose-400 hover:text-rose-200 text-xs px-2 py-1 rounded border border-rose-800/50 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Catalogue List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-300 tracking-wide">
            Emolumentos Registados ({items.length})
          </h3>
        </div>

        {items.length === 0 ? (
          <div className="border border-zinc-800 rounded-xl p-12 text-center bg-zinc-900/20">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-400 font-mono text-lg">
              €
            </div>
            <p className="text-zinc-300 font-medium text-sm">Ainda não existem emolumentos neste catálogo.</p>
            <p className="text-zinc-500 text-xs mt-1 max-w-sm mx-auto">
              Utilize o botão <strong className="text-emerald-400">+ Novo emolumento</strong> acima para registar a primeira taxa ou propina institucional.
            </p>
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
                      <span className="text-zinc-300 font-medium">
                        {i.current.feeType?.displayName || i.feeType?.displayName || i.current.kind}
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span>Desde: {formatDisplayDate(i.current.effectiveFrom)}</span>
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
                      onClick={() => onOpenHistory(i)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors cursor-pointer"
                    >
                      Histórico
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenEdit(i)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors cursor-pointer"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void onToggleStatus(i)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
                        i.status === 'active'
                          ? 'border-zinc-700 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-300'
                          : 'border-emerald-700/60 hover:bg-emerald-950/40 text-emerald-400'
                      }`}
                    >
                      {i.status === 'active' ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default FeeCatalogueList;
