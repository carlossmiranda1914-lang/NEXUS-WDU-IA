import React, { useEffect, useState } from 'react';
import { feeCatalogueClient, type FeeCatalogueRecord } from '../../../modules/finance/fee-catalogue-client.ts';
import { formatDisplayDateTime } from './fee-catalogue-date.ts';

export interface FeeCatalogueHistoryViewProps {
  item: FeeCatalogueRecord;
  onBack: () => void;
}

export function FeeCatalogueHistoryView({ item, onBack }: FeeCatalogueHistoryViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<FeeCatalogueRecord | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    feeCatalogueClient
      .get(item.id, true)
      .then((res: any) => {
        if (active) {
          setHistoryData(res as FeeCatalogueRecord);
        }
      })
      .catch((err: any) => {
        if (active) {
          setError(err?.message || 'Falha ao carregar histórico');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [item.id]);

  const versions = historyData?.history || [];

  return (
    <main className="p-6 max-w-4xl mx-auto text-zinc-100">
      {/* Top contextual back navigation & header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors mb-3 font-medium cursor-pointer"
        >
          <span>←</span> Catálogo de Emolumentos
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-800 gap-2">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold tracking-tight text-white">Histórico de Versões</h2>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold">
                {item.code}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Rastreabilidade temporal imutável de todas as versões publicadas para este emolumento.
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="py-16 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-zinc-400">A carregar versões registadas...</p>
        </div>
      )}

      {error && (
        <div className="p-4 mb-6 rounded-lg bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold uppercase tracking-wider text-rose-400 text-[10px]">Erro Operacional</p>
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

      {!loading && !error && versions.length === 0 && (
        <div className="border border-zinc-800 rounded-xl p-12 text-center bg-zinc-900/20">
          <p className="text-xs text-zinc-400">Nenhuma versão histórica registada.</p>
        </div>
      )}

      {!loading && !error && versions.length > 0 && (
        <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-900/40 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Linha Temporal de Vigência ({versions.length} {versions.length === 1 ? 'versão' : 'versões'})
          </h3>
          <div className="divide-y divide-zinc-800/80">
            {versions.map((ver) => {
              const isCurrent = ver.version === item.currentVersion;
              return (
                <div key={ver.id || ver.version} className="py-4 space-y-2 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-xs px-2.5 py-0.5 rounded font-bold border ${
                          isCurrent
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        v{ver.version} {isCurrent && '— Atual'}
                      </span>
                      <strong className="text-sm text-zinc-200">{ver.name}</strong>
                      <span className="text-xs text-zinc-500 capitalize">({ver.kind})</span>
                    </div>
                    <span className="font-mono text-emerald-400 font-semibold text-sm">
                      {ver.money.amount} {ver.money.currency}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-2 font-mono">
                    <span>Vigência:</span>
                    <span className="text-zinc-300">{formatDisplayDateTime(ver.effectiveFrom)}</span>
                    <span>→</span>
                    <span className={ver.effectiveTo ? 'text-zinc-300' : 'text-emerald-400 font-medium'}>
                      {ver.effectiveTo ? formatDisplayDateTime(ver.effectiveTo) : 'Atualidade'}
                    </span>
                  </div>

                  {ver.description && (
                    <p className="text-xs text-zinc-400 italic bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-800/60">
                      {ver.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end pt-6">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-xs font-medium rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors cursor-pointer"
        >
          Voltar ao catálogo
        </button>
      </div>
    </main>
  );
}

export default FeeCatalogueHistoryView;
