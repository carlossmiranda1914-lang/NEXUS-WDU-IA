import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = readFileSync(resolve('src/components/StudentRecordWorkspace.tsx'), 'utf8');

assert.match(workspace, /Encarregados/);
assert.match(workspace, /context\.guardians\.items/);
assert.match(workspace, /Ainda não existem encarregados associados a este aluno/);
assert.match(workspace, /guardianStatusLabel/);
assert.doesNotMatch(workspace, /isPrimary|financialResponsib|guardian_person_id|student_person_id|personId|institutionId/);
assert.doesNotMatch(workspace, /phone|email|address|telefone|contacto/i);

console.log('student-record-guardians-contract: PASS');
