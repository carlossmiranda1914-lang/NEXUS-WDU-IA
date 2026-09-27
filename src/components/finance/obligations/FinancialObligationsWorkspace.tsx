import React, { useState } from 'react';
import { FinancialObligationsListView } from './FinancialObligationsListView.tsx';
import { FinancialObligationCreateView } from './FinancialObligationCreateView.tsx';
import { FinancialAccountsView } from './FinancialAccountsView.tsx';
import type { FinancialObligationRecord } from '../../../modules/finance/financial-obligation-client.ts';
import { InvoicePreissuePreview } from './InvoicePreissuePreview.tsx';
import { SelectedFinancialObligationDetail } from './SelectedFinancialObligationDetail.tsx';

export type ObligationsViewMode = 'list' | 'create' | 'accounts';

type Props = {
  mode?: 'collection' | 'detail';
  selectedObligationId?: string | null;
  originLabel?: string | null;
  returnTestId?: string;
  onSelectObligation?: (obligationId: string) => void;
  onReturn?: () => void;
  onOpenFinancialDocument?: (documentId: string) => void;
};

export function FinancialObligationsWorkspace({ mode = 'collection', selectedObligationId, originLabel, returnTestId, onSelectObligation, onReturn, onOpenFinancialDocument }: Props) {
  const [view, setView] = useState<ObligationsViewMode>('list');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [invoiceObligation, setInvoiceObligation] = useState<FinancialObligationRecord | null>(null);

  const handleCreated = async () => {
    setRefreshTrigger((prev) => prev + 1);
    setView('list');
  };

  if (mode === 'detail' && selectedObligationId) {
    return <SelectedFinancialObligationDetail obligationId={selectedObligationId} originLabel={originLabel} returnTestId={returnTestId} onBack={onReturn ?? (() => {})} onPreviewInvoice={setInvoiceObligation} />;
  }

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
      onOpenCreate={() => setView('create')}
      onOpenAccounts={() => setView('accounts')}
      onSelectObligation={onSelectObligation ?? (() => {})}
    />
    {invoiceObligation && <InvoicePreissuePreview obligationId={invoiceObligation.id} onClose={() => setInvoiceObligation(null)} onIssued={(documentId) => onOpenFinancialDocument?.(documentId)} />}</>
  );
}
