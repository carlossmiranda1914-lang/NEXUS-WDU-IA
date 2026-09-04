import React, { useState, useEffect, useCallback } from 'react';
import { feeCatalogueClient, type FeeCatalogueRecord } from '../../../modules/finance/fee-catalogue-client.ts';
import { FeeCatalogueList } from './FeeCatalogueList.tsx';
import { FeeCatalogueCreateDialog } from './FeeCatalogueCreateDialog.tsx';
import { FeeCatalogueVersionDialog } from './FeeCatalogueVersionDialog.tsx';
import { FeeCatalogueHistoryDialog } from './FeeCatalogueHistoryDialog.tsx';

export interface FinanceFeeCatalogueWorkspaceProps {
  theme?: string;
}

export function FinanceFeeCatalogueWorkspace(_props: FinanceFeeCatalogueWorkspaceProps) {
  const [items, setItems] = useState<FeeCatalogueRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FeeCatalogueRecord | null>(null);
  const [historyItem, setHistoryItem] = useState<FeeCatalogueRecord | null>(null);

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

  return (
    <>
      <FeeCatalogueList
        items={items}
        loading={loading}
        error={error}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenEdit={(item) => setEditingItem(item)}
        onOpenHistory={(item) => setHistoryItem(item)}
        onToggleStatus={handleToggleStatus}
        onRetry={load}
        onDismissError={() => setError(null)}
      />

      <FeeCatalogueCreateDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={load}
      />

      <FeeCatalogueVersionDialog
        item={editingItem}
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        onUpdated={load}
      />

      <FeeCatalogueHistoryDialog
        item={historyItem}
        isOpen={Boolean(historyItem)}
        onClose={() => setHistoryItem(null)}
      />
    </>
  );
}

export default FinanceFeeCatalogueWorkspace;
