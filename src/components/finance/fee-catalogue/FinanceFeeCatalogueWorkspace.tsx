import React, { useState, useEffect, useCallback } from 'react';
import { feeCatalogueClient, type FeeCatalogueRecord } from '../../../modules/finance/fee-catalogue-client.ts';
import { FeeCatalogueList } from './FeeCatalogueList.tsx';
import { FeeCatalogueCreateView } from './FeeCatalogueCreateView.tsx';
import { FeeCatalogueTypesView } from './FeeCatalogueTypesView.tsx';
import { FeeCatalogueVersionView } from './FeeCatalogueVersionView.tsx';
import { FeeCatalogueHistoryView } from './FeeCatalogueHistoryView.tsx';
import { FinanceDiscountPolicyView } from './FinanceDiscountPolicyView.tsx';

export type FeeCatalogueView =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'types' }
  | { kind: 'discounts' }
  | { kind: 'version'; item: FeeCatalogueRecord }
  | { kind: 'history'; item: FeeCatalogueRecord };

export interface FinanceFeeCatalogueWorkspaceProps {
  theme?: string;
}

export function FinanceFeeCatalogueWorkspace(_props: FinanceFeeCatalogueWorkspaceProps) {
  const [items, setItems] = useState<FeeCatalogueRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Single-surface deterministic state machine
  const [view, setView] = useState<FeeCatalogueView>({ kind: 'list' });

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

  const handleToggleStatus = async (item: FeeCatalogueRecord) => {
    setError(null);
    try {
      await feeCatalogueClient.setStatus(item.id, item.status === 'inactive');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Erro ao alterar estado operacional');
    }
  };

  const handleCreated = async () => {
    await load();
    setView({ kind: 'list' });
  };

  const handleUpdated = async () => {
    await load();
    setView({ kind: 'list' });
  };

  if (view.kind === 'create') {
    return (
      <FeeCatalogueCreateView
        onBack={() => setView({ kind: 'list' })}
        onCreated={handleCreated}
      />
    );
  }

  if (view.kind === 'types') {
    return (
      <FeeCatalogueTypesView
        onBack={() => setView({ kind: 'list' })}
      />
    );
  }

  if (view.kind === 'discounts') {
    return (
      <div>
        <div className="max-w-6xl mx-auto pt-4 px-4 sm:px-6 flex gap-2 border-b border-zinc-800">
          <button
            type="button"
            onClick={() => setView({ kind: 'list' })}
            className="px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer text-zinc-400 hover:text-zinc-200"
          >
            Catálogo de Emolumentos
          </button>
          <button
            type="button"
            onClick={() => setView({ kind: 'discounts' })}
            className="px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer bg-zinc-900 text-emerald-400 border-t border-x border-zinc-700"
          >
            Políticas de Desconto
          </button>
        </div>
        <FinanceDiscountPolicyView
          onBack={() => setView({ kind: 'list' })}
        />
      </div>
    );
  }

  if (view.kind === 'version') {
    return (
      <FeeCatalogueVersionView
        item={view.item}
        onBack={() => setView({ kind: 'list' })}
        onUpdated={handleUpdated}
      />
    );
  }

  if (view.kind === 'history') {
    return (
      <FeeCatalogueHistoryView
        item={view.item}
        onBack={() => setView({ kind: 'list' })}
      />
    );
  }

  return (
    <div>
      <div className="max-w-6xl mx-auto pt-4 px-4 sm:px-6 flex gap-2 border-b border-zinc-800">
        <button
          type="button"
          onClick={() => setView({ kind: 'list' })}
          className="px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer bg-zinc-900 text-emerald-400 border-t border-x border-zinc-700"
        >
          Catálogo de Emolumentos
        </button>
        <button
          type="button"
          onClick={() => setView({ kind: 'discounts' })}
          className="px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer text-zinc-400 hover:text-zinc-200"
        >
          Políticas de Desconto
        </button>
      </div>
      <FeeCatalogueList
        items={items}
        loading={loading}
        error={error}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onOpenCreate={() => setView({ kind: 'create' })}
        onOpenTypes={() => setView({ kind: 'types' })}
        onOpenEdit={(item) => setView({ kind: 'version', item })}
        onOpenHistory={(item) => setView({ kind: 'history', item })}
        onToggleStatus={handleToggleStatus}
        onRetry={load}
        onDismissError={() => setError(null)}
      />
    </div>
  );
}

export default FinanceFeeCatalogueWorkspace;
