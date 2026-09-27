import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { FinanceOperationalContext, FinanceOperationalObligation } from '../../../modules/finance/finance-operational-context-model.ts';
import type { FinancialAccount } from '../../../modules/finance/financial-account-model.ts';
import { FinanceOperationalContextClient } from '../../../modules/finance/finance-operational-context-client.ts';
import { FinanceOperationalContextHeader } from './FinanceOperationalContextHeader.tsx';
import { FinanceOperationalTruthPanels } from './FinanceOperationalTruthPanels.tsx';
import { FinanceOperationalHistory } from './FinanceOperationalHistory.tsx';
import { FinancePaymentCreateView } from '../payments/FinancePaymentCreateView.tsx';
import { FinanceAllocationCreateView } from './FinanceAllocationCreateView.tsx';
import { FinanceAllocationReverseView } from './FinanceAllocationReverseView.tsx';
import { allocationClient } from '../../../modules/finance/allocation-client.ts';
import { obligationAdjustmentClient } from '../../../modules/finance/obligation-adjustment-client.ts';
import { financialDocumentClient } from '../../../modules/finance/financial-document-client.ts';
import { obligationDiscountClient } from '../../../modules/finance/obligation-discount-client.ts';
import { FinanceObligationAdjustmentView } from './FinanceObligationAdjustmentView.tsx';
import { FinanceObligationDiscountView } from './FinanceObligationDiscountView.tsx';
import { AuroraPageHeader } from '../../aurora/AuroraPageHeader.tsx';

export interface FinanceOperationalContextWorkspaceProps {
  theme?: string;
  initialFinancialAccountId?: string;
  initialContextQuery?: { financialAccountId?: string; studentRef?: string; enrollmentId?: string } | null;
  onOpenFinancialDocument?: (documentId: string) => void;
  onOpenObligation?: (obligationId: string, financialAccountId: string) => void;
  onOpenPayment?: (paymentId: string, financialAccountId: string) => void;
}

const client = new FinanceOperationalContextClient();

