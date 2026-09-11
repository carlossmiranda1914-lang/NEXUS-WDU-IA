/**
 * Documents Foundation I6 - Deletion Idempotency & Concurrency Tests
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
  placeHoldCommand,
} from '../src/modules/documents/document-retention-command.ts';
import {
  executeDeletionCommand,
} from '../src/modules/documents/document-deletion-command.ts';
import {
  ConfigurableRetentionPolicyEngine,
  RetentionPolicyConfig,
} from '../src/modules/documents/document-retention-policy.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { DeterministicTestMalwareScanner } from './support/deterministic-test-malware-scanner.ts';
import { ContentTypeDetector } from '../src/modules/documents/content-type-detector.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

await verifyApprovedTestConnection();

const schema = `doc_del_idemp_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
  max: 10,
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

async function createAvailableVersion(): Promise<{ documentId: string; versionId: string }> {
  const content = Buffer.from('%PDF-1.4 sample content for deletion idempotency test', 'utf8');
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

console.log('[DOCUMENTS-DELETION-IDEMPOTENCY] Running tests...');

// ── Test 1: Idempotent replay of ExecuteDeletion ───────────────────────────────
{
  const { documentId, versionId } = await createAvailableVersion();

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

  const execKey = `exec_del_replay_${randomUUID()}`;

  const first = await executeDeletionCommand({
    pool,
    context: dpoContext,
    idempotencyKey: execKey,
    deletionPseudonymizationKey,
    storageProvider,
    input: {
      deletionAuthorizationId: authRes.result.id,
    },
  });
  assert.strictEqual(first.replayed, false);
  assert.ok(first.result.deletionRecord != null);
  assert.strictEqual(first.result.deletionRecord.result, 'deleted');

  const second = await executeDeletionCommand({
    pool,
    context: dpoContext,
    idempotencyKey: execKey,
    deletionPseudonymizationKey,
    storageProvider,
    input: {
      deletionAuthorizationId: authRes.result.id,
    },
  });
  assert.strictEqual(second.replayed, true);
  assert.strictEqual(second.result.deletionRecord?.id, first.result.deletionRecord.id);

  console.log('✔ Test 1 passed: ExecuteDeletion idempotent replay verified');
}

// ── Test 2: Double execution concurrency race on ExecuteDeletion ───────────────
{
  const { documentId, versionId } = await createAvailableVersion();

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

  // Launch two concurrent executeDeletionCommand calls with different idempotency keys
  const [r1, r2] = await Promise.allSettled([
    executeDeletionCommand({
      pool,
      context: dpoContext,
      idempotencyKey: `exec_del_race_1_${randomUUID()}`,
      deletionPseudonymizationKey,
      storageProvider,
      input: { deletionAuthorizationId: authRes.result.id },
    }),
    executeDeletionCommand({
      pool,
      context: dpoContext,
      idempotencyKey: `exec_del_race_2_${randomUUID()}`,
      deletionPseudonymizationKey,
      storageProvider,
      input: { deletionAuthorizationId: authRes.result.id },
    }),
  ]);

  const fulfilled = [r1, r2].filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof executeDeletionCommand>>>[];
  assert.strictEqual(fulfilled.length, 2, 'Both concurrent executions should safely resolve without duplicate deletion effects');
  assert.ok(fulfilled[0].value.result.deletionRecord != null);
  assert.ok(fulfilled[1].value.result.deletionRecord != null);
  assert.strictEqual(
    fulfilled[0].value.result.deletionRecord?.id,
    fulfilled[1].value.result.deletionRecord?.id,
    'Both concurrent callers resolve to the exact same immutable DeletionRecord',
  );

  // Verify only 1 DeletionRecord exists in DB for this authorization
  const checkClient = await pool.connect();
  try {
    const rows = await checkClient.query(
      `SELECT count(*) FROM document_deletion_records WHERE institution_id = $1 AND deletion_authorization_id = $2`,
      [institutionId, authRes.result.id],
    );
    assert.strictEqual(parseInt(rows.rows[0].count, 10), 1, 'Exactly one deletion record created across concurrent racers');
  } finally {
    checkClient.release();
  }

  console.log('✔ Test 2 passed: Double execution concurrency race mutually excluded & append-only preserved');
}

// ── Test 3: Hold-vs-Delete concurrency race & mutual exclusion ──────────────────
{
  // Subtest 3A: Hold placed first blocks deletion
  {
    const { documentId, versionId } = await createAvailableVersion();

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

    await placeHoldCommand({
      pool,
      context: adminContext,
      idempotencyKey: `hold_${randomUUID()}`,
      policyEngine,
      input: {
        documentId,
        versionId,
        holdType: 'legal',
        authority: 'Legal Department',
        reason: 'Litigation hold',
      },
    });

    // Attempting deletion while hold is active must fail
    await assert.rejects(
      () =>
        executeDeletionCommand({
          pool,
          context: dpoContext,
          idempotencyKey: `exec_del_blocked_${randomUUID()}`,
          deletionPseudonymizationKey,
          storageProvider,
          input: { deletionAuthorizationId: authRes.result.id },
        }),
      /ACTIVE_HOLD_PREVENTS_DELETION/,
    );
  }

  // Subtest 3B: Concurrent race between PlaceHold and ExecuteDeletion
  {
    const { documentId, versionId } = await createAvailableVersion();

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

    const [holdSettled, delSettled] = await Promise.allSettled([
      placeHoldCommand({
        pool,
        context: adminContext,
        idempotencyKey: `hold_race_${randomUUID()}`,
        policyEngine,
        input: {
          documentId,
          versionId,
          holdType: 'legal',
          authority: 'Legal Department',
          reason: 'Race hold',
        },
      }),
      executeDeletionCommand({
        pool,
        context: dpoContext,
        idempotencyKey: `exec_del_race_${randomUUID()}`,
        deletionPseudonymizationKey,
        storageProvider,
        input: { deletionAuthorizationId: authRes.result.id },
      }),
    ]);

    // Either hold succeeded and deletion was rejected with ACTIVE_HOLD_PREVENTS_DELETION,
    // or deletion succeeded and hold was rejected with VERSION_DELETION_IN_PROGRESS.
    const holdWon = holdSettled.status === 'fulfilled' && delSettled.status === 'rejected';
    const delWon = delSettled.status === 'fulfilled' && holdSettled.status === 'rejected';

    assert.ok(
      holdWon || delWon,
      `Hold-vs-delete race must resolve deterministically to one winner: holdWon=${holdWon}, delWon=${delWon}`,
    );

    if (holdWon) {
      assert.match((delSettled as PromiseRejectedResult).reason?.message, /ACTIVE_HOLD_PREVENTS_DELETION/);
    } else {
      assert.match((holdSettled as PromiseRejectedResult).reason?.message, /VERSION_DELETION_IN_PROGRESS/);
    }
  }

  console.log('✔ Test 3 passed: Hold-vs-Delete race serialization on version lock verified');
}

const teardownClient = await pool.connect();
try {
  await teardownClient.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
} finally {
  teardownClient.release();
  await pool.end();
}

console.log('[DOCUMENTS-DELETION-IDEMPOTENCY] ALL TESTS PASSED ✅');
