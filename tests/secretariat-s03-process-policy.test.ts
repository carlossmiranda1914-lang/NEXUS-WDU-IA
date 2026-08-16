import { projectEnrollmentProcess, type EnrollmentProcessTruth } from '../src/modules/enrollments/enrollment-process-policy.ts';

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition { assertions += 1; if (!condition) throw new Error(message); }

const base: EnrollmentProcessTruth = {
  enrollmentStatus: 'under_review', registrationReady: false, registrationMissing: ['guardian'], academicContextValid: true,
  policyCaptured: true, documents: [{ documentType: 'Identificação', required: true, status: 'pending' }],
};

const incomplete = projectEnrollmentProcess(base, 'secretariat');
assert(incomplete.currentStage === 'P02', 'Incomplete registration must own the current stage.');
assert(incomplete.stages[1].status === 'blocked', 'Incomplete registration must be an objective blocker.');
assert(incomplete.nextAction?.code === 'ADD_GUARDIAN_DATA', 'Missing guardian must yield a stable guardian action.');

const documentPending = projectEnrollmentProcess({ ...base, registrationReady: true, registrationMissing: [] }, 'secretariat');
assert(documentPending.currentStage === 'P04', 'Pending required document must own P04.');
assert(documentPending.nextAction?.code === 'SUBMIT_REQUIRED_DOCUMENTS', 'Pending document must yield submission action.');

const documentSubmitted = projectEnrollmentProcess({ ...base, registrationReady: true, registrationMissing: [], documents: [{ documentType: 'Identificação', required: true, status: 'submitted' }] }, 'secretariat');
assert(documentSubmitted.nextAction?.code === 'VERIFY_REQUIRED_DOCUMENTS', 'Submitted document must yield verification action.');

const ready = projectEnrollmentProcess({ ...base, registrationReady: true, registrationMissing: [], documents: [{ documentType: 'Identificação', required: true, status: 'verified' }] }, 'secretariat');
assert(ready.currentStage === 'P06' && ready.progress.completed === 5, 'Satisfied gates must reach P06 with five completed stages.');
assert(ready.nextAction?.code === 'VALIDATE_ENROLLMENT', 'Under-review ready process must offer real validation.');

const validated = projectEnrollmentProcess({ ...base, enrollmentStatus: 'validated', registrationReady: true, registrationMissing: [], documents: [] }, 'secretariat');
assert(validated.currentStage === 'P06' && validated.progress.percent === 100, 'Validated must complete S03 at P06.');
assert(validated.nextAction === null, 'Validated must not offer activation in S03.');

const active = projectEnrollmentProcess({ ...base, enrollmentStatus: 'active', registrationReady: true, registrationMissing: [], documents: [] }, 'secretariat');
assert(active.progress.percent === 100 && active.nextAction === null, 'Future active state must be terminal for S03.');

const cancelled = projectEnrollmentProcess({ ...base, enrollmentStatus: 'cancelled' }, 'secretariat');
assert(cancelled.currentStage === 'P06' && cancelled.stages[5].reasonCode === 'ENROLLMENT_CANCELLED', 'Cancelled process must close at P06.');
assert(cancelled.nextAction === null, 'Cancelled process must not continue.');

const forbidden = projectEnrollmentProcess(base, 'teacher');
assert(forbidden.nextAction?.available === false, 'Projection must not offer executable actions to an unauthorized role.');

console.log(`[S03-PROCESS-POLICY] passed (${assertions} assertions).`);
