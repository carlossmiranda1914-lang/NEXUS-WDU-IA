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
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [selectedPaymentReference, setSelectedPaymentReference] = useState<string | null>(null);
  const [selectedObligationId, setSelectedObligationId] = useState<string | null>(null);
  const [operationsReturnContext, setOperationsReturnContext] = useState<{ id: string; label: string } | null>(null);
  const inactive = theme === 'light' ? 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100';
  const destination = (tab: FinanceTab) => `w-full rounded-lg px-3 py-2 text-left text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] ${activeTab === tab ? 'bg-[var(--color-action-primary)] text-white shadow-sm' : inactive}`;
  const destinationProps = (tab: FinanceTab) => ({
    className: destination(tab),
    'aria-current': activeTab === tab ? 'page' as const : undefined,
    onClick: () => setActiveTab(tab),
  });

  return <div className="aurora-finance-surface mx-auto grid w-full max-w-[1700px] gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
    <nav aria-label="Navegação de Finanças e Contas" className={`self-start rounded-xl border p-2 shadow-sm md:sticky md:top-6 ${theme === 'light' ? 'border-[var(--color-border-default)] bg-[var(--color-surface-raised)]' : 'border-zinc-800 bg-zinc-900/95'}`}>
      <div className="grid gap-3">
        <section aria-labelledby="finance-nav-overview"><h2 id="finance-nav-overview" className="px-3 text-xs font-bold uppercase tracking-wide text-zinc-500">Visão Geral</h2><button type="button" data-testid="finance-tab-operations" {...destinationProps('operations')}>Situação Financeira</button></section>
        <section aria-labelledby="finance-nav-operation"><h2 id="finance-nav-operation" className="px-3 text-xs font-bold uppercase tracking-wide text-zinc-500">Operação</h2><div className="mt-1 grid gap-1"><button type="button" data-testid="finance-tab-obligations" {...destinationProps('obligations')}>Obrigações</button><button type="button" data-testid="finance-tab-recebimentos" {...destinationProps('recebimentos')}>Recebimentos</button><button type="button" data-testid="finance-tab-documents" {...destinationProps('documents')}>Documentos</button></div></section>
        <section aria-labelledby="finance-nav-configuration"><h2 id="finance-nav-configuration" className="px-3 text-xs font-bold uppercase tracking-wide text-zinc-500">Configuração</h2><div className="mt-1 grid gap-1"><button type="button" data-testid="finance-tab-catalogue" {...destinationProps('catalogue')}>Emolumentos</button><button type="button" data-testid="finance-tab-configuration" {...destinationProps('configuration')}>Configuração Financeira</button></div></section>
      </div>
    </nav>
    <main aria-label="Área de trabalho financeira" className="min-w-0">
      {operationsReturnContext && (activeTab === 'obligations' || activeTab === 'recebimentos') && <button type="button" data-testid="return-to-financial-situation" onClick={() => setActiveTab('operations')} className="mb-4 rounded-md border px-3 py-1 text-sm">Voltar à situação financeira — {operationsReturnContext.label}</button>}
      {activeTab === 'operations' && <FinanceOperationalContextWorkspace theme={theme} initialFinancialAccountId={operationsReturnContext?.id ?? initialFinancialAccountId} initialContextQuery={initialContextQuery} onOpenFinancialDocument={(documentId) => { setSelectedDocumentId(documentId); setActiveTab('documents'); }} onOpenObligation={(obligationId, financialAccount) => { setSelectedObligationId(obligationId); setOperationsReturnContext(financialAccount); setActiveTab('obligations'); }} onOpenPayment={(paymentId, financialAccount) => { setSelectedPaymentId(paymentId); setOperationsReturnContext(financialAccount); setActiveTab('recebimentos'); }} />}
      {activeTab === 'catalogue' && <FinanceFeeCatalogueWorkspace theme={theme} />}
      {activeTab === 'obligations' && <FinancialObligationsWorkspace initialObligationId={selectedObligationId} onOpenFinancialDocument={(documentId) => { setSelectedDocumentId(documentId); setActiveTab('documents'); }} />}
      {activeTab === 'recebimentos' && <FinancePaymentsWorkspace theme={theme} initialPaymentId={selectedPaymentId} initialPaymentReference={selectedPaymentReference} onOpenFinanceConfiguration={() => setActiveTab('configuration')} onOpenFinancialDocuments={(documentId) => { setSelectedDocumentId(documentId); setActiveTab('documents'); }} />}
      {activeTab === 'documents' && <FinancialDocumentsWorkspace theme={theme} initialDocumentId={selectedDocumentId} onOpenPayment={(paymentReference) => { setSelectedPaymentId(null); setSelectedPaymentReference(paymentReference); setActiveTab('recebimentos'); }} onOpenObligation={(obligationId) => { setSelectedObligationId(obligationId); setActiveTab('obligations'); }} />}
      {activeTab === 'configuration' && <FinanceConfigurationWorkspace />}
    </main>
  </div>;
}

export default FinanceWorkspace;
