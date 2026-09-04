import type { InstitutionalRole } from '../../auth/institutional-context.ts';
export type FeeCatalogueAction = 'read' | 'write';
export function canAccessFeeCatalogue(role: InstitutionalRole, action: FeeCatalogueAction): boolean {
  return action === 'read' ? role === 'institution_admin' || role === 'financial' || role === 'director' : role === 'institution_admin' || role === 'financial';
}
