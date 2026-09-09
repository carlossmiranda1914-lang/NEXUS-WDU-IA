import assert from 'node:assert/strict';
import {
  RECOGNIZED_TARGET_DOMAINS,
  GOVERNED_TARGET_CONTRACTS,
  validateTargetDomain,
  validateTargetResourceType,
  validateTargetResourceId,
  validatePurpose,
  validateTargetResourceContract,
  validateAuthorityDomain,
  validateDecisionType,
  validateExternalReference,
  validateAssociationTransition,
} from '../src/modules/documents/document-association-model.ts';
import {
  createAssociationCreationFingerprint,
  createPinVersionFingerprint,
  createTransitionAssociationStatusFingerprint,
  createRecordDecisionReferenceFingerprint,
} from '../src/modules/documents/document-association-command.ts';

// 1. Target Domain Governance & Invariants
assert.throws(() => validateTargetDomain(''), /Invalid targetDomain/);
assert.throws(() => validateTargetDomain('a'), /Invalid targetDomain/);
assert.throws(() => validateTargetDomain('unknown_domain'), /Unrecognized targetDomain/);
assert.throws(() => validateTargetDomain('random_module'), /Unrecognized targetDomain/);
assert.throws(() => validateTargetDomain('attendance'), /Unrecognized targetDomain/);
assert.throws(() => validateTargetDomain('student_lifecycle'), /Unrecognized targetDomain/);

for (const domain of RECOGNIZED_TARGET_DOMAINS) {
  assert.doesNotThrow(() => validateTargetDomain(domain));
}

// 2. Governed Target Resource Types per Domain (EVIDENCED ONLY)
assert.throws(() => validateTargetResourceType('enrollment', ''), /Invalid targetResourceType/);
assert.throws(() => validateTargetResourceType('enrollment', 'a'), /Invalid targetResourceType/);
assert.throws(() => validateTargetResourceType('unknown_domain', 'enrollment_application'), /Unrecognized targetDomain/);

// Recognized domain + evidenced resource type -> PASS
assert.doesNotThrow(() => validateTargetResourceType('enrollment', 'enrollment_application'));
assert.doesNotThrow(() => validateTargetResourceType('enrollment', 'enrollment_process'));
assert.doesNotThrow(() => validateTargetResourceType('finance', 'invoice'));
assert.doesNotThrow(() => validateTargetResourceType('academic', 'academic_year'));
assert.doesNotThrow(() => validateTargetResourceType('academic', 'academic_term'));
assert.doesNotThrow(() => validateTargetResourceType('secretariat', 'school_task'));
assert.doesNotThrow(() => validateTargetResourceType('secretariat', 'approval'));

// Removed/Unevidenced resource types -> MUST BE REJECTED (Explicit Audit Regression)
const unevidencedTypesToReject: Array<{ domain: string; type: string }> = [
  // Removed from enrollment
  { domain: 'enrollment', type: 'student_enrollment' },
  { domain: 'enrollment', type: 'candidacy' },
  { domain: 'enrollment', type: 'registration' },
  // Removed from finance
  { domain: 'finance', type: 'student_account' },
  { domain: 'finance', type: 'payment_plan' },
  { domain: 'finance', type: 'scholarship' },
  { domain: 'finance', type: 'bursary' },
  // Removed from academic
  { domain: 'academic', type: 'student_record' },
  { domain: 'academic', type: 'grade_appeal' },
  { domain: 'academic', type: 'academic_standing' },
  { domain: 'academic', type: 'curriculum_waiver' },
  // Removed from secretariat
  { domain: 'secretariat', type: 'certificate_request' },
  { domain: 'secretariat', type: 'diploma_request' },
  { domain: 'secretariat', type: 'transfer_process' },
  { domain: 'secretariat', type: 'general_request' },
];

for (const { domain, type } of unevidencedTypesToReject) {
  assert.throws(
    () => validateTargetResourceType(domain, type),
    new RegExp(`Unrecognized targetResourceType "${type}" for domain "${domain}"`),
    `Removed unevidenced resource type "${type}" on domain "${domain}" must be rejected`,
  );
}

// Resource type valid for Domain A used with Domain B -> REJECTED
assert.throws(
  () => validateTargetResourceType('finance', 'school_task'),
  /Unrecognized targetResourceType "school_task" for domain "finance"/,
);
assert.throws(
  () => validateTargetResourceType('enrollment', 'invoice'),
  /Unrecognized targetResourceType "invoice" for domain "enrollment"/,
);
assert.throws(
  () => validateTargetResourceType('academic', 'approval'),
  /Unrecognized targetResourceType "approval" for domain "academic"/,
);
assert.throws(
  () => validateTargetResourceType('secretariat', 'enrollment_application'),
  /Unrecognized targetResourceType "enrollment_application" for domain "secretariat"/,
);

