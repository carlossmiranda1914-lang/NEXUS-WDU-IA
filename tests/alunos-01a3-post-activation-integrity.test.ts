import { canTransitionEnrollment, type EnrollmentStatus } from '../src/modules/enrollments/enrollment-policy.ts';
import { allowedOperationalTransitions } from '../src/modules/enrollments/enrollment-workflow-actions.ts';

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition {
  assertions += 1;
  if (!condition) throw new Error(message);
}

const managementRoles = ['institution_admin', 'director', 'secretariat'] as const;
for (const role of managementRoles) {
  assert(
    !canTransitionEnrollment(role, 'active', 'cancelled'),
    `${role} must not cancel an active Enrollment through the generic transition policy.`,
  );
  assert(
    !allowedOperationalTransitions(role, 'active').includes('cancelled'),
    `${role} must not receive a generic post-activation cancellation action.`,
  );
}

const preActivationStatuses: EnrollmentStatus[] = [
  'draft',
  'under_review',
  'awaiting_documents',
  'validated',
  'blocked',
];

for (const from of preActivationStatuses) {
  assert(
    canTransitionEnrollment('institution_admin', from, 'cancelled'),
    `Pre-activation cancellation from ${from} must remain available.`,
  );
  assert(
    allowedOperationalTransitions('institution_admin', from).includes('cancelled'),
    `Operational actions must preserve pre-activation cancellation from ${from}.`,
  );
}

console.log(`[ALUNOS-01A.3 POST-ACTIVATION INTEGRITY] passed (${assertions} assertions).`);
