import type { InstitutionalRole } from '../../auth/institutional-context.ts';

export interface CapturedDocumentRequirement {
  documentType: string;
  required: boolean;
  status: 'pending' | 'submitted' | 'verified' | 'rejected';
}

export function canConfigureDocumentRequirements(role: InstitutionalRole): boolean {
  return role === 'institution_admin' || role === 'director';
}

export function normalizeDocumentRequirements(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of values) {
    const value = raw.trim().replace(/\s+/g, ' ');
    if (value.length < 2 || value.length > 120) continue;
    const key = value.toLocaleLowerCase('pt');
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }
  return normalized;
}

export function documentValidationGate(policyCaptured: boolean, documents: readonly CapturedDocumentRequirement[]): { ready: boolean; reason: 'POLICY_NOT_CAPTURED' | 'REQUIRED_DOCUMENTS_PENDING' | null } {
  if (!policyCaptured) return { ready: false, reason: 'POLICY_NOT_CAPTURED' };
  const pending = documents.some((document) => document.required && document.status !== 'verified');
  return pending
    ? { ready: false, reason: 'REQUIRED_DOCUMENTS_PENDING' }
    : { ready: true, reason: null };
}
