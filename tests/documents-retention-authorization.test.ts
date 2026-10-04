/**
 * Documents Module — H1-06A Retention & Deletion Authorization Integration Test Suite
 * Tests central H1 authorization, direct command bypass matrix, tenant isolation,
 * authoritative category enforcement, hold blocking, and audit/outbox non-emission on denial.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import { PostgresRetentionAssignmentRepository, PostgresRetentionHoldRepository, PostgresDeletionAuthorizationRepository } from '../src/modules/documents/document-retention-repository.ts';
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
  evaluateDeletionEligibilityCommand,
} from '../src/modules/documents/document-retention-command.ts';
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

await verifyApprovedTestConnection();

const schema = `doc_ret_auth_${randomUUID().replaceAll('-', '')}`;
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
  role: 'auditor' as unknown as InstitutionalContext['role'], // not a management role, no rule defined
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
    policyId: 'SYNTHETIC_TRANSCRIPT_POLICY_V1',
    policyVersion: '1.0',
    jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
    jurisdictionProfileVersion: '1.0',
    category: 'academic_transcript',
    clockTriggerType: 'student_graduation_or_withdrawal',
    retentionDurationDays: 365,
    allowedHoldTypes: ['legal', 'administrative'],
    allowedDeletionAuthorityScopePatterns: ['institution_admin', 'director', 'admin'],
  },
  {
    policyId: 'SYNTHETIC_IDENTIFICATION_POLICY_V1',
    policyVersion: '1.0',
    jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
    jurisdictionProfileVersion: '1.0',
    category: 'identification',
    clockTriggerType: 'course_conclusion',
    retentionDurationDays: 0, // expires immediately for deletion tests
    allowedHoldTypes: ['legal', 'administrative'],
    allowedDeletionAuthorityScopePatterns: ['institution_admin', 'admin'],
  },
];

const policyEngine = new ConfigurableRetentionPolicyEngine(syntheticPolicies);
const authAuthority = new DefaultDocumentAuthorizationAuthority({
  rules: createDefaultDocumentAuthorizationRules(),
});
const storageProvider = new MemoryObjectStorageProvider();
const malwareScanner = new DeterministicTestMalwareScanner();

const setupClient = await pool.connect();
try {
  await setupClient.query(`CREATE SCHEMA ${quote(schema)}`);
  await setupClient.query(`SET search_path TO ${quote(schema)}, public`);

  const migrations = await discoverMigrations(migrationsDir);
  await runMigrations(setupClient, migrations);

  // Seed institutions
  await setupClient.query(
    `INSERT INTO institutions (id, name, slug, status)
     VALUES ($1, 'Colégio Nexus A', 'nexus-a', 'active'),
            ($2, 'Colégio Nexus B', 'nexus-b', 'active')`,
    [institutionAId, institutionBId],
  );

  // Seed people
  for (const pid of [adminAPersonId, studentAPersonId, parentAPersonId, teacherAPersonId, unknownRolePersonId, adminBPersonId]) {
    await setupClient.query(
      `INSERT INTO people (id, name) VALUES ($1, $2)`,
      [pid, `Person ${pid.slice(-4)}`],
    );
  }

  // Helper to create an available version for a tenant
  async function createAvailableDoc(
    context: InstitutionalContext,
    category: string,
    filename: string,
  ): Promise<{ documentId: string; versionId: string }> {
    const docRepo = new PostgresDocumentRepository();
    const c = await pool.connect();
    let docId: string;
    try {
      const doc = await docRepo.createDocument(c, {
        institutionId: context.institutionId,
        category,
        createdByPersonId: context.personId,
      });
      docId = doc.id;
    } finally {
      c.release();
    }

    const idSuffix = randomUUID();
    const content = Buffer.from('%PDF-1.4 authorized test content', 'utf8');
    const sessionRes = await createUploadSessionCommand({
      pool,
      context,
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
      context,
      storageProvider,
      idempotencyKey: `comp_${idSuffix}`,
      input: {
        sessionId: sessionRes.result.session.id,
        rawToken: sessionRes.result.rawToken,
        provenance: {
          originType: 'user_upload',
          actorPersonId: context.personId,
          sourceDomain: 'documents.test',
          method: 'direct_upload',
        },
      },
    });

    await executeTechnicalVerificationPipelineCommand({
      pool,
      context,
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

  console.log('[H1-06A] Running direct command bypass & authorization tests...');

  // ── TEST 1: Direct command bypass — assignRetentionCommand role matrix ───
  {
    const { documentId, versionId } = await createAvailableDoc(adminAContext, 'academic_transcript', 'transcript.pdf');

    // 1.1 Non-management roles must be rejected
    for (const ctx of [studentAContext, parentAContext, teacherAContext, unknownRoleContext]) {
      await assert.rejects(
        () => assignRetentionCommand({
          pool,
          context: ctx,
          idempotencyKey: `ret_bypass_${ctx.role}_${randomUUID()}`,
          policyEngine,
          authorizationAuthority: authAuthority,
          input: {
            documentId,
            versionId,
            jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
            category: 'academic_transcript',
            clockTriggerEventAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
          },
        }),
        /AUTHORIZATION_DENIED/,
        `Role '${ctx.role}' must be rejected from assignRetentionCommand`,
      );
    }

    // Verify 0 success audit and outbox events emitted for denied calls
    const c = await pool.connect();
    try {
      const audits = await c.query(
        `SELECT COUNT(*) FROM document_audit_events WHERE document_id = $1 AND action = 'document.retention_assigned'`,
        [documentId],
      );
      assert.strictEqual(parseInt(audits.rows[0].count, 10), 0, 'DENIED_RETENTION_SUCCESS_AUDIT must be 0');

      const events = await c.query(
        `SELECT COUNT(*) FROM document_outbox_events WHERE aggregate_id = $1 AND event_type = 'document.retention_assigned'`,
        [documentId],
      );
      assert.strictEqual(parseInt(events.rows[0].count, 10), 0, 'DENIED_RETENTION_SUCCESS_EVENT must be 0');
    } finally {
      c.release();
    }

    // 1.2 Management role succeeds with governed policy
    const assignRes = await assignRetentionCommand({
      pool,
      context: adminAContext,
      idempotencyKey: `ret_assign_mgmt_${randomUUID()}`,
      policyEngine,
      authorizationAuthority: authAuthority,
      input: {
        documentId,
        versionId,
        jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
        category: 'academic_transcript',
        clockTriggerEventAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      },
    });
    assert.ok(assignRes.result.id);
    assert.strictEqual(assignRes.result.retentionStatus, 'retention_active');

    console.log('✔ Test 1 passed: assignRetentionCommand role matrix & audit non-emission verified');
  }

  // ── TEST 2: Authoritative category enforcement & client mismatch rejection ───
  {
    // Create doc with category 'identification'
    const { documentId, versionId } = await createAvailableDoc(adminAContext, 'identification', 'id.pdf');

    // Attempt to pass category 'academic_transcript' in AssignRetentionInput -> must be rejected with CATEGORY_MISMATCH
    await assert.rejects(
      () => assignRetentionCommand({
        pool,
        context: adminAContext,
        idempotencyKey: `ret_mismatch_${randomUUID()}`,
        policyEngine,
        authorizationAuthority: authAuthority,
        input: {
          documentId,
          versionId,
          jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
          category: 'academic_transcript', // MISMATCH with authoritative doc.category='identification'
          clockTriggerEventAt: new Date(),
        },
      }),
      /CATEGORY_MISMATCH/,
      'Input category mismatching authoritative document category must be rejected',
    );

    // Omitting category or passing matching category uses authoritative category
    const assignRes = await assignRetentionCommand({
      pool,
      context: adminAContext,
      idempotencyKey: `ret_match_${randomUUID()}`,
      policyEngine,
      authorizationAuthority: authAuthority,
      input: {
        documentId,
        versionId,
        jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
        category: 'identification',
        clockTriggerEventAt: new Date(Date.now() - 1000), // in the past -> retention_expired
      },
    });
    assert.strictEqual(assignRes.result.category, 'identification');

    console.log('✔ Test 2 passed: Authoritative category wins, category mismatch denied');
  }

  // ── TEST 3: PlaceHold direct command bypass role matrix & hold types ────────
  {
    const { documentId, versionId } = await createAvailableDoc(adminAContext, 'academic_transcript', 'hold_test.pdf');
    await assignRetentionCommand({
      pool,
      context: adminAContext,
      idempotencyKey: `ret_hold_prep_${randomUUID()}`,
      policyEngine,
      authorizationAuthority: authAuthority,
      input: {
        documentId,
        versionId,
        jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
        category: 'academic_transcript',
        clockTriggerEventAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      },
    });

    // 3.1 Non-management roles cannot place holds
    for (const ctx of [studentAContext, parentAContext, teacherAContext, unknownRoleContext]) {
      await assert.rejects(
        () => placeHoldCommand({
          pool,
          context: ctx,
          idempotencyKey: `hold_bypass_${ctx.role}_${randomUUID()}`,
          policyEngine,
          authorizationAuthority: authAuthority,
          input: {
            documentId,
            versionId,
            holdType: 'legal',
            authority: 'Tribunal Judicial de Luanda',
            reason: 'Processo n. 102/2026',
          },
        }),
        /HOLD_AUTHORITY_DENIED/,
        `Role '${ctx.role}' must be rejected from placeHoldCommand`,
      );
    }

    // Verify 0 success audit and outbox events emitted for denied calls
    const c = await pool.connect();
    try {
      const audits = await c.query(
        `SELECT COUNT(*) FROM document_audit_events WHERE document_id = $1 AND action = 'document.hold_placed'`,
        [documentId],
      );
      assert.strictEqual(parseInt(audits.rows[0].count, 10), 0, 'DENIED_HOLD_SUCCESS_AUDIT must be 0');
    } finally {
      c.release();
    }

    // 3.2 Management can place legal hold and administrative hold
    const legalHold = await placeHoldCommand({
      pool,
      context: adminAContext,
      idempotencyKey: `hold_legal_mgmt_${randomUUID()}`,
      policyEngine,
      authorizationAuthority: authAuthority,
      input: {
        documentId,
        versionId,
        holdType: 'legal',
        authority: 'Tribunal Judicial de Luanda',
        reason: 'Processo n. 102/2026',
      },
    });
    assert.strictEqual(legalHold.result.holdType, 'legal');
    assert.strictEqual(legalHold.result.holdStatus, 'active');

    const adminHold = await placeHoldCommand({
      pool,
      context: adminAContext,
      idempotencyKey: `hold_admin_mgmt_${randomUUID()}`,
      policyEngine,
      authorizationAuthority: authAuthority,
      input: {
        documentId,
        versionId,
        holdType: 'administrative',
        authority: 'Conselho Pedagógico',
        reason: 'Auditoria Académica Interna',
      },
    });
    assert.strictEqual(adminHold.result.holdType, 'administrative');
    assert.strictEqual(adminHold.result.holdStatus, 'active');

    console.log('✔ Test 3 passed: placeHoldCommand role matrix (legal + admin hold) verified');
  }

  // ── TEST 4: ReleaseHold direct command bypass & identity integrity ──────────
  {
    const { documentId, versionId } = await createAvailableDoc(adminAContext, 'academic_transcript', 'release_test.pdf');
    await assignRetentionCommand({
      pool,
      context: adminAContext,
      idempotencyKey: `ret_rel_prep_${randomUUID()}`,
      policyEngine,
      authorizationAuthority: authAuthority,
      input: {
        documentId,
        versionId,
        jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
        category: 'academic_transcript',
        clockTriggerEventAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      },
    });

    const hold = await placeHoldCommand({
      pool,
      context: adminAContext,
      idempotencyKey: `hold_to_release_${randomUUID()}`,
      policyEngine,
      authorizationAuthority: authAuthority,
      input: {
        documentId,
        versionId,
        holdType: 'legal',
        authority: 'Tribunal Judicial de Luanda',
        reason: 'Investigação Preliminar',
      },
    });

    // 4.1 Non-management roles cannot release holds
    for (const ctx of [studentAContext, parentAContext, teacherAContext, unknownRoleContext]) {
      await assert.rejects(
        () => releaseHoldCommand({
          pool,
          context: ctx,
          idempotencyKey: `rel_bypass_${ctx.role}_${randomUUID()}`,
          policyEngine,
          authorizationAuthority: authAuthority,
          input: {
            holdId: hold.result.id,
            documentId,
            versionId,
            releaseReason: 'Conclusão do inquérito pelo Ministério Público',
          },
        }),
        /HOLD_AUTHORITY_DENIED/,
        `Role '${ctx.role}' must be rejected from releaseHoldCommand`,
      );
    }

    // 4.2 Cross-document/version mismatch fails closed
    await assert.rejects(
      () => releaseHoldCommand({
        pool,
        context: adminAContext,
        idempotencyKey: `rel_mismatch_doc_${randomUUID()}`,
        policyEngine,
        authorizationAuthority: authAuthority,
        input: {
          holdId: hold.result.id,
          documentId: randomUUID(), // mismatched doc
          versionId,
          releaseReason: 'Valid reason but wrong doc',
        },
      }),
      /DOCUMENT_NOT_FOUND|HOLD_DOCUMENT_MISMATCH/,
    );

    // 4.3 Management release succeeds
    const releaseRes = await releaseHoldCommand({
      pool,
      context: adminAContext,
      idempotencyKey: `rel_mgmt_${randomUUID()}`,
      policyEngine,
      authorizationAuthority: authAuthority,
      input: {
        holdId: hold.result.id,
        documentId,
        versionId,
        releaseReason: 'Conclusão do inquérito e arquivamento formal',
      },
    });
    assert.strictEqual(releaseRes.result.holdStatus, 'released');
    assert.ok(releaseRes.result.releasedAt);

    // 4.4 Cannot release already released hold
    await assert.rejects(
      () => releaseHoldCommand({
        pool,
        context: adminAContext,
        idempotencyKey: `rel_repeat_${randomUUID()}`,
        policyEngine,
        authorizationAuthority: authAuthority,
        input: {
          holdId: hold.result.id,
          documentId,
          versionId,
          releaseReason: 'Second release attempt',
        },
      }),
      /HOLD_NOT_ACTIVE/,
    );

    console.log('✔ Test 4 passed: releaseHoldCommand role matrix & identity integrity verified');
  }

  // ── TEST 5: AuthorizeDeletion preconditions, hold blocking & role matrix ───
  {
    const { documentId, versionId } = await createAvailableDoc(adminAContext, 'identification', 'del_auth_test.pdf');

    // 5.1 No retention assignment -> rejected
    await assert.rejects(
      () => authorizeDeletionCommand({
        pool,
        context: adminAContext,
        idempotencyKey: `del_no_ret_${randomUUID()}`,
        policyEngine,
        authorizationAuthority: authAuthority,
        input: { documentId, versionId },
      }),
      /RETENTION_ASSIGNMENT_MISSING/,
      'Must reject deletion authorization when retention assignment is missing',
    );

    // Assign retention in future -> RETENTION_ACTIVE
    await assignRetentionCommand({
      pool,
      context: adminAContext,
      idempotencyKey: `ret_active_${randomUUID()}`,
      policyEngine,
      authorizationAuthority: authAuthority,
      input: {
        documentId,
        versionId,
        jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
        category: 'identification',
        clockTriggerEventAt: new Date(Date.now() + 30 * 24 * 3600 * 1000), // future
      },
    });

    // 5.2 Retention active -> rejected
    await assert.rejects(
      () => authorizeDeletionCommand({
        pool,
        context: adminAContext,
        idempotencyKey: `del_active_ret_${randomUUID()}`,
        policyEngine,
        authorizationAuthority: authAuthority,
        input: { documentId, versionId },
      }),
      /RETENTION_ACTIVE/,
      'Must reject deletion authorization while retention is active',
    );

    // Update assignment to expired retention
    const c = await pool.connect();
    try {
      await c.query(
        `UPDATE document_retention_assignments
         SET retain_until = NOW() - INTERVAL '1 day', retention_status = 'retention_expired'
         WHERE institution_id = $1 AND version_id = $2`,
        [institutionAId, versionId],
      );
    } finally {
      c.release();
    }

    // Place an active legal hold
    const hold = await placeHoldCommand({
      pool,
      context: adminAContext,
      idempotencyKey: `hold_blocking_${randomUUID()}`,
      policyEngine,
      authorizationAuthority: authAuthority,
      input: {
        documentId,
        versionId,
        holdType: 'legal',
        authority: 'Procuradoria Geral',
        reason: 'Bloqueio preventivo',
      },
    });

    // 5.3 Active legal hold blocks deletion authorization
    await assert.rejects(
      () => authorizeDeletionCommand({
        pool,
        context: adminAContext,
        idempotencyKey: `del_with_hold_${randomUUID()}`,
        policyEngine,
        authorizationAuthority: authAuthority,
        input: { documentId, versionId },
      }),
      /ACTIVE_HOLD_PREVENTS_DELETION/,
      'Active legal hold must block deletion authorization',
    );

    // Release the legal hold
    await releaseHoldCommand({
      pool,
      context: adminAContext,
      idempotencyKey: `rel_blocking_${randomUUID()}`,
      policyEngine,
      authorizationAuthority: authAuthority,
      input: {
        holdId: hold.result.id,
        documentId,
        versionId,
        releaseReason: 'Levantamento da providência cautelar',
      },
    });

    // Place an active administrative hold
    const adminHold = await placeHoldCommand({
      pool,
      context: adminAContext,
      idempotencyKey: `hold_admin_blocking_${randomUUID()}`,
      policyEngine,
      authorizationAuthority: authAuthority,
      input: {
        documentId,
        versionId,
        holdType: 'administrative',
        authority: 'Reitoria',
        reason: 'Verificação estatística',
      },
    });

    // 5.4 Active administrative hold blocks deletion authorization
    await assert.rejects(
      () => authorizeDeletionCommand({
        pool,
        context: adminAContext,
        idempotencyKey: `del_with_admin_hold_${randomUUID()}`,
        policyEngine,
        authorizationAuthority: authAuthority,
        input: { documentId, versionId },
      }),
      /ACTIVE_HOLD_PREVENTS_DELETION/,
      'Active administrative hold must block deletion authorization',
    );

    // Release the administrative hold
    await releaseHoldCommand({
      pool,
      context: adminAContext,
      idempotencyKey: `rel_admin_blocking_${randomUUID()}`,
      policyEngine,
      authorizationAuthority: authAuthority,
      input: {
        holdId: adminHold.result.id,
        documentId,
        versionId,
        releaseReason: 'Fim da verificação',
      },
    });

    // 5.5 Non-management roles cannot authorize deletion
    for (const ctx of [studentAContext, parentAContext, teacherAContext, unknownRoleContext]) {
      await assert.rejects(
        () => authorizeDeletionCommand({
          pool,
          context: ctx,
          idempotencyKey: `del_auth_bypass_${ctx.role}_${randomUUID()}`,
          policyEngine,
          authorizationAuthority: authAuthority,
          input: { documentId, versionId },
        }),
        /DELETION_AUTHORIZATION_DENIED/,
        `Role '${ctx.role}' must be rejected from authorizeDeletionCommand`,
      );
    }

    // Verify 0 success audit and outbox events emitted for denied calls
    const c2 = await pool.connect();
    try {
      const audits = await c2.query(
        `SELECT COUNT(*) FROM document_audit_events WHERE document_id = $1 AND action = 'document.deletion_authorized'`,
        [documentId],
      );
      assert.strictEqual(parseInt(audits.rows[0].count, 10), 0, 'DENIED_DELETION_AUTH_SUCCESS_AUDIT must be 0');
    } finally {
      c2.release();
    }

    // 5.6 Management role succeeds
    const authRes = await authorizeDeletionCommand({
      pool,
      context: adminAContext,
      idempotencyKey: `del_auth_mgmt_${randomUUID()}`,
      policyEngine,
      authorizationAuthority: authAuthority,
      input: { documentId, versionId },
    });
    assert.strictEqual(authRes.result.authorizationStatus, 'authorized');
    assert.strictEqual(authRes.result.policyBasis, 'SYNTHETIC_IDENTIFICATION_POLICY_V1');

    console.log('✔ Test 5 passed: authorizeDeletionCommand preconditions, hold blocking & role matrix verified');
  }

  // ── TEST 6: Multi-tenant negative isolation (Cross-tenant leak = 0) ─────────
  {
    const { documentId: docA, versionId: verA } = await createAvailableDoc(adminAContext, 'academic_transcript', 'doc_a.pdf');
    await assignRetentionCommand({
      pool,
      context: adminAContext,
      idempotencyKey: `ret_iso_prep_${randomUUID()}`,
      policyEngine,
      authorizationAuthority: authAuthority,
      input: {
        documentId: docA,
        versionId: verA,
        jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
        category: 'academic_transcript',
        clockTriggerEventAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      },
    });

    const holdA = await placeHoldCommand({
      pool,
      context: adminAContext,
      idempotencyKey: `hold_iso_prep_${randomUUID()}`,
      policyEngine,
      authorizationAuthority: authAuthority,
      input: {
        documentId: docA,
        versionId: verA,
        holdType: 'legal',
        authority: 'Tribunal',
        reason: 'Tenant A hold',
      },
    });

    // 6.1 Tenant B cannot assign retention to Tenant A version
    await assert.rejects(
      () => assignRetentionCommand({
        pool,
        context: adminBContext,
        idempotencyKey: `ret_cross_${randomUUID()}`,
        policyEngine,
        authorizationAuthority: authAuthority,
        input: {
          documentId: docA,
          versionId: verA,
          jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
          category: 'academic_transcript',
          clockTriggerEventAt: new Date(),
        },
      }),
      /DOCUMENT_NOT_FOUND|DOCUMENT_VERSION_NOT_FOUND/,
      'Cross-tenant retention assignment must fail closed',
    );

    // 6.2 Tenant B cannot place hold on Tenant A version
    await assert.rejects(
      () => placeHoldCommand({
        pool,
        context: adminBContext,
        idempotencyKey: `hold_cross_${randomUUID()}`,
        policyEngine,
        authorizationAuthority: authAuthority,
        input: {
          documentId: docA,
          versionId: verA,
          holdType: 'legal',
          authority: 'Tribunal B',
          reason: 'Cross-tenant hold attempt',
        },
      }),
      /DOCUMENT_NOT_FOUND/,
      'Cross-tenant hold placement must fail closed',
    );

    // 6.3 Tenant B cannot release Tenant A hold
    await assert.rejects(
      () => releaseHoldCommand({
        pool,
        context: adminBContext,
        idempotencyKey: `rel_cross_${randomUUID()}`,
        policyEngine,
        authorizationAuthority: authAuthority,
        input: {
          holdId: holdA.result.id,
          documentId: docA,
          versionId: verA,
          releaseReason: 'Cross-tenant release attempt',
        },
      }),
      /DOCUMENT_NOT_FOUND|HOLD_NOT_FOUND/,
      'Cross-tenant hold release must fail closed',
    );

    // 6.4 Tenant B cannot authorize deletion of Tenant A version
    await assert.rejects(
      () => authorizeDeletionCommand({
        pool,
        context: adminBContext,
        idempotencyKey: `del_cross_${randomUUID()}`,
        policyEngine,
        authorizationAuthority: authAuthority,
        input: { documentId: docA, versionId: verA },
      }),
      /DOCUMENT_NOT_FOUND/,
      'Cross-tenant deletion authorization must fail closed',
    );

    // 6.5 Tenant B cannot evaluate deletion eligibility for Tenant A version
    await assert.rejects(
      () => evaluateDeletionEligibilityCommand({
        pool,
        context: adminBContext,
        input: { documentId: docA, versionId: verA },
      }),
      /DOCUMENT_NOT_FOUND/,
      'Cross-tenant evaluate deletion eligibility must fail closed',
    );

    console.log('✔ Test 6 passed: Multi-tenant negative isolation (CROSS_TENANT_LEAK=0) verified');
  }

  console.log('[H1-06A] ALL RETENTION & DELETION AUTHORIZATION HARDENING TESTS PASSED ✅');
} finally {
  try {
    await setupClient.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } catch {
    // Ignore cleanup error
  }
  setupClient.release();
  await pool.end();
}
