import type { InstitutionalRole } from '../../auth/institutional-context.ts';

export type FinancialDocumentAction =
  | 'read'
  | 'issue'
  | 'correct'
  | 'fiscal_config_read'
  | 'fiscal_config_manage'
  | 'series_read'
  | 'series_manage'
  | 'legal_profile_read'
  | 'legal_profile_manage'
  | 'financial_profile_read'
  | 'financial_profile_manage';

export function canAccessFinancialDocuments(role: InstitutionalRole, action: FinancialDocumentAction): boolean {
  if (action === 'read' || action === 'fiscal_config_read' || action === 'series_read' || action === 'legal_profile_read' || action === 'financial_profile_read') {
    return role === 'institution_admin' || role === 'financial' || role === 'director';
  }
  if (action === 'issue' || action === 'correct') {
    return role === 'institution_admin' || role === 'financial';
  }
  if (action === 'fiscal_config_manage' || action === 'series_manage' || action === 'legal_profile_manage' || action === 'financial_profile_manage') {
    return role === 'institution_admin';
  }
  return false;
}

export function canConfigureFiscalSettings(role: InstitutionalRole): boolean {
  return canAccessFinancialDocuments(role, 'fiscal_config_manage');
}

export function canIssueFinancialDocument(role: InstitutionalRole): boolean {
  return canAccessFinancialDocuments(role, 'issue');
}
