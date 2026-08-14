import type { InstitutionalRole } from '../../auth/institutional-context.ts';
import { canTransitionEnrollment, type EnrollmentStatus } from './enrollment-policy.ts';

const ORDERED_TARGETS: EnrollmentStatus[] = ['under_review', 'awaiting_documents', 'validated', 'blocked', 'active', 'cancelled'];

export function allowedOperationalTransitions(role: InstitutionalRole, from: EnrollmentStatus): EnrollmentStatus[] {
  if (role === 'secretariat' && (from === 'active' || from === 'cancelled')) return [];
  return ORDERED_TARGETS.filter((target) => canTransitionEnrollment(role, from, target));
}
