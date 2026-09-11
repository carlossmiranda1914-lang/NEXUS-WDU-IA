/**
 * Documents Foundation I6 - Unit Tests: Retention Model, Pseudonymization & Policy Engine
 * Mission: DOCUMENTS-FOUNDATION-I6
 */

import assert from 'node:assert';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import {
  validateDeletionPseudonymizationKey,
  deriveDeletionPseudonymizedRef,
  generateDeletionOperationId,
} from '../src/modules/documents/document-retention-model.ts';
import {
  ConfigurableRetentionPolicyEngine,
  RetentionPolicyConfig,
} from '../src/modules/documents/document-retention-policy.ts';

test('DOCUMENTS-RETENTION-MODEL: Key validation and HMAC pseudonymization', () => {
  // 1. Missing / empty key -> throws DELETION_PSEUDONYM_KEY_MISSING
  assert.throws(
    () => validateDeletionPseudonymizationKey(''),
    /DELETION_PSEUDONYM_KEY_MISSING/,
  );
  assert.throws(
    () => validateDeletionPseudonymizationKey('   '),
    /DELETION_PSEUDONYM_KEY_MISSING/,
  );

  // 2. Short key (< 32 bytes) -> throws DELETION_PSEUDONYM_KEY_MISSING
  assert.throws(
    () => validateDeletionPseudonymizationKey('too_short_key_123'),
    /DELETION_PSEUDONYM_KEY_MISSING/,
  );

  // 3. Valid 32-byte secret material -> passes
  const validKeyHex = randomBytes(32).toString('hex'); // 64 chars hex = 32 bytes
  assert.doesNotThrow(() => validateDeletionPseudonymizationKey(validKeyHex));

  const validKeyRaw = 'a'.repeat(32); // 32 raw bytes
  assert.doesNotThrow(() => validateDeletionPseudonymizationKey(validKeyRaw));

  // 4. Pseudonymized ref derivation
  const instId = '11111111-1111-1111-1111-111111111111';
  const docId = '22222222-2222-2222-2222-222222222222';
  const verId = '33333333-3333-3333-3333-333333333333';
  const authId = '44444444-4444-4444-4444-444444444444';

  const ref1 = deriveDeletionPseudonymizedRef({
    deletionPseudonymizationKey: validKeyHex,
    institutionId: instId,
    documentId: docId,
    versionId: verId,
    deletionAuthorizationId: authId,
  });

  const ref1Repeat = deriveDeletionPseudonymizedRef({
    deletionPseudonymizationKey: validKeyHex,
    institutionId: instId,
    documentId: docId,
    versionId: verId,
    deletionAuthorizationId: authId,
  });

  assert.strictEqual(typeof ref1, 'string');
  assert.strictEqual(ref1.length, 64); // SHA-256 hex = 64 characters
  assert.strictEqual(/^[a-f0-9]{64}$/.test(ref1), true);
  assert.strictEqual(ref1, ref1Repeat, 'Derivation must be deterministic given same key and inputs');

  // Must NOT contain raw identifiers
  assert.strictEqual(ref1.includes(docId), false);
  assert.strictEqual(ref1.includes(verId), false);
  assert.strictEqual(ref1.includes(instId), false);

  // Different documentId -> different ref
  const refDiffDoc = deriveDeletionPseudonymizedRef({
    deletionPseudonymizationKey: validKeyHex,
    institutionId: instId,
    documentId: '99999999-9999-9999-9999-999999999999',
    versionId: verId,
    deletionAuthorizationId: authId,
  });
  assert.notStrictEqual(ref1, refDiffDoc);

  // Different key -> different ref
  const otherKeyHex = randomBytes(32).toString('hex');
  const refDiffKey = deriveDeletionPseudonymizedRef({
    deletionPseudonymizationKey: otherKeyHex,
    institutionId: instId,
    documentId: docId,
    versionId: verId,
    deletionAuthorizationId: authId,
  });
  assert.notStrictEqual(ref1, refDiffKey);

  // 5. Operation ID generation
  const opId1 = generateDeletionOperationId();
  const opId2 = generateDeletionOperationId();
  assert.notStrictEqual(opId1, opId2);
  assert.strictEqual(opId1.length > 20, true);
});

