import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  discountPolicyClient,
  type DiscountPolicyApiClient,
  type CreateDiscountPolicyInput,
  type CreateDiscountPolicyVersionInput,
} from '../../../modules/finance/discount-policy-client.ts';
import type { DiscountPolicySummary } from '../../../modules/finance/discount-policy-model.ts';
import { FinanceDiscountPolicyList } from './FinanceDiscountPolicyList.tsx';
import { FinanceDiscountPolicyCreateDialog } from './FinanceDiscountPolicyCreateDialog.tsx';
import { FinanceDiscountPolicyVersionDialog } from './FinanceDiscountPolicyVersionDialog.tsx';
import { FinanceDiscountPolicyArchiveDialog } from './FinanceDiscountPolicyArchiveDialog.tsx';

export interface FinanceDiscountPolicyViewProps {
  client?: DiscountPolicyApiClient;
  onBack?: () => void;
}

export function FinanceDiscountPolicyView({
  client = discountPolicyClient,
  onBack,
}: FinanceDiscountPolicyViewProps) {
  const [policies, setPolicies] = useState<readonly DiscountPolicySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [versionModalPolicy, setVersionModalPolicy] = useState<DiscountPolicySummary | null>(null);
  const [archiveModalPolicy, setArchiveModalPolicy] = useState<DiscountPolicySummary | null>(null);

  const createTriggerRef = useRef<HTMLButtonElement>(null);

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await client.listDiscountPolicies();
      setPolicies(data);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar políticas de desconto.');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void loadPolicies();
  }, [loadPolicies]);

  const handleCloseModal = () => {
    setCreateModalOpen(false);
    setVersionModalPolicy(null);
    setArchiveModalPolicy(null);
    createTriggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCloseModal();
    }
  };

  const handleCreateSubmit = async (input: CreateDiscountPolicyInput) => {
    const idempotencyKey = `policy-create-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await client.createDiscountPolicy(input, idempotencyKey);
    await loadPolicies();
  };

  const handleVersionSubmit = async (policyId: string, input: CreateDiscountPolicyVersionInput) => {
    const idempotencyKey = `version-create-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await client.createDiscountPolicyVersion(policyId, input, idempotencyKey);
    await loadPolicies();
  };

  const handleArchiveConfirm = async (policyId: string) => {
    try {
      await client.archiveDiscountPolicy(policyId);
      await loadPolicies();
    } catch (err: any) {
      setError(err?.message || 'Erro ao arquivar política.');
    }
  };

  return (
    <main
      className="p-4 sm:p-6 max-w-6xl mx-auto text-zinc-100 bg-zinc-950 min-h-screen"
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-800/80 mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-1.5 rounded-lg border border-zinc-700/60 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 transition-colors"
                aria-label="Voltar"
              >
                &larr;
              </button>
            )}
            <h2 className="text-xl font-bold tracking-tight text-white">Políticas de Desconto Institucionais</h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Definição e vigência temporal de bolsas e reduções financeiras concedíveis a cobranças de alunos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            ref={createTriggerRef}
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            id="btn-nova-politica-desconto"
          >
            <span>+</span>
            <span>Nova Política</span>
          </button>
        </div>
      </header>

      {/* Error alert */}
      {error && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center justify-between"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={loadPolicies}
            className="underline hover:text-white font-medium ml-4"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && policies.length === 0 && (
        <div className="animate-pulse space-y-3" aria-label="Carregando políticas">
          <div className="h-12 bg-zinc-900/80 border border-zinc-800/60 rounded-lg"></div>
          <div className="h-20 bg-zinc-900/50 border border-zinc-800/40 rounded-lg"></div>
          <div className="h-20 bg-zinc-900/50 border border-zinc-800/40 rounded-lg"></div>
        </div>
      )}

      {/* Empty State */}
      {!loading && policies.length === 0 && !error && (
        <div className="p-12 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
          <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mx-auto mb-3 text-zinc-400">
            %
          </div>
          <h3 className="text-sm font-semibold text-zinc-200">Nenhuma política de desconto registada</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Crie políticas institucionais (como Bolsas de Mérito ou Descontos de Irmãos) para concessão operacional.
          </p>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="mt-4 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
          >
            Criar primeira política
          </button>
        </div>
      )}

      {/* Policies List */}
      {policies.length > 0 && (
        <FinanceDiscountPolicyList
          policies={policies}
          onOpenVersion={(policy) => setVersionModalPolicy(policy)}
          onOpenArchive={(policy) => setArchiveModalPolicy(policy)}
        />
      )}

      {/* Create Dialog */}
      <FinanceDiscountPolicyCreateDialog
        isOpen={createModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleCreateSubmit}
      />

      {/* Version Dialog */}
      <FinanceDiscountPolicyVersionDialog
        policy={versionModalPolicy}
        onClose={handleCloseModal}
        onSubmit={handleVersionSubmit}
      />

      {/* Archive Dialog */}
      <FinanceDiscountPolicyArchiveDialog
        policy={archiveModalPolicy}
        onClose={handleCloseModal}
        onConfirm={handleArchiveConfirm}
      />
    </main>
  );
}

export default FinanceDiscountPolicyView;
