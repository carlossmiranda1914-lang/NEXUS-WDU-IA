import React, { useState, useEffect, useCallback } from 'react';
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
}

const client = new FinanceOperationalContextClient();

export function FinanceOperationalContextWorkspace({
  theme = 'light',
  initialFinancialAccountId,
}: FinanceOperationalContextWorkspaceProps) {
  const isLight = theme === 'light';

  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialFinancialAccountId || '');
  const [context, setContext] = useState<FinanceOperationalContext | null>(null);

  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingContext, setLoadingContext] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isRegisteringPayment, setIsRegisteringPayment] = useState(false);
  const [paymentSuccessNotice, setPaymentSuccessNotice] = useState<string | null>(null);

  // 1. Load accounts
  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    setError(null);
    try {
      const list = await client.listFinancialAccounts('active');
      setAccounts(list);
      if (list.length > 0) {
        if (initialFinancialAccountId && list.some((a) => a.id === initialFinancialAccountId)) {
          setSelectedAccountId(initialFinancialAccountId);
        } else if (!selectedAccountId || !list.some((a) => a.id === selectedAccountId)) {
          setSelectedAccountId(list[0].id);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar as contas financeiras da instituição.');
    } finally {
      setLoadingAccounts(false);
    }
  }, [initialFinancialAccountId, selectedAccountId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // 2. Load selected account context
  const loadContext = useCallback(async (accountId: string) => {
    if (!accountId) return;
    setLoadingContext(true);
    setError(null);
    try {
      const data = await client.getByFinancialAccountId(accountId);
      setContext(data);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar a situação operacional da conta financeira.');
    } finally {
      setLoadingContext(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      loadContext(selectedAccountId);
    }
  }, [selectedAccountId, loadContext]);

  const handleSelectAccount = (id: string) => {
    setSelectedAccountId(id);
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
        className="p-8 text-center rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900"
      >
        <p className="text-sm font-semibold text-rose-700 dark:text-rose-300 mb-4">{error}</p>
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

      {context && (
        <>
          <FinanceOperationalContextHeader
            theme={theme}
            context={context}
            accounts={accounts}
            selectedAccountId={selectedAccountId}
            onSelectAccount={handleSelectAccount}
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
        </>
      )}
    </div>
  );
}
