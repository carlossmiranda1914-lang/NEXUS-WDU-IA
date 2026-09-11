/**
 * Documents Foundation I6 - Deletion Execution & Reconciliation PostgreSQL Integration Tests
 * Mission: DOCUMENTS-FOUNDATION-I6
 */

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import { PostgresDocumentAssociationRepository } from '../src/modules/documents/document-association-repository.ts';
import {
  PostgresDeletionRecordRepository,
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
  authorizeDeletionCommand,
} from '../src/modules/documents/document-retention-command.ts';
import {
  executeDeletionCommand,
  reconcileDeletionCommand,
} from '../src/modules/documents/document-deletion-command.ts';
import {
  deriveDeletionPseudonymizedRef,
} from '../src/modules/documents/document-retention-model.ts';
import {
  ConfigurableRetentionPolicyEngine,
  RetentionPolicyConfig,
} from '../src/modules/documents/document-retention-policy.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { DeterministicTestMalwareScanner } from './support/deterministic-test-malware-scanner.ts';
import { ContentTypeDetector } from '../src/modules/documents/content-type-detector.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

await verifyApprovedTestConnection();

const schema = `doc_del_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionId = '00000000-0000-0000-0000-000000000001';
const adminPersonId = '00000000-0000-0000-0000-000000000002';
const dpoPersonId = '00000000-0000-0000-0000-000000000003';

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

const detector = new ContentTypeDetector({
  maxPrefixInspectionBytes: 4096,
  zipMetadataInspectionLimit: 64 * 1024,
  maxContainerEntryCount: 100,
  maxContainerMetadataBytes: 128 * 1024,
});

const syntheticPolicies: RetentionPolicyConfig[] = [
  {
    policyId: 'SYNTHETIC_SHORT_RETENTION_V1',
    policyVersion: '1.0',
    jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
    jurisdictionProfileVersion: '1.0',
    category: 'identification',
    clockTriggerType: 'enrollment_closure',
    retentionDurationDays: 0,
    allowedHoldTypes: ['legal', 'administrative'],
    allowedDeletionAuthorityScopePatterns: ['institution_admin', 'director'],
  },
];

const policyEngine = new ConfigurableRetentionPolicyEngine(syntheticPolicies);
const storageProvider = new MemoryObjectStorageProvider();
const malwareScanner = new DeterministicTestMalwareScanner();
const deletionPseudonymizationKey = randomBytes(32).toString('hex');

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
  for (const pid of [adminPersonId, dpoPersonId]) {
    await setupClient.query(
      `INSERT INTO people (id, name) VALUES ($1, $2)`,
      [pid, `Person ${pid.slice(-2)}`],
    );
  }
} finally {
  setupClient.release();
}

async function createAvailableVersion(filename: string = 'doc.pdf'): Promise<{ documentId: string; versionId: string; storageBucket: string; storageKey: string }> {
  const content = Buffer.from(`%PDF-1.4 sample content for deletion test ${randomUUID()}`, 'utf8');
  const docRepo = new PostgresDocumentRepository();
  const c = await pool.connect();
  let docId: string;
  try {
    const doc = await docRepo.createDocument(c, {
      institutionId,
      category: 'identification',
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

  return {
    documentId: docId,
    versionId: completeRes.result.version.id,
    storageBucket: sessionRes.result.session.storageBucket,
    storageKey: sessionRes.result.session.storageKey,
  };
}

console.log('[DOCUMENTS-DELETION-POSTGRES] Running tests...');

// ── Test 1: Happy path — deletion execution, physical storage removal, tombstone & pseudonym ──
{
  const { documentId, versionId, storageBucket, storageKey } = await createAvailableVersion('happy_del.pdf');

  await assignRetentionCommand({
    pool,
    context: adminContext,
    idempotencyKey: `ret_assign_${randomUUID()}`,
    policyEngine,
    input: {
      documentId,
      versionId,
      category: 'identification',
      jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
      clockTriggerEventAt: new Date(Date.now() - 1000),
    },
  });

  const authRes = await authorizeDeletionCommand({
    pool,
    context: dpoContext,
    idempotencyKey: `auth_del_${randomUUID()}`,
    policyEngine,
    input: {
      documentId,
      versionId,
    },
  });

  // Execute deletion
  const execRes = await executeDeletionCommand({
    pool,
    context: dpoContext,
    idempotencyKey: `exec_del_${randomUUID()}`,
    deletionPseudonymizationKey,
    storageProvider,
    input: {
      deletionAuthorizationId: authRes.result.id,
    },
  });

  assert.strictEqual(execRes.replayed, false);
  assert.strictEqual(execRes.result.reconciliationRequired, false);
  assert.ok(execRes.result.deletionRecord != null);
  assert.strictEqual(execRes.result.deletionRecord.result, 'deleted');
  assert.strictEqual(execRes.result.deletionRecord.storageDeletionConfirmed, true);

  // 1. Verify physical storage object is gone
  const headAfter = await storageProvider.headObject({ storageBucket, storageKey });
  assert.strictEqual(headAfter.exists, false, 'Physical storage object must be deleted');

  // 2. Verify document_storage_references row is deleted
  const checkClient = await pool.connect();
  try {
    const srRows = await checkClient.query(
      `SELECT * FROM document_storage_references WHERE institution_id = $1 AND version_id = $2`,
      [institutionId, versionId],
    );
    assert.strictEqual(srRows.rows.length, 0, 'Storage reference row must be removed');

    // 3. Verify version status is 'deleted'
    const docRepo = new PostgresDocumentRepository();
    const ver = await docRepo.getVersionById(checkClient, institutionId, versionId);
    assert.strictEqual(ver?.status, 'deleted', 'Version status must be terminal "deleted"');

    // 4. Verify DeletionRecord contains NO raw documentId or versionId
    const delRecord = execRes.result.deletionRecord;
    const expectedPseudonym = deriveDeletionPseudonymizedRef({
      deletionPseudonymizationKey,
      institutionId,
      documentId,
      versionId,
      deletionAuthorizationId: authRes.result.id,
    });
    assert.strictEqual(delRecord.pseudonymizedRef, expectedPseudonym);
    assert.strictEqual(JSON.stringify(delRecord).includes(documentId), false);
    assert.strictEqual(JSON.stringify(delRecord).includes(versionId), false);
    assert.strictEqual(JSON.stringify(delRecord).includes(storageBucket), false);
    assert.strictEqual(JSON.stringify(delRecord).includes(storageKey), false);
  } finally {
    checkClient.release();
  }

  console.log('✔ Test 1 passed: Happy path deletion execution, storage removal, tombstone & pseudonym verified');
}

// ── Test 2: Failure / Reconciliation path — storage delete failure -> reconciliation ──
{
  const { documentId, versionId, storageBucket, storageKey } = await createAvailableVersion('fail_del.pdf');

  await assignRetentionCommand({
    pool,
    context: adminContext,
    idempotencyKey: `ret_assign_${randomUUID()}`,
    policyEngine,
    input: {
      documentId,
      versionId,
      category: 'identification',
      jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
      clockTriggerEventAt: new Date(Date.now() - 1000),
    },
  });

  const authRes = await authorizeDeletionCommand({
    pool,
    context: dpoContext,
    idempotencyKey: `auth_del_${randomUUID()}`,
    policyEngine,
    input: {
      documentId,
      versionId,
    },
  });

  // Inject failure on delete
  storageProvider.injectFailure('delete');

  const execResFail = await executeDeletionCommand({
    pool,
    context: dpoContext,
    idempotencyKey: `exec_del_fail_${randomUUID()}`,
    deletionPseudonymizationKey,
    storageProvider,
    input: {
      deletionAuthorizationId: authRes.result.id,
    },
  });

  assert.strictEqual(execResFail.result.reconciliationRequired, true);
  assert.strictEqual(execResFail.result.deletionRecord, null, 'DeletionRecord must be null when storage deletion fails');

  // Storage and DB checks during reconciliation_required:
  const checkClient = await pool.connect();
  try {
    // Assert 0 deletion records exist for this authorization
    const delRecRows = await checkClient.query(
      `SELECT * FROM document_deletion_records WHERE institution_id = $1 AND deletion_authorization_id = $2`,
      [institutionId, authRes.result.id],
    );
    assert.strictEqual(delRecRows.rows.length, 0, 'No deletion record should be written on failure');

    const authRepo = new PostgresDeletionAuthorizationRepository();
    const a = await authRepo.getById(checkClient, institutionId, authRes.result.id);
    assert.strictEqual(a?.authorizationStatus, 'deletion_reconciliation_required');

    const docRepo = new PostgresDocumentRepository();
    const ver = await docRepo.getVersionById(checkClient, institutionId, versionId);
    assert.strictEqual(ver?.status, 'deletion_in_progress', 'Version must NOT be set to deleted on failure');

    const srRows = await checkClient.query(
      `SELECT * FROM document_storage_references WHERE institution_id = $1 AND version_id = $2`,
      [institutionId, versionId],
    );
    assert.strictEqual(srRows.rows.length, 1, 'Storage reference row must NOT be removed on failure');
  } finally {
    checkClient.release();
  }

  // Clear failure injection and reconcile
  storageProvider.clearInjectedFailures();

  const reconcileRes = await reconcileDeletionCommand({
    pool,
    context: dpoContext,
    deletionPseudonymizationKey,
    storageProvider,
    input: {
      deletionAuthorizationId: authRes.result.id,
    },
  });

  assert.strictEqual(reconcileRes.reconciliationRequired, false);
  assert.strictEqual(reconcileRes.deletionRecord.result, 'deleted');
  assert.strictEqual(reconcileRes.deletionRecord.storageDeletionConfirmed, true);

  // Verify storage gone and version deleted after reconciliation
  const headAfter = await storageProvider.headObject({ storageBucket, storageKey });
  assert.strictEqual(headAfter.exists, false);

  const checkClient2 = await pool.connect();
  try {
    const docRepo = new PostgresDocumentRepository();
    const ver = await docRepo.getVersionById(checkClient2, institutionId, versionId);
    assert.strictEqual(ver?.status, 'deleted');

    const srRows = await checkClient2.query(
      `SELECT * FROM document_storage_references WHERE institution_id = $1 AND version_id = $2`,
      [institutionId, versionId],
    );
    assert.strictEqual(srRows.rows.length, 0);

    // Assert exactly 1 deletion record exists now (append-only)
    const delRecRows = await checkClient2.query(
      `SELECT * FROM document_deletion_records WHERE institution_id = $1 AND deletion_authorization_id = $2`,
      [institutionId, authRes.result.id],
    );
    assert.strictEqual(delRecRows.rows.length, 1, 'Exactly one deletion record appended on final reconciliation');
  } finally {
    checkClient2.release();
  }

  console.log('✔ Test 2 passed: Failure fail-closed state and successful reconciliation verified');
}

// ── Test 3: Historical associations remain preserved after deletion ─────────────
{
  const { documentId, versionId } = await createAvailableVersion('assoc_del.pdf');

  // Create an association
  const assocRepo = new PostgresDocumentAssociationRepository();
  const cAssoc = await pool.connect();
  let assocId: string;
  try {
    const assoc = await assocRepo.createAssociation(cAssoc, {
      institutionId,
      documentId,
      pinnedVersionId: versionId,
      targetDomain: 'enrollment',
      targetResourceType: 'enrollment_application',
      targetResourceId: randomUUID(),
      purpose: 'identification',
      createdByPersonId: adminPersonId,
    });
    assocId = assoc.id;
  } finally {
    cAssoc.release();
  }

  await assignRetentionCommand({
    pool,
    context: adminContext,
    idempotencyKey: `ret_assign_${randomUUID()}`,
    policyEngine,
    input: {
      documentId,
      versionId,
      category: 'identification',
      jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
      clockTriggerEventAt: new Date(Date.now() - 1000),
    },
  });

  const authRes = await authorizeDeletionCommand({
    pool,
    context: dpoContext,
    idempotencyKey: `auth_del_${randomUUID()}`,
    policyEngine,
    input: {
      documentId,
      versionId,
    },
  });

  await executeDeletionCommand({
    pool,
    context: dpoContext,
    idempotencyKey: `exec_del_${randomUUID()}`,
    deletionPseudonymizationKey,
    storageProvider,
    input: {
      deletionAuthorizationId: authRes.result.id,
    },
  });

  // Check association: record still exists, pinnedVersionId is unchanged
  const cCheck = await pool.connect();
  try {
    const assoc = await assocRepo.getAssociationById(cCheck, institutionId, assocId);
    assert.ok(assoc != null, 'Association must be preserved');
    assert.strictEqual(assoc.pinnedVersionId, versionId, 'Pinned version pointer must remain unchanged');
  } finally {
    cCheck.release();
  }

  console.log('✔ Test 3 passed: Historical association and pinned version preserved after deletion');
}

// ── Test 4: Crash window recovery — Phase 1 persisted deletion_in_progress, retry resumes safely ──
{
  const { documentId, versionId, storageBucket, storageKey } = await createAvailableVersion('crash_rec.pdf');

  await assignRetentionCommand({
    pool,
    context: adminContext,
    idempotencyKey: `ret_assign_${randomUUID()}`,
    policyEngine,
    input: {
      documentId,
      versionId,
      category: 'identification',
      jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
      clockTriggerEventAt: new Date(Date.now() - 1000),
    },
  });

  const authRes = await authorizeDeletionCommand({
    pool,
    context: dpoContext,
    idempotencyKey: `auth_del_${randomUUID()}`,
    policyEngine,
    input: {
      documentId,
      versionId,
    },
  });

  // Simulate a crash right after Phase 1 commit by directly setting version & auth to 'deletion_in_progress'
  const cCrash = await pool.connect();
  try {
    await cCrash.query(
      `UPDATE document_versions SET status = 'deletion_in_progress' WHERE institution_id = $1 AND id = $2`,
      [institutionId, versionId],
    );
    await cCrash.query(
      `UPDATE document_deletion_authorizations SET authorization_status = 'deletion_in_progress' WHERE institution_id = $1 AND id = $2`,
      [institutionId, authRes.result.id],
    );
  } finally {
    cCrash.release();
  }

  // Now resume/retry via executeDeletionCommand (or reconcileDeletionCommand)
  const execResumeRes = await executeDeletionCommand({
    pool,
    context: dpoContext,
    idempotencyKey: `exec_del_resume_${randomUUID()}`,
    deletionPseudonymizationKey,
    storageProvider,
    input: {
      deletionAuthorizationId: authRes.result.id,
    },
  });

  assert.strictEqual(execResumeRes.result.reconciliationRequired, false);
  assert.ok(execResumeRes.result.deletionRecord != null);
  assert.strictEqual(execResumeRes.result.deletionRecord.result, 'deleted');

  const headAfter = await storageProvider.headObject({ storageBucket, storageKey });
  assert.strictEqual(headAfter.exists, false);

  const cFinal = await pool.connect();
  try {
    const docRepo = new PostgresDocumentRepository();
    const ver = await docRepo.getVersionById(cFinal, institutionId, versionId);
    assert.strictEqual(ver?.status, 'deleted');
  } finally {
    cFinal.release();
  }

  console.log('✔ Test 4 passed: Crash window resumption after Phase 1 intent persistence verified');
}

const teardownClient = await pool.connect();
try {
  await teardownClient.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
} finally {
  teardownClient.release();
  await pool.end();
}

console.log('[DOCUMENTS-DELETION-POSTGRES] ALL TESTS PASSED ✅');
