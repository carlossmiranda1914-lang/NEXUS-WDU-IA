import React, { useState } from 'react';
import { FinancialObligationsListView } from './FinancialObligationsListView.tsx';
import { FinancialObligationCreateView } from './FinancialObligationCreateView.tsx';
import { FinancialAccountsView } from './FinancialAccountsView.tsx';

export type ObligationsViewMode = 'list' | 'create' | 'accounts';

export function FinancialObligationsWorkspace() {
  const [view, setView] = useState<ObligationsViewMode>('list');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
    <FinancialObligationsListView
      refreshTrigger={refreshTrigger}
      onOpenCreate={() => setView('create')}
      onOpenAccounts={() => setView('accounts')}
    />
  );
}
