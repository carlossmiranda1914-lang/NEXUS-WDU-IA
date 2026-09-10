import React from 'react';
import { FinanceConfigurationWorkspace } from '../finance/configuration/FinanceConfigurationWorkspace.tsx';

export function InstitutionConfigurationWorkspace() {
  return <section data-testid="institution-finance-configuration"><h2 className="text-xl font-bold">Configuração institucional</h2><p className="mt-1 text-sm text-zinc-500">Acompanhe apenas a prontidão financeira confirmada pelo servidor.</p><div className="mt-4"><FinanceConfigurationWorkspace /></div></section>;
}
