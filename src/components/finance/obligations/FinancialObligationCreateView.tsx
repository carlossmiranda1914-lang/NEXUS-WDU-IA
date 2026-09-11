import React, { useState, useEffect, useCallback } from 'react';
import {
  financialObligationClient,
  FinancialObligationApiError,
  type FinancialAccountRecord,
  type PersonOptionRecord,
} from '../../../modules/finance/financial-obligation-client.ts';
import { feeCatalogueClient, type FeeCatalogueRecord } from '../../../modules/finance/fee-catalogue-client.ts';

export interface FinancialObligationCreateViewProps {
  onBack: () => void;
  onCreated: () => Promise<void>;
}

export function FinancialObligationCreateView({
  onBack,
  onCreated,
}: FinancialObligationCreateViewProps) {
  const [accounts, setAccounts] = useState<FinancialAccountRecord[]>([]);
  const [feeItems, setFeeItems] = useState<FeeCatalogueRecord[]>([]);
  const [persons, setPersons] = useState<PersonOptionRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [form, setForm] = useState({
    financialAccountId: '',
    feeCatalogueItemId: '',
    beneficiaryPersonId: '',
    dueAt: '',
    sourceRef: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    setError(null);
    try {
      const [accList, feeList, personList] = await Promise.all([
        financialObligationClient.listAccounts('active') as Promise<FinancialAccountRecord[]>,
        feeCatalogueClient.list('active') as Promise<FeeCatalogueRecord[]>,
        financialObligationClient.listPersonOptions() as Promise<PersonOptionRecord[]>,
      ]);
      setAccounts(accList || []);
      setFeeItems(feeList || []);
      setPersons(personList || []);
    } catch {
      setError('Falha ao carregar contas financeiras e catálogo de emolumentos.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedAccount = accounts.find((a) => a.id === form.financialAccountId);
  const selectedFeeItem = feeItems.find((f) => f.id === form.feeCatalogueItemId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.financialAccountId) {
      setError('Por favor selecione uma conta financeira de responsabilidade.');
      return;
    }
    if (!form.feeCatalogueItemId) {
      setError('Por favor selecione um item do catálogo de emolumentos.');
      return;
    }

    setSubmitting(true);
    try {
      await financialObligationClient.createObligation({
        financialAccountId: form.financialAccountId,
        feeCatalogueItemId: form.feeCatalogueItemId,
        beneficiaryPersonId: form.beneficiaryPersonId.trim() || undefined,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
        sourceRef: form.sourceRef.trim() || undefined,
      });
      await onCreated();
    } catch (err: any) {
      if (err instanceof FinancialObligationApiError) {
        setError(err.message);
      } else {
        setError(err?.message || 'Erro inesperado ao emitir obrigação');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto text-zinc-100">
      {/* Top contextual back navigation */}
      <div className="mb-6">
        <button
          type="button"
          data-testid="cancel-obligation-button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <span>←</span> Voltar às obrigações
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="border-b border-zinc-800 pb-4 mb-6">
          <h1 data-testid="create-obligation-title" className="text-xl font-bold text-white">
            Nova Obrigação Financeira
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Emissão de obrigação financeira canónica para uma conta de responsabilidade. O montante é determinado exclusivamente pelo item do catálogo de emolumentos selecionado.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-950/40 border border-red-900 rounded-lg text-xs text-red-300">
            {error}
          </div>
        )}

        {loadingData ? (
          <div className="flex items-center justify-center py-12 text-zinc-500">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-2" />
            <span className="text-xs">A carregar dados institucionais...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1 & 2: Account Selection & Responsible Context */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  1. Conta Financeira de Responsabilidade <span className="text-red-400">*</span>
                </label>
                <select
                  data-testid="select-financial-account"
                  value={form.financialAccountId}
                  onChange={(e) => setForm({ ...form, financialAccountId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-emerald-500"
                  required
                >
                  <option value="">Selecione uma conta financeira...</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountNumber} — {acc.primaryParty?.personName || acc.name}
                    </option>
                  ))}
                </select>
                {accounts.length === 0 && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    Não existem contas ativas. Crie uma conta financeira primeiro em &quot;Gerir contas financeiras&quot;.
                  </p>
                )}
              </div>

              {/* Step 3: Beneficiary Selection */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  2. Beneficiário / Aluno (Opcional)
                </label>
                <select
                  data-testid="select-beneficiary"
                  value={form.beneficiaryPersonId}
                  onChange={(e) => setForm({ ...form, beneficiaryPersonId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">O próprio titular da conta</option>
                  {persons.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.email ? `(${p.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Confirmed Responsible Context */}
            {selectedAccount && (
              <div className="p-3 bg-zinc-800/40 border border-zinc-700/60 rounded-lg flex items-center justify-between text-xs">
                <div className="text-zinc-400">
                  Titular Responsável Confirmado:
                </div>
                <div className="font-medium text-white flex items-center gap-2">
                  <span>{selectedAccount.primaryParty?.personName || selectedAccount.name}</span>
                  <span className="text-[11px] text-zinc-400 font-mono">({selectedAccount.accountNumber})</span>
                </div>
              </div>
            )}

            {/* Step 4: Fee Catalogue Selection */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                3. Item do Catálogo de Emolumentos <span className="text-red-400">*</span>
              </label>
              <select
                data-testid="select-fee-item"
                value={form.feeCatalogueItemId}
                onChange={(e) => setForm({ ...form, feeCatalogueItemId: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-emerald-500"
                required
              >
                <option value="">Selecione um emolumento...</option>
                {feeItems.map((fee) => (
                  <option key={fee.id} value={fee.id}>
                    [{fee.code}] {fee.current.name} — {fee.current.money.amount} {fee.current.money.currency} (v{fee.currentVersion})
                  </option>
                ))}
              </select>
            </div>

            {/* Step 5: Read-Only Fee Snapshot Authority (Money cannot be typed) */}
            {selectedFeeItem && (
              <div
                data-testid="fee-amount-display"
                className="p-4 rounded-lg bg-zinc-800/60 border border-zinc-700/80 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Código Operacional:</span>
                  <span className="font-mono text-zinc-200">{selectedFeeItem.code}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Versão Aplicável:</span>
                  <span className="font-mono text-zinc-200">v{selectedFeeItem.currentVersion}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Montante Canónico (Snapshot Imutável):</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {selectedFeeItem.current.money.amount} {selectedFeeItem.current.money.currency}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Em vigor desde:</span>
                  <span className="text-zinc-300">
                    {new Date(selectedFeeItem.current.effectiveFrom).toLocaleDateString('pt-PT')}
                  </span>
                </div>
              </div>
            )}

            {/* Step 6: Operational Context Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Data de Vencimento (Opcional)
                </label>
                <input
                  type="date"
                  value={form.dueAt}
                  onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Referência de Origem / Justificação (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex.: Requerimento nº 123"
                  value={form.sourceRef}
                  onChange={(e) => setForm({ ...form, sourceRef: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Step 7 & 8: Review & Submit */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-testid="submit-obligation-button"
                disabled={submitting || !form.financialAccountId || !form.feeCatalogueItemId}
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-sm transition-colors cursor-pointer"
              >
                {submitting ? 'A emitir obrigação...' : 'Emitir Obrigação Financeira'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
