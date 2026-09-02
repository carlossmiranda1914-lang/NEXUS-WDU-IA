import assert from 'node:assert/strict';
import { createLatestIdentityRequestGate } from '../src/modules/enrollments/identity-review-request-gate.ts';

const gate = createLatestIdentityRequestGate();
const requestA = gate.begin();
const requestB = gate.begin();
assert.equal(requestB.isLatest(), true, 'B must own the current async state after it starts.');
assert.equal(requestA.isLatest(), false, 'A must not overwrite B when it resolves late.');

gate.select('decision_b');
const decisionA = gate.begin('decision_a');
gate.select('decision_b');
const decisionB = gate.begin('decision_b');
assert.equal(decisionB.isLatest(), true, 'The selected decision owns its current action.');
assert.equal(decisionA.isLatest(), false, 'An action for a previously selected decision must be ignored.');

gate.invalidate();
assert.equal(decisionB.isLatest(), false, 'A refresh/invalidation must leave no stale decision action current.');

console.log('[ALUNOS-01A.3] identity review latest-request gate: PASS.');
