import {
  ACADEMIC_YEAR_STATUSES,
  canEditAcademicYearDefinition,
  canManageAcademicYear,
  canTransitionAcademicYear,
  isAcademicYearStatus,
} from '../src/modules/enrollments/academic-year-policy.ts';

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition {
  assertions++;
  if (!condition) throw new Error(message);
}

assert(ACADEMIC_YEAR_STATUSES.join(',') === 'draft,active,closed', 'Academic-year statuses must remain explicit and ordered.');
assert(isAcademicYearStatus('draft'), 'draft must be valid.');
assert(isAcademicYearStatus('active'), 'active must be valid.');
assert(isAcademicYearStatus('closed'), 'closed must be valid.');
assert(!isAcademicYearStatus('cancelled'), 'Enrollment statuses must not leak into academic-year domain.');
assert(canManageAcademicYear('institution_admin'), 'Institution admin must manage academic years.');
assert(canManageAcademicYear('director'), 'Director must manage academic years.');
assert(!canManageAcademicYear('secretariat'), 'Secretariat must not govern academic-year lifecycle.');
assert(canTransitionAcademicYear('institution_admin', 'draft', 'active'), 'Admin must activate planned year.');
assert(canTransitionAcademicYear('director', 'draft', 'active'), 'Director must activate planned year.');
assert(canTransitionAcademicYear('institution_admin', 'active', 'closed'), 'Admin must close active year.');
assert(canTransitionAcademicYear('director', 'active', 'closed'), 'Director must close active year.');
assert(!canTransitionAcademicYear('secretariat', 'draft', 'active'), 'Secretariat must not activate year.');
assert(!canTransitionAcademicYear('institution_admin', 'active', 'draft'), 'Active year must not move back to draft.');
assert(!canTransitionAcademicYear('institution_admin', 'closed', 'active'), 'Closed year must not reopen.');
assert(!canTransitionAcademicYear('institution_admin', 'draft', 'closed'), 'Draft must not skip activation.');
assert(canEditAcademicYearDefinition('draft'), 'Draft definition must be editable.');
assert(!canEditAcademicYearDefinition('active'), 'Active definition must be immutable.');
assert(!canEditAcademicYearDefinition('closed'), 'Closed definition must be immutable.');

console.log(`Academic year policy tests passed (${assertions} assertions).`);
