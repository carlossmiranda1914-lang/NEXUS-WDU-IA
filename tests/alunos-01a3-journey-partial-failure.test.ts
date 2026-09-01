import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { composeEnrollmentJourneyProcesses, createLatestEnrollmentJourneyBatchCommitter, type EnrollmentJourneyProcessBatch, type EnrollmentJourneyProcessProjection } from '../src/modules/enrollments/enrollment-lifecycle-presentation.ts';

const source = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');

const projection = (enrollmentId: string): EnrollmentJourneyProcessProjection => ({
  enrollmentId,
  enrollmentStatus: 'under_review',
  currentStage: 'P02',
  stages: [],
  progress: { percent: 0, completed: 0, applicable: 0 },
  blockers: [],
  nextAction: null,
});
const partial = composeEnrollmentJourneyProcesses(['A', 'B'], [
  { status: 'fulfilled', value: projection('A') },
  { status: 'rejected', reason: new Error('unavailable') },
]);
assert.deepEqual(partial.fulfilledProcesses.map((item) => item.enrollmentId), ['A'], 'One rejected request must retain all fulfilled process projections.');
assert.deepEqual(partial.unresolvedEnrollmentIds, ['B'], 'Only rejected Enrollment refs may enter the unresolved set.');
const allFailed = composeEnrollmentJourneyProcesses(['A', 'B'], [
  { status: 'rejected', reason: new Error('unavailable') },
  { status: 'rejected', reason: new Error('unavailable') },
]);
assert.deepEqual(allFailed.fulfilledProcesses, [], 'All failures must expose no inferred process projection.');
assert.deepEqual(allFailed.unresolvedEnrollmentIds, ['A', 'B'], 'All failures must remain explicit and bounded to attempted Enrollment refs.');
const recovered = composeEnrollmentJourneyProcesses(['B'], [{ status: 'fulfilled', value: projection('B') }]);
assert.deepEqual(recovered.fulfilledProcesses.map((item) => item.enrollmentId), ['B'], 'A retry must return exactly one recovered projection for its Enrollment.');
assert.deepEqual(recovered.unresolvedEnrollmentIds, [], 'A recovered projection must leave no stale unresolved reference.');
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
const olderBatch = composeEnrollmentJourneyProcesses(['A'], [{ status: 'fulfilled', value: projection('A') }]);
const newerBatch = composeEnrollmentJourneyProcesses(['B'], [{ status: 'rejected', reason: new Error('unavailable') }]);
const committer = createLatestEnrollmentJourneyBatchCommitter();
const olderDeferred = deferred<EnrollmentJourneyProcessBatch>();
const olderRequest = committer.startRequest();
const olderCompletion = committer.commit(olderRequest, olderDeferred.promise);
const newerDeferred = deferred<EnrollmentJourneyProcessBatch>();
const newerRequest = committer.startRequest();
const newerCompletion = committer.commit(newerRequest, newerDeferred.promise);
newerDeferred.resolve(newerBatch);
const afterNewerCompletion = await newerCompletion;
assert.equal(afterNewerCompletion.committed, true, 'The newer batch must commit once it completes.');
olderDeferred.resolve(olderBatch);
const afterLateOlderCompletion = await olderCompletion;
assert.equal(afterLateOlderCompletion.committed, false, 'A late older batch must not commit after B becomes authoritative.');
assert.strictEqual(afterLateOlderCompletion.batch, afterNewerCompletion.batch, 'A late older completion must retain B as the committed batch.');
assert.deepEqual(afterLateOlderCompletion.batch?.fulfilledProcesses, [], 'A late older fulfillment must not render after a newer batch is authoritative.');
assert.deepEqual(afterLateOlderCompletion.batch?.unresolvedEnrollmentIds, ['B'], 'A late older batch must not erase the newer unresolved state.');

assert.match(source, /const \[unresolvedProcessEnrollmentIds, setUnresolvedProcessEnrollmentIds\] = useState<string\[\]>\(\[\]\)/, 'Journey must retain unresolved Enrollment references separately from fulfilled process projections.');
assert.match(source, /composeEnrollmentJourneyProcesses\(enrollmentRecords\.map\(\(record\) => record\.id\), processResults\)/, 'The workspace must use the tested partial-composition boundary.');
assert.match(source, /setProcesses\(commit\.batch\.fulfilledProcesses\)/, 'The Journey Rail must receive only the latest committed fulfilled server projections.');
assert.match(source, /setUnresolvedProcessEnrollmentIds\(commit\.batch\.unresolvedEnrollmentIds\)/, 'Failed process requests must be tracked by the latest committed Enrollment reference set.');
assert.match(source, /unresolvedProcessEnrollmentIds\.length > 0/, 'The partial-data warning must be bounded to unresolved projections.');
assert.match(source, /onClick=\{\(\) => void load\(\)\}/, 'Operators must be able to retry unresolved projections through the existing canonical reads.');
assert.doesNotMatch(source, /processResults\.every\(\(result\) => result\.status === 'fulfilled'\)[\s\S]{0,220}setProcesses\(\[\]\)/, 'One rejected process request must not erase every fulfilled Journey projection.');
assert.match(source, /buildEnrollmentLifecyclePresentation\(processes, activeStudents\.length\)/, 'Journey counts and selection must remain derived only from confirmed projections.');
assert.match(source, /setJourneyEnrollmentIds\(stage\.enrollmentIds\)/, 'Journey selection must keep exact confirmed server membership.');
assert.match(source, /loadRequestController\.current\?\.abort\(\)/, 'A retry must abort superseded process batches.');
assert.match(source, /const isLatestRequest = \(\) => requestSequence === loadRequestSequence\.current/, 'Every batch must have monotonic latest-request ownership.');
assert.match(source, /if \(!isLatestRequest\(\)\) return;[\s\S]{0,900}composeEnrollmentJourneyProcesses/, 'A late process batch must be rejected before it can replace the newer retry state.');
assert.match(source, /journeyBatchCommitter\.current\.commit\(journeyRequestSequence, Promise\.resolve\(completedBatch\)\)/, 'The workspace must use the executable async latest-batch committer before rendering a completed batch.');

console.log('[ALUNOS-01A.3] Journey partial-failure resilience: PASS.');
