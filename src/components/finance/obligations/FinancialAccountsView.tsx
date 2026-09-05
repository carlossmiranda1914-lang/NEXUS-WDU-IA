import React, { useState, useEffect, useCallback } from 'react';
import {
  financialObligationClient,
  FinancialObligationApiError,
  type FinancialAccountRecord,
  type PersonOptionRecord,
} from '../../../modules/finance/financial-obligation-client.ts';

export interface FinancialAccountsViewProps {
  onBack: () => void;
}

export function FinancialAccountsView({ onBack }: FinancialAccountsViewProps) {
  const [accounts, setAccounts] = useState<FinancialAccountRecord[]>([]);
  const [persons, setPersons] = useState<PersonOptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    personId: '',
    role: 'primary_payer',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accList, personList] = await Promise.all([
        financialObligationClient.listAccounts('all') as Promise<FinancialAccountRecord[]>,
        financialObligationClient.listPersonOptions() as Promise<PersonOptionRecord[]>,
      ]);
      setAccounts(accList || []);
      setPersons(personList || []);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar contas financeiras');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.personId) {
      setFormError('Selecione uma pessoa para titular de responsabilidade financeira.');
      return;
    }

    setSubmitting(true);
    try {
      await financialObligationClient.createAccount({
        personId: form.personId,
        role: form.role,
      });
      setForm({ personId: '', role: 'primary_payer' });
      await loadData();
    } catch (err: any) {
      if (err instanceof FinancialObligationApiError) {
        setFormError(err.message);
      } else {
        setFormError(err?.message || 'Erro ao criar conta financeira');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (account: FinancialAccountRecord) => {
    try {
      await financialObligationClient.setAccountStatus(account.id, account.status === 'inactive');
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Erro ao alterar estado da conta financeira');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto text-zinc-100">
      {/* Back button */}
      <div className="mb-6">
        <button
          type="button"
          data-testid="accounts-back-button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <span>←</span> Voltar às obrigações
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-800 gap-4 mb-6">
        <div>
          <h1 data-testid="accounts-view-title" className="text-2xl font-bold tracking-tight text-white">
            Contas Financeiras de Responsabilidade
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Unidades institucionais de responsabilidade económica. Não duplicam registos de pessoas nem alunos.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-950/40 border border-red-900 text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Creation form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold text-white mb-4">Nova Conta Financeira</h2>
        {formError && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-900 rounded-lg text-xs text-red-300">
            {formError}
          </div>
        )}
        <form onSubmit={handleCreateAccount} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Pessoa / Titular de Responsabilidade <span className="text-red-400">*</span>
            </label>
            <select
              value={form.personId}
              onChange={(e) => setForm({ ...form, personId: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-emerald-500"
              required
            >
              <option value="">Selecione a pessoa...</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.email || p.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={submitting || !form.personId}
              className="w-full px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-sm transition-colors cursor-pointer"
            >
              {submitting ? 'A criar conta...' : 'Criar Conta Financeira'}
            </button>
          </div>
        </form>
      </div>

      {/* Accounts List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Contas Existentes ({accounts.length})</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-zinc-500">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-2" />
            <span className="text-xs">A carregar contas...</span>
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">
            Nenhuma conta financeira registada na instituição.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-900/60">
                  <th className="py-3 px-4 font-semibold">Referência Operacional</th>
                  <th className="py-3 px-4 font-semibold">ID Técnico</th>
                  <th className="py-3 px-4 font-semibold">Titular / Relação</th>
                  <th className="py-3 px-4 font-semibold">Data Criação</th>
                  <th className="py-3 px-4 font-semibold">Estado</th>
                  <th className="py-3 px-4 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-white font-mono">
                      {acc.displayReference}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                      {acc.id}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300">
                      {acc.parties && acc.parties.length > 0 ? (
                        <div>
                          <div className="text-zinc-200">{acc.parties[0].personId}</div>
                          <div className="text-[11px] text-zinc-500">{acc.parties[0].role}</div>
                        </div>
                      ) : (
                        <span className="text-zinc-500 italic">Sem partes</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400">
                      {new Date(acc.createdAt).toLocaleDateString('pt-PT')}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                          acc.status === 'active'
                            ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300'
                            : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                        }`}
                      >
                        {acc.status === 'active' ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(acc)}
                        className={`text-xs transition-colors cursor-pointer ${
                          acc.status === 'active'
                            ? 'text-zinc-400 hover:text-red-300'
                            : 'text-emerald-400 hover:text-emerald-300'
                        }`}
                      >
                        {acc.status === 'active' ? 'Desativar' : 'Ativar'}
                      </button>
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
