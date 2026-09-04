import React, { useEffect, useState } from 'react';
import { feeCatalogueClient, type FeeCatalogueRecord } from '../../../modules/finance/fee-catalogue-client.ts';
import { formatDisplayDate, formatDisplayDateTime } from './fee-catalogue-date.ts';

export interface FeeCatalogueHistoryDialogProps {
  item: FeeCatalogueRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FeeCatalogueHistoryDialog({ item, isOpen, onClose }: FeeCatalogueHistoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<FeeCatalogueRecord | null>(null);

  useEffect(() => {
    if (isOpen && item) {
      setLoading(true);
      setError(null);
      feeCatalogueClient
        .get(item.id, true)
        .then((res: any) => {
          setHistoryData(res as FeeCatalogueRecord);
        })
        .catch((err: any) => {
          setError(err?.message || 'Falha ao carregar histórico');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setHistoryData(null);
      setError(null);
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const versions = historyData?.history || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="border border-zinc-700/70 rounded-2xl p-6 bg-zinc-900 shadow-2xl max-w-2xl w-full text-zinc-100 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-zinc-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base text-white">Histórico de Versões</h3>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold">
                {item.code}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Rastreabilidade temporal imutável de todas as versões publicadas para este emolumento.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-lg p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {loading && (
          <div className="py-8 text-center space-y-2">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-zinc-400">A carregar versões registadas...</p>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {!loading && !error && versions.length === 0 && (
          <p className="text-xs text-zinc-400 py-6 text-center">Nenhuma versão histórica registada.</p>
        )}

        {!loading && !error && versions.length > 0 && (
          <div className="space-y-3 pt-1">
            <div className="divide-y divide-zinc-800/80">
              {versions.map((ver, idx) => {
                const isCurrent = ver.version === item.currentVersion;
                return (
                  <div key={ver.id || ver.version} className="py-3.5 space-y-2 first:pt-1 last:pb-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs px-2 py-0.5 rounded font-bold border ${
                          isCurrent
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}>
                          v{ver.version} {isCurrent && '• Atual'}
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
                      <span>$\rightarrow$</span>
                      <span className={ver.effectiveTo ? 'text-zinc-300' : 'text-emerald-400 font-medium'}>
                        {ver.effectiveTo ? formatDisplayDateTime(ver.effectiveTo) : 'Atualidade'}
                      </span>
                    </div>

                    {ver.description && (
                      <p className="text-xs text-zinc-400 italic bg-zinc-950/40 p-2 rounded border border-zinc-800/60">
                        {ver.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
