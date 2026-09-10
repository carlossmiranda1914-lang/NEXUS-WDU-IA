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
  const inactive = theme === 'light' ? 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100';
  const destination = (tab: FinanceTab) => `rounded-md px-3 py-2 text-left text-sm font-semibold whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 ${activeTab === tab ? 'bg-emerald-600 text-white shadow-sm' : inactive}`;

  return <div className="mx-auto w-full max-w-[1700px] space-y-6">
    <nav aria-label="Finanças e Contas" className={`sticky top-0 z-10 rounded-xl border p-3 shadow-sm ${theme === 'light' ? 'border-zinc-200 bg-white/95' : 'border-zinc-800 bg-zinc-900/95'}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2"><span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Visão Geral</span><button type="button" data-testid="finance-tab-operations" onClick={() => setActiveTab('operations')} className={destination('operations')}>Situação Financeira</button><span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Operação</span><button type="button" data-testid="finance-tab-obligations" onClick={() => setActiveTab('obligations')} className={destination('obligations')}>Obrigações</button><button type="button" data-testid="finance-tab-recebimentos" onClick={() => setActiveTab('recebimentos')} className={destination('recebimentos')}>Recebimentos</button><button type="button" data-testid="finance-tab-documents" onClick={() => setActiveTab('documents')} className={destination('documents')}>Documentos</button><span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Configuração</span><button type="button" data-testid="finance-tab-catalogue" onClick={() => setActiveTab('catalogue')} className={destination('catalogue')}>Emolumentos</button><button type="button" data-testid="finance-tab-configuration" onClick={() => setActiveTab('configuration')} className={destination('configuration')}>Configuração</button></div>
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
