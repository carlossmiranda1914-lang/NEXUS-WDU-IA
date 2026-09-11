/**
 * Documents Foundation I6 - PostgreSQL Retention & Holds Lifecycle Integration Tests
 * Mission: DOCUMENTS-FOUNDATION-I6
 */

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import { PostgresDocumentUploadRepository } from '../src/modules/documents/document-upload-repository.ts';
import { PostgresDocumentVerificationRepository } from '../src/modules/documents/document-verification-repository.ts';
import {
  PostgresRetentionAssignmentRepository,
  PostgresRetentionHoldRepository,
  PostgresDeletionAuthorizationRepository,
} from '../src/modules/documents/document-retention-repository.ts';
import {
  createUploadSessionCommand,
  completeUploadSessionCommand,
} from '../src/modules/documents/document-upload-command.ts';
import {
  executeTechnicalVerificationPipelineCommand,
} from '../src/modules/documents/document-verification-command.ts';
import {
  assignRetentionCommand,
  evaluateDeletionEligibilityCommand,
  placeHoldCommand,
  releaseHoldCommand,
  authorizeDeletionCommand,
} from '../src/modules/documents/document-retention-command.ts';
import {
  ConfigurableRetentionPolicyEngine,
  RetentionPolicyConfig,
} from '../src/modules/documents/document-retention-policy.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { DeterministicTestMalwareScanner } from './support/deterministic-test-malware-scanner.ts';
import { ContentTypeDetector } from '../src/modules/documents/content-type-detector.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

await verifyApprovedTestConnection();

