import type { InstitutionalRole } from '../../auth/institutional-context.ts';

export type StudentContextRelationship = 'any' | 'self' | 'linked' | 'other';

export function canReadStudentContext(role: InstitutionalRole, relationship: StudentContextRelationship): boolean {
  if (role === 'institution_admin' || role === 'director' || role === 'secretariat') return relationship !== 'other';
  if (role === 'student') return relationship === 'self';
  if (role === 'parent') return relationship === 'linked';
  return false;
}

export const unavailableDomains = Object.freeze({
  finance: { status: 'not_yet_authoritative' as const },
  assessment: { status: 'not_yet_authoritative' as const },
  attendance: { status: 'not_yet_authoritative' as const },
  physicalDocuments: { status: 'not_yet_authoritative' as const },
});
