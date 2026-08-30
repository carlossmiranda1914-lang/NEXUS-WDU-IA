import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');

assert.match(source, /buildEnrollmentLifecyclePresentation/, 'Task 5 must retain the single server-derived lifecycle presentation.');
assert.match(source, /ProcessDrawer/, 'Task 5 must retain the existing process drawer.');
assert.match(source, /onOpen=\{onOpenStudentRecord\}/, 'Student Record navigation must remain delegated only through the opaque studentRef callback.');
assert.match(source, /theme = 'dark'/, 'Dark theme remains an explicit supported presentation.');
assert.match(source, /overflow-x-auto/, 'Narrow viewports must retain horizontal overflow protection for navigational rails.');
assert.match(source, /focus-visible:/, 'Keyboard focus must be visibly distinguishable from the selected state.');
assert.match(source, /motion-reduce:/, 'Reduced-motion users must retain static state meaning.');
assert.doesNotMatch(source, /animate-pulse|animate-bounce|animate-ping|animate-spin.*infinite/, 'Task 5 must not add autoplay or looping decorative motion.');
assert.doesNotMatch(source, /Dashboard|Mural de métricas/, 'Task 5 must not add a dashboard metric wall.');

console.log('[ALUNOS-01A] Task 5 visual and motion contract: PASS.');