export function FinanceOperationalContextWorkspace({
  theme = 'light',
  initialFinancialAccountId,
  initialContextQuery,
  onOpenFinancialDocument,
  onOpenObligation,
  onOpenPayment,
}: FinanceOperationalContextWorkspaceProps) {
  const isLight = theme === 'light';

  // Request sequencing ref to prevent stale response overwrites
  const requestSeq = useRef(0);

  const [searchResults, setSearchResults] = useState<FinancialAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    initialFinancialAccountId || initialContextQuery?.financialAccountId || ''
  );
  const [context, setContext] = useState<FinanceOperationalContext | null>(null);

  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingContext, setLoadingContext] = useState(
    Boolean(initialFinancialAccountId || (initialContextQuery && (initialContextQuery.studentRef || initialContextQuery.enrollmentId || initialContextQuery.financialAccountId)))
  );
  const [error, setError] = useState<string | null>(null);
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const [isRegisteringPayment, setIsRegisteringPayment] = useState(false);
  const [allocationPaymentId, setAllocationPaymentId] = useState<string | null>(null);
  const [reversalAllocation, setReversalAllocation] = useState<Extract<NonNullable<FinanceOperationalContext>['history'][number], { kind: 'allocation' }>['allocation'] | null>(null);
  const [adjustmentObligationId, setAdjustmentObligationId] = useState<string | null>(null);
  const [discountObligation, setDiscountObligation] = useState<{
    obligation: FinanceOperationalObligation;
    mode: 'apply' | 'revoke';
  } | null>(null);
  const [paymentSuccessNotice, setPaymentSuccessNotice] = useState<string | null>(null);
  const [eligibleDebitNoteAdjustmentIds, setEligibleDebitNoteAdjustmentIds] = useState<ReadonlySet<string>>(new Set());
  const [issuedDebitNote, setIssuedDebitNote] = useState<{ id: string; documentType: 'debit_note'; sequenceNumber: number; adjustmentId: string; replayed: boolean } | null>(null);
  const [debitNoteIssuing, setDebitNoteIssuing] = useState(false);
  const [debitNoteError, setDebitNoteError] = useState<string | null>(null);

  useEffect(() => {
    const adjustments = context?.history.filter((item): item is Extract<NonNullable<FinanceOperationalContext>['history'][number], { kind: 'adjustment' }> => item.kind === 'adjustment') ?? [];
    let current = true;
    Promise.all(adjustments.map(async item => ({ id: item.id, readiness: await financialDocumentClient.debitNoteReadiness(item.id).catch(() => ({ status: 'BLOCKED' as const })) })))
      .then(results => { if (current) setEligibleDebitNoteAdjustmentIds(new Set(results.filter(result => result.readiness.status === 'ELIGIBLE').map(result => result.id))); });
    return () => { current = false; };
  }, [context]);

  // 1. Server-side bounded account search
  const performSearch = useCallback(async (q: string) => {
    setLoadingSearch(true);
    setHasSearched(true);
    try {
      const results = await client.searchFinancialAccounts({
        q: q.trim() || undefined,
        status: 'active',
        limit: 20,
      });
      setSearchResults(results);
    } catch (err: any) {
      setError(err?.message || 'Falha ao pesquisar contas financeiras.');
    } finally {
      setLoadingSearch(false);
    }
  }, []);

  // 2. Load context by account ID with stale request sequencing protection
  const loadContext = useCallback(async (accountId: string) => {
    if (!accountId) return;
    const seq = ++requestSeq.current;
    setLoadingContext(true);
    setError(null);
    try {
      const data = await client.getByFinancialAccountId(accountId);
      if (seq === requestSeq.current) {
        setContext(data);
        setSelectedAccountId(data.financialAccount.id);
      }
    } catch (err: any) {
      if (seq === requestSeq.current) {
        setError(err?.message || 'Falha ao carregar a situação financeira da conta.');
        setContext(null);
      }
    } finally {
      if (seq === requestSeq.current) {
        setLoadingContext(false);
      }
    }
  }, []);

  // 3. Direct cross-module entry (studentRef, enrollmentId, financialAccountId)
  useEffect(() => {
    if (initialContextQuery && (initialContextQuery.studentRef || initialContextQuery.enrollmentId || initialContextQuery.financialAccountId)) {
      const seq = ++requestSeq.current;
      setLoadingContext(true);
      setError(null);
      client
        .getOperationalContext(initialContextQuery)
        .then((data) => {
          if (seq === requestSeq.current) {
            setContext(data);
            setSelectedAccountId(data.financialAccount.id);
          }
        })
        .catch((err: any) => {
          if (seq === requestSeq.current) {
            const msg = err?.code === 'AMBIGUOUS_FINANCIAL_ACCOUNT'
              ? 'Existem múltiplas contas financeiras associadas a esta referência. Por favor selecione a conta pretendida.'
              : (err?.message || 'Não foi encontrada nenhuma conta financeira associada a esta referência.');
            setError(msg);
            setContext(null);
          }
        })
        .finally(() => {
          if (seq === requestSeq.current) {
            setLoadingContext(false);
          }
        });
    } else if (initialFinancialAccountId) {
      loadContext(initialFinancialAccountId);
    }
  }, [initialContextQuery, initialFinancialAccountId, loadContext]);

  // Handle explicit account selection
  const handleSelectAccount = (id: string) => {
    setSelectedAccountId(id);
    setContext(null); // Clear context atomically before loading new account
    setIsRegisteringPayment(false);
    setAllocationPaymentId(null);
    setReversalAllocation(null);
    setAdjustmentObligationId(null);
    setDiscountObligation(null);
    setPaymentSuccessNotice(null);
    loadContext(id);
  };

  // Handle clearing account selection
  const handleClearAccount = () => {
    requestSeq.current++; // Invalidate in-flight requests
    setSelectedAccountId('');
    setContext(null);
    setError(null);
    setIsRegisteringPayment(false);
    setAllocationPaymentId(null);
    setReversalAllocation(null);
    setAdjustmentObligationId(null);
    setDiscountObligation(null);
    setPaymentSuccessNotice(null);
    setHasSearched(false);
    setSearchResults([]);
    setAccountSearchQuery('');
  };

  const handlePaymentSuccess = () => {
    setIsRegisteringPayment(false);
    setPaymentSuccessNotice('Recebimento registado com sucesso no estado Confirmado (Não aplicado).');
    if (selectedAccountId) {
      loadContext(selectedAccountId);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(accountSearchQuery);
  };

  // Initial loading state for direct context resolution
  if (loadingContext && !context && (initialFinancialAccountId || initialContextQuery)) {
    return (
      <div
        data-testid="finance-operational-loading"
        className={`p-12 text-center rounded-xl border ${
          isLight ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className={`text-sm ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
          A carregar situação financeira...
        </p>
      </div>
    );
  }

  // Error state with controlled recovery
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
          {selectedAccountId && (
            <button
              type="button"
              onClick={() => loadContext(selectedAccountId)}
              className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
            >
              Tentar novamente
            </button>
          )}
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

  const allocationPayment = context?.confirmedUnallocatedPayments.find((payment) => payment.id === allocationPaymentId);
  if (allocationPayment && context) {
    return <FinanceAllocationCreateView
      theme={theme}
      payment={allocationPayment}
      obligations={context.openObligations}
      onCancel={() => setAllocationPaymentId(null)}
      onSuccess={() => { setAllocationPaymentId(null); loadContext(selectedAccountId); }}
    />;
  }
  if (reversalAllocation && context) {
    return <FinanceAllocationReverseView theme={theme} allocation={reversalAllocation} onCancel={() => setReversalAllocation(null)} onSuccess={() => { setReversalAllocation(null); loadContext(selectedAccountId); }} onReverse={(request) => allocationClient.reverse(reversalAllocation.id, { ...request, effectiveAt: new Date().toISOString() }).then(() => undefined)} />;
  }

  // Explicit Account Selection & Search view when no account is selected
  if (!selectedAccountId || !context) {
    return (
      <div
        data-testid="finance-explicit-account-selection"
        className={`p-6 sm:p-8 rounded-2xl border space-y-6 ${
          isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <AuroraPageHeader
          title="Situação Financeira"
          description="Consulte o contexto financeiro autorizado a partir de uma conta institucional."
        />
        <div>
          <h2 className={`text-lg font-bold tracking-tight ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
            Selecionar conta financeira
          </h2>
          <p className={`text-sm mt-1 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
            Pesquise pelo número de conta (ex: CTA-000001), nome da conta ou responsável financeiro.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={accountSearchQuery}
              onChange={(e) => setAccountSearchQuery(e.target.value)}
              placeholder="Pesquisar por número de conta, nome ou responsável..."
              data-testid="finance-account-search-input"
              className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border font-medium outline-none transition-all ${
                isLight
                  ? 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                  : 'bg-zinc-800/80 border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:bg-zinc-800 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20'
              }`}
            />
          </div>
          <button
            type="submit"
            disabled={loadingSearch}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors shrink-0"
          >
            {loadingSearch ? 'A pesquisar...' : 'Pesquisar'}
          </button>
        </form>

        {/* Results */}
        {loadingSearch ? (
          <div className="py-12 text-center">
            <div className="animate-spin w-6 h-6 border-3 border-emerald-600 border-t-transparent rounded-full mx-auto mb-2" />
            <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              A pesquisar contas...
            </p>
          </div>
        ) : hasSearched && searchResults.length === 0 ? (
          <div className="py-12 text-center">
            <p className={`text-sm ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Nenhuma conta financeira ativa encontrada para &quot;{accountSearchQuery}&quot;.
            </p>
          </div>
        ) : searchResults.length > 0 ? (
          <div className="divide-y rounded-xl border overflow-hidden max-h-[500px] overflow-y-auto">
            {searchResults.map((acc) => (
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
                      Responsável: <strong className={isLight ? 'text-zinc-700' : 'text-zinc-300'}>{acc.primaryDebtor.personName}</strong>
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectAccount(acc.id)}
                  data-testid={`finance-select-account-btn-${acc.id}`}
                  className="shrink-0 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
                >
                  Abrir situação financeira
                </button>
              </div>
            ))}
          </div>
        ) : null}
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
        accounts={searchResults.length > 0 ? searchResults : [context.financialAccount as any]}
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
            onAllocatePayment={(paymentId) => setAllocationPaymentId(paymentId)}
            onRegisterAdjustment={(obligation) => setAdjustmentObligationId(obligation.id)}
            onApplyDiscount={(obligation) => setDiscountObligation({ obligation, mode: 'apply' })}
            onRevokeDiscount={(obligation) => setDiscountObligation({ obligation, mode: 'revoke' })}
            onOpenObligation={(obligationId) => onOpenObligation?.(obligationId, context.financialAccount.id)}
            onOpenPayment={(paymentId) => onOpenPayment?.(paymentId, context.financialAccount.id)}
          />

          <FinanceOperationalHistory
            theme={theme}
            history={context.history}
            onReverse={setReversalAllocation}
            onOpenObligation={(obligationId) => onOpenObligation?.(obligationId, context.financialAccount.id)}
            onOpenPayment={(paymentId) => onOpenPayment?.(paymentId, context.financialAccount.id)}
            eligibleDebitNoteAdjustmentIds={eligibleDebitNoteAdjustmentIds}
            onIssueDebitNote={debitNoteIssuing ? undefined : async (adjustment) => {
              try {
                const readiness = await financialDocumentClient.debitNoteReadiness(adjustment.id);
                if (readiness.status !== 'ELIGIBLE' || !window.confirm('Confirmar emissão da Nota de Débito?')) return;
                setDebitNoteIssuing(true); setDebitNoteError(null);
                const issued = await financialDocumentClient.issueDebitNote({ adjustmentId: adjustment.id, seriesId: readiness.seriesId, idempotencyKey: `debit-note-${crypto.randomUUID()}` });
                setIssuedDebitNote(issued); setDebitNoteError(null);
                await loadContext(selectedAccountId);
              } catch (error) {
                setDebitNoteError(error instanceof Error ? error.message : 'Não foi possível emitir a Nota de Débito.');
              } finally { setDebitNoteIssuing(false); }
            }}
          />
          {debitNoteIssuing && <p data-testid="debit-note-issuing" className="mt-2 text-sm">A emitir Nota de Débito…</p>}
          {debitNoteError && <p data-testid="debit-note-issue-error" role="alert" className="mt-2 text-sm text-red-700">{debitNoteError}</p>}
          {issuedDebitNote && <section data-testid="debit-note-issued-success" className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm">
            <strong>Nota de Débito emitida com sucesso.</strong><p>Documento {issuedDebitNote.id} · sequência {issuedDebitNote.sequenceNumber}{issuedDebitNote.replayed ? ' (operação recuperada sem duplicação)' : ''}.</p>
            <button type="button" data-testid="open-issued-debit-note" onClick={() => onOpenFinancialDocument?.(issuedDebitNote.id)} className="mt-2 rounded-md border px-3 py-1">Abrir Nota de Débito emitida</button>
          </section>}
        </>
      )}
      {adjustmentObligationId && (
        <FinanceObligationAdjustmentView
          theme={theme}
          obligations={context.openObligations.filter((item) => item.id === adjustmentObligationId)}
          onCancel={() => setAdjustmentObligationId(null)}
          onSubmit={(obligationId, input) => obligationAdjustmentClient.record(obligationId, input, `adjustment-${crypto.randomUUID()}`).then(() => {
            setAdjustmentObligationId(null);
            return loadContext(selectedAccountId);
          })}
        />
      )}
      {discountObligation && (
        <FinanceObligationDiscountView
          theme={theme}
          mode={discountObligation.mode}
          obligation={discountObligation.obligation}
          onCancel={() => setDiscountObligation(null)}
          onApply={async (obligationId, policyId, reason) => {
            const key = `discount-apply-${crypto.randomUUID()}`;
            await obligationDiscountClient.applyDiscount(
              obligationId,
              { discountPolicyId: policyId, reason },
              key
            );
            setDiscountObligation(null);
            await loadContext(selectedAccountId);
          }}
          onRevoke={async (obligationId, discountId, reason) => {
            const key = `discount-revoke-${crypto.randomUUID()}`;
            await obligationDiscountClient.revokeDiscount(
              obligationId,
              discountId,
              reason,
              key
            );
            setDiscountObligation(null);
            await loadContext(selectedAccountId);
          }}
        />
      )}
    </div>
  );
}

export default FinanceOperationalContextWorkspace;
