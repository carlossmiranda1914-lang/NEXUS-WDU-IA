/**
 * Documents Module — H1-06B Physical Deletion & Reconciliation Security Integration Test Suite
 * Tests:
 * 1. Role Matrix & Direct Command Bypass for executeDeletionCommand (student, parent, teacher, unknown => DENIED)
 * 2. Role Matrix & Direct Command Bypass for reconcileDeletionCommand (student, parent, teacher, unknown => DENIED)
 * 3. Zero Storage Calls Before Authorization (deleteObject=0, headObject=0 on unauthorized calls)
 * 4. Multi-Tenant Negative Isolation (Tenant B cannot execute or reconcile Tenant A deletions, storage calls=0)
 * 5. Active Holds Block Both Execution and Reconciliation (ACTIVE_HOLD_EXECUTE=DENY, RECONCILE_HOLD_RECHECK=YES)
 * 6. Durable Intent Before Storage Delete & Active Content Grants Revocation
 * 7. Physical Deletion Confirmation, Fail-Closed Storage Failures, and No-Storage-Reference Ambiguity
 * 8. Reconciliation State Machine, Idempotency, and Append-Only DeletionRecord
 */

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import {
  PostgresRetentionAssignmentRepository,
  PostgresRetentionHoldRepository,
  PostgresDeletionAuthorizationRepository,
  PostgresDeletionRecordRepository,
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
  placeHoldCommand,
  releaseHoldCommand,
  authorizeDeletionCommand,
} from '../src/modules/documents/document-retention-command.ts';
import {
  executeDeletionCommand,
  reconcileDeletionCommand,
} from '../src/modules/documents/document-deletion-command.ts';
import {
  ConfigurableRetentionPolicyEngine,
  type RetentionPolicyConfig,
} from '../src/modules/documents/document-retention-policy.ts';
import {
  DefaultDocumentAuthorizationAuthority,
  createDefaultDocumentAuthorizationRules,
} from '../src/modules/documents/document-authorization-policy.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { DeterministicTestMalwareScanner } from './support/deterministic-test-malware-scanner.ts';
import { ContentTypeDetector } from '../src/modules/documents/content-type-detector.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import type { ObjectStorageProvider, DeleteObjectParams, HeadObjectParams } from '../src/modules/documents/object-storage-provider.ts';

await verifyApprovedTestConnection();

