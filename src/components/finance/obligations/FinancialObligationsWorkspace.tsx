import React, { useState } from 'react';
import { FinancialObligationsListView } from './FinancialObligationsListView.tsx';
import { FinancialObligationCreateView } from './FinancialObligationCreateView.tsx';
import { FinancialAccountsView } from './FinancialAccountsView.tsx';
import type { FinancialObligationRecord } from '../../../modules/finance/financial-obligation-client.ts';
import { InvoicePreissuePreview } from './InvoicePreissuePreview.tsx';

export type ObligationsViewMode = 'list' | 'create' | 'accounts';

export function FinancialObligationsWorkspace({ onOpenFinancialDocument, initialObligationId }: { onOpenFinancialDocument?: (documentId: string) => void; initialObligationId?: string | null }) {
  const [view, setView] = useState<ObligationsViewMode>('list');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [invoiceObligation, setInvoiceObligation] = useState<FinancialObligationRecord | null>(null);

  const handleCreated = async () => {
    setRefreshTrigger((prev) => prev + 1);
    setView('list');
  };

  if (view === 'create') {
    return (
      <FinancialObligationCreateView
        onBack={() => setView('list')}
        onCreated={handleCreated}
      />
    );
  }

  if (view === 'accounts') {
    return (
      <FinancialAccountsView
        onBack={() => setView('list')}
      />
    );
  }

  return (
    <><FinancialObligationsListView
      refreshTrigger={refreshTrigger}
      initialObligationId={initialObligationId}
      onOpenCreate={() => setView('create')}
      onOpenAccounts={() => setView('accounts')}
      onPreviewInvoice={setInvoiceObligation}
    />
    {invoiceObligation && <InvoicePreissuePreview obligationId={invoiceObligation.id} onClose={() => setInvoiceObligation(null)} onIssued={(documentId) => onOpenFinancialDocument?.(documentId)} />}</>
  );
}
