/**
 * Documents Foundation I5 - Idempotency & Concurrency Tests
 * Mission: DOCUMENTS-FOUNDATION-I5
 */

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
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
  authorizeContentAccessCommand,
  exchangeGrantForContentStreamCommand,
  revokeContentAccessGrantCommand,
} from '../src/modules/documents/document-access-command.ts';
import {
  ConfigurableDocumentAccessPolicyEngine,
} from '../src/modules/documents/document-access-policy.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { DeterministicTestMalwareScanner } from './support/deterministic-test-malware-scanner.ts';
import { ContentTypeDetector } from '../src/modules/documents/content-type-detector.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

await verifyApprovedTestConnection();

const schema = `doc_access_conc_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionId = '00000000-0000-0000-0000-000000000001';
const adminPersonId = '00000000-0000-0000-0000-000000000002';
const teacherPersonId = '00000000-0000-0000-0000-000000000003';

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

const teacherContext: InstitutionalContext = {
  institutionId,
  institutionName: 'Nexus Test Academy',
  institutionSlug: 'nexus-test-academy',
  personId: teacherPersonId,
  personName: 'Teacher Person',
  identityEmail: 'teacher@nexus.edu',
  membershipId: '00000000-0000-0000-0000-000000000011',
  role: 'teacher',
};

const detector = new ContentTypeDetector({
  maxPrefixInspectionBytes: 4096,
  zipMetadataInspectionLimit: 64 * 1024,
  maxContainerEntryCount: 100,
  maxContainerMetadataBytes: 128 * 1024,
});

const policyEngine = new ConfigurableDocumentAccessPolicyEngine([
  {
    role: 'institution_admin',
    category: '*',
    allowedActions: ['view_metadata', 'open_content', 'download_content'],
  },
  {
    role: 'teacher',
    category: '*',
    allowedActions: ['view_metadata', 'open_content', 'download_content'],
  },
]);

const storageProvider = new MemoryObjectStorageProvider();
const malwareScanner = new DeterministicTestMalwareScanner();
const docRepo = new PostgresDocumentRepository();

try {
  await pool.query(`CREATE SCHEMA ${quote(schema)}`);
  const migrations = await discoverMigrations(migrationsDir);
  await runMigrations(pool, migrations);

  const client = await pool.connect();
  try {
    // Seed
    await client.query(`
      INSERT INTO institutions (id, name, slug)
      VALUES ('${institutionId}', 'Nexus Test Academy', 'nexus-test-academy')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO people (id, name)
      VALUES
        ('${adminPersonId}', 'Admin Person'),
        ('${teacherPersonId}', 'Teacher Person')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO memberships (id, institution_id, person_id, role, status)
      VALUES
        ('${adminContext.membershipId}', '${institutionId}', '${adminPersonId}', 'institution_admin', 'active'),
        ('${teacherContext.membershipId}', '${institutionId}', '${teacherPersonId}', 'teacher', 'active')
      ON CONFLICT (id) DO NOTHING;
    `);

    const cleanPdf = Buffer.from('%PDF-1.4 Concurrency test content');

    const doc = await docRepo.createDocument(client, {
      institutionId,
      category: 'academic_transcript',
      createdByPersonId: adminPersonId,
    });

    const sessionRes = await createUploadSessionCommand({
      pool,
      context: adminContext,
      idempotencyKey: 'idemp-conc-upload',
      input: {
        documentId: doc.id,
        declaredFilename: 'transcript.pdf',
        declaredMimeType: 'application/pdf',
        declaredByteSize: cleanPdf.length,
        policyConfig: { globalMaxByteSize: 50 * 1024 * 1024 },
        storageProvider: 'test-memory',
        storageBucket: 'vault',
      },
    });

    await storageProvider.simulateDirectUpload({
      storageBucket: sessionRes.result.session.storageBucket,
      storageKey: sessionRes.result.session.storageKey,
      content: cleanPdf,
      mimeType: 'application/pdf',
    });

    const completeRes = await completeUploadSessionCommand({
      pool,
      context: adminContext,
      storageProvider,
      idempotencyKey: 'idemp-conc-complete',
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
      idempotencyKey: 'idemp-conc-pipe',
      input: {
        documentId: doc.id,
        versionId: completeRes.result.version.id,
        storageProvider,
        malwareScanner,
        contentTypeDetector: detector,
        retryPolicy: { maxAttempts: 3, baseBackoffMs: 1000, maxBackoffMs: 10000 },
      },
    });

    const docId = doc.id;
    const verId = completeRes.result.version.id;

    // 1. EXACT_IDEMPOTENT_RETRY
    const auth1 = await authorizeContentAccessCommand({
      pool,
      context: teacherContext,
      idempotencyKey: 'idemp-grant-exact-1',
      input: {
        documentId: docId,
        versionId: verId,
        action: 'open',
        policyEngine,
      },
    });
    assert.strictEqual(auth1.replayed, false);
    assert.ok(auth1.result.rawAccessToken);

    const auth1Replay = await authorizeContentAccessCommand({
      pool,
      context: teacherContext,
      idempotencyKey: 'idemp-grant-exact-1',
      input: {
        documentId: docId,
        versionId: verId,
        action: 'open',
        policyEngine,
      },
    });
    assert.strictEqual(auth1Replay.replayed, true);
    assert.strictEqual(auth1Replay.result.grant.id, auth1.result.grant.id);
    assert.strictEqual(auth1Replay.result.rawAccessToken, auth1.result.rawAccessToken, 'Replay must return usable raw token');

    // 2. IDEMPOTENCY_CONFLICT
    await assert.rejects(
      async () => {
        await authorizeContentAccessCommand({
          pool,
          context: teacherContext,
          idempotencyKey: 'idemp-grant-exact-1',
          input: {
            documentId: docId,
            versionId: verId,
            action: 'download', // Conflicting action with same key
            policyEngine,
          },
        });
      },
      /IDEMPOTENCY_CONFLICT/,
      'Different request payload with same key must throw IDEMPOTENCY_CONFLICT',
    );

    // 3. CONCURRENT_GRANT_REQUESTS
    const concurrentPromises = Array.from({ length: 5 }).map((_, i) =>
      authorizeContentAccessCommand({
        pool,
        context: teacherContext,
        idempotencyKey: `idemp-concurrent-${i}`,
        input: {
          documentId: docId,
          versionId: verId,
          action: 'open',
          policyEngine,
        },
      }),
    );

    const concurrentResults = await Promise.all(concurrentPromises);
    const grantIds = new Set(concurrentResults.map((r) => r.result.grant.id));
    const tokenHashes = new Set(concurrentResults.map((r) => r.result.grant.tokenHash));

    assert.strictEqual(grantIds.size, 5, 'All 5 concurrent grant requests must succeed with unique grant IDs');
    assert.strictEqual(tokenHashes.size, 5, 'All 5 grants must have distinct token hashes');

    // 4. GRANT_VS_REVOKE_RACE
    const targetGrant = concurrentResults[0].result;
    // Concurrently exchange and revoke
    const revokePromise = revokeContentAccessGrantCommand({
      pool,
      context: adminContext,
      idempotencyKey: 'idemp-race-revoke',
      input: {
        grantId: targetGrant.grant.id,
        reason: 'Concurrent race test',
      },
    });

    const [revokedResult] = await Promise.all([revokePromise]);
    assert.strictEqual(revokedResult.result.status, 'revoked');

    // Exchange must now fail closed
    await assert.rejects(
      async () => {
        await exchangeGrantForContentStreamCommand({
          pool,
          context: teacherContext,
          input: {
            rawAccessToken: targetGrant.rawAccessToken!,
            policyEngine,
            storageProvider,
          },
        });
      },
      /GRANT_REVOKED/,
      'Exchange on revoked grant must fail closed deterministically',
    );

    // 5. IDEMPOTENT_REVOKE
    const revokeReplay = await revokeContentAccessGrantCommand({
      pool,
      context: adminContext,
      idempotencyKey: 'idemp-race-revoke',
      input: {
        grantId: targetGrant.grant.id,
        reason: 'Concurrent race test',
      },
    });
    assert.strictEqual(revokeReplay.replayed, true);
    assert.strictEqual(revokeReplay.result.id, targetGrant.grant.id);
    assert.strictEqual(revokeReplay.result.status, 'revoked');

    console.log('[DOCUMENTS-ACCESS-CONCURRENCY] PASS: Idempotency replay, conflict rejection, concurrency and revocation safety verified.');
  } finally {
    client.release();
  }
} finally {
  await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  await pool.end();
}
