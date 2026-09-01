import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [workspace, activeStudents, studentContext, controller] = await Promise.all([
  readFile(new URL('../src/components/StudentRecordWorkspace.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/student-context/active-students-api.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/student-context/student-context-api.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/student-context/student-context.controller.ts', import.meta.url), 'utf8'),
]);

type VisibleAuthority = {
  visible: string;
  httpField: string;
  serverProjection: string;
  canonicalSource: string;
};

// This is intentionally a characterization contract: no attention behaviour belongs to Task 2.
const visibleToAuthority: VisibleAuthority[] = [
  { visible: 'student display name', httpField: 'student.displayName', serverProjection: 'display_name -> displayName', canonicalSource: 'people.name' },
  { visible: 'student state', httpField: 'student.status', serverProjection: 'student_profiles.status -> status', canonicalSource: 'student_profiles.status' },
  { visible: 'current academic year', httpField: 'current.placement.academicYear.name || current.enrollment.academicYear.name', serverProjection: 'year_name -> academicYear.name', canonicalSource: 'academic_years.name' },
  { visible: 'current class', httpField: 'current.placement.class.code', serverProjection: 'class_code -> class.code', canonicalSource: 'academic_classes.code' },
  { visible: 'program and level', httpField: 'current.placement.program/level', serverProjection: 'program/level codes and names', canonicalSource: 'academic_programs + academic_levels' },
  { visible: 'enrollment history', httpField: 'history.enrollments.items', serverProjection: 'enrollment history query', canonicalSource: 'enrollment_applications + academic_years' },
  { visible: 'academic history', httpField: 'history.placements.items', serverProjection: 'placement history query', canonicalSource: 'student_academic_placements + academic structure' },
  { visible: 'document metadata', httpField: 'documents.metadata', serverProjection: 'document metadata query', canonicalSource: 'enrollment_documents' },
  { visible: 'guardian relationship', httpField: 'guardians.items', serverProjection: 'guardian projection query', canonicalSource: 'guardian_relationships + people' },
];

assert.equal(visibleToAuthority.length, 9, 'Task 2 must inventory every currently visible Student Record fact.');
assert.match(workspace, /request\(`\/api\/student-context\/\$\{studentRef\}`, controller\.signal\)/, 'one opaque reference must feed the visible Student Record through an abortable read.');
assert.match(workspace, /studentRequestSequence\.current[\s\S]*contextStudentRef === studentRef/, 'a changed opaque reference must invalidate late reads and cannot render another student while it reloads.');
assert.match(controller, /app\.get\('\/api\/student-context\/:studentRef'/, 'the Student Record HTTP contract must be server-owned.');

for (const field of [
  'context.student.displayName',
  'context.student.status',
  'current?.academicYear ?? context?.current.enrollment?.academicYear',
  'current?.class.code',
  'current?.program.name',
  'current?.level.name',
  'context.history.enrollments.items',
  'context.history.placements.items',
  'context.documents.metadata',
  'context.guardians.items',
]) assert.ok(workspace.includes(field), `visible UI must read the HTTP field ${field}`);

for (const source of [
  'JOIN people p ON p.id=sp.person_id',
  'sp.status',
  'academic_years y',
  'academic_classes c',
  'academic_programs p',
  'academic_levels l',
  'FROM enrollment_applications e',
  'FROM student_academic_placements pl',
  'FROM enrollment_documents WHERE',
  'FROM guardian_relationships g',
]) assert.ok(studentContext.includes(source), `Student Context must retain canonical source ${source}`);

assert.match(activeStudents, /WHERE sp\.institution_id=\$1 AND sp\.status='active'/, 'Active Students must be institution-scoped and profile-authoritative.');
assert.match(activeStudents, /sp\.public_ref AS student_ref/, 'Active Students must expose only the opaque public reference.');
assert.doesNotMatch(workspace, /student360\.uat|Ana Manuel|Maria Manuel|fixture/i, 'Student Record must not use fixture data as product output.');
assert.doesNotMatch(workspace, /personId|institutionId|membershipId|provider_uid/i, 'Student Record must not send or render internal authority identifiers.');
assert.doesNotMatch(workspace, /localStorage|sessionStorage/, 'Student Record must not retain a stale projection in browser storage.');
assert.doesNotMatch(workspace, /attention|alert score|warning badge/i, 'Task 2 must not add attention functionality.');

console.log('[STUDENT-EXPERIENCE-02] Task 2 visible-to-authority characterization: PASS.');