const schema = `doc_ret_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionId = '00000000-0000-0000-0000-000000000001';
const adminPersonId = '00000000-0000-0000-0000-000000000002';
const dpoPersonId = '00000000-0000-0000-0000-000000000003';
const teacherPersonId = '00000000-0000-0000-0000-000000000004';

const adminContext: InstitutionalContext = {
  institutionId,
  institutionName: 'Nexus Test Academy',
  institutionSlug: 'nexus-test-academy',
  personId: adminPersonId,
  personName: 'Admin Person',
  identityEmail: 'admin@nexus.edu',
  membershipId: '00000000-0000-0000-0000-000000000010',
  role: 'institution_admin',
};

const dpoContext: InstitutionalContext = {
  institutionId,
  institutionName: 'Nexus Test Academy',
  institutionSlug: 'nexus-test-academy',
  personId: dpoPersonId,
  personName: 'DPO Person',
  identityEmail: 'dpo@nexus.edu',
  membershipId: '00000000-0000-0000-0000-000000000011',
  role: 'institution_admin',
};

const teacherContext: InstitutionalContext = {
  institutionId,
  institutionName: 'Nexus Test Academy',
  institutionSlug: 'nexus-test-academy',
  personId: teacherPersonId,
  personName: 'Teacher Person',
  identityEmail: 'teacher@nexus.edu',
  membershipId: '00000000-0000-0000-0000-000000000012',
  role: 'teacher',
};

const detector = new ContentTypeDetector({
  maxPrefixInspectionBytes: 4096,
  zipMetadataInspectionLimit: 64 * 1024,
  maxContainerEntryCount: 100,
  maxContainerMetadataBytes: 128 * 1024,
});

const syntheticPolicies: RetentionPolicyConfig[] = [
  {
    policyId: 'SYNTHETIC_TRANSCRIPT_RETENTION_V1',
    policyVersion: '1.0',
    jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
    jurisdictionProfileVersion: '1.0',
    category: 'academic_transcript',
    clockTriggerType: 'student_graduation_or_withdrawal',
    retentionDurationDays: 365, // 1 year synthetic
    allowedHoldTypes: ['legal', 'administrative'],
    allowedDeletionAuthorityScopePatterns: ['institution_admin', 'director'],
  },
  {
    policyId: 'SYNTHETIC_SHORT_RETENTION_V1',
    policyVersion: '1.0',
    jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
    jurisdictionProfileVersion: '1.0',
    category: 'identification',
    clockTriggerType: 'enrollment_closure',
    retentionDurationDays: 0, // 0 days synthetic = immediately expired
    allowedHoldTypes: ['legal', 'administrative'],
    allowedDeletionAuthorityScopePatterns: ['institution_admin'],
  },
];

const policyEngine = new ConfigurableRetentionPolicyEngine(syntheticPolicies);

const storageProvider = new MemoryObjectStorageProvider();
const malwareScanner = new DeterministicTestMalwareScanner();

const setupClient = await pool.connect();
try {
  await setupClient.query(`CREATE SCHEMA ${quote(schema)}`);
  await setupClient.query(`SET search_path TO ${quote(schema)},public`);

  const migrations = await discoverMigrations(migrationsDir);
  await runMigrations(setupClient, migrations);

  await setupClient.query(
    `INSERT INTO institutions (id, name, slug) VALUES ($1, $2, $3)`,
    [institutionId, 'Nexus Test Academy', 'nexus-test-academy'],
  );
  for (const pid of [adminPersonId, dpoPersonId, teacherPersonId]) {
    await setupClient.query(
      `INSERT INTO people (id, name) VALUES ($1, $2)`,
      [pid, `Person ${pid.slice(-2)}`],
    );
  }
} finally {
  setupClient.release();
}

async function createAvailableVersion(category: string, filename: string, content: Buffer): Promise<{ documentId: string; versionId: string }> {
  const docRepo = new PostgresDocumentRepository();
  const c = await pool.connect();
  let docId: string;
  try {
    const doc = await docRepo.createDocument(c, {
      institutionId,
      category,
      createdByPersonId: adminPersonId,
    });
    docId = doc.id;
  } finally {
    c.release();
  }

  const idSuffix = randomUUID();
  const sessionRes = await createUploadSessionCommand({
    pool,
    context: adminContext,
    idempotencyKey: `idemp-upload-session-${idSuffix}`,
    input: {
      documentId: docId,
      declaredFilename: filename,
      declaredMimeType: 'application/pdf',
      declaredByteSize: content.length,
      policyConfig: { globalMaxByteSize: 50 * 1024 * 1024 },
      storageProvider: 'test-memory',
      storageBucket: 'vault',
    },
  });

  await storageProvider.simulateDirectUpload({
    storageBucket: sessionRes.result.session.storageBucket,
    storageKey: sessionRes.result.session.storageKey,
    content,
    mimeType: 'application/pdf',
  });

  const completeRes = await completeUploadSessionCommand({
    pool,
    context: adminContext,
    storageProvider,
    idempotencyKey: `idemp-upload-complete-${idSuffix}`,
    input: {
      sessionId: sessionRes.result.session.id,
      rawToken: sessionRes.result.rawToken,
      provenance: {
        originType: 'user_upload',
        actorPersonId: adminPersonId,
        sourceDomain: 'documents.test',
        method: 'direct_upload',
      },
    },
  });

  await executeTechnicalVerificationPipelineCommand({
    pool,
    context: adminContext,
    idempotencyKey: `idemp-pipe-${idSuffix}`,
    input: {
      documentId: docId,
      versionId: completeRes.result.version.id,
      storageProvider,
      malwareScanner,
      contentTypeDetector: detector,
      retryPolicy: { maxAttempts: 3, baseBackoffMs: 1000, maxBackoffMs: 10000 },
    },
  });

  return { documentId: docId, versionId: completeRes.result.version.id };
}

console.log('[DOCUMENTS-RETENTION-POSTGRES] Running tests...');

// ── Test 1: Assign retention successfully with synthetic policy ────────────────
{
  const pdfBytes = Buffer.from('%PDF-1.4 sample content for retention test', 'utf8');
  const { documentId, versionId } = await createAvailableVersion('academic_transcript', 'transcript.pdf', pdfBytes);

  const clockTrigger = new Date('2025-01-01T00:00:00Z');
  const assignRes = await assignRetentionCommand({
    pool,
    context: adminContext,
    idempotencyKey: `ret_assign_${randomUUID()}`,
    policyEngine,
    input: {
      documentId,
      versionId,
      category: 'academic_transcript',
      jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
      clockTriggerEventAt: clockTrigger,
    },
  });

  assert.strictEqual(assignRes.replayed, false);
  assert.strictEqual(assignRes.result.policyId, 'SYNTHETIC_TRANSCRIPT_RETENTION_V1');
  assert.strictEqual(assignRes.result.retentionStatus, 'retention_active');
  assert.strictEqual(assignRes.result.clockTriggerType, 'student_graduation_or_withdrawal');

  const expectedRetainUntil = new Date('2026-01-01T00:00:00Z');
  assert.strictEqual(
    assignRes.result.retainUntil.toISOString().slice(0, 10),
    expectedRetainUntil.toISOString().slice(0, 10),
  );

  console.log('✔ Test 1 passed: Retention assigned with synthetic policy');
}

// ── Test 2: Fail closed when policy / jurisdiction is missing ──────────────────
{
  const pdfBytes = Buffer.from('%PDF-1.4 sample content for unknown policy test', 'utf8');
  const { documentId, versionId } = await createAvailableVersion('academic_transcript', 'transcript2.pdf', pdfBytes);

  await assert.rejects(
    () => assignRetentionCommand({
      pool,
      context: adminContext,
      idempotencyKey: `ret_assign_fail_${randomUUID()}`,
      policyEngine,
      input: {
        documentId,
        versionId,
        category: 'academic_transcript',
        jurisdictionProfileId: 'NON_EXISTENT_PROFILE',
        clockTriggerEventAt: new Date(),
      },
    }),
    /JURISDICTION_PROFILE_MISSING/,
    'Must fail closed when jurisdiction profile is missing',
  );

  console.log('✔ Test 2 passed: Fail-closed on missing jurisdiction profile');
}

// ── Test 3: Evaluate deletion eligibility (active retention vs expired) ─────────
{
  const pdfBytes = Buffer.from('%PDF-1.4 sample content for eligibility test', 'utf8');
  const { documentId, versionId } = await createAvailableVersion('academic_transcript', 'eligibility.pdf', pdfBytes);

  // Before assignment: not eligible (NO_RETENTION_ASSIGNMENT)
  const eligBefore = await evaluateDeletionEligibilityCommand({
    pool,
    context: adminContext,
    input: { documentId, versionId },
  });
  assert.strictEqual(eligBefore.eligible, false);
  assert.ok(eligBefore.blockers.includes('NO_RETENTION_ASSIGNMENT'));

  // Assign retention in future (retention active)
  await assignRetentionCommand({
    pool,
    context: adminContext,
    idempotencyKey: `ret_assign_elig_${randomUUID()}`,
    policyEngine,
    input: {
      documentId,
      versionId,
      category: 'academic_transcript',
      jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
      clockTriggerEventAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    },
  });

  const eligActive = await evaluateDeletionEligibilityCommand({
    pool,
    context: adminContext,
    input: { documentId, versionId },
  });
  assert.strictEqual(eligActive.eligible, false);
  assert.strictEqual(eligActive.retentionExpired, false);
  assert.ok(eligActive.blockers.includes('RETENTION_ACTIVE'));

  // Assign short retention in past (retention expired)
  const { documentId: docExp, versionId: verExp } = await createAvailableVersion('identification', 'expired_id.pdf', pdfBytes);
  await assignRetentionCommand({
    pool,
    context: adminContext,
    idempotencyKey: `ret_assign_exp_${randomUUID()}`,
    policyEngine,
    input: {
      documentId: docExp,
      versionId: verExp,
      category: 'identification',
      jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
      clockTriggerEventAt: new Date(Date.now() - 1000), // in the past
    },
  });

  const eligExp = await evaluateDeletionEligibilityCommand({
    pool,
    context: adminContext,
    input: { documentId: docExp, versionId: verExp },
  });
  assert.strictEqual(eligExp.eligible, true);
  assert.strictEqual(eligExp.retentionExpired, true);
  assert.strictEqual(eligExp.noActiveHolds, true);
  assert.strictEqual(eligExp.blockers.length, 0);

  console.log('✔ Test 3 passed: Deletion eligibility correctly computed');
}

// ── Test 4: Legal / administrative holds block deletion ─────────────────────────
{
  const pdfBytes = Buffer.from('%PDF-1.4 sample content for hold test', 'utf8');
  const { documentId, versionId } = await createAvailableVersion('identification', 'hold_doc.pdf', pdfBytes);

  await assignRetentionCommand({
    pool,
    context: adminContext,
    idempotencyKey: `ret_assign_hold_${randomUUID()}`,
    policyEngine,
    input: {
      documentId,
      versionId,
      category: 'identification',
      jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
      clockTriggerEventAt: new Date(Date.now() - 1000),
    },
  });

  // Place legal hold
  const holdRes = await placeHoldCommand({
    pool,
    context: dpoContext,
    idempotencyKey: `place_hold_${randomUUID()}`,
    policyEngine,
    input: {
      documentId,
      versionId,
      holdType: 'legal',
      authority: 'Court Order 2026-99A',
      reason: 'Pending judicial discovery',
    },
  });
  assert.strictEqual(holdRes.result.holdStatus, 'active');
  assert.strictEqual(holdRes.result.holdType, 'legal');

  // Eligibility must now be BLOCKED by the hold
  const eligWithHold = await evaluateDeletionEligibilityCommand({
    pool,
    context: adminContext,
    input: { documentId, versionId },
  });
  assert.strictEqual(eligWithHold.eligible, false);
  assert.strictEqual(eligWithHold.noActiveHolds, false);
  assert.ok(eligWithHold.blockers.some((b) => b.startsWith('ACTIVE_HOLDS:1')));

  // Deletion authorization must FAIL with active hold
  await assert.rejects(
    () => authorizeDeletionCommand({
      pool,
      context: dpoContext,
      idempotencyKey: `auth_del_hold_${randomUUID()}`,
      policyEngine,
      input: {
        documentId,
        versionId,
      },
    }),
    /ACTIVE_HOLD_PREVENTS_DELETION/,
  );

  // Release the hold
  const releaseRes = await releaseHoldCommand({
    pool,
    context: dpoContext,
    idempotencyKey: `rel_hold_${randomUUID()}`,
    policyEngine,
    input: {
      holdId: holdRes.result.id,
      documentId,
      versionId,
      releaseReason: 'Judicial discovery concluded without finding',
    },
  });
  assert.strictEqual(releaseRes.result.holdStatus, 'released');
  assert.ok(releaseRes.result.releasedAt != null);

  // Eligibility unblocked after release
  const eligAfterRelease = await evaluateDeletionEligibilityCommand({
    pool,
    context: adminContext,
    input: { documentId, versionId },
  });
  assert.strictEqual(eligAfterRelease.eligible, true);
  assert.strictEqual(eligAfterRelease.noActiveHolds, true);

  console.log('✔ Test 4 passed: Legal holds block and release unblocks deletion');
}

// ── Test 5: Authorize deletion (role check, status transition) ──────────────────
{
  const pdfBytes = Buffer.from('%PDF-1.4 sample content for auth deletion test', 'utf8');
  const { documentId, versionId } = await createAvailableVersion('identification', 'auth_del.pdf', pdfBytes);

  await assignRetentionCommand({
    pool,
    context: adminContext,
    idempotencyKey: `ret_assign_del_${randomUUID()}`,
    policyEngine,
    input: {
      documentId,
      versionId,
      category: 'identification',
      jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
      clockTriggerEventAt: new Date(Date.now() - 1000),
    },
  });

  // 1. Teacher unauthorized -> DENIED
  await assert.rejects(
    () => authorizeDeletionCommand({
      pool,
      context: teacherContext,
      idempotencyKey: `auth_del_unauth_${randomUUID()}`,
      policyEngine,
      input: {
        documentId,
        versionId,
      },
    }),
    /DELETION_AUTHORIZATION_DENIED/,
  );

  // 2. Admin authorized -> SUCCESS
  const authRes = await authorizeDeletionCommand({
    pool,
    context: dpoContext,
    idempotencyKey: `auth_del_dpo_${randomUUID()}`,
    policyEngine,
    input: {
      documentId,
      versionId,
    },
  });
  assert.strictEqual(authRes.result.authorizationStatus, 'authorized');
  assert.strictEqual(authRes.result.policyBasis, 'SYNTHETIC_SHORT_RETENTION_V1');

  // Verify retention assignment status transitioned to deletion_authorized
  const checkClient = await pool.connect();
  try {
    const rRepo = new PostgresRetentionAssignmentRepository();
    const a = await rRepo.getByVersionId(checkClient, institutionId, versionId);
    assert.strictEqual(a?.retentionStatus, 'deletion_authorized');
  } finally {
    checkClient.release();
  }

  console.log('✔ Test 5 passed: Deletion authorization role check and status transition verified');
}

const teardownClient = await pool.connect();
try {
  await teardownClient.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
} finally {
  teardownClient.release();
  await pool.end();
}

console.log('[DOCUMENTS-RETENTION-POSTGRES] ALL TESTS PASSED ✅');
