import React, { useState } from 'react';
import { FinanceOperationalContextWorkspace } from './operational/FinanceOperationalContextWorkspace.tsx';
import { FinanceFeeCatalogueWorkspace } from './fee-catalogue/FinanceFeeCatalogueWorkspace.tsx';
import { FinancialObligationsWorkspace } from './obligations/FinancialObligationsWorkspace.tsx';
import { FinancePaymentsWorkspace } from './payments/FinancePaymentsWorkspace.tsx';
import { FinancialDocumentsWorkspace } from './documents/FinancialDocumentsWorkspace.tsx';
import { FinanceConfigurationWorkspace } from './configuration/FinanceConfigurationWorkspace.tsx';

export type FinanceTab = 'operations' | 'catalogue' | 'obligations' | 'recebimentos' | 'documents' | 'configuration';

export interface FinanceWorkspaceProps {
  theme?: string;
  initialTab?: FinanceTab;
  initialFinancialAccountId?: string;
  initialContextQuery?: { financialAccountId?: string; studentRef?: string; enrollmentId?: string } | null;
}

export function FinanceWorkspace({ theme = 'light', initialTab = 'operations', initialFinancialAccountId, initialContextQuery }: FinanceWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<FinanceTab>(initialTab);
  const inactive = theme === 'light' ? 'border-transparent text-zinc-600 hover:text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-100';
  const destination = (tab: FinanceTab) => `w-full rounded-md border-l-2 px-3 py-2 text-left text-sm font-semibold whitespace-normal ${activeTab === tab ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-300' : inactive}`;

  return <div className="mx-auto w-full max-w-[1700px] space-y-6">
    <nav aria-label="Finanças e Contas" className={`grid gap-4 rounded-xl border p-4 ${theme === 'light' ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-900'} md:grid-cols-3`}>
      <section aria-label="Visão Geral"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">Visão Geral</p><button type="button" data-testid="finance-tab-operations" onClick={() => setActiveTab('operations')} className={destination('operations')}>Situação Financeira</button></section>
      <section aria-label="Operação"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">Operação</p><div className="grid gap-1"><button type="button" data-testid="finance-tab-obligations" onClick={() => setActiveTab('obligations')} className={destination('obligations')}>Obrigações Financeiras</button><button type="button" data-testid="finance-tab-recebimentos" onClick={() => setActiveTab('recebimentos')} className={destination('recebimentos')}>Recebimentos</button><button type="button" data-testid="finance-tab-documents" onClick={() => setActiveTab('documents')} className={destination('documents')}>Documentos Financeiros</button></div></section>
      <section aria-label="Configuração"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">Configuração</p><div className="grid gap-1"><button type="button" data-testid="finance-tab-catalogue" onClick={() => setActiveTab('catalogue')} className={destination('catalogue')}>Catálogo de Emolumentos</button><button type="button" data-testid="finance-tab-configuration" onClick={() => setActiveTab('configuration')} className={destination('configuration')}>Configuração Financeira</button></div></section>
    </nav>
    <div>
      {activeTab === 'operations' && <FinanceOperationalContextWorkspace theme={theme} initialFinancialAccountId={initialFinancialAccountId} initialContextQuery={initialContextQuery} />}
      {activeTab === 'catalogue' && <FinanceFeeCatalogueWorkspace theme={theme} />}
      {activeTab === 'obligations' && <FinancialObligationsWorkspace theme={theme} />}
      {activeTab === 'recebimentos' && <FinancePaymentsWorkspace theme={theme} onOpenFinanceConfiguration={() => setActiveTab('configuration')} />}
      {activeTab === 'documents' && <FinancialDocumentsWorkspace theme={theme} />}
      {activeTab === 'configuration' && <FinanceConfigurationWorkspace />}
    </div>
  </div>;
}

export default FinanceWorkspace;
