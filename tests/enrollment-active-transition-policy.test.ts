import { canTransitionEnrollment } from '../src/modules/enrollments/enrollment-policy.ts';

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition { assertions += 1; if (!condition) throw new Error(message); }

assert(!canTransitionEnrollment('institution_admin', 'validated', 'active'), 'Generic transition policy must never grant canonical activation.');
assert(!canTransitionEnrollment('director', 'validated', 'active'), 'Leadership must use ActivateEnrollment rather than generic active state.');
assert(canTransitionEnrollment('secretariat', 'draft', 'under_review'), 'Existing non-activation process transition must remain valid.');
assert(canTransitionEnrollment('secretariat', 'under_review', 'awaiting_documents'), 'Existing non-activation process transition must remain valid.');
assert(canTransitionEnrollment('secretariat', 'under_review', 'validated'), 'Existing validation transition must remain valid.');

console.log(`[ENROLLMENT-ACTIVE-TRANSITION-POLICY] passed (${assertions} assertions).`);
