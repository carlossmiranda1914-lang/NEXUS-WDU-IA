import React, { useState } from 'react';
import { FinanceOperationalContextWorkspace } from './operational/FinanceOperationalContextWorkspace.tsx';
import { FinanceFeeCatalogueWorkspace } from './fee-catalogue/FinanceFeeCatalogueWorkspace.tsx';
import { FinancialObligationsWorkspace } from './obligations/FinancialObligationsWorkspace.tsx';
import { FinancePaymentsWorkspace } from './payments/FinancePaymentsWorkspace.tsx';

export type FinanceTab = 'operations' | 'catalogue' | 'obligations' | 'recebimentos';

export interface FinanceWorkspaceProps {
  theme?: string;
  initialTab?: FinanceTab;
  initialFinancialAccountId?: string;
  initialContextQuery?: { financialAccountId?: string; studentRef?: string; enrollmentId?: string } | null;
}

export function FinanceWorkspace({
  theme = 'light',
  initialTab = 'operations',
  initialFinancialAccountId,
  initialContextQuery,
}: FinanceWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<FinanceTab>(initialTab);

  const isLight = theme === 'light';

  return (
    <div className="space-y-6 w-full max-w-[1700px] mx-auto">
      {/* Top-Level Finance Sub-Navigation */}
      <div className={`flex items-center gap-2 border-b ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-900'} px-4 pt-3 rounded-t-xl overflow-x-auto`}>
        <button
          type="button"
          onClick={() => setActiveTab('operations')}
          data-testid="finance-tab-operations"
          className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'operations'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          Conta Financeira
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('catalogue')}
          data-testid="finance-tab-catalogue"
          className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'catalogue'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Catálogo de Emolumentos
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('obligations')}
          data-testid="finance-tab-obligations"
          className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'obligations'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Obrigações Financeiras
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('recebimentos')}
          data-testid="finance-tab-recebimentos"
          className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'recebimentos'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Recebimentos
        </button>
      </div>

      {/* Active Finance Surface */}
      <div>
        {activeTab === 'operations' && (
          <FinanceOperationalContextWorkspace
            theme={theme}
            initialFinancialAccountId={initialFinancialAccountId}
            initialContextQuery={initialContextQuery}
          />
        )}
        {activeTab === 'catalogue' && <FinanceFeeCatalogueWorkspace theme={theme} />}
        {activeTab === 'obligations' && <FinancialObligationsWorkspace theme={theme} />}
        {activeTab === 'recebimentos' && <FinancePaymentsWorkspace theme={theme} />}
      </div>
    </div>
  );
}

export default FinanceWorkspace;
