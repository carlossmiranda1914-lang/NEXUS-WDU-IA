import type { InstitutionalRole } from '../../auth/institutional-context.ts';
import { canManageEnrollment, type EnrollmentStatus } from './enrollment-policy.ts';

export const ENROLLMENT_DOCUMENT_STATUSES = ['pending', 'submitted', 'verified', 'rejected'] as const;
export type EnrollmentDocumentStatus = (typeof ENROLLMENT_DOCUMENT_STATUSES)[number];

const MUTABLE_ENROLLMENT_STATUSES: EnrollmentStatus[] = ['draft', 'under_review', 'awaiting_documents', 'blocked'];
const DOCUMENT_TRANSITIONS: Record<EnrollmentDocumentStatus, EnrollmentDocumentStatus[]> = {
  pending: ['submitted'],
  submitted: ['verified', 'rejected'],
  verified: [],
  rejected: ['submitted'],
};

export function isEnrollmentDocumentStatus(value: unknown): value is EnrollmentDocumentStatus {
  return typeof value === 'string' && (ENROLLMENT_DOCUMENT_STATUSES as readonly string[]).includes(value);
}

export function canManageEnrollmentDocuments(role: InstitutionalRole, enrollmentStatus: EnrollmentStatus): boolean {
  return canManageEnrollment(role) && MUTABLE_ENROLLMENT_STATUSES.includes(enrollmentStatus);
}

export function canTransitionEnrollmentDocument(
  role: InstitutionalRole,
  enrollmentStatus: EnrollmentStatus,
  from: EnrollmentDocumentStatus,
  to: EnrollmentDocumentStatus,
): boolean {
  return canManageEnrollmentDocuments(role, enrollmentStatus) && DOCUMENT_TRANSITIONS[from].includes(to);
}

export function validDocumentType(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= 80;
}

export function validEvidenceReference(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 500;
}
