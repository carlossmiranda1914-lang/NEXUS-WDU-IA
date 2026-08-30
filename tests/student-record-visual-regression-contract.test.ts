import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = readFileSync(resolve('src/components/StudentRecordWorkspace.tsx'), 'utf8');

for (const feature of ['Contexto de navegação', 'min-h-56', 'bg-rose-500/10', 'rounded-2xl border p-5 sm:p-7', 'initials', 'Situação atual', 'Percurso anterior', 'Matrícula atual', 'Matrículas anteriores', 'documentStatusLabel', 'focus-visible:outline', 'sm:flex-row']) {
  assert.ok(workspace.includes(feature), `pre-existing visual feature must remain: ${feature}`);
}
assert.ok(workspace.includes("setSection('guardians')"), 'guardians must be a fifth tab in the restored visual shell');
assert.ok(workspace.includes('context.guardians.items'), 'guardians must use the server-projected safe data');
assert.ok(workspace.includes('Ainda não existem encarregados associados a este aluno.'), 'guardian empty state must remain explicit');
assert.doesNotMatch(workspace, /isPrimary|financialResponsib|guardian_person_id|student_person_id|personId|institutionId|phone|email|address/i);

console.log('student-record-visual-regression-contract: PASS');
