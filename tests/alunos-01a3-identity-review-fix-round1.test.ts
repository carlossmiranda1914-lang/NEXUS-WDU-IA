import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const drawer = await readFile(new URL('../src/components/EnrollmentNewEntryDrawer.tsx', import.meta.url), 'utf8');
const client = await readFile(new URL('../src/modules/enrollments/enrollment-intake-client.ts', import.meta.url), 'utf8');
const controller = await readFile(new URL('../src/modules/enrollments/enrollment.controller.ts', import.meta.url), 'utf8');
const decisions = await readFile(new URL('../src/modules/people/identity-resolution-decision.ts', import.meta.url), 'utf8');

assert.match(controller, /readEnrollmentIdentityDecisionForActor\(enrollmentPool, context, req\.params\.ref\)/, 'A requester must recover only its own opaque decision through the actor-safe read boundary.');
assert.match(decisions, /role !== 'secretariat'[\s\S]{0,3000}requested_by_person_id = \$2/, 'Secretariat must receive its own server-scoped review list after reload.');
assert.match(client, /getIdentityReviewDecision\(decisionRef: string\)/, 'The browser must use the opaque decision reference to recover durable decision truth.');
assert.match(drawer, /resumeApprovedDecision\(/, 'Approved decisions must have a direct server-owned resume action.');
assert.doesNotMatch(drawer, /identityDecision\?\.status === 'approved'[\s\S]{0,500}name\.trim\(\)\.length < 3/, 'Approved direct resume must not depend on locally remembered name or offer fields.');
assert.match(drawer, /createLatestIdentityRequestGate/, 'Identity async operations must use the existing latest-request ownership pattern.');
assert.match(drawer, /identityRequestGate\.current\.select/, 'Selection changes must invalidate prior identity actions.');
assert.match(drawer, /function failClosedIdentityRequest/, 'A failed authoritative identity operation must clear rendered decision actions.');
assert.match(drawer, /catch \(e\) \{ failClosedIdentityRequest\(request/, 'Current evidence/outcome failures must not retain stale actionable authority.');
assert.doesNotMatch(drawer + client, /candidatePersonId|candidate_person_id|personId:|person_id|decisionId|decision_id/, 'The browser must never receive/select internal Person or decision identifiers.');

console.log('[ALUNOS-01A.3] Task 5 Fix Round 1 contract: PASS.');
