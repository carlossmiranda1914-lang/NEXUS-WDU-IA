import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const studentRecord = await readFile(new URL('../src/components/StudentRecordWorkspace.tsx', import.meta.url), 'utf8');
const enrollmentWorkspace = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');

assert.match(studentRecord, /useRef/, 'Student Record must keep request authority outside render state.');
assert.match(studentRecord, /studentRequestSequence\.current/, 'Student Record must sequence reads when studentRef changes.');
assert.match(studentRecord, /studentRequestController\.current\?\.abort\(\)/, 'Student Record must abort the superseded student read.');
assert.match(studentRecord, /contextStudentRef === studentRef/, 'Student Record rendering must bind loaded content to the current opaque studentRef before effects run.');
assert.match(studentRecord, /errorStudentRef === studentRef/, 'Student Record must not render an earlier request error under a new opaque studentRef.');
assert.match(studentRecord, /setContext\(null\)[\s\S]*request\(`\/api\/student-context\/\$\{studentRef\}`/, 'Student A must be cleared before Student B is requested.');
assert.match(studentRecord, /if \(requestId !== studentRequestSequence\.current\) return;[\s\S]*setContext\(nextContext\)/, 'A late Student A response must not replace Student B.');
assert.match(studentRecord, /catch \(cause\) \{[\s\S]*if \(requestId !== studentRequestSequence\.current\) return;[\s\S]*setContext\(null\)[\s\S]*setError/, 'A Student B failure must render an error without retaining Student A.');
assert.match(studentRecord, /request\(`\/api\/student-context\/\$\{studentRef\}`, controller\.signal\)/, 'Student Record fetch must receive the current abort signal.');

assert.match(enrollmentWorkspace, /processRequestSequence\.current/, 'The Process Drawer must sequence authoritative process reads.');
assert.match(enrollmentWorkspace, /processRequestController\.current\?\.abort\(\)/, 'The Process Drawer must abort a superseded process read.');
assert.match(enrollmentWorkspace, /processEnrollmentId === record\.id/, 'The Process Drawer must bind rendered process truth to the selected Enrollment before effects run.');
assert.match(enrollmentWorkspace, /processErrorEnrollmentId === record\.id/, 'The Process Drawer must not render an earlier process error under another Enrollment.');
assert.match(enrollmentWorkspace, /setProcess\(null\)[\s\S]*request\(`\/api\/enrollments\/\$\{record\.id\}\/process`, \{ signal: controller\.signal \}\)/, 'Refreshing a process must quarantine stale action-enabled process truth.');
assert.match(enrollmentWorkspace, /if \(requestId !== processRequestSequence\.current\) return;[\s\S]*setProcess\(result\.process\)/, 'A late process response must not replace the latest process truth.');
assert.match(enrollmentWorkspace, /catch \(cause\) \{[\s\S]*if \(requestId !== processRequestSequence\.current\) return;[\s\S]*setProcess\(null\)[\s\S]*setError/, 'A process refresh failure must keep stale actions unavailable.');

const primaryAction = enrollmentWorkspace.slice(
  enrollmentWorkspace.indexOf('async function runPrimaryAction()'),
  enrollmentWorkspace.indexOf('const currentStage = process?.stages'),
);
assert.match(primaryAction, /await onTransition\(target\);\s*await loadProcess\(\);/, 'A server-confirmed process write must refresh authoritative process state.');
assert.doesNotMatch(primaryAction, /setProcess\(/, 'A process write must not optimistically advance canonical process state.');

console.log('[ALUNOS-01A.3] async stale-state contract: PASS.');
