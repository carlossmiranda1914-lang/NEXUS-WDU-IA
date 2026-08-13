import { allowedOperationalTransitions } from '../src/modules/enrollments/enrollment-workflow-actions.ts';

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition {
  assertions += 1;
  if (!condition) throw new Error(message);
}

assert(allowedOperationalTransitions('secretariat', 'draft').join(',') === 'under_review,cancelled', 'Secretariat draft actions must match policy.');
assert(allowedOperationalTransitions('secretariat', 'under_review').join(',') === 'awaiting_documents,validated,blocked,cancelled', 'Secretariat review actions must match policy.');
assert(allowedOperationalTransitions('secretariat', 'awaiting_documents').join(',') === 'under_review,blocked,cancelled', 'Secretariat must resume document-dependent work safely.');
assert(allowedOperationalTransitions('secretariat', 'blocked').join(',') === 'under_review,cancelled', 'Secretariat must resume resolved blockage safely.');
assert(!allowedOperationalTransitions('secretariat', 'validated').includes('active'), 'Secretariat must never activate enrollment.');
assert(allowedOperationalTransitions('director', 'validated').includes('active'), 'Director must be able to activate validated enrollment.');
assert(allowedOperationalTransitions('institution_admin', 'validated').includes('active'), 'Institution admin must be able to activate validated enrollment.');
assert(allowedOperationalTransitions('secretariat', 'active').length === 0, 'S02.2 must not expose generic cancellation for active students.');
assert(allowedOperationalTransitions('secretariat', 'cancelled').length === 0, 'Cancelled enrollment must remain terminal in S02.2.');

console.log(`Secretariat S02.2 lifecycle action model passed (${assertions} assertions).`);
