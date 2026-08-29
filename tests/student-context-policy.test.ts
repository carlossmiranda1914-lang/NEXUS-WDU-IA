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
assert.equal(canReadStudentContext('teacher', 'self'), false);
assert.equal(canReadStudentContext('financial', 'linked'), false);
assert.equal(canReadStudentContext('institution_admin', 'other'), false);
assert.equal(canReadStudentContext('director', 'other'), false);
assert.equal(canReadStudentContext('secretariat', 'other'), false);
assert.equal(canReadStudentContext('guardian' as any, 'linked'), false, 'guardian is not an alias for parent');
assert.equal(canReadStudentContext('finance' as any, 'any'), false, 'finance is not an alias for financial');
assert.deepEqual(unavailableDomains, {
  finance: { status: 'not_yet_authoritative' },
  assessment: { status: 'not_yet_authoritative' },
  attendance: { status: 'not_yet_authoritative' },
  physicalDocuments: { status: 'not_yet_authoritative' },
});
console.log('[STUDENT-360-01-POLICY] authorization matrix and unavailable semantics: PASS.');
