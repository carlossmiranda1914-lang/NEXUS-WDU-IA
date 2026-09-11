/**
 * Documents Foundation I6 - Multi-Tenant Isolation Negative Tests
 * Mission: DOCUMENTS-FOUNDATION-I6
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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

const schema = `doc_ret_tenant_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const instA = '00000000-0000-0000-0000-000000000001';
const instB = '00000000-0000-0000-0000-000000000002';
const personA = '00000000-0000-0000-0000-000000000011';
const personB = '00000000-0000-0000-0000-000000000012';

const contextA: InstitutionalContext = {
  institutionId: instA,
  institutionName: 'Academy Alpha',
  institutionSlug: 'academy-alpha',
  personId: personA,
  personName: 'Alpha Officer',
  identityEmail: 'alpha@nexus.edu',
  membershipId: '00000000-0000-0000-0000-000000000021',
  role: 'institution_admin',
};

const contextB: InstitutionalContext = {
  institutionId: instB,
  institutionName: 'Academy Beta',
  institutionSlug: 'academy-beta',
  personId: personB,
  personName: 'Beta Officer',
  identityEmail: 'beta@nexus.edu',
  membershipId: '00000000-0000-0000-0000-000000000022',
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

const setupClient = await pool.connect();
try {
  await setupClient.query(`CREATE SCHEMA ${quote(schema)}`);
  await setupClient.query(`SET search_path TO ${quote(schema)},public`);

  const migrations = await discoverMigrations(migrationsDir);
  await runMigrations(setupClient, migrations);

  await setupClient.query(
    `INSERT INTO institutions (id, name, slug) VALUES
      ($1, 'Academy Alpha', 'academy-alpha'),
      ($2, 'Academy Beta', 'academy-beta')`,
    [instA, instB],
  );
  await setupClient.query(
    `INSERT INTO people (id, name) VALUES
      ($1, 'Alpha Officer'),
      ($2, 'Beta Officer')`,
    [personA, personB],
  );
} finally {
  setupClient.release();
}

async function createAvailableVersionForTenant(context: InstitutionalContext): Promise<{ documentId: string; versionId: string }> {
  const content = Buffer.from('%PDF-1.4 sample content for tenant isolation test', 'utf8');
  const docRepo = new PostgresDocumentRepository();
  const c = await pool.connect();
  let docId: string;
  try {
    const doc = await docRepo.createDocument(c, {
      institutionId: context.institutionId,
      category: 'identification',
      createdByPersonId: context.personId,
    });
    docId = doc.id;
  } finally {
    c.release();
  }

  const idSuffix = randomUUID();
  const sessionRes = await createUploadSessionCommand({
    pool,
    context,
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
    context,
    storageProvider,
    idempotencyKey: `idemp-upload-complete-${idSuffix}`,
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

console.log('[DOCUMENTS-RETENTION-MULTI-TENANT] Running tests...');

// Create document owned by Tenant A
const { documentId: docA, versionId: verA } = await createAvailableVersionForTenant(contextA);

// ── Test 1: Tenant B cannot assign retention to Tenant A's document ─────────────
await assert.rejects(
  () => assignRetentionCommand({
    pool,
    context: contextB,
    idempotencyKey: `tenant_b_assign_${randomUUID()}`,
    policyEngine,
    input: {
      documentId: docA,
      versionId: verA,
      category: 'identification',
      jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
      clockTriggerEventAt: new Date(),
    },
  }),
  /DOCUMENT_VERSION_NOT_FOUND/,
);
console.log('✔ Test 1 passed: Tenant B cross-tenant AssignRetention rejected');

// Assign retention by Tenant A
await assignRetentionCommand({
  pool,
  context: contextA,
  idempotencyKey: `tenant_a_assign_${randomUUID()}`,
  policyEngine,
  input: {
    documentId: docA,
    versionId: verA,
    category: 'identification',
    jurisdictionProfileId: 'SYNTHETIC_BR_MEC_STANDARD',
    clockTriggerEventAt: new Date(Date.now() - 1000),
  },
});

// ── Test 2: Tenant B cannot place hold on Tenant A's document ───────────────────
await assert.rejects(
  () => placeHoldCommand({
    pool,
    context: contextB,
    idempotencyKey: `tenant_b_hold_${randomUUID()}`,
    policyEngine,
    input: {
      documentId: docA,
      versionId: verA,
      holdType: 'legal',
      authority: 'Rogue Authority',
      reason: 'Malicious hold',
      actorAuthorityScope: 'institutional_dpo',
    },
  }),
  /DOCUMENT_NOT_FOUND/,
);
console.log('✔ Test 2 passed: Tenant B cross-tenant PlaceHold rejected');

// Tenant A places a legal hold
const holdA = await placeHoldCommand({
  pool,
  context: contextA,
  idempotencyKey: `tenant_a_hold_${randomUUID()}`,
  policyEngine,
  input: {
    documentId: docA,
    versionId: verA,
    holdType: 'legal',
    authority: 'Alpha Legal Order',
    reason: 'Internal review',
    actorAuthorityScope: 'institutional_dpo',
  },
});

// ── Test 3: Tenant B cannot release Tenant A's hold ─────────────────────────────
await assert.rejects(
  () => releaseHoldCommand({
    pool,
    context: contextB,
    idempotencyKey: `tenant_b_rel_${randomUUID()}`,
    policyEngine,
    input: {
      holdId: holdA.result.id,
      documentId: docA,
      versionId: verA,
      releaseReason: 'Unauthorized release',
      actorAuthorityScope: 'institutional_dpo',
    },
  }),
  /HOLD_NOT_FOUND/,
);
console.log('✔ Test 3 passed: Tenant B cross-tenant ReleaseHold rejected');

// Tenant A releases hold
await releaseHoldCommand({
  pool,
  context: contextA,
  idempotencyKey: `tenant_a_rel_${randomUUID()}`,
  policyEngine,
  input: {
    holdId: holdA.result.id,
    documentId: docA,
    versionId: verA,
    releaseReason: 'Internal review complete',
    actorAuthorityScope: 'institutional_dpo',
  },
});

// ── Test 4: Tenant B cannot authorize deletion of Tenant A's document ───────────
await assert.rejects(
  () => authorizeDeletionCommand({
    pool,
    context: contextB,
    idempotencyKey: `tenant_b_auth_del_${randomUUID()}`,
    policyEngine,
    input: {
      documentId: docA,
      versionId: verA,
      actorAuthorityScope: 'institutional_dpo',
    },
  }),
  /DOCUMENT_NOT_FOUND/,
);
console.log('✔ Test 4 passed: Tenant B cross-tenant AuthorizeDeletion rejected');

const teardownClient = await pool.connect();
try {
  await teardownClient.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
} finally {
  teardownClient.release();
  await pool.end();
}

console.log('[DOCUMENTS-RETENTION-MULTI-TENANT] ALL TESTS PASSED ✅');
