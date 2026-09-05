import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { FinanceOperationalContext } from '../../../modules/finance/finance-operational-context-model.ts';
import type { FinancialAccount } from '../../../modules/finance/financial-account-model.ts';
import { FinanceOperationalContextClient } from '../../../modules/finance/finance-operational-context-client.ts';
import { FinanceOperationalContextHeader } from './FinanceOperationalContextHeader.tsx';
import { FinanceOperationalTruthPanels } from './FinanceOperationalTruthPanels.tsx';
import { FinanceOperationalHistory } from './FinanceOperationalHistory.tsx';
import { FinancePaymentCreateView } from '../payments/FinancePaymentCreateView.tsx';

export interface FinanceOperationalContextWorkspaceProps {
  theme?: string;
  initialFinancialAccountId?: string;
  initialContextQuery?: { financialAccountId?: string; studentRef?: string; enrollmentId?: string } | null;
}

const client = new FinanceOperationalContextClient();

export function FinanceOperationalContextWorkspace({
  theme = 'light',
  initialFinancialAccountId,
  initialContextQuery,
}: FinanceOperationalContextWorkspaceProps) {
  const isLight = theme === 'light';

  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    initialFinancialAccountId || initialContextQuery?.financialAccountId || ''
  );
  const [context, setContext] = useState<FinanceOperationalContext | null>(null);

  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingContext, setLoadingContext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountSearchQuery, setAccountSearchQuery] = useState('');

  const [isRegisteringPayment, setIsRegisteringPayment] = useState(false);
  const [paymentSuccessNotice, setPaymentSuccessNotice] = useState<string | null>(null);

  // 1. Load accounts list (without silent first account selection)
  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const list = await client.listFinancialAccounts('active');
      setAccounts(list);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar as contas financeiras da instituição.');
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // 2. Load context by account ID
  const loadContext = useCallback(async (accountId: string) => {
    if (!accountId) return;
    setLoadingContext(true);
    setError(null);
    try {
      const data = await client.getByFinancialAccountId(accountId);
      setContext(data);
      setSelectedAccountId(data.financialAccount.id);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar a situação operacional da conta financeira.');
      setContext(null);
    } finally {
      setLoadingContext(false);
    }
  }, []);

  // 3. Load initial context query (studentRef, enrollmentId, financialAccountId)
  useEffect(() => {
    if (initialContextQuery && (initialContextQuery.studentRef || initialContextQuery.enrollmentId || initialContextQuery.financialAccountId)) {
      setLoadingContext(true);
      setError(null);
      client
        .getOperationalContext(initialContextQuery)
        .then((data) => {
          setContext(data);
          setSelectedAccountId(data.financialAccount.id);
        })
        .catch((err: any) => {
          setError(err?.message || 'Não foi possível resolver o contexto financeiro para a referência indicada.');
          setContext(null);
        })
        .finally(() => {
          setLoadingContext(false);
        });
    } else if (initialFinancialAccountId) {
      loadContext(initialFinancialAccountId);
    }
  }, [initialContextQuery, initialFinancialAccountId, loadContext]);

  const handleSelectAccount = (id: string) => {
    setSelectedAccountId(id);
    setIsRegisteringPayment(false);
    setPaymentSuccessNotice(null);
    loadContext(id);
  };

  const handleClearAccount = () => {
    setSelectedAccountId('');
    setContext(null);
    setError(null);
    setIsRegisteringPayment(false);
    setPaymentSuccessNotice(null);
  };

  const handlePaymentSuccess = () => {
    setIsRegisteringPayment(false);
    setPaymentSuccessNotice('Recebimento registado com sucesso no estado Confirmado (Não aplicado).');
    if (selectedAccountId) {
      loadContext(selectedAccountId);
    }
  };

  // Filtered accounts for explicit search/selection
  const filteredAccounts = useMemo(() => {
    const q = accountSearchQuery.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((acc) => {
      const numMatch = acc.accountNumber?.toLowerCase().includes(q);
      const nameMatch = acc.name?.toLowerCase().includes(q);
      const debtorMatch = acc.primaryDebtor?.personName?.toLowerCase().includes(q);
      return numMatch || nameMatch || debtorMatch;
    });
  }, [accounts, accountSearchQuery]);

  // Loading accounts state
  if (loadingAccounts) {
    return (
      <div
        data-testid="finance-operational-loading"
        className={`p-12 text-center rounded-xl border ${
          isLight ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className={`text-sm ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
          A carregar contas financeiras...
        </p>
      </div>
    );
  }

  // Error state with retry
  if (error && !context) {
    return (
      <div
        data-testid="finance-operational-error"
        className="p-8 text-center rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900 space-y-4"
      >
        <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-rose-800 dark:text-rose-200">
            Situação Financeira Não Disponível
          </h3>
          <p className="text-sm font-medium text-rose-700 dark:text-rose-300 mt-1 max-w-lg mx-auto">
            {error}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              if (selectedAccountId) loadContext(selectedAccountId);
              else loadAccounts();
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
          >
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={handleClearAccount}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              isLight
                ? 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            Pesquisar contas da instituição
          </button>
        </div>
      </div>
    );
  }

  // Empty state: no accounts in institution
  if (accounts.length === 0) {
    return (
      <div
        data-testid="finance-operational-empty"
        className={`p-12 text-center rounded-xl border ${
          isLight ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <svg className="w-12 h-12 mx-auto mb-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <h3 className={`text-lg font-bold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
          Nenhuma conta financeira ativa
        </h3>
        <p className={`text-sm mt-1 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
          Não foram encontradas contas financeiras nesta instituição.
        </p>
      </div>
    );
  }

  // Payment creation flow
  if (isRegisteringPayment && context) {
    return (
      <div className="space-y-6">
        <FinancePaymentCreateView
          theme={theme}
          financialAccount={{
            id: context.financialAccount.id,
            accountNumber: context.financialAccount.accountNumber,
            name: context.financialAccount.name,
          }}
          payerPerson={
            context.responsiblePerson
              ? {
                  personId: context.responsiblePerson.personId,
                  displayName: context.responsiblePerson.displayName,
                }
              : null
          }
          onSuccess={handlePaymentSuccess}
          onCancel={() => setIsRegisteringPayment(false)}
        />
      </div>
    );
  }

  // P1-03: Explicit Account Selection state when no account is selected
  if (!selectedAccountId || !context) {
    return (
      <div
        data-testid="finance-explicit-account-selection"
        className={`p-6 sm:p-8 rounded-2xl border space-y-6 ${
          isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className={`text-xl font-bold tracking-tight ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
              Selecionar Conta Financeira
            </h2>
            <p className={`text-sm mt-1 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
              Pesquise pelo número de conta, nome ou responsável para consultar a respetiva situação financeira operacional.
            </p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border self-start sm:self-auto ${
            isLight ? 'bg-zinc-100 border-zinc-200 text-zinc-700' : 'bg-zinc-800 border-zinc-700 text-zinc-300'
          }`}>
            {accounts.length} conta{accounts.length === 1 ? '' : 's'} ativa{accounts.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={accountSearchQuery}
            onChange={(e) => setAccountSearchQuery(e.target.value)}
            placeholder="Pesquisar por número de conta (ex: CTA-000001), nome ou titular..."
            data-testid="finance-account-search-input"
            className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border font-medium outline-none transition-all ${
              isLight
                ? 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                : 'bg-zinc-800/80 border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:bg-zinc-800 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20'
            }`}
          />
        </div>

        {/* Filtered account list */}
        {filteredAccounts.length === 0 ? (
          <div className="py-12 text-center">
            <p className={`text-sm ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Nenhuma conta financeira corresponde à pesquisa &quot;{accountSearchQuery}&quot;.
            </p>
          </div>
        ) : (
          <div className="divide-y rounded-xl border overflow-hidden max-h-[500px] overflow-y-auto">
            {filteredAccounts.map((acc) => (
              <div
                key={acc.id}
                data-testid={`finance-account-row-${acc.id}`}
                className={`p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors ${
                  isLight ? 'hover:bg-zinc-50 border-zinc-200' : 'hover:bg-zinc-800/50 border-zinc-800'
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {acc.accountNumber}
                    </span>
                    <span className={`text-sm font-semibold truncate ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
                      {acc.name}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                      acc.status === 'active'
                        ? isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-950/60 text-emerald-300'
                        : isLight ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {acc.status === 'active' ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  {acc.primaryDebtor?.personName && (
                    <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      Titular: <strong className={isLight ? 'text-zinc-700' : 'text-zinc-300'}>{acc.primaryDebtor.personName}</strong>
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectAccount(acc.id)}
                  data-testid={`finance-select-account-btn-${acc.id}`}
                  className="shrink-0 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
                >
                  Abrir situação operacional
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Resolved context view
  return (
    <div className="space-y-6 w-full">
      {paymentSuccessNotice && (
        <div
          data-testid="finance-payment-success-notice"
          className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-sm text-emerald-800 dark:text-emerald-300 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{paymentSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setPaymentSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 text-xs font-semibold"
          >
            Fechar
          </button>
        </div>
      )}

      <FinanceOperationalContextHeader
        theme={theme}
        context={context}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelectAccount={handleSelectAccount}
        onClearAccount={handleClearAccount}
        onRegisterPayment={() => setIsRegisteringPayment(true)}
        loading={loadingContext}
      />

      {loadingContext ? (
        <div className="py-12 text-center">
          <div className="animate-spin w-6 h-6 border-3 border-emerald-600 border-t-transparent rounded-full mx-auto mb-2" />
          <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
            A atualizar situação financeira...
          </p>
        </div>
      ) : (
        <>
          <FinanceOperationalTruthPanels
            theme={theme}
            openObligations={context.openObligations}
            confirmedUnallocatedPayments={context.confirmedUnallocatedPayments}
          />

          <FinanceOperationalHistory
            theme={theme}
            history={context.history}
          />
        </>
      )}
    </div>
  );
}
