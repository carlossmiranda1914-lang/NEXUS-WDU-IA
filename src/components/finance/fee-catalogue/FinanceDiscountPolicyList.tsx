import React from 'react';
import type { DiscountPolicySummary } from '../../../modules/finance/discount-policy-model.ts';

export interface FinanceDiscountPolicyListProps {
  policies: readonly DiscountPolicySummary[];
  onOpenVersion: (policy: DiscountPolicySummary) => void;
  onOpenArchive: (policy: DiscountPolicySummary) => void;
}

function formatDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function FinanceDiscountPolicyList({
  policies,
  onOpenVersion,
  onOpenArchive,
}: FinanceDiscountPolicyListProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-900/40 shadow-sm">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 font-medium">
            <th className="py-3 px-4">Código / Nome</th>
            <th className="py-3 px-4">Modalidade</th>
            <th className="py-3 px-4">Valor Vigente</th>
            <th className="py-3 px-4">Versão</th>
            <th className="py-3 px-4">Vigência</th>
            <th className="py-3 px-4">Estado</th>
            <th className="py-3 px-4 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {policies.map((p) => {
            const isArchived = p.status === 'archived';
            const hasFutureVersion =
              p.latestVersion.version > (p.currentApplicableVersion?.version || 0);
            const activeVer = p.currentApplicableVersion || p.latestVersion;
            const fromStr = formatDate(activeVer.effectiveFrom);
            const toStr = formatDate(activeVer.effectiveTo);

            return (
              <tr
                key={p.id}
                className={`hover:bg-zinc-800/30 transition-colors ${
                  isArchived ? 'opacity-50' : ''
                }`}
              >
                <td className="py-3.5 px-4">
                  <div className="font-semibold text-white tracking-wide">{p.code}</div>
                  <div className="text-zinc-400 text-[11px] truncate max-w-xs">{activeVer.name}</div>
                </td>
                <td className="py-3.5 px-4">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                      activeVer.calculationMode === 'percentage'
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                        : 'bg-blue-950/60 text-blue-300 border border-blue-800/50'
                    }`}
                  >
                    {activeVer.calculationMode === 'percentage' ? 'Percentagem (%)' : 'Valor Fixo'}
                  </span>
                </td>
                <td className="py-3.5 px-4 font-mono font-medium text-zinc-200">
                  {activeVer.calculationMode === 'percentage'
                    ? `${activeVer.value}%`
                    : `${activeVer.value} ${activeVer.currency || 'EUR'}`}
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-zinc-300 text-[11px]">v{activeVer.version}</span>
                    {hasFutureVersion && (
                      <span
                        className="px-1.5 py-0.2 bg-amber-950/60 text-amber-300 border border-amber-800/40 rounded text-[9px]"
                        title={`v${p.latestVersion.version} agendada`}
                      >
                        v{p.latestVersion.version} agendada
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3.5 px-4 text-zinc-400 text-[11px]">
                  {fromStr && toStr
                    ? `${fromStr} — ${toStr}`
                    : fromStr
                    ? `Desde ${fromStr}`
                    : 'Indefinida'}
                </td>
                <td className="py-3.5 px-4">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      isArchived
                        ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        : 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                    }`}
                  >
                    {isArchived ? 'Arquivada' : 'Ativa'}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right">
                  {!isArchived && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenVersion(p)}
                        className="px-2.5 py-1 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium transition-colors"
                        aria-label={`Criar nova versão para ${p.code}`}
                      >
                        Nova Versão
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenArchive(p)}
                        className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-red-950/50 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-800/50 text-[11px] transition-colors"
                        aria-label={`Arquivar política ${p.code}`}
                      >
                        Arquivar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
