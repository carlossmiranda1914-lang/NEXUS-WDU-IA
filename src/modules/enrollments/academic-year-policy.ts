import type { InstitutionalRole } from '../../auth/institutional-context.ts';

export const ACADEMIC_YEAR_STATUSES = ['draft', 'active', 'closed'] as const;
export type AcademicYearStatus = (typeof ACADEMIC_YEAR_STATUSES)[number];

const transitions: Record<AcademicYearStatus, readonly AcademicYearStatus[]> = {
  draft: ['active'],
  active: ['closed'],
  closed: [],
};

export function isAcademicYearStatus(value: unknown): value is AcademicYearStatus {
  return typeof value === 'string'
    && (ACADEMIC_YEAR_STATUSES as readonly string[]).includes(value);
}

export function canManageAcademicYear(role: InstitutionalRole): boolean {
  return role === 'institution_admin' || role === 'director';
}

export function canTransitionAcademicYear(
  role: InstitutionalRole,
  from: AcademicYearStatus,
  to: AcademicYearStatus,
): boolean {
  if (!canManageAcademicYear(role)) return false;
  return transitions[from].includes(to);
}

export function canEditAcademicYearDefinition(status: AcademicYearStatus): boolean {
  return status === 'draft';
}
