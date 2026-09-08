export type AssociationStatus = 'active' | 'superseded' | 'withdrawn' | 'closed';

export type DecisionOutcome = 'accepted' | 'rejected' | 'waived' | 'inconclusive';

export const RECOGNIZED_TARGET_DOMAINS = [
  'enrollment',
  'finance',
  'academic',
  'student_lifecycle',
  'secretariat',
  'attendance',
] as const;

export type RecognizedTargetDomain = (typeof RECOGNIZED_TARGET_DOMAINS)[number] | (string & {});

export interface DocumentAssociationRecord {
  id: string;
  institutionId: string;
  documentId: string;
  pinnedVersionId: string | null;
  targetDomain: string;
  targetResourceType: string;
  targetResourceId: string;
  purpose: string;
  status: AssociationStatus;
  createdByPersonId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessDecisionReferenceRecord {
  id: string;
  institutionId: string;
  associationId: string;
  documentId: string;
  versionId: string;
  authorityDomain: string;
  decisionType: string;
  decisionOutcome: DecisionOutcome;
  decisionReason: string | null;
  externalReference: string;
  decidedByPersonId: string | null;
  observedAt: Date;
  correlationId: string | null;
}

export function validateTargetDomain(targetDomain: string): void {
  const trimmed = targetDomain?.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 64) {
    throw new Error(`Invalid targetDomain: "${targetDomain}". Must be between 2 and 64 characters.`);
  }
}

export function validateTargetResourceType(targetResourceType: string): void {
  const trimmed = targetResourceType?.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 64) {
    throw new Error(`Invalid targetResourceType: "${targetResourceType}". Must be between 2 and 64 characters.`);
  }
}

export function validateTargetResourceId(targetResourceId: string): void {
  const trimmed = targetResourceId?.trim();
  if (!trimmed || trimmed.length < 1 || trimmed.length > 128) {
    throw new Error(`Invalid targetResourceId: "${targetResourceId}". Must be between 1 and 128 characters.`);
  }
}

export function validatePurpose(purpose: string): void {
  const trimmed = purpose?.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 128) {
    throw new Error(`Invalid purpose: "${purpose}". Must be between 2 and 128 characters.`);
  }
}

export function validateAuthorityDomain(authorityDomain: string): void {
  const trimmed = authorityDomain?.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 64) {
    throw new Error(`Invalid authorityDomain: "${authorityDomain}". Must be between 2 and 64 characters.`);
  }
}

export function validateDecisionType(decisionType: string): void {
  const trimmed = decisionType?.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 64) {
    throw new Error(`Invalid decisionType: "${decisionType}". Must be between 2 and 64 characters.`);
  }
}

export function validateExternalReference(externalReference: string): void {
  const trimmed = externalReference?.trim();
  if (!trimmed || trimmed.length < 1 || trimmed.length > 128) {
    throw new Error(`Invalid externalReference: "${externalReference}". Must be between 1 and 128 characters.`);
  }
}

export function validateAssociationTransition(
  currentStatus: AssociationStatus,
  targetStatus: AssociationStatus,
): void {
  if (currentStatus === targetStatus) {
    return;
  }
  if (currentStatus !== 'active') {
    throw new Error(
      `Invalid association transition: Cannot transition from terminal state "${currentStatus}" to "${targetStatus}".`,
    );
  }
  if (targetStatus !== 'withdrawn' && targetStatus !== 'closed' && targetStatus !== 'superseded') {
    throw new Error(`Invalid target association status: "${targetStatus}".`);
  }
}