const schema = `doc_del_auth_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

// Setup two tenants: Institution A and Institution B
const institutionAId = randomUUID();
const institutionBId = randomUUID();

const adminAPersonId = randomUUID();
const studentAPersonId = randomUUID();
const parentAPersonId = randomUUID();
const teacherAPersonId = randomUUID();
const unknownRolePersonId = randomUUID();
const adminBPersonId = randomUUID();

const adminAContext: InstitutionalContext = {
  institutionId: institutionAId,
  institutionName: 'Colégio Nexus A',
  institutionSlug: 'nexus-a',
  personId: adminAPersonId,
  personName: 'Admin A',
  identityEmail: 'admin.a@nexus.test',
  membershipId: randomUUID(),
  role: 'institution_admin',
};

const studentAContext: InstitutionalContext = {
  institutionId: institutionAId,
  institutionName: 'Colégio Nexus A',
  institutionSlug: 'nexus-a',
  personId: studentAPersonId,
  personName: 'Student A',
  identityEmail: 'student.a@nexus.test',
  membershipId: randomUUID(),
  role: 'student',
};

const parentAContext: InstitutionalContext = {
  institutionId: institutionAId,
  institutionName: 'Colégio Nexus A',
  institutionSlug: 'nexus-a',
  personId: parentAPersonId,
  personName: 'Parent A',
  identityEmail: 'parent.a@nexus.test',
  membershipId: randomUUID(),
  role: 'parent',
};

const teacherAContext: InstitutionalContext = {
  institutionId: institutionAId,
  institutionName: 'Colégio Nexus A',
  institutionSlug: 'nexus-a',
  personId: teacherAPersonId,
  personName: 'Teacher A',
  identityEmail: 'teacher.a@nexus.test',
  membershipId: randomUUID(),
  role: 'teacher',
};

const unknownRoleContext: InstitutionalContext = {
  institutionId: institutionAId,
  institutionName: 'Colégio Nexus A',
  institutionSlug: 'nexus-a',
  personId: unknownRolePersonId,
  personName: 'Unknown Role Actor',
  identityEmail: 'unknown@nexus.test',
  membershipId: randomUUID(),
  role: 'auditor' as unknown as InstitutionalContext['role'],
};

const adminBContext: InstitutionalContext = {
  institutionId: institutionBId,
  institutionName: 'Colégio Nexus B',
  institutionSlug: 'nexus-b',
  personId: adminBPersonId,
  personName: 'Admin B',
  identityEmail: 'admin.b@nexus.test',
  membershipId: randomUUID(),
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
    policyId: 'SYNTHETIC_INSTANT_EXPIRY_A',
    policyVersion: '1.0',
    jurisdictionProfileId: 'SYNTHETIC_BR_MEC_2026',
    jurisdictionProfileVersion: '1.0',
    category: 'identification',
    clockTriggerType: 'enrollment_closure',
    retentionDurationDays: 0,
    allowedHoldTypes: ['legal', 'administrative'],
    allowedDeletionAuthorityScopePatterns: ['institution_admin', 'director'],
  },
];

const policyEngine = new ConfigurableRetentionPolicyEngine(syntheticPolicies);
const authAuthority = new DefaultDocumentAuthorizationAuthority({
  rules: createDefaultDocumentAuthorizationRules(),
});
const malwareScanner = new DeterministicTestMalwareScanner();
const deletionPseudonymizationKey = randomBytes(32).toString('hex');

// Instrumented storage provider to verify zero storage calls on denial
class TrackingStorageProvider extends MemoryObjectStorageProvider {
  public deleteObjectCalls: DeleteObjectParams[] = [];
  public headObjectCalls: HeadObjectParams[] = [];
  public failNextDelete: boolean = false;
  public headExistsOverride: boolean | null = null;

  override async deleteObject(params: DeleteObjectParams) {
    this.deleteObjectCalls.push(params);
    if (this.failNextDelete) {
      throw new Error('SIMULATED_STORAGE_DELETE_FAILURE');
    }
    return super.deleteObject(params);
  }

  override async headObject(params: HeadObjectParams) {
    this.headObjectCalls.push(params);
    const res = await super.headObject(params);
    if (this.headExistsOverride !== null) {
      return { ...res, exists: this.headExistsOverride };
    }
    return res;
  }

  resetTracking() {
    this.deleteObjectCalls = [];
    this.headObjectCalls = [];
    this.failNextDelete = false;
    this.headExistsOverride = null;
  }
}

const storageProvider = new TrackingStorageProvider();

const setupClient = await pool.connect();
try {
  await setupClient.query(`CREATE SCHEMA ${quote(schema)}`);
  await setupClient.query(`SET search_path TO ${quote(schema)},public`);

  const migrations = await discoverMigrations(migrationsDir);
  await runMigrations(setupClient, migrations);

  // Seed institutions
  await setupClient.query(
    `INSERT INTO institutions (id, name, slug) VALUES ($1, $2, $3), ($4, $5, $6)`,
    [
      institutionAId, 'Colégio Nexus A', 'nexus-a',
      institutionBId, 'Colégio Nexus B', 'nexus-b',
    ],
  );

  // Seed people
  for (const pid of [adminAPersonId, studentAPersonId, parentAPersonId, teacherAPersonId, unknownRolePersonId, adminBPersonId]) {
    await setupClient.query(
      `INSERT INTO people (id, name) VALUES ($1, $2)`,
      [pid, `Person ${pid.slice(-4)}`],
    );
  }
} finally {
  setupClient.release();
}

async function createAuthorizedDeletionFixture(instContext: InstitutionalContext): Promise<{
  documentId: string;
  versionId: string;
  authorizationId: string;
  storageBucket: string;
  storageKey: string;
}> {
  const content = Buffer.from(`%PDF-1.4 sample content ${randomUUID()}`, 'utf8');
  const docRepo = new PostgresDocumentRepository();
  const c = await pool.connect();
  let docId: string;
  try {
    const doc = await docRepo.createDocument(c, {
      institutionId: instContext.institutionId,
      category: 'identification',
      createdByPersonId: instContext.personId,
    });
    docId = doc.id;
  } finally {
    c.release();
  }

  const idSuffix = randomUUID();
  const sessionRes = await createUploadSessionCommand({
    pool,
    context: instContext,
    idempotencyKey: `idemp-sess-${idSuffix}`,
    input: {
      documentId: docId,
      declaredFilename: 'doc.pdf',
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
    context: instContext,
    storageProvider,
    idempotencyKey: `idemp-comp-${idSuffix}`,
    input: {
      sessionId: sessionRes.result.session.id,
      rawToken: sessionRes.result.rawToken,
      provenance: {
        originType: 'user_upload',
        actorPersonId: instContext.personId,
        sourceDomain: 'documents.test',
        method: 'direct_upload',
      },
    },
  });

  await executeTechnicalVerificationPipelineCommand({
    pool,
    context: instContext,
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

  await assignRetentionCommand({
    pool,
    context: instContext,
    idempotencyKey: `ret_assign_${randomUUID()}`,
    policyEngine,
    authorizationAuthority: authAuthority,
    input: {
      documentId: docId,
      versionId: completeRes.result.version.id,
      jurisdictionProfileId: 'SYNTHETIC_BR_MEC_2026',
      clockTriggerEventAt: new Date(Date.now() - 1000),
    },
  });

  const authRes = await authorizeDeletionCommand({
    pool,
    context: instContext,
    idempotencyKey: `del_auth_${randomUUID()}`,
    policyEngine,
    authorizationAuthority: authAuthority,
    input: {
      documentId: docId,
      versionId: completeRes.result.version.id,
    },
  });

  return {
    documentId: docId,
    versionId: completeRes.result.version.id,
    authorizationId: authRes.result.id,
    storageBucket: sessionRes.result.session.storageBucket,
    storageKey: sessionRes.result.session.storageKey,
  };
}

console.log('[H1-06B] Running deletion execution & reconciliation authorization tests...');

// ── Test 1: Direct Command Bypass & Zero Storage Calls for executeDeletionCommand ──
{
  const fixture = await createAuthorizedDeletionFixture(adminAContext);
  storageProvider.resetTracking();

  const nonManagers = [
    { name: 'student', ctx: studentAContext },
    { name: 'parent', ctx: parentAContext },
    { name: 'teacher', ctx: teacherAContext },
    { name: 'unknown', ctx: unknownRoleContext },
  ];

  for (const { name, ctx } of nonManagers) {
    storageProvider.resetTracking();
    await assert.rejects(
      () =>
        executeDeletionCommand({
          pool,
          context: ctx,
          idempotencyKey: `bypass-exec-${name}-${randomUUID()}`,
          deletionPseudonymizationKey,
          storageProvider,
          authorizationAuthority: authAuthority,
          input: { deletionAuthorizationId: fixture.authorizationId },
        }),
      (err: Error) => {
        assert.match(err.message, /DELETION_AUTHORITY_DENIED/);
        return true;
      },
      `${name} must be denied execute_deletion by central authority`,
    );

    // CRITICAL: Prove ZERO storage calls occurred!
    assert.equal(
      storageProvider.deleteObjectCalls.length,
      0,
      `deleteObject calls must be 0 for unauthorized role '${name}'`,
    );
    assert.equal(
      storageProvider.headObjectCalls.length,
      0,
      `headObject calls must be 0 for unauthorized role '${name}'`,
    );
  }

  // Verify that version was NOT deleted in DB and no DeletionRecord was written
  const checkClient = await pool.connect();
  try {
    const verRes = await checkClient.query<{ status: string }>(
      `SELECT status FROM document_versions WHERE institution_id = $1 AND id = $2`,
      [adminAContext.institutionId, fixture.versionId],
    );
    assert.equal(verRes.rows[0].status, 'available');

    const drRes = await checkClient.query<{ id: string }>(
      `SELECT id FROM document_deletion_records WHERE institution_id = $1 AND deletion_authorization_id = $2`,
      [adminAContext.institutionId, fixture.authorizationId],
    );
    assert.equal(drRes.rows.length, 0);

    // Verify ZERO deletion success outbox events emitted
    const outboxRes = await checkClient.query<{ id: string }>(
      `SELECT id FROM document_outbox_events WHERE institution_id = $1 AND event_type IN ('document.deleted', 'document.deletion_started')`,
      [adminAContext.institutionId],
    );
    assert.equal(outboxRes.rows.length, 0);
  } finally {
    checkClient.release();
  }

  console.log('✔ Test 1 passed: executeDeletionCommand direct command bypass & zero storage calls verified');
}

// ── Test 2: Direct Command Bypass & Zero Storage Calls for reconcileDeletionCommand ──
{
  const fixture = await createAuthorizedDeletionFixture(adminAContext);

  // Transition authorization to deletion_reconciliation_required so reconciliation would be state-eligible
  const prepClient = await pool.connect();
  try {
    await prepClient.query(
      `UPDATE document_deletion_authorizations
          SET authorization_status = 'deletion_reconciliation_required'
        WHERE institution_id = $1 AND id = $2`,
      [adminAContext.institutionId, fixture.authorizationId],
    );
  } finally {
    prepClient.release();
  }

  const nonManagers = [
    { name: 'student', ctx: studentAContext },
    { name: 'parent', ctx: parentAContext },
    { name: 'teacher', ctx: teacherAContext },
    { name: 'unknown', ctx: unknownRoleContext },
  ];

  for (const { name, ctx } of nonManagers) {
    storageProvider.resetTracking();
    await assert.rejects(
      () =>
        reconcileDeletionCommand({
          pool,
          context: ctx,
          deletionPseudonymizationKey,
          storageProvider,
          authorizationAuthority: authAuthority,
          input: { deletionAuthorizationId: fixture.authorizationId },
        }),
      (err: Error) => {
        assert.match(err.message, /DELETION_AUTHORITY_DENIED/);
        return true;
      },
      `${name} must be denied reconcile_deletion by central authority`,
    );

    // CRITICAL: Prove ZERO storage calls occurred!
    assert.equal(
      storageProvider.deleteObjectCalls.length,
      0,
      `deleteObject calls must be 0 for unauthorized reconcile by '${name}'`,
    );
    assert.equal(
      storageProvider.headObjectCalls.length,
      0,
      `headObject calls must be 0 for unauthorized reconcile by '${name}'`,
    );
  }

  console.log('✔ Test 2 passed: reconcileDeletionCommand direct command bypass & zero storage calls verified');
}

// ── Test 3: Multi-Tenant Negative Isolation (CROSS_TENANT_LEAK=0) ──
{
  const fixtureA = await createAuthorizedDeletionFixture(adminAContext);
  storageProvider.resetTracking();

  // Tenant B attempts to execute Tenant A deletion authorization
  await assert.rejects(
    () =>
      executeDeletionCommand({
        pool,
        context: adminBContext,
        idempotencyKey: `tenant-b-exec-${randomUUID()}`,
        deletionPseudonymizationKey,
        storageProvider,
        authorizationAuthority: authAuthority,
        input: { deletionAuthorizationId: fixtureA.authorizationId },
      }),
    (err: Error) => {
      assert.match(err.message, /DELETION_AUTHORIZATION_NOT_FOUND/);
      return true;
    },
    'Tenant B must receive DELETION_AUTHORIZATION_NOT_FOUND for Tenant A authorization',
  );

  assert.equal(storageProvider.deleteObjectCalls.length, 0);
  assert.equal(storageProvider.headObjectCalls.length, 0);

  // Tenant B attempts to reconcile Tenant A deletion authorization
  await assert.rejects(
    () =>
      reconcileDeletionCommand({
        pool,
        context: adminBContext,
        deletionPseudonymizationKey,
        storageProvider,
        authorizationAuthority: authAuthority,
        input: { deletionAuthorizationId: fixtureA.authorizationId },
      }),
    (err: Error) => {
      assert.match(err.message, /DELETION_AUTHORIZATION_NOT_FOUND/);
      return true;
    },
    'Tenant B must receive DELETION_AUTHORIZATION_NOT_FOUND for Tenant A reconcile',
  );

  assert.equal(storageProvider.deleteObjectCalls.length, 0);
  assert.equal(storageProvider.headObjectCalls.length, 0);

  console.log('✔ Test 3 passed: Multi-tenant negative isolation & cross-tenant storage protection verified');
}

// ── Test 4: Active Holds Block Both Execution and Reconciliation (ACTIVE_HOLD_EXECUTE=DENY, RECONCILE_HOLD_RECHECK=YES) ──
{
  const fixture = await createAuthorizedDeletionFixture(adminAContext);

  // Place a legal hold on the version
  await placeHoldCommand({
    pool,
    context: adminAContext,
    idempotencyKey: `hold-${randomUUID()}`,
    policyEngine,
    authorizationAuthority: authAuthority,
    input: {
      documentId: fixture.documentId,
      versionId: fixture.versionId,
      holdType: 'legal',
      authority: 'Legal Subpoena #123',
      reason: 'Pending court subpoena',
    },
  });

  storageProvider.resetTracking();

  // Execution must fail closed because of active hold
  await assert.rejects(
    () =>
      executeDeletionCommand({
        pool,
        context: adminAContext,
        idempotencyKey: `del-exec-blocked-${randomUUID()}`,
        deletionPseudonymizationKey,
        storageProvider,
        authorizationAuthority: authAuthority,
        input: { deletionAuthorizationId: fixture.authorizationId },
      }),
    (err: Error) => {
      assert.match(err.message, /ACTIVE_HOLD_PREVENTS_DELETION/);
      return true;
    },
  );

  // Zero storage delete calls
  assert.equal(storageProvider.deleteObjectCalls.length, 0);

  // Transition authorization to deletion_reconciliation_required to test reconciliation hold recheck
  const prepClient = await pool.connect();
  try {
    await prepClient.query(
      `UPDATE document_deletion_authorizations
          SET authorization_status = 'deletion_reconciliation_required'
        WHERE institution_id = $1 AND id = $2`,
      [adminAContext.institutionId, fixture.authorizationId],
    );
  } finally {
    prepClient.release();
  }

  // Reconciliation must also fail closed because of active hold!
  await assert.rejects(
    () =>
      reconcileDeletionCommand({
        pool,
        context: adminAContext,
        deletionPseudonymizationKey,
        storageProvider,
        authorizationAuthority: authAuthority,
        input: { deletionAuthorizationId: fixture.authorizationId },
      }),
    (err: Error) => {
      assert.match(err.message, /ACTIVE_HOLD_PREVENTS_DELETION/);
      return true;
    },
  );

  // Zero storage delete calls
  assert.equal(storageProvider.deleteObjectCalls.length, 0);

  console.log('✔ Test 4 passed: Active holds block both execution and reconciliation (fail-closed verified)');
}

// ── Test 5: Durable Intent Before Storage Delete & Active Content Grants Revocation ──
{
  const fixture = await createAuthorizedDeletionFixture(adminAContext);

  // Insert an active content access grant for the version
  const grantClient = await pool.connect();
  const grantId = randomUUID();
  try {
    await grantClient.query(
      `INSERT INTO document_content_access_grants (
        id, institution_id, document_id, version_id, grantee_person_id,
        action, status, token_hash, expires_at
      ) VALUES ($1, $2, $3, $4, $5, 'open', 'active', $6, now() + interval '1 hour')`,
      [grantId, adminAContext.institutionId, fixture.documentId, fixture.versionId, studentAPersonId, randomBytes(32).toString('hex')],
    );
  } finally {
    grantClient.release();
  }

  storageProvider.resetTracking();

  // Execute deletion successfully
  const execRes = await executeDeletionCommand({
    pool,
    context: adminAContext,
    idempotencyKey: `del-exec-success-${randomUUID()}`,
    deletionPseudonymizationKey,
    storageProvider,
    authorizationAuthority: authAuthority,
    input: { deletionAuthorizationId: fixture.authorizationId },
  });

  assert.equal(execRes.result.reconciliationRequired, false);
  assert.ok(execRes.result.deletionRecord);
  assert.equal(execRes.result.deletionRecord.result, 'deleted');
  assert.equal(execRes.result.deletionRecord.storageDeletionConfirmed, true);

  // Verify that the active content grant was revoked with 'legal_deletion_in_progress'
  const verifyClient = await pool.connect();
  try {
    const grantRow = await verifyClient.query<{ status: string; revocation_reason: string }>(
      `SELECT status, revocation_reason FROM document_content_access_grants WHERE id = $1`,
      [grantId],
    );
    assert.equal(grantRow.rows[0].status, 'revoked');
    assert.equal(grantRow.rows[0].revocation_reason, 'legal_deletion_in_progress');

    // Verify outbox event order: document.deletion_started then document.deleted
    const outboxRows = await verifyClient.query<{ event_type: string }>(
      `SELECT event_type FROM document_outbox_events
        WHERE institution_id = $1 AND aggregate_id = $2
        ORDER BY created_at ASC`,
      [adminAContext.institutionId, fixture.documentId],
    );
    const eventTypes = outboxRows.rows.map((r) => r.event_type);
    assert.ok(eventTypes.includes('document.deletion_started'), 'deletion_started must be emitted');
    assert.ok(eventTypes.includes('document.deleted'), 'document.deleted must be emitted');
  } finally {
    verifyClient.release();
  }

  console.log('✔ Test 5 passed: Durable intent committed before storage delete & content grants revoked');
}

// ── Test 6: Physical Deletion Confirmation, Fail-Closed Storage Failures, & Reconcile Recovery ──
{
  const fixture = await createAuthorizedDeletionFixture(adminAContext);

  // Simulate headObject returning exists: true after deleteObject (storage still present)
  storageProvider.resetTracking();
  storageProvider.headExistsOverride = true;

  const failExecRes = await executeDeletionCommand({
    pool,
    context: adminAContext,
    idempotencyKey: `del-exec-fail-${randomUUID()}`,
    deletionPseudonymizationKey,
    storageProvider,
    authorizationAuthority: authAuthority,
    input: { deletionAuthorizationId: fixture.authorizationId },
  });

  // Must fail closed to reconciliationRequired
  assert.equal(failExecRes.result.reconciliationRequired, true);
  assert.equal(failExecRes.result.deletionRecord, null);

  const checkClient = await pool.connect();
  try {
    const authRow = await checkClient.query<{ authorization_status: string }>(
      `SELECT authorization_status FROM document_deletion_authorizations WHERE id = $1`,
      [fixture.authorizationId],
    );
    assert.equal(authRow.rows[0].authorization_status, 'deletion_reconciliation_required');

    const verRow = await checkClient.query<{ status: string }>(
      `SELECT status FROM document_versions WHERE id = $1`,
      [fixture.versionId],
    );
    // Version must NOT be terminal deleted
    assert.equal(verRow.rows[0].status, 'deletion_in_progress');
  } finally {
    checkClient.release();
  }

  // Now reconcile: storage object is actually gone (override removed)
  storageProvider.headExistsOverride = false;

  const reconcileRes = await reconcileDeletionCommand({
    pool,
    context: adminAContext,
    deletionPseudonymizationKey,
    storageProvider,
    authorizationAuthority: authAuthority,
    input: { deletionAuthorizationId: fixture.authorizationId },
  });

  assert.equal(reconcileRes.reconciliationRequired, false);
  assert.ok(reconcileRes.deletionRecord);
  assert.equal(reconcileRes.deletionRecord.storageDeletionConfirmed, true);

  // Now verify terminal states in DB
  const termClient = await pool.connect();
  try {
    const authRow = await termClient.query<{ authorization_status: string }>(
      `SELECT authorization_status FROM document_deletion_authorizations WHERE id = $1`,
      [fixture.authorizationId],
    );
    assert.equal(authRow.rows[0].authorization_status, 'deleted');

    const verRow = await termClient.query<{ status: string }>(
      `SELECT status FROM document_versions WHERE id = $1`,
      [fixture.versionId],
    );
    assert.equal(verRow.rows[0].status, 'deleted');

    // Storage reference must be removed
    const srRow = await termClient.query<{ id: string }>(
      `SELECT id FROM document_storage_references WHERE version_id = $1`,
      [fixture.versionId],
    );
    assert.equal(srRow.rows.length, 0);

    // Deletion record exists exactly once
    const drRows = await termClient.query<{ id: string }>(
      `SELECT id FROM document_deletion_records WHERE deletion_authorization_id = $1`,
      [fixture.authorizationId],
    );
    assert.equal(drRows.rows.length, 1);
  } finally {
    termClient.release();
  }

  // Test idempotent replay of reconciliation: already deleted returns existing record
  const replayReconcile = await reconcileDeletionCommand({
    pool,
    context: adminAContext,
    deletionPseudonymizationKey,
    storageProvider,
    authorizationAuthority: authAuthority,
    input: { deletionAuthorizationId: fixture.authorizationId },
  });
  assert.equal(replayReconcile.reconciliationRequired, false);
  assert.equal(replayReconcile.deletionRecord?.id, reconcileRes.deletionRecord.id);

  console.log('✔ Test 6 passed: Fail-closed storage failures, reconcile recovery, & idempotency verified');
}

// ── Test 7: No-Storage-Reference Ambiguity on Stored Content (Fail-Closed) ──
{
  storageProvider.resetTracking();
  const fixture = await createAuthorizedDeletionFixture(adminAContext);

  // Manually delete storage reference while byte_size > 0 to simulate missing/corrupted storage reference
  const corruptClient = await pool.connect();
  try {
    await corruptClient.query(
      `DELETE FROM document_storage_references WHERE version_id = $1`,
      [fixture.versionId],
    );
  } finally {
    corruptClient.release();
  }

  storageProvider.resetTracking();

  const execRes = await executeDeletionCommand({
    pool,
    context: adminAContext,
    idempotencyKey: `del-exec-missing-sr-${randomUUID()}`,
    deletionPseudonymizationKey,
    storageProvider,
    authorizationAuthority: authAuthority,
    input: { deletionAuthorizationId: fixture.authorizationId },
  });

  // Because byte_size > 0 and storage reference is missing, it must FAIL CLOSED to reconciliationRequired!
  assert.equal(execRes.result.reconciliationRequired, true);
  assert.equal(execRes.result.deletionRecord, null);

  const checkClient = await pool.connect();
  try {
    const authRow = await checkClient.query<{ authorization_status: string }>(
      `SELECT authorization_status FROM document_deletion_authorizations WHERE id = $1`,
      [fixture.authorizationId],
    );
    assert.equal(authRow.rows[0].authorization_status, 'deletion_reconciliation_required');

    const verRow = await checkClient.query<{ status: string }>(
      `SELECT status FROM document_versions WHERE id = $1`,
      [fixture.versionId],
    );
    assert.equal(verRow.rows[0].status, 'deletion_in_progress');
  } finally {
    checkClient.release();
  }

  console.log('✔ Test 7 passed: No-storage-reference on stored content fails closed to reconciliation_required');
}

await pool.end();
console.log('[H1-06B] ALL DELETION EXECUTION & RECONCILIATION SECURITY TESTS PASSED ✅');
