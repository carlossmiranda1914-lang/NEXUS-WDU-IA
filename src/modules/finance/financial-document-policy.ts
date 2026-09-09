import type { InstitutionalRole } from '../../auth/institutional-context.ts';

export function canConfigureFiscalSettings(role: InstitutionalRole): boolean {
  return role === 'institution_admin';
}

export function canIssueFinancialDocument(role: InstitutionalRole): boolean {
  return role === 'institution_admin' || role === 'financial';
}
