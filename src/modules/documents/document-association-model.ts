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

export type RecognizedTargetDomain = (typeof RECOGNIZED_TARGET_DOMAINS)[number];

export const GOVERNED_TARGET_CONTRACTS: Record<RecognizedTargetDomain, readonly string[]> = {
  enrollment: [
    'enrollment_application',
    'student_enrollment',
    'candidacy',
    'registration',
  ],
  finance: [
    'student_account',
    'payment_plan',
    'invoice',
    'scholarship',
    'bursary',
  ],
  academic: [
    'student_record',
    'grade_appeal',
    'academic_standing',
    'curriculum_waiver',
  ],
  student_lifecycle: [
    'person_identity',
    'legal_guardian',
    'civil_id',
    'lifecycle_event',
  ],
  secretariat: [
    'certificate_request',
    'diploma_request',
    'transfer_process',
    'general_request',
  ],
  attendance: [
    'absence_record',
    'medical_justification',
    'attendance_log',
  ],
} as const;

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

export function validateTargetDomain(targetDomain: string): asserts targetDomain is RecognizedTargetDomain {
  const trimmed = targetDomain?.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 64) {
    throw new Error(`Invalid targetDomain: "${targetDomain}". Must be between 2 and 64 characters.`);
  }
  if (!RECOGNIZED_TARGET_DOMAINS.includes(trimmed as RecognizedTargetDomain)) {
    throw new Error(
      `Unrecognized targetDomain: "${targetDomain}". Allowed domains: ${RECOGNIZED_TARGET_DOMAINS.join(', ')}.`,
    );
  }
}

export function validateTargetResourceType(targetDomain: string, targetResourceType: string): void {
  validateTargetDomain(targetDomain);
  const trimmedType = targetResourceType?.trim();
  if (!trimmedType || trimmedType.length < 2 || trimmedType.length > 64) {
    throw new Error(
      `Invalid targetResourceType: "${targetResourceType}". Must be between 2 and 64 characters.`,
    );
  }
  const domainKey = targetDomain as RecognizedTargetDomain;
  const allowedTypes = GOVERNED_TARGET_CONTRACTS[domainKey];
  if (!allowedTypes || !allowedTypes.includes(trimmedType)) {
    throw new Error(
      `Unrecognized targetResourceType "${targetResourceType}" for domain "${targetDomain}". Allowed resource types: ${allowedTypes ? allowedTypes.join(', ') : 'none'}.`,
    );
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

export function validateTargetResourceContract(
  targetDomain: string,
  targetResourceType: string,
  targetResourceId: string,
  purpose: string,
): void {
  validateTargetDomain(targetDomain);
  validateTargetResourceType(targetDomain, targetResourceType);
  validateTargetResourceId(targetResourceId);
  validatePurpose(purpose);
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
  if (currentStatus !== 'active') {
    throw new Error(
      `Invalid association transition: Cannot transition from terminal state "${currentStatus}" to "${targetStatus}". Associations in terminal states are immutable.`,
    );
  }
  if (targetStatus !== 'withdrawn' && targetStatus !== 'closed' && targetStatus !== 'superseded') {
    throw new Error(
      `Invalid target association status: "${targetStatus}". Active associations can only transition to 'withdrawn', 'closed', or 'superseded'.`,
    );
  }
}
