import {
  canManageEnrollmentDocuments,
  canTransitionEnrollmentDocument,
  isEnrollmentDocumentStatus,
  validDocumentType,
  validEvidenceReference,
} from '../src/modules/enrollments/enrollment-document-policy.ts';

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition {
  assertions += 1;
  if (!condition) throw new Error(message);
}

assert(isEnrollmentDocumentStatus('pending'), 'pending must be valid.');
assert(isEnrollmentDocumentStatus('submitted'), 'submitted must be valid.');
assert(isEnrollmentDocumentStatus('verified'), 'verified must be valid.');
assert(isEnrollmentDocumentStatus('rejected'), 'rejected must be valid.');
assert(!isEnrollmentDocumentStatus('active'), 'Enrollment statuses must not leak into document domain.');
assert(canManageEnrollmentDocuments('secretariat', 'draft'), 'Secretariat must manage documents during intake.');
assert(canManageEnrollmentDocuments('secretariat', 'under_review'), 'Secretariat must manage documents during review.');
assert(canManageEnrollmentDocuments('secretariat', 'awaiting_documents'), 'Secretariat must manage missing documents.');
assert(canManageEnrollmentDocuments('secretariat', 'blocked'), 'Secretariat must manage documents while resolving blockage.');
assert(!canManageEnrollmentDocuments('secretariat', 'validated'), 'Validated applications must not be silently mutated.');
assert(!canManageEnrollmentDocuments('secretariat', 'active'), 'Active enrollment documents must be read-only in S02.3.');
assert(!canManageEnrollmentDocuments('secretariat', 'cancelled'), 'Cancelled applications must remain read-only.');
assert(canTransitionEnrollmentDocument('secretariat', 'under_review', 'pending', 'submitted'), 'Pending evidence must be submittable.');
assert(canTransitionEnrollmentDocument('secretariat', 'under_review', 'submitted', 'verified'), 'Submitted evidence must be verifiable.');
assert(canTransitionEnrollmentDocument('secretariat', 'under_review', 'submitted', 'rejected'), 'Submitted evidence must be rejectable.');
assert(canTransitionEnrollmentDocument('secretariat', 'awaiting_documents', 'rejected', 'submitted'), 'Rejected evidence must support resubmission.');
assert(!canTransitionEnrollmentDocument('secretariat', 'under_review', 'pending', 'verified'), 'Pending evidence must not skip submission.');
assert(!canTransitionEnrollmentDocument('secretariat', 'under_review', 'verified', 'submitted'), 'Verified evidence must remain terminal in this unit.');
assert(!canTransitionEnrollmentDocument('secretariat', 'validated', 'submitted', 'verified'), 'Validated applications must not mutate documents.');
assert(validDocumentType('Certificado de habilitações'), 'Normal document type must be valid.');
assert(!validDocumentType('x'), 'Single-character document type must be rejected.');
assert(validEvidenceReference('arquivo/interno/123'), 'Evidence reference must accept a bounded non-empty reference.');
assert(!validEvidenceReference(''), 'Empty evidence reference must be rejected.');

console.log(`Secretariat S02.3 document policy passed (${assertions} assertions).`);
