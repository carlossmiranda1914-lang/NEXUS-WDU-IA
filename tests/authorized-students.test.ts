import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAuthorizedStudents } from '../src/auth/authorized-students.ts';

const studentContext = { personId: 'student-person', personName: 'Student', identityEmail: null, membershipId: 'm1', institutionId: 'institution-a', institutionName: 'A', institutionSlug: 'a', role: 'student' as const };
const parentContext = { ...studentContext, personId: 'guardian-person', role: 'parent' as const };

test('a student is resolved only from their own person relationship', async () => {
  let params: unknown[] = [];
  const result = await resolveAuthorizedStudents({ query: async (_sql, received) => { params = received; return { rows: [{ student_profile_id: 'profile-1', person_id: 'student-person', name: 'Student', student_number: 'S-1', legacy_student_id: 'legacy-1' }] }; } }, studentContext);
  assert.deepEqual(params, ['institution-a', 'student-person']);
  assert.equal(result[0].personId, 'student-person');
  assert.equal(result[0].legacyStudentId, 'legacy-1');
});

test('a guardian receives only students from active persisted relationships', async () => {
  const result = await resolveAuthorizedStudents({ query: async () => ({ rows: [{ student_profile_id: 'profile-2', person_id: 'child-person', name: 'Child', student_number: null }] }) }, parentContext);
  assert.equal(result.length, 1);
  assert.equal(result[0].personId, 'child-person');
});
