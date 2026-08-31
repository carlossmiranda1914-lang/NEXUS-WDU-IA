import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildEnrollmentLifecyclePresentation, type EnrollmentJourneyProcessProjection } from '../src/modules/enrollments/enrollment-lifecycle-presentation.ts';

const source = await readFile(new URL('../src/modules/enrollments/enrollment-lifecycle-presentation.ts', import.meta.url), 'utf8');
const processApi = await readFile(new URL('../src/modules/enrollments/enrollment-process-api.ts', import.meta.url), 'utf8');
const processController = await readFile(new URL('../src/modules/enrollments/enrollment-process.controller.ts', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');

assert.match(source, /EnrollmentProcessProjection/, 'Journey presentation must consume the canonical server process projection.');
assert.doesNotMatch(source, /record\.status|records\.filter|const count\s*=/, 'Journey presentation must not infer process authority from operational status counts.');
assert.doesNotMatch(source, /key:\s*'preparation'[\s\S]{0,200}count:\s*0/, 'Preparação cannot be a hardcoded synthetic zero.');
assert.match(processApi, /loadEnrollmentProcesses/, 'The server must expose a read-only bulk canonical process projection.');
assert.match(processController, /app\.get\('\/api\/enrollments\/processes'/, 'The process controller must expose the authorized bulk projection route.');
assert.match(workspace, /buildEnrollmentLifecyclePresentation\(processes, activeStudents\.length\)/, 'The Journey Rail must receive canonical process projections rather than operational records.');
assert.doesNotMatch(workspace, /buildEnrollmentLifecyclePresentation\(records, activeStudents\.length\)/, 'The Journey Rail must not receive status-count list records.');

const process = (currentStage: EnrollmentJourneyProcessProjection['currentStage']): EnrollmentJourneyProcessProjection => ({
  enrollmentId: `process-${currentStage}`,
  enrollmentStatus: 'under_review',
  currentStage,
  progress: { completed: currentStage === 'P02' ? 1 : 3, applicable: 6, percent: currentStage === 'P02' ? 17 : 50 },
  stages: [],
  blockers: [],
  nextAction: null,
});

const steps = buildEnrollmentLifecyclePresentation([process('P01'), process('P02'), process('P03'), process('P04'), process('P05'), process('P06'), { ...process('P06'), enrollmentId: 'process-active', enrollmentStatus: 'active' }], 2);
assert.deepEqual(steps.find((step) => step.key === 'entry')?.enrollmentIds, ['process-P01'], 'Entrada must map only canonical P01 membership.');
assert.equal(steps.find((step) => step.key === 'preparation')?.count, 2, 'Preparação must group the canonical P02 and P03 process stages.');
assert.equal(steps.find((step) => step.key === 'documents')?.count, 1, 'Documentos must be derived from canonical P04 process stages.');
assert.deepEqual(steps.find((step) => step.key === 'verification')?.enrollmentIds, ['process-P05'], 'Verificação must map only canonical P05 membership.');
assert.deepEqual(steps.find((step) => step.key === 'decision')?.enrollmentIds, ['process-P06'], 'Decisão must map only non-active canonical P06 membership.');
assert.deepEqual(steps.find((step) => step.key === 'activation')?.enrollmentIds, ['process-active'], 'Ativação must map only the server-confirmed active result.');
assert.equal(steps.find((step) => step.key === 'active_student')?.count, 2, 'Active Students remain the distinct server projection.');
assert.deepEqual(steps.find((step) => step.key === 'preparation')?.enrollmentIds, ['process-P02', 'process-P03'], 'Journey membership must retain the exact server-projected processes.');

console.log('[ALUNOS-01A.2] single process truth adapter: PASS.');
