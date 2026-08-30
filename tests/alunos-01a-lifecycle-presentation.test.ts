import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildEnrollmentLifecyclePresentation } from '../src/modules/enrollments/enrollment-lifecycle-presentation.ts';
import type { EnrollmentOperationalRecord } from '../src/modules/enrollments/enrollment-operations-model.ts';

const record = (status: EnrollmentOperationalRecord['status']): EnrollmentOperationalRecord => ({
  id: `internal-${status}`,
  status,
  student_name: 'Fixture Student',
  guardian_name: null,
  offer_name: 'Oferta',
  academic_year_name: '2026',
  created_at: '2026-08-30T00:00:00.000Z',
  updated_at: '2026-08-30T00:00:00.000Z',
});

const steps = buildEnrollmentLifecyclePresentation([
  record('draft'),
  record('awaiting_documents'),
  record('under_review'),
  record('validated'),
  record('active'),
], 7);

assert.deepEqual(steps.map((step) => step.label), [
  'Entrada',
  'Preparação',
  'Documentos',
  'Verificação',
  'Decisão',
  'Ativação',
  'Aluno ativo',
]);
assert.deepEqual(steps.map((step) => step.key), ['entry', 'preparation', 'documents', 'verification', 'decision', 'activation', 'active_student']);
assert.equal(steps.find((step) => step.key === 'entry')?.count, 1);
assert.equal(steps.find((step) => step.key === 'documents')?.count, 1);
assert.equal(steps.find((step) => step.key === 'verification')?.count, 1);
assert.equal(steps.find((step) => step.key === 'decision')?.count, 1);
assert.equal(steps.find((step) => step.key === 'preparation')?.count, 0, 'The list record has no canonical preparation-stage field.');
assert.equal(steps.find((step) => step.key === 'activation')?.count, 1, 'Confirmed active enrollment rows are canonical activation evidence.');
assert.deepEqual(steps.find((step) => step.key === 'activation')?.statuses, ['active'], 'Activation must route only to confirmed active enrollment records.');
assert.equal(steps.find((step) => step.key === 'active_student')?.count, 7, 'Active students must come only from the active-student projection input.');
assert.equal(steps.find((step) => step.key === 'active_student')?.source, 'active-students');
assert.equal(steps.filter((step) => step.key === 'active_student')[0]?.count, 7);
assert.equal(Object.isFrozen(steps), false, 'The helper need not freeze caller-owned presentation values.');

const workspace = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');
assert.match(workspace, /buildEnrollmentLifecyclePresentation\(records, activeStudents\.length\)/, 'The workspace must render the single lifecycle presentation from server-owned lists.');
assert.match(workspace, /Percurso de alunos e matrículas/, 'The workspace must expose one human lifecycle rail.');
assert.doesNotMatch(workspace, /pipelineCounts\(|PIPELINE_CONTEXT|pipeline\.map\(/, 'The competing pipeline summary must not remain visible.');
assert.match(workspace, /<ActiveStudentsView/, 'Active Students must remain a distinct server-owned view.');
assert.match(workspace, /lifecycle\.map\(\(stage, index\).*stage\.key/s, 'Lifecycle rendering must use only the public presentation step key.');
assert.match(workspace, /setStatusFilter\(stage\.statuses\.length > 0 \? stage\.statuses : null\)/, 'A lifecycle click must use its authoritative filter, including active enrollment evidence.');

console.log('[ALUNOS-01A] Task 2 lifecycle presentation: PASS.');
