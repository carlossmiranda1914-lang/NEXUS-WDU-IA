import React, { useState } from 'react';
import { FinanceOperationalContextWorkspace } from './operational/FinanceOperationalContextWorkspace.tsx';
import { FinanceFeeCatalogueWorkspace } from './fee-catalogue/FinanceFeeCatalogueWorkspace.tsx';
import { FinancialObligationsWorkspace } from './obligations/FinancialObligationsWorkspace.tsx';
import { FinancePaymentsWorkspace } from './payments/FinancePaymentsWorkspace.tsx';
import { FinancialDocumentsWorkspace } from './documents/FinancialDocumentsWorkspace.tsx';
import { FinanceConfigurationWorkspace } from './configuration/FinanceConfigurationWorkspace.tsx';

export type FinanceTab = 'operations' | 'catalogue' | 'obligations' | 'recebimentos' | 'documents' | 'configuration';
export type FinancePrimaryView = 'FINANCIAL_SITUATION' | 'COLLECTION_DOCUMENTS' | 'COLLECTION_OBLIGATIONS' | 'COLLECTION_PAYMENTS' | 'DETAIL_FINANCIAL_DOCUMENT' | 'DETAIL_OBLIGATION' | 'DETAIL_PAYMENT' | 'FEE_CATALOGUE' | 'CONFIGURATION';
type FinanceImmediateOrigin = { view: FinancePrimaryView; entityId?: string; businessReference?: string } | null;

export interface FinanceWorkspaceProps {
  theme?: string;
  initialTab?: FinanceTab;
  initialFinancialAccountId?: string;
  initialContextQuery?: { financialAccountId?: string; studentRef?: string; enrollmentId?: string } | null;
}

const initialPrimaryView = (tab: FinanceTab): FinancePrimaryView => ({ operations: 'FINANCIAL_SITUATION', catalogue: 'FEE_CATALOGUE', obligations: 'COLLECTION_OBLIGATIONS', recebimentos: 'COLLECTION_PAYMENTS', documents: 'COLLECTION_DOCUMENTS', configuration: 'CONFIGURATION' })[tab];
const activeTabForView = (view: FinancePrimaryView): FinanceTab => ({ FINANCIAL_SITUATION: 'operations', FEE_CATALOGUE: 'catalogue', COLLECTION_OBLIGATIONS: 'obligations', DETAIL_OBLIGATION: 'obligations', COLLECTION_PAYMENTS: 'recebimentos', DETAIL_PAYMENT: 'recebimentos', COLLECTION_DOCUMENTS: 'documents', DETAIL_FINANCIAL_DOCUMENT: 'documents', CONFIGURATION: 'configuration' })[view];