test('DOCUMENTS-RETENTION-POLICY: Synthetic policy engine, duration and authority evaluation', () => {
  const syntheticPolicies: RetentionPolicyConfig[] = [
    {
      policyId: 'SYNTHETIC_TRANSCRIPT_RETENTION_V1',
      policyVersion: '1.0',
      jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
      jurisdictionProfileVersion: '1.0',
      category: 'academic_transcript',
      clockTriggerType: 'student_graduation_or_withdrawal',
      retentionDurationDays: 1825, // 5 years synthetic
      allowedHoldTypes: ['legal', 'administrative'],
      allowedDeletionAuthorityScopePatterns: ['institution_admin', 'director'],
    },
    {
      policyId: 'SYNTHETIC_MEDICAL_REPORT_RETENTION_V1',
      policyVersion: '1.0',
      jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
      jurisdictionProfileVersion: '1.0',
      category: 'medical_report',
      clockTriggerType: 'student_graduation_or_withdrawal',
      retentionDurationDays: 7300, // 20 years synthetic
      allowedHoldTypes: ['legal'],
      allowedDeletionAuthorityScopePatterns: ['institution_admin'],
    },
  ];

  const engine = new ConfigurableRetentionPolicyEngine(syntheticPolicies);

  // 1. Resolve matching policy
  const policy = engine.resolvePolicy({
    institutionId: '11111111-1111-1111-1111-111111111111',
    category: 'academic_transcript',
    jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
  });
  assert.ok(policy != null);
  assert.strictEqual(policy.policyId, 'SYNTHETIC_TRANSCRIPT_RETENTION_V1');

  // 2. Unmatched category -> returns null (fail closed)
  const unknownPolicy = engine.resolvePolicy({
    institutionId: '11111111-1111-1111-1111-111111111111',
    category: 'unregistered_category',
    jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
  });
  assert.strictEqual(unknownPolicy, null);

  // 3. Unmatched jurisdiction -> returns null (fail closed)
  const unknownJurisdiction = engine.resolvePolicy({
    institutionId: '11111111-1111-1111-1111-111111111111',
    category: 'academic_transcript',
    jurisdictionProfileId: 'NON_EXISTENT_JURISDICTION',
  });
  assert.strictEqual(unknownJurisdiction, null);

  // 4. Retain until calculation (never uses default or uploaded_at)
  const clockTrigger = new Date('2020-01-01T00:00:00Z');
  const retainUntil = engine.calculateRetainUntil(policy!, clockTrigger);
  const diffDays = Math.round((retainUntil.getTime() - clockTrigger.getTime()) / (1000 * 60 * 60 * 24));
  assert.strictEqual(diffDays, 1825);

  // 5. Deletion authority checks (roles derived from InstitutionalContext)
  assert.strictEqual(engine.isDeletionAuthorized(policy!, 'institution_admin'), true);
  assert.strictEqual(engine.isDeletionAuthorized(policy!, 'director'), true);
  assert.strictEqual(engine.isDeletionAuthorized(policy!, 'teacher'), false);
  assert.strictEqual(engine.isDeletionAuthorized(policy!, 'student'), false);

  // 6. Hold authorization checks
  const medPolicy = engine.resolvePolicy({
    institutionId: '11111111-1111-1111-1111-111111111111',
    category: 'medical_report',
    jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
  });
  assert.ok(medPolicy != null);
  // medPolicy only allows 'legal' hold
  assert.strictEqual(engine.isHoldAuthorized(medPolicy!, 'legal', 'institution_admin'), true);
  assert.strictEqual(engine.isHoldAuthorized(medPolicy!, 'administrative', 'institution_admin'), false);
  assert.strictEqual(engine.isHoldAuthorized(medPolicy!, 'legal', 'teacher'), false);

  console.log('[DOCUMENTS-RETENTION-MODEL] PASS: Unit models, HMAC derivation and retention policy engine verified.');
});
