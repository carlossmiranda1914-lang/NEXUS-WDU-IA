import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');

assert.ok(source.includes("request('/api/active-students')"), 'Active Students must consume the server-owned projection, not enrollment rows.');
assert.ok(source.includes('ActiveStudentRow'), 'Active Students must render a student-specific row rather than ProcessRow.');
assert.ok(source.includes('StudentRecordDrawer'), 'Opening an active student must target the human Student Record surface.');
assert.ok(source.includes('Abrir registo'), 'The active-student row must expose the human primary action.');
assert.ok(source.includes('studentRef'), 'Navigation must use the opaque studentRef.');
assert.ok(source.includes('request(`/api/student-context/${studentRef}`)'), 'Student Record navigation must use only the opaque Student Context route handle.');
assert.equal(source.includes('studentPersonId:'), false, 'The browser must not send Person authority.');
assert.equal(source.includes('institutionId:'), false, 'The browser must not send Institution authority.');
assert.equal(source.includes('Student 360'), false, 'The human Active Students surface must not use technical Student 360 language.');
console.log('[STUDENT-EXPERIENCE-01] Active Students UI contract: server projection, opaque navigation, student record and no process drawer: PASS.');
