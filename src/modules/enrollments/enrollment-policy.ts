import { InstitutionalRole } from '../../auth/institutional-context.ts';

export const ENROLLMENT_STATUSES = ['draft', 'under_review', 'awaiting_documents', 'validated', 'blocked', 'active', 'cancelled'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

const transitions: Record<EnrollmentStatus, EnrollmentStatus[]> = {
  draft: ['under_review', 'cancelled'],
  under_review: ['awaiting_documents', 'validated', 'blocked', 'cancelled'],
  awaiting_documents: ['under_review', 'blocked', 'cancelled'],
  validated: ['active', 'blocked', 'cancelled'],
  blocked: ['under_review', 'cancelled'],
  active: ['cancelled'],
  cancelled: [],
};

export function canManageEnrollment(role: InstitutionalRole): boolean {
  return role === 'institution_admin' || role === 'director' || role === 'secretariat';
}

/** Only the institution leadership may change the official enrollment offer. */
export function canConfigureEnrollment(role: InstitutionalRole): boolean {
  return role === 'institution_admin' || role === 'director';
}

export function canTransitionEnrollment(role: InstitutionalRole, from: EnrollmentStatus, to: EnrollmentStatus): boolean {
  if (!canManageEnrollment(role) || !transitions[from].includes(to)) return false;
  if (to === 'active') return role === 'institution_admin' || role === 'director';
  return true;
}

export function isEnrollmentStatus(value: unknown): value is EnrollmentStatus {
  return typeof value === 'string' && (ENROLLMENT_STATUSES as readonly string[]).includes(value);
}
