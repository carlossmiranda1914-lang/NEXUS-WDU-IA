import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildEnrollmentLifecyclePresentation, type EnrollmentJourneyProcessProjection } from '../src/modules/enrollments/enrollment-lifecycle-presentation.ts';

const process = (currentStage: EnrollmentJourneyProcessProjection['currentStage'], enrollmentStatus: EnrollmentJourneyProcessProjection['enrollmentStatus'] = 'under_review'): EnrollmentJourneyProcessProjection => ({
  enrollmentId: `server-${currentStage}-${enrollmentStatus}`,
  enrollmentStatus,
  currentStage,
  progress: { completed: 1, applicable: 6, percent: 17 },
  stages: [],
  blockers: [],
  nextAction: null,
});

const steps = buildEnrollmentLifecyclePresentation([
  process('P01'), process('P02'), process('P03'), process('P04'), process('P05'), process('P06'), process('P06', 'active'),
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
assert.equal(steps.find((step) => step.key === 'preparation')?.count, 2, 'Preparação must group canonical P02/P03 projections.');
assert.equal(steps.find((step) => step.key === 'activation')?.count, 1, 'Only the server-confirmed active result is activation evidence.');
assert.deepEqual(steps.find((step) => step.key === 'activation')?.enrollmentIds, ['server-P06-active'], 'Activation must retain only exact server process membership.');
assert.equal(steps.find((step) => step.key === 'active_student')?.count, 7, 'Active students must come only from the active-student projection input.');
assert.equal(steps.find((step) => step.key === 'active_student')?.source, 'active-students');
assert.equal(steps.filter((step) => step.key === 'active_student')[0]?.count, 7);
assert.equal(Object.isFrozen(steps), false, 'The helper need not freeze caller-owned presentation values.');

const workspace = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');
assert.match(workspace, /request\('\/api\/enrollments\/processes'\)/, 'The workspace must request the server-owned bulk process projection.');
assert.match(workspace, /buildEnrollmentLifecyclePresentation\(processes, activeStudents\.length\)/, 'The workspace must render the lifecycle from canonical process projections.');
assert.match(workspace, /Percurso de alunos e matrículas/, 'The workspace must expose one human lifecycle rail.');
assert.doesNotMatch(workspace, /pipelineCounts\(|PIPELINE_CONTEXT|pipeline\.map\(/, 'The competing pipeline summary must not remain visible.');
assert.match(workspace, /<ActiveStudentsView/, 'Active Students must remain a distinct server-owned view.');
assert.match(workspace, /lifecycle\.map\(\(stage, index\).*stage\.key/s, 'Lifecycle rendering must use only the public presentation step key.');
assert.match(workspace, /setEnrollmentFilter\(stage\.enrollmentIds\)/, 'A lifecycle click must filter the exact server-projected process membership.');

console.log('[ALUNOS-01A] Task 2 lifecycle presentation: PASS.');
