import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildEnrollmentLifecyclePresentation, type EnrollmentJourneyProcessProjection } from '../src/modules/enrollments/enrollment-lifecycle-presentation.ts';

const source = await readFile(new URL('../src/modules/enrollments/enrollment-lifecycle-presentation.ts', import.meta.url), 'utf8');

assert.match(source, /EnrollmentProcessProjection/, 'Journey presentation must consume the canonical server process projection.');
assert.doesNotMatch(source, /record\.status|records\.filter|const count\s*=/, 'Journey presentation must not infer process authority from operational status counts.');
assert.doesNotMatch(source, /key:\s*'preparation'[\s\S]{0,200}count:\s*0/, 'Preparação cannot be a hardcoded synthetic zero.');

const process = (currentStage: EnrollmentJourneyProcessProjection['currentStage']): EnrollmentJourneyProcessProjection => ({
  enrollmentId: `process-${currentStage}`,
  enrollmentStatus: 'under_review',
  currentStage,
  progress: { completed: currentStage === 'P02' ? 1 : 3, applicable: 6, percent: currentStage === 'P02' ? 17 : 50 },
  stages: [],
  blockers: [],
  nextAction: null,
});

const steps = buildEnrollmentLifecyclePresentation([process('P02'), process('P03'), process('P04')], 2);
assert.equal(steps.find((step) => step.key === 'preparation')?.count, 2, 'Preparação must group the canonical P02 and P03 process stages.');
assert.equal(steps.find((step) => step.key === 'documents')?.count, 1, 'Documentos must be derived from canonical P04 process stages.');
assert.equal(steps.find((step) => step.key === 'active_student')?.count, 2, 'Active Students remain the distinct server projection.');
assert.deepEqual(steps.find((step) => step.key === 'preparation')?.enrollmentIds, ['process-P02', 'process-P03'], 'Journey membership must retain the exact server-projected processes.');

console.log('[ALUNOS-01A.2] single process truth adapter: PASS.');
