import React, { useState, useEffect, useCallback } from 'react';
import {
  financialObligationClient,
  type FinancialObligationRecord,
} from '../../../modules/finance/financial-obligation-client.ts';
import { AuroraPageHeader } from '../../aurora/AuroraPageHeader.tsx';

export interface FinancialObligationsListViewProps {
  refreshTrigger: number;
  onOpenCreate: () => void;
  onOpenAccounts: () => void;
}

export function FinancialObligationsListView({
  refreshTrigger,
  onOpenCreate,
  onOpenAccounts,
}: FinancialObligationsListViewProps) {
  const [items, setItems] = useState<FinancialObligationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await financialObligationClient.listObligations()) as FinancialObligationRecord[];
      setItems(data || []);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar obrigações financeiras');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems, refreshTrigger]);

  const filteredItems = (items || []).filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (item.accountNumber && item.accountNumber.toLowerCase().includes(q)) ||
      (item.accountName && item.accountName.toLowerCase().includes(q)) ||
      (item.feeItemCode && item.feeItemCode.toLowerCase().includes(q)) ||
      (item.feeItemName && item.feeItemName.toLowerCase().includes(q)) ||
      (item.beneficiaryName && item.beneficiaryName.toLowerCase().includes(q)) ||
      (item.sourceType && item.sourceType.toLowerCase().includes(q)) ||
      item.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto text-zinc-100">
      {/* Header */}
      <AuroraPageHeader
        title="Obrigações Financeiras"
        titleTestId="obligations-list-title"
        description="Gestão e emissão de montantes legítimos a cobrar associados a contas financeiras e catálogo de emolumentos."
        actions={<div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="manage-accounts-button"
            onClick={onOpenAccounts}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
          >
            Gerir contas financeiras
          </button>
          <button
            type="button"
            data-testid="new-obligation-button"
            onClick={onOpenCreate}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors cursor-pointer flex items-center gap-2"
          >
            <span>+</span> Nova obrigação
          </button>
        </div>}
      />

      {/* Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
        <div className="text-xs text-zinc-400">
          Total registado: <span className="font-semibold text-zinc-200">{filteredItems.length}</span> obrigações abertas
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Pesquisar por conta, código, beneficiário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Content */}
      <div className="mt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs">A carregar obrigações...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-red-950/40 border border-red-900 text-red-300 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={loadItems}
              className="px-2.5 py-1 bg-red-900/60 hover:bg-red-800 rounded text-red-200 font-medium"
            >
              Tentar novamente
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
            <div className="w-12 h-12 mx-auto rounded-full bg-zinc-800/60 flex items-center justify-center text-zinc-500 mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-zinc-300">Nenhuma obrigação financeira encontrada</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              Emita uma nova obrigação financeira a partir do catálogo oficial de emolumentos para uma conta de responsabilidade.
            </p>
            <button
              type="button"
              onClick={onOpenCreate}
              className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <span>+</span> Nova obrigação
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-900/30">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-900/60">
                  <th className="py-3 px-4 font-semibold">Conta Financeira</th>
                  <th className="py-3 px-4 font-semibold">Beneficiário</th>
                  <th className="py-3 px-4 font-semibold">Emolumento / Código</th>
                  <th className="py-3 px-4 font-semibold text-right">Montante (Snapshot)</th>
                  <th className="py-3 px-4 font-semibold">Origem</th>
                  <th className="py-3 px-4 font-semibold">Data Emissão</th>
                  <th className="py-3 px-4 font-semibold">Vencimento</th>
                  <th className="py-3 px-4 font-semibold text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-white">
                      <div>{item.accountNumber || 'Conta'}</div>
                      <div className="text-[11px] text-zinc-500">{item.accountName || item.financialAccountId}</div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300">
                      {item.beneficiaryName || <span className="text-zinc-500 italic">Titular da Conta</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-zinc-200">{item.feeItemName || 'Emolumento'}</div>
                      <div className="text-[11px] text-zinc-500 font-mono">
                        {item.feeItemCode} (v{item.feeCatalogueVersion})
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                      {item.money.amount} {item.money.currency}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400 text-xs">
                      {item.sourceType === 'manual_finance'
                        ? 'Emissão Manual'
                        : item.sourceType === 'enrollment'
                          ? 'Matrícula'
                          : item.sourceType}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400">
                      {new Date(item.effectiveAt).toLocaleDateString('pt-PT')}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400">
                      {item.dueAt ? new Date(item.dueAt).toLocaleDateString('pt-PT') : <span className="text-zinc-500">-</span>}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                          item.status === 'open'
                            ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300'
                            : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                        }`}
                      >
                        {item.status === 'open' ? 'Aberta' : 'Cancelada (Histórico)'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