export function FinanceWorkspace({ theme = 'light', initialTab = 'operations', initialFinancialAccountId, initialContextQuery }: FinanceWorkspaceProps) {
  const [primaryView, setPrimaryView] = useState<FinancePrimaryView>(() => initialPrimaryView(initialTab));
  const [origin, setOrigin] = useState<FinanceImmediateOrigin>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [selectedPaymentReference, setSelectedPaymentReference] = useState<string | null>(null);
  const [selectedObligationId, setSelectedObligationId] = useState<string | null>(null);
  const [operationsReturnContext, setOperationsReturnContext] = useState<{ id: string; label: string } | null>(null);
  const activeTab = activeTabForView(primaryView);
  const inactive = theme === 'light' ? 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100';
  const destination = (tab: FinanceTab) => `w-full rounded-lg px-3 py-2 text-left text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] ${activeTab === tab ? 'bg-[var(--color-action-primary)] text-white shadow-sm' : inactive}`;
  const enterCollection = (tab: FinanceTab) => { setPrimaryView(initialPrimaryView(tab)); setOrigin(null); };
  const destinationProps = (tab: FinanceTab) => ({ className: destination(tab), 'aria-current': activeTab === tab ? 'page' as const : undefined, onClick: () => enterCollection(tab) });
  const openDocumentDetail = (documentId: string, nextOrigin: FinanceImmediateOrigin) => { setSelectedDocumentId(documentId); setOrigin(nextOrigin); setPrimaryView('DETAIL_FINANCIAL_DOCUMENT'); };
  const returnToDocumentDetail = () => { if (origin?.view === 'DETAIL_FINANCIAL_DOCUMENT' && origin.entityId) { setSelectedDocumentId(origin.entityId); setPrimaryView('DETAIL_FINANCIAL_DOCUMENT'); } };
  const returnFromObligationDetail = () => {
    if (origin?.view === 'DETAIL_FINANCIAL_DOCUMENT') return returnToDocumentDetail();
    if (origin?.view === 'FINANCIAL_SITUATION') return setPrimaryView('FINANCIAL_SITUATION');
    setPrimaryView('COLLECTION_OBLIGATIONS');
    setOrigin(null);
  };

  return <div className="aurora-finance-surface mx-auto grid w-full max-w-[1700px] gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
    <nav aria-label="Navegação de Finanças e Contas" className={`self-start rounded-xl border p-2 shadow-sm md:sticky md:top-6 ${theme === 'light' ? 'border-[var(--color-border-default)] bg-[var(--color-surface-raised)]' : 'border-zinc-800 bg-zinc-900/95'}`}>
      <div className="grid gap-3">
        <section aria-labelledby="finance-nav-overview"><h2 id="finance-nav-overview" className="px-3 text-xs font-bold uppercase tracking-wide text-zinc-500">Visão Geral</h2><button type="button" data-testid="finance-tab-operations" {...destinationProps('operations')}>Situação Financeira</button></section>
        <section aria-labelledby="finance-nav-operation"><h2 id="finance-nav-operation" className="px-3 text-xs font-bold uppercase tracking-wide text-zinc-500">Operação</h2><div className="mt-1 grid gap-1"><button type="button" data-testid="finance-tab-obligations" {...destinationProps('obligations')}>Obrigações</button><button type="button" data-testid="finance-tab-recebimentos" {...destinationProps('recebimentos')}>Recebimentos</button><button type="button" data-testid="finance-tab-documents" {...destinationProps('documents')}>Documentos</button></div></section>
        <section aria-labelledby="finance-nav-configuration"><h2 id="finance-nav-configuration" className="px-3 text-xs font-bold uppercase tracking-wide text-zinc-500">Configuração</h2><div className="mt-1 grid gap-1"><button type="button" data-testid="finance-tab-catalogue" {...destinationProps('catalogue')}>Emolumentos</button><button type="button" data-testid="finance-tab-configuration" {...destinationProps('configuration')}>Configuração Financeira</button></div></section>
      </div>
    </nav>
    <main aria-label="Área de trabalho financeira" className="min-w-0">
      {primaryView === 'DETAIL_PAYMENT' && origin?.view === 'DETAIL_FINANCIAL_DOCUMENT' && <button type="button" data-testid="return-to-financial-document" onClick={returnToDocumentDetail} className="mb-4 rounded-md border px-3 py-1 text-sm">Voltar ao documento financeiro — {origin.businessReference ?? 'documento selecionado'}</button>}
      {primaryView === 'DETAIL_PAYMENT' && origin?.view === 'FINANCIAL_SITUATION' && <button type="button" data-testid="return-to-financial-situation" onClick={() => setPrimaryView('FINANCIAL_SITUATION')} className="mb-4 rounded-md border px-3 py-1 text-sm">Voltar à situação financeira — {origin.businessReference}</button>}
      {primaryView === 'FINANCIAL_SITUATION' && <FinanceOperationalContextWorkspace theme={theme} initialFinancialAccountId={operationsReturnContext?.id ?? initialFinancialAccountId} initialContextQuery={initialContextQuery} onOpenFinancialDocument={documentId => openDocumentDetail(documentId, { view: 'FINANCIAL_SITUATION', entityId: operationsReturnContext?.id, businessReference: operationsReturnContext?.label })} onOpenObligation={(obligationId, financialAccount) => { setSelectedObligationId(obligationId); setOperationsReturnContext(financialAccount); setOrigin({ view: 'FINANCIAL_SITUATION', entityId: financialAccount.id, businessReference: financialAccount.label }); setPrimaryView('DETAIL_OBLIGATION'); }} onOpenPayment={(paymentId, financialAccount) => { setSelectedPaymentId(paymentId); setOrigin({ view: 'FINANCIAL_SITUATION', entityId: financialAccount.id, businessReference: financialAccount.label }); setPrimaryView('DETAIL_PAYMENT'); }} />}
      {primaryView === 'FEE_CATALOGUE' && <FinanceFeeCatalogueWorkspace theme={theme} />}
      {primaryView === 'COLLECTION_OBLIGATIONS' && <FinancialObligationsWorkspace mode="collection" onSelectObligation={obligationId => { setSelectedObligationId(obligationId); setOrigin({ view: 'COLLECTION_OBLIGATIONS' }); setPrimaryView('DETAIL_OBLIGATION'); }} />}
      {primaryView === 'DETAIL_OBLIGATION' && selectedObligationId && <FinancialObligationsWorkspace mode="detail" selectedObligationId={selectedObligationId} originLabel={origin?.businessReference ?? null} returnTestId={origin?.view === 'DETAIL_FINANCIAL_DOCUMENT' ? 'return-to-financial-document' : undefined} onReturn={returnFromObligationDetail} onOpenFinancialDocument={documentId => openDocumentDetail(documentId, { view: 'DETAIL_OBLIGATION', entityId: selectedObligationId })} />}
      {(primaryView === 'COLLECTION_PAYMENTS' || primaryView === 'DETAIL_PAYMENT') && <FinancePaymentsWorkspace theme={theme} initialPaymentId={selectedPaymentId} initialPaymentReference={selectedPaymentReference} onOpenFinanceConfiguration={() => enterCollection('configuration')} onOpenFinancialDocuments={documentId => openDocumentDetail(documentId, { view: primaryView, entityId: selectedPaymentId ?? undefined, businessReference: selectedPaymentReference ?? undefined })} />}
      {primaryView === 'COLLECTION_DOCUMENTS' && <FinancialDocumentsWorkspace theme={theme} mode="collection" onSelectDocument={documentId => openDocumentDetail(documentId, { view: 'COLLECTION_DOCUMENTS' })} />}
      {primaryView === 'DETAIL_FINANCIAL_DOCUMENT' && selectedDocumentId && <FinancialDocumentsWorkspace theme={theme} mode="detail" selectedDocumentId={selectedDocumentId} onReturnToCollection={() => { setPrimaryView('COLLECTION_DOCUMENTS'); setOrigin(null); }} onOpenPayment={(paymentReference, originDocumentId, originReference) => { setSelectedPaymentId(null); setSelectedPaymentReference(paymentReference); setOrigin({ view: 'DETAIL_FINANCIAL_DOCUMENT', entityId: originDocumentId, businessReference: originReference }); setPrimaryView('DETAIL_PAYMENT'); }} onOpenObligation={(obligationId, originDocumentId, originReference) => { setSelectedObligationId(obligationId); setOrigin({ view: 'DETAIL_FINANCIAL_DOCUMENT', entityId: originDocumentId, businessReference: originReference }); setPrimaryView('DETAIL_OBLIGATION'); }} />}
      {primaryView === 'CONFIGURATION' && <FinanceConfigurationWorkspace />}
    </main>
  </div>;
}

export default FinanceWorkspace;
