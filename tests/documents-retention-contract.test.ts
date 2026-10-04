/**
 * Documents Retention & Deletion Contract Tests
 * Validates alignment of Frontend DTOs, advisory capabilities, and backend authorization rules
 * with canonical backend retention vocabulary:
 * - retention_active
 * - retention_expired
 * - eligible_for_deletion
 * - deletion_authorized
 * - deleted
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import { PostgresRetentionAssignmentRepository } from '../src/modules/documents/document-retention-repository.ts';
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
  authorizeDeletionCommand,
} from '../src/modules/documents/document-retention-command.ts';
import {
  ConfigurableRetentionPolicyEngine,
  RetentionPolicyConfig,
} from '../src/modules/documents/document-retention-policy.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { DeterministicTestMalwareScanner } from './support/deterministic-test-malware-scanner.ts';
import { ContentTypeDetector } from '../src/modules/documents/content-type-detector.ts';
import { getRetentionStatusPresentation } from '../src/components/documents/utils.ts';
import { listDocumentsQuery } from '../src/modules/documents/document-query-service.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

// ─── 1. FRONTEND UTILS / PRESENTATION CONTRACT ───────────────────────────────

{
  // retention_active
  const activePres = getRetentionStatusPresentation('retention_active');
  assert.equal(activePres.tone, 'emerald');
  assert.equal(activePres.label, 'Retenção Ativa');

  const activeWithDate = getRetentionStatusPresentation('retention_active', '2030-01-01T00:00:00Z');
  assert.equal(activeWithDate.tone, 'emerald');
  assert.ok(activeWithDate.label.includes('Retenção até'));

  // retention_expired
  const expiredPres = getRetentionStatusPresentation('retention_expired');
  assert.equal(expiredPres.tone, 'amber');
  assert.equal(expiredPres.label, 'Prazo Expirado');

  // eligible_for_deletion
  const eligiblePres = getRetentionStatusPresentation('eligible_for_deletion');
  assert.equal(eligiblePres.tone, 'amber');
  assert.equal(eligiblePres.label, 'Elegível para Eliminação');

  // deletion_authorized
  const authPres = getRetentionStatusPresentation('deletion_authorized');
  assert.equal(authPres.tone, 'rose');
  assert.equal(authPres.label, 'Eliminação Autorizada');

  // deleted
  const delPres = getRetentionStatusPresentation('deleted');
  assert.equal(delPres.tone, 'zinc');
  assert.equal(delPres.label, 'Eliminado');

  // unassigned / null
  const unassignedPres = getRetentionStatusPresentation(null);
  assert.equal(unassignedPres.tone, 'zinc');
  assert.equal(unassignedPres.label, 'Sem Política Atribuída');
}

// ─── 2. POSTGRES & BACKEND GOVERNANCE PROOFS ────────────────────────────────

await verifyApprovedTestConnection();

const schema = `doc_ret_contract_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionId = randomUUID();
const adminPersonId = randomUUID();
const teacherPersonId = randomUUID();

const adminContext: InstitutionalContext = {
  institutionId,
  institutionName: 'Colégio Nexus Contract Test',
  institutionSlug: 'nexus-contract-test',
  personId: adminPersonId,
  personName: 'Admin Person',
  identityEmail: 'admin@nexus.test',
  membershipId: randomUUID(),
  role: 'institution_admin',
};

const teacherContext: InstitutionalContext = {
  institutionId,
  institutionName: 'Colégio Nexus Contract Test',
  institutionSlug: 'nexus-contract-test',
  personId: teacherPersonId,
  personName: 'Teacher Person',
  identityEmail: 'teacher@nexus.test',
  membershipId: randomUUID(),
  role: 'teacher',
};

const syntheticPolicies: RetentionPolicyConfig[] = [
  {
    policyId: 'SYNTHETIC_CONTRACT_RET_V1',
    policyVersion: '1.0',
    jurisdictionProfileId: 'SYNTHETIC_JURISDICTION_V1',
    jurisdictionProfileVersion: '1.0',
    category: 'identification',
    clockTriggerType: 'enrollment_closure',
    retentionDurationDays: 365,
    allowedHoldTypes: ['legal', 'administrative'],
    allowedDeletionAuthorityScopePatterns: ['institution_admin', 'director'],
  },
  {
    policyId: 'SYNTHETIC_SHORT_RET_V1',
    policyVersion: '1.0',
    jurisdictionProfileId: 'SYNTHETIC_JURISDICTION_V1',
    jurisdictionProfileVersion: '1.0',
    category: 'academic',
    clockTriggerType: 'course_completed',
    retentionDurationDays: 0,
    allowedHoldTypes: ['legal', 'administrative'],
    allowedDeletionAuthorityScopePatterns: ['institution_admin', 'director'],
  },
];

const policyEngine = new ConfigurableRetentionPolicyEngine(syntheticPolicies);
const storageProvider = new MemoryObjectStorageProvider();
const malwareScanner = new DeterministicTestMalwareScanner();
const detector = new ContentTypeDetector({
  maxPrefixInspectionBytes: 4096,
  zipMetadataInspectionLimit: 64 * 1024,
  maxContainerEntryCount: 100,
  maxContainerMetadataBytes: 128 * 1024,
});

const client = await pool.connect();
try {
  await client.query(`CREATE SCHEMA ${quote(schema)}`);
  await client.query(`SET search_path TO ${quote(schema)}, public`);

  const migrations = await discoverMigrations(migrationsDir);
  await runMigrations(client, migrations);

  await client.query(
    `INSERT INTO institutions (id, name, slug, status)
     VALUES ($1, 'Colégio Nexus Contract Test', 'nexus-contract-test', 'active')`,
    [institutionId],
  );
  for (const pid of [adminPersonId, teacherPersonId]) {
    await client.query(
      `INSERT INTO people (id, name) VALUES ($1, $2)`,
      [pid, `Person ${pid.slice(-2)}`],
    );
  }

  async function createTestDoc(category: string, filename: string): Promise<{ documentId: string; versionId: string }> {
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
    const content = Buffer.from('%PDF-1.4 contract test content', 'utf8');
    const sessionRes = await createUploadSessionCommand({
      pool,
      context: adminContext,
      idempotencyKey: `sess_${idSuffix}`,
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
      idempotencyKey: `comp_${idSuffix}`,
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
      idempotencyKey: `pipe_${idSuffix}`,
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

  // ── INVARIANT 1: NO RETENTION ASSIGNMENT -> DELETION STRUCTURALLY BLOCKED ──
  {
    const { documentId, versionId } = await createTestDoc('identification', 'no_retention.pdf');

    // Query projection
    const listRes = await listDocumentsQuery(pool, adminContext, { page: 1, limit: 10 });
    const docItem = listRes.items.find((d) => d.id === documentId);
    assert.ok(docItem);
    assert.equal(docItem.retention, null);
    assert.equal(docItem.capabilities.canAuthorizeDeletion, false, 'Unassigned retention cannot authorize deletion');

    // Backend domain execution -> throws RETENTION_ASSIGNMENT_MISSING
    await assert.rejects(
      () => authorizeDeletionCommand({
        pool,
        context: adminContext,
        idempotencyKey: `auth_del_no_ret_${randomUUID()}`,
        policyEngine,
        input: { documentId, versionId },
      }),
      /RETENTION_ASSIGNMENT_MISSING/,
      'Must reject deletion when retention assignment is missing',
    );
  }

  // ── INVARIANT 2: RETENTION_ACTIVE -> DELETION STRUCTURALLY BLOCKED ─────────
  {
    const { documentId, versionId } = await createTestDoc('identification', 'active_retention.pdf');

    // Assign active retention (1 year future)
    await assignRetentionCommand({
      pool,
      context: adminContext,
      idempotencyKey: `ret_assign_${randomUUID()}`,
      policyEngine,
      input: {
        documentId,
        versionId,
        category: 'identification',
        jurisdictionProfileId: 'SYNTHETIC_JURISDICTION_V1',
        clockTriggerEventAt: new Date(),
      },
    });

    // Query projection
    const listRes = await listDocumentsQuery(pool, adminContext, { page: 1, limit: 10 });
    const docItem = listRes.items.find((d) => d.id === documentId);
    assert.ok(docItem);
    assert.equal(docItem.retention?.retentionStatus, 'retention_active');
    assert.equal(docItem.capabilities.canAuthorizeDeletion, false, 'Active retention structurally blocks deletion');

    // Backend domain execution -> throws RETENTION_ACTIVE
    await assert.rejects(
      () => authorizeDeletionCommand({
        pool,
        context: adminContext,
        idempotencyKey: `auth_del_active_${randomUUID()}`,
        policyEngine,
        input: { documentId, versionId },
      }),
      /RETENTION_ACTIVE/,
      'Must reject deletion when retention is active',
    );
  }

  // ── INVARIANT 3: RETENTION_EXPIRED -> DELETION WORKFLOW AVAILABLE ──────────
  {
    const { documentId, versionId } = await createTestDoc('academic', 'expired_retention.pdf');

    // Assign short retention in past (0 days -> expired)
    await assignRetentionCommand({
      pool,
      context: adminContext,
      idempotencyKey: `ret_assign_exp_${randomUUID()}`,
      policyEngine,
      input: {
        documentId,
        versionId,
        category: 'academic',
        jurisdictionProfileId: 'SYNTHETIC_JURISDICTION_V1',
        clockTriggerEventAt: new Date(Date.now() - 1000),
      },
    });

    // Update assignment status explicitly to 'retention_expired'
    const c2 = await pool.connect();
    try {
      const rRepo = new PostgresRetentionAssignmentRepository();
      const assignment = await rRepo.getByVersionId(c2, institutionId, versionId);
      assert.ok(assignment);
      await rRepo.updateStatus(c2, institutionId, assignment.id, 'retention_expired');
    } finally {
      c2.release();
    }

    // Query projection
    const listRes = await listDocumentsQuery(pool, adminContext, { page: 1, limit: 10 });
    const docItem = listRes.items.find((d) => d.id === documentId);
    assert.ok(docItem);
    assert.equal(docItem.retention?.retentionStatus, 'retention_expired');
    assert.equal(docItem.capabilities.canAuthorizeDeletion, true, 'Expired retention enables deletion authorization advisory');

    // Backend domain execution -> succeeds for authorized role
    const authRes = await authorizeDeletionCommand({
      pool,
      context: adminContext,
      idempotencyKey: `auth_del_exp_${randomUUID()}`,
      policyEngine,
      input: { documentId, versionId },
    });
    assert.equal(authRes.result.authorizationStatus, 'authorized');
  }

  // ── INVARIANT 4: ELIGIBLE_FOR_DELETION -> DELETION WORKFLOW AVAILABLE ──────
  {
    const { documentId, versionId } = await createTestDoc('academic', 'eligible_deletion.pdf');

    await assignRetentionCommand({
      pool,
      context: adminContext,
      idempotencyKey: `ret_assign_elig_${randomUUID()}`,
      policyEngine,
      input: {
        documentId,
        versionId,
        category: 'academic',
        jurisdictionProfileId: 'SYNTHETIC_JURISDICTION_V1',
        clockTriggerEventAt: new Date(Date.now() - 1000),
      },
    });

    // Set retention_status to 'eligible_for_deletion'
    const c3 = await pool.connect();
    try {
      const rRepo = new PostgresRetentionAssignmentRepository();
      const assignment = await rRepo.getByVersionId(c3, institutionId, versionId);
      assert.ok(assignment);
      await rRepo.updateStatus(c3, institutionId, assignment.id, 'eligible_for_deletion');
    } finally {
      c3.release();
    }

    // Query projection
    const listRes = await listDocumentsQuery(pool, adminContext, { page: 1, limit: 10 });
    const docItem = listRes.items.find((d) => d.id === documentId);
    assert.ok(docItem);
    assert.equal(docItem.retention?.retentionStatus, 'eligible_for_deletion');
    assert.equal(docItem.capabilities.canAuthorizeDeletion, true, 'eligible_for_deletion enables deletion authorization advisory');

    // Backend domain execution -> succeeds for authorized role
    const authRes = await authorizeDeletionCommand({
      pool,
      context: adminContext,
      idempotencyKey: `auth_del_elig_${randomUUID()}`,
      policyEngine,
      input: { documentId, versionId },
    });
    assert.equal(authRes.result.authorizationStatus, 'authorized');
  }

  // ── INVARIANT 5: ACTIVE HOLD -> DELETION STRUCTURALLY BLOCKED ─────────────
  {
    const { documentId, versionId } = await createTestDoc('academic', 'hold_blocked.pdf');

    await assignRetentionCommand({
      pool,
      context: adminContext,
      idempotencyKey: `ret_assign_hold_${randomUUID()}`,
      policyEngine,
      input: {
        documentId,
        versionId,
        category: 'academic',
        jurisdictionProfileId: 'SYNTHETIC_JURISDICTION_V1',
        clockTriggerEventAt: new Date(Date.now() - 1000),
      },
    });

    const c4 = await pool.connect();
    try {
      const rRepo = new PostgresRetentionAssignmentRepository();
      const assignment = await rRepo.getByVersionId(c4, institutionId, versionId);
      assert.ok(assignment);
      await rRepo.updateStatus(c4, institutionId, assignment.id, 'eligible_for_deletion');
    } finally {
      c4.release();
    }

    // Place active hold
    await placeHoldCommand({
      pool,
      context: adminContext,
      idempotencyKey: `hold_${randomUUID()}`,
      policyEngine,
      input: {
        documentId,
        versionId,
        holdType: 'legal',
        authority: 'Tribunal',
        reason: 'Investigação',
      },
    });

    // Query projection
    const listRes = await listDocumentsQuery(pool, adminContext, { page: 1, limit: 10 });
    const docItem = listRes.items.find((d) => d.id === documentId);
    assert.ok(docItem);
    assert.equal(docItem.activeHolds.length, 1);
    assert.equal(docItem.capabilities.canAuthorizeDeletion, false, 'Active hold structurally blocks deletion in advisory capabilities');

    // Backend domain execution -> throws ACTIVE_HOLD_PREVENTS_DELETION
    await assert.rejects(
      () => authorizeDeletionCommand({
        pool,
        context: adminContext,
        idempotencyKey: `auth_del_hold_${randomUUID()}`,
        policyEngine,
        input: { documentId, versionId },
      }),
      /ACTIVE_HOLD_PREVENTS_DELETION/,
      'Active hold must reject deletion authorization',
    );
  }

  // ── INVARIANT 6: BACKEND ROLE / POLICY AUTHORIZATION IS AUTHORITATIVE ──────
  {
    const { documentId, versionId } = await createTestDoc('academic', 'role_check.pdf');

    await assignRetentionCommand({
      pool,
      context: adminContext,
      idempotencyKey: `ret_assign_role_${randomUUID()}`,
      policyEngine,
      input: {
        documentId,
        versionId,
        category: 'academic',
        jurisdictionProfileId: 'SYNTHETIC_JURISDICTION_V1',
        clockTriggerEventAt: new Date(Date.now() - 1000),
      },
    });

    const c5 = await pool.connect();
    try {
      const rRepo = new PostgresRetentionAssignmentRepository();
      const assignment = await rRepo.getByVersionId(c5, institutionId, versionId);
      assert.ok(assignment);
      await rRepo.updateStatus(c5, institutionId, assignment.id, 'retention_expired');
    } finally {
      c5.release();
    }

    // Non-authorized role (teacher) -> rejected by backend policy engine
    await assert.rejects(
      () => authorizeDeletionCommand({
        pool,
        context: teacherContext,
        idempotencyKey: `auth_del_teacher_${randomUUID()}`,
        policyEngine,
        input: { documentId, versionId },
      }),
      /DELETION_AUTHORIZATION_DENIED/,
      'Teacher role must be rejected by backend policy engine',
    );
  }

  console.log('[DOCUMENTS-RETENTION-CONTRACT] All contract invariants verified PASS ✅');
} finally {
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } catch {
    // Ignore schema cleanup errors
  }
  client.release();
  await pool.end();
}
