import assert from 'node:assert/strict';
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

console.log('[ALUNOS-01A.2] lifecycle projection adapter: PASS.');
