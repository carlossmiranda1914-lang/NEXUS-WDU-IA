import { strict as assert } from 'node:assert';
import {
  IdentityDecisionError,
  isPublicIdentityDecisionRef,
  listPublicIdentityDecisions,
  toPublicIdentityDecision,
  type IdentityDecisionPool,
} from '../src/modules/people/identity-resolution-decision.ts';
import { toPublicEnrollmentResolution } from '../src/modules/enrollments/enrollment-intake-api.ts';

const row = {
  id: '00000000-0000-4000-8000-000000000001', public_ref: 'a'.repeat(36), institution_id: 'institution-a',
  requested_by_person_id: 'person-a', proposed_candidate_person_id: 'person-b', candidate_person_ids: ['person-b'],
  status: 'pending_confirmation', risk_level: 'B', proposed_action: 'REUSE_PERSON', reason_code: 'MULTIPLE_CANDIDATES_RESOLVED', version: 1,
};
const publicDecision = toPublicIdentityDecision(row);
assert.equal(isPublicIdentityDecisionRef(publicDecision.decisionRef), true, 'migration-generated 36-hex reference must be routable');
assert.equal(isPublicIdentityDecisionRef('00000000-0000-4000-8000-000000000001'), false, 'UUID primary keys are never public decision references');
assert.deepEqual(Object.keys(publicDecision).sort(), ['decisionRef', 'proposedAction', 'reasonCode', 'riskLevel', 'status', 'version']);
assert.equal(JSON.stringify(publicDecision).includes('person-b'), false, 'public decision must not contain candidate Person ids');
assert.equal(JSON.stringify(toPublicEnrollmentResolution({ status: 'RESTRICTED_POSSIBLE_MATCH', candidateCount: 1, matchReasons: ['student_number'] })), JSON.stringify({ status: 'RESTRICTED_POSSIBLE_MATCH', candidateCount: 1, matchReasons: [] }));
assert.equal(publicDecision.proposedAction === 'REVIEW_REQUIRED', false, 'a queue DTO reports status/action only and never a candidate selector');

const forbiddenPool: IdentityDecisionPool = { connect: async () => ({
  query: async <T>(sql: string) => (sql.includes('FROM memberships') ? { rows: [{ role: 'secretariat' } as T], rowCount: 1 } : { rows: [] as T[], rowCount: 0 }),
  release() {},
}) };
await assert.rejects(() => listPublicIdentityDecisions(forbiddenPool, 'institution-a', 'person-a'), (error: unknown) => error instanceof IdentityDecisionError && error.code === 'UNAUTHORIZED_DECISION');
console.log('ALUNOS-01A.3 identity decision boundary tests passed.');
