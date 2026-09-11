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
    allowedDeletionAuthorityScopePatterns: ['institutional_dpo'],
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
      actorAuthorityScope: 'institutional_dpo',
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
      actorAuthorityScope: 'institutional_dpo',
    },
  });
  assert.strictEqual(first.replayed, false);
  assert.strictEqual(first.result.deletionRecord.result, 'deleted');

  const second = await executeDeletionCommand({
    pool,
    context: dpoContext,
    idempotencyKey: execKey,
    deletionPseudonymizationKey,
    storageProvider,
    input: {
      deletionAuthorizationId: authRes.result.id,
      actorAuthorityScope: 'institutional_dpo',
    },
  });
  assert.strictEqual(second.replayed, true);
  assert.strictEqual(second.result.deletionRecord.id, first.result.deletionRecord.id);

  console.log('✔ Test 1 passed: ExecuteDeletion idempotent replay verified');
}

const teardownClient = await pool.connect();
try {
  await teardownClient.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
} finally {
  teardownClient.release();
  await pool.end();
}

console.log('[DOCUMENTS-DELETION-IDEMPOTENCY] ALL TESTS PASSED ✅');
