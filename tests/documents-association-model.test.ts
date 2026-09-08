import assert from 'node:assert/strict';
import {
  validateTargetDomain,
  validateTargetResourceType,
  validateTargetResourceId,
  validatePurpose,
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

// 1. Invariants validation
assert.throws(() => validateTargetDomain(''), /Invalid targetDomain/);
assert.throws(() => validateTargetDomain('a'), /Invalid targetDomain/);
assert.doesNotThrow(() => validateTargetDomain('enrollment'));
assert.doesNotThrow(() => validateTargetDomain('finance'));

assert.throws(() => validateTargetResourceType(''), /Invalid targetResourceType/);
assert.doesNotThrow(() => validateTargetResourceType('enrollment_application'));

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

// 2. Association state machine transitions
assert.doesNotThrow(() => validateAssociationTransition('active', 'withdrawn'));
assert.doesNotThrow(() => validateAssociationTransition('active', 'closed'));
assert.doesNotThrow(() => validateAssociationTransition('active', 'superseded'));
assert.doesNotThrow(() => validateAssociationTransition('active', 'active'));

assert.throws(() => validateAssociationTransition('withdrawn', 'active'), /terminal state/);
assert.throws(() => validateAssociationTransition('closed', 'active'), /terminal state/);
assert.throws(() => validateAssociationTransition('superseded', 'active'), /terminal state/);
assert.throws(() => validateAssociationTransition('withdrawn', 'closed'), /terminal state/);

// 3. Deterministic Fingerprint Generation
const fp1 = createAssociationCreationFingerprint(
  '00000000-0000-0000-0000-000000000001',
  {
    documentId: '00000000-0000-0000-0000-000000000002',
    targetDomain: 'enrollment',
    targetResourceType: 'application',
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
    targetResourceType: 'application',
    targetDomain: 'enrollment',
    documentId: '00000000-0000-0000-0000-000000000002',
  },
  '00000000-0000-0000-0000-000000000003',
);

assert.strictEqual(fp1, fp2, 'Fingerprints must match regardless of property order');

console.log('[DOCUMENTS-ASSOCIATION-MODEL] PASS: Association models, invariants, and transitions verified.');
