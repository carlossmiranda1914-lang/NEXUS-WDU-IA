import type { InstitutionalRole } from '../../auth/institutional-context.ts';

export interface CapturedDocumentRequirement {
  documentType: string;
  required: boolean;
  status: 'pending' | 'submitted' | 'verified' | 'rejected';
  sourceRequirementId?: string | null;
}

export type DocumentReadinessReason =
  | 'POLICY_NOT_CAPTURED'
  | 'REQUIREMENTS_NOT_CONFIGURED'
  | 'REQUIRED_DOCUMENTS_PENDING'
  | 'REQUIRED_DOCUMENTS_UNVERIFIED'
  | null;

export interface DocumentReadiness {
  ready: boolean;
  reason: DocumentReadinessReason;
  configuredRequirementCount: number;
  requiredCount: number;
  pendingCount: number;
  submittedCount: number;
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

export function documentValidationGate(policyCaptured: boolean, documents: readonly CapturedDocumentRequirement[]): DocumentReadiness {
  const configuredRequirements = documents.filter((document) => Boolean(document.sourceRequirementId));
  const required = configuredRequirements.filter((document) => document.required);
  const submitted = required.filter((document) => document.status === 'submitted');
  const unresolved = required.filter((document) => document.status !== 'verified');
  const pending = unresolved.filter((document) => document.status !== 'submitted');
  const base = {
    configuredRequirementCount: configuredRequirements.length,
    requiredCount: required.length,
    pendingCount: pending.length,
    submittedCount: submitted.length,
  };
  if (!policyCaptured) return { ready: false, reason: 'POLICY_NOT_CAPTURED', ...base };
  // A policy reference alone does not prove an intentional zero-requirement decision.
  // S04 owns that configuration authority, so S03 must fail closed until a snapshot exists.
  if (configuredRequirements.length === 0) return { ready: false, reason: 'REQUIREMENTS_NOT_CONFIGURED', ...base };
  if (submitted.length > 0) return { ready: false, reason: 'REQUIRED_DOCUMENTS_UNVERIFIED', ...base };
  if (unresolved.length > 0) return { ready: false, reason: 'REQUIRED_DOCUMENTS_PENDING', ...base };
  return { ready: true, reason: null, ...base };
}
