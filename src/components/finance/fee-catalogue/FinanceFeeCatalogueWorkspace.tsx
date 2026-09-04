import React, { useState, useEffect, useCallback } from 'react';
import { feeCatalogueClient, type FeeCatalogueRecord } from '../../../modules/finance/fee-catalogue-client.ts';
import { FeeCatalogueList } from './FeeCatalogueList.tsx';
import { FeeCatalogueCreateView } from './FeeCatalogueCreateView.tsx';
import { FeeCatalogueVersionView } from './FeeCatalogueVersionView.tsx';
import { FeeCatalogueHistoryView } from './FeeCatalogueHistoryView.tsx';

export type FeeCatalogueView =
  | { kind: 'list' }
  | { kind: 'create' }
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
    <FeeCatalogueList
      items={items}
      loading={loading}
      error={error}
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      onOpenCreate={() => setView({ kind: 'create' })}
      onOpenEdit={(item) => setView({ kind: 'version', item })}
      onOpenHistory={(item) => setView({ kind: 'history', item })}
      onToggleStatus={handleToggleStatus}
      onRetry={load}
      onDismissError={() => setError(null)}
    />
  );
}

export default FinanceFeeCatalogueWorkspace;
