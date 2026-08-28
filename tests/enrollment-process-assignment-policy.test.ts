import { canAssignEnrollmentProcess, canReceiveEnrollmentProcessAssignment } from '../src/modules/enrollments/enrollment-process-policy.ts';
import type { InstitutionalRole } from '../src/auth/institutional-context.ts';

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition { assertions += 1; if (!condition) throw new Error(message); }

const allowed: InstitutionalRole[] = ['institution_admin', 'director', 'secretariat'];
const forbidden: InstitutionalRole[] = ['financial', 'teacher', 'student', 'parent'];
for (const role of allowed) {
  assert(canAssignEnrollmentProcess(role), `${role} must be able to assign Enrollment process work.`);
  assert(canReceiveEnrollmentProcessAssignment(role), `${role} must be eligible to receive Enrollment process work.`);
}
for (const role of forbidden) {
  assert(!canAssignEnrollmentProcess(role), `${role} must not assign Enrollment process work.`);
  assert(!canReceiveEnrollmentProcessAssignment(role), `${role} must not receive Enrollment process work.`);
}

console.log(`[ENROLLMENT-PROCESS-ASSIGNMENT-POLICY] passed (${assertions} assertions).`);
