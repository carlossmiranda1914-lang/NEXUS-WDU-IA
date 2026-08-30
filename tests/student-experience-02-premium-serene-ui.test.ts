import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [record, enrollmentWorkspace] = await Promise.all([
  readFile(new URL('../src/components/StudentRecordWorkspace.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8'),
]);

assert.match(enrollmentWorkspace, /view === 'students' \? 'Alunos ativos' : 'Alunos & Matrículas'/, 'Active Students needs task-specific framing.');
assert.match(enrollmentWorkspace, /view === 'students' \? 'Encontre e abra o registo atual de cada aluno ativo\.'/, 'Active Students framing must prioritise finding a student record.');
assert.ok(enrollmentWorkspace.includes("{view !== 'students' && <button"), 'enrollment creation remains available only in its process context.');
assert.ok(enrollmentWorkspace.includes('setNewEntryOpen(true)'), 'the established enrollment creation action must remain available outside Active Students.');

assert.match(record, /Contexto académico no cabeçalho/, 'Summary must direct repeated current facts to the primary header.');
assert.doesNotMatch(record, /<dt className="text-xs">Estado<\/dt>/, 'Summary must not duplicate the header status.');
assert.doesNotMatch(record, /<dt className="text-xs">Ano letivo atual<\/dt>/, 'Summary must not duplicate the header year.');
assert.doesNotMatch(record, /<dt className="text-xs">Turma atual<\/dt>/, 'Summary must not duplicate the header class.');
assert.match(record, /Curso e classe/, 'programme and level must remain visible.');

assert.match(record, /flex flex-wrap gap-1 border-b pb-2 sm:flex-nowrap/, 'mobile tabs must wrap rather than hide the fifth section.');
assert.match(record, /focus-visible:ring-2 focus-visible:ring-emerald-500\/40/, 'focus must be distinguishable from selection without colour alone.');
assert.match(record, /focus-visible:rounded-md/, 'focus treatment must have a visible shape.');
assert.doesNotMatch(record, /Matrícula registada neste ano letivo/, 'historical enrollment filler copy must be removed.');

for (const section of ['Resumo', 'Percurso académico', 'Matrículas', 'Documentos', 'Encarregados']) {
  assert.match(record, new RegExp(`>${section}<`), `five-section architecture must preserve ${section}.`);
}
assert.doesNotMatch(record, /attention|alerta|pontuaç|risco|percentagem/i, 'quiet normal state must not add attention functionality.');
assert.doesNotMatch(record, /personId|institutionId|enrollmentId|studentProfileId/, 'browser-safe Student Record must not expose internal identifiers.');

console.log('[STUDENT-EXPERIENCE-02] Task 5 premium-serene UI contract: PASS.');
