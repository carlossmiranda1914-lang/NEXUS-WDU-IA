import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = readFileSync(resolve('src/components/StudentRecordWorkspace.tsx'), 'utf8');

assert.match(workspace, /Matrículas/);
assert.match(workspace, /Matrícula atual/);
assert.match(workspace, /Matrículas anteriores/);
assert.match(workspace, /context\.current\.enrollment/);
assert.match(workspace, /context\.history\.enrollments\.items/);
assert.match(workspace, /Não existe uma matrícula atual autorizada para apresentar/);
assert.match(workspace, /Ainda não existem matrículas anteriores/);
assert.doesNotMatch(workspace, /institutionId|personId|studentProfileId|enrollmentId/);

console.log('student-record-enrollments-contract: PASS');
