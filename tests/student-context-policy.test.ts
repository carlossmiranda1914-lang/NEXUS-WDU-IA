import assert from 'node:assert/strict';
import { canReadStudentContext, unavailableDomains } from '../src/modules/student-context/student-context-policy.ts';

assert.equal(canReadStudentContext('institution_admin', 'any'), true);
assert.equal(canReadStudentContext('director', 'any'), true);
assert.equal(canReadStudentContext('secretariat', 'any'), true);
assert.equal(canReadStudentContext('student', 'self'), true);
assert.equal(canReadStudentContext('parent', 'linked'), true);
assert.equal(canReadStudentContext('student', 'other'), false);
assert.equal(canReadStudentContext('parent', 'other'), false);
assert.equal(canReadStudentContext('teacher', 'any'), false);
assert.equal(canReadStudentContext('financial', 'any'), false);
assert.deepEqual(unavailableDomains, {
  finance: { status: 'not_yet_authoritative' },
  assessment: { status: 'not_yet_authoritative' },
  attendance: { status: 'not_yet_authoritative' },
  physicalDocuments: { status: 'not_yet_authoritative' },
});
console.log('[STUDENT-360-01-POLICY] authorization matrix and unavailable semantics: PASS.');