// Full target resource contract validation
assert.doesNotThrow(() =>
  validateTargetResourceContract('enrollment', 'enrollment_application', 'app-101', 'enrollment_proof'),
);
assert.throws(
  () => validateTargetResourceContract('enrollment', 'unsupported_type', 'app-101', 'enrollment_proof'),
  /Unrecognized targetResourceType/,
);

// 3. String Invariants
assert.throws(() => validateTargetResourceId(''), /Invalid targetResourceId/);
assert.doesNotThrow(() => validateTargetResourceId('app-12345'));

assert.throws(() => validatePurpose(''), /Invalid purpose/);
assert.doesNotThrow(() => validatePurpose('identity_verification'));

assert.throws(() => validateAuthorityDomain(''), /Invalid authorityDomain/);
assert.doesNotThrow(() => validateAuthorityDomain('academic'));

assert.throws(() => validateDecisionType(''), /Invalid decisionType/);
assert.doesNotThrow(() => validateDecisionType('curriculum_approval'));

assert.throws(() => validateExternalReference(''), /Invalid externalReference/);
assert.doesNotThrow(() => validateExternalReference('proc-ref-999'));

// 4. Association state machine transitions and terminal immutability
// ACTIVE -> Valid terminal transitions
assert.doesNotThrow(() => validateAssociationTransition('active', 'withdrawn'));
assert.doesNotThrow(() => validateAssociationTransition('active', 'closed'));
assert.doesNotThrow(() => validateAssociationTransition('active', 'superseded'));

// ACTIVE -> ACTIVE must be rejected
assert.throws(() => validateAssociationTransition('active', 'active'), /Invalid target association status/);

// Terminal states -> Same terminal state must be REJECTED (no self-transition / no mutation)
assert.throws(() => validateAssociationTransition('withdrawn', 'withdrawn'), /terminal state "withdrawn"/);
assert.throws(() => validateAssociationTransition('closed', 'closed'), /terminal state "closed"/);
assert.throws(() => validateAssociationTransition('superseded', 'superseded'), /terminal state "superseded"/);

// Terminal states -> Other terminal states must be REJECTED
assert.throws(() => validateAssociationTransition('withdrawn', 'closed'), /terminal state "withdrawn"/);
assert.throws(() => validateAssociationTransition('withdrawn', 'superseded'), /terminal state "withdrawn"/);
assert.throws(() => validateAssociationTransition('closed', 'withdrawn'), /terminal state "closed"/);
assert.throws(() => validateAssociationTransition('closed', 'superseded'), /terminal state "closed"/);
assert.throws(() => validateAssociationTransition('superseded', 'withdrawn'), /terminal state "superseded"/);
assert.throws(() => validateAssociationTransition('superseded', 'closed'), /terminal state "superseded"/);

// Terminal states -> ACTIVE must be REJECTED
assert.throws(() => validateAssociationTransition('withdrawn', 'active'), /terminal state "withdrawn"/);
assert.throws(() => validateAssociationTransition('closed', 'active'), /terminal state "closed"/);
assert.throws(() => validateAssociationTransition('superseded', 'active'), /terminal state "superseded"/);

// 5. Deterministic Fingerprint Generation
const fp1 = createAssociationCreationFingerprint(
  '00000000-0000-0000-0000-000000000001',
  {
    documentId: '00000000-0000-0000-0000-000000000002',
    targetDomain: 'enrollment',
    targetResourceType: 'enrollment_application',
    targetResourceId: 'app-1',
    purpose: 'identity_proof',
  },
  '00000000-0000-0000-0000-000000000003',
);

const fp2 = createAssociationCreationFingerprint(
  '00000000-0000-0000-0000-000000000001',
  {
    purpose: 'identity_proof',
    targetResourceId: 'app-1',
    targetResourceType: 'enrollment_application',
    targetDomain: 'enrollment',
    documentId: '00000000-0000-0000-0000-000000000002',
  },
  '00000000-0000-0000-0000-000000000003',
);

assert.strictEqual(fp1, fp2, 'Fingerprints must match regardless of property order');

console.log('[DOCUMENTS-ASSOCIATION-MODEL] PASS: Association models, governed target contracts, and terminal immutability verified.');
