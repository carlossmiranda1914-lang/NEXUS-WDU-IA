import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import { PostgresDocumentUploadRepository } from '../src/modules/documents/document-upload-repository.ts';
import {
  createUploadSessionCommand,
  cancelUploadSessionCommand,
  completeUploadSessionCommand,
} from '../src/modules/documents/document-upload-command.ts';
import { MemoryObjectStorageProvider } from '../src/modules/documents/object-storage-provider.ts';

await verifyApprovedTestConnection();

const schema = `doc_up_idemp_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

const institutionId = '00000000-0000-0000-0000-000000000001';
const personId = '00000000-0000-0000-0000-000000000002';
const context: InstitutionalContext = {
  institutionId,
  institutionName: 'Test Institution',
  institutionSlug: 'test-inst',
  personId,
  personName: 'Test Actor',
  identityEmail: 'actor@nexus.edu',
  membershipId: '00000000-0000-0000-0000-000000000003',
  role: 'institution_admin',
};

const client = await pool.connect();
try {
  await client.query(`CREATE SCHEMA ${quote(schema)}`);
  await client.query(`SET search_path TO ${quote(schema)}, public`);

  const migrations = await discoverMigrations(migrationsDir);
  await runMigrations(client, migrations);

  // Seed fixture institution and person
  await client.query(
    `INSERT INTO institutions (id, name, slug, status) VALUES ($1, 'Test Institution', 'test-inst', 'active')`,
    [institutionId],
  );
  await client.query(
    `INSERT INTO people (id, name) VALUES ($1, 'Test Actor')`,
    [personId],
  );

  const docRepo = new PostgresDocumentRepository();
  const uploadRepo = new PostgresDocumentUploadRepository();
  const storageProvider = new MemoryObjectStorageProvider();

  // Test Document
  const doc = await docRepo.createDocument(client, {
    institutionId,
    category: 'academic_transcript',
    createdByPersonId: personId,
  });

  // 1. DOUBLE_COMPLETION CONCURRENCY TEST
  const sessionRes = await createUploadSessionCommand({
    pool,
    context,
    idempotencyKey: 'idemp-sess-double-1',
    input: {
      documentId: doc.id,
      declaredFilename: 'transcript.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 2048,
      policyConfig: { globalMaxByteSize: 50 * 1024 * 1024 },
      storageProvider: 'test-memory',
      storageBucket: 'vault',
    },
  });

  const session = sessionRes.result.session;
  const rawToken = sessionRes.result.rawToken;

  await storageProvider.simulateDirectUpload({
    storageBucket: session.storageBucket,
    storageKey: session.storageKey,
    content: Buffer.from('Mock transcript content'),
    mimeType: 'application/pdf',
  });

  // Run 5 concurrent completions of the exact same session
  const concurrentCompletions = await Promise.all(
    Array.from({ length: 5 }).map((_, i) =>
      completeUploadSessionCommand({
        pool,
        context,
        storageProvider,
        idempotencyKey: `idemp-complete-worker-${i}`,
        input: {
          sessionId: session.id,
          rawToken,
          provenance: {
            originType: 'user_upload',
            actorPersonId: personId,
            sourceDomain: 'portal',
            method: 'direct_upload',
            correlationId: `corr-${i}`,
          },
        },
      }),
    ),
  );

  // Assert all completed successfully
  assert.strictEqual(concurrentCompletions.length, 5);
  const distinctVersionIds = new Set(concurrentCompletions.map((c) => c.result.version.id));
  assert.strictEqual(distinctVersionIds.size, 1, 'All concurrent completions must yield the EXACT same version ID');

  const versionsInDb = await docRepo.listVersions(client, institutionId, doc.id);
  assert.strictEqual(versionsInDb.length, 1, 'Exactly 1 canonical version must exist in database');
  assert.strictEqual(versionsInDb[0].versionNumber, 1);

  // 2. COMPLETE VS CANCEL RACE
  const raceDoc = await docRepo.createDocument(client, {
    institutionId,
    category: 'identification',
    createdByPersonId: personId,
  });

  const raceSessRes = await createUploadSessionCommand({
    pool,
    context,
    idempotencyKey: 'idemp-race-create',
    input: {
      documentId: raceDoc.id,
      declaredFilename: 'race.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 1024,
      policyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
      storageProvider: 'test-memory',
      storageBucket: 'vault',
    },
  });

  await storageProvider.simulateDirectUpload({
    storageBucket: raceSessRes.result.session.storageBucket,
    storageKey: raceSessRes.result.session.storageKey,
    content: Buffer.from('Race test bytes'),
    mimeType: 'application/pdf',
  });

  // Launch Complete vs Cancel simultaneously
  const results = await Promise.allSettled([
    completeUploadSessionCommand({
      pool,
      context,
      storageProvider,
      idempotencyKey: 'idemp-race-complete',
      input: {
        sessionId: raceSessRes.result.session.id,
        rawToken: raceSessRes.result.rawToken,
        provenance: {
          originType: 'user_upload',
          actorPersonId: personId,
          sourceDomain: 'portal',
          method: 'direct_upload',
        },
      },
    }),
    cancelUploadSessionCommand({
      pool,
      context,
      idempotencyKey: 'idemp-race-cancel',
      input: {
        sessionId: raceSessRes.result.session.id,
        reason: 'Raced cancellation',
      },
    }),
  ]);

  const finalSession = await uploadRepo.getSessionById(client, institutionId, raceSessRes.result.session.id);
  assert.ok(finalSession);
  assert.ok(
    finalSession.status === 'completed' || finalSession.status === 'cancelled',
    'Final session status must be either completed or cancelled',
  );

  const raceDocVersions = await docRepo.listVersions(client, institutionId, raceDoc.id);
  if (finalSession.status === 'completed') {
    assert.strictEqual(raceDocVersions.length, 1);
  } else {
    assert.strictEqual(raceDocVersions.length, 0);
  }

  // 3. CONCURRENT DISTINCT SESSIONS SEQUENCING
  const seqDoc = await docRepo.createDocument(client, {
    institutionId,
    category: 'identification',
    createdByPersonId: personId,
  });

  const sessA = await createUploadSessionCommand({
    pool,
    context,
    idempotencyKey: 'idemp-seq-a',
    input: {
      documentId: seqDoc.id,
      declaredFilename: 'doc_a.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 1000,
      policyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
      storageProvider: 'test-memory',
      storageBucket: 'vault',
    },
  });

  const sessB = await createUploadSessionCommand({
    pool,
    context,
    idempotencyKey: 'idemp-seq-b',
    input: {
      documentId: seqDoc.id,
      declaredFilename: 'doc_b.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 2000,
      policyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
      storageProvider: 'test-memory',
      storageBucket: 'vault',
    },
  });

  await storageProvider.simulateDirectUpload({
    storageBucket: sessA.result.session.storageBucket,
    storageKey: sessA.result.session.storageKey,
    content: Buffer.from('Session A content'),
    mimeType: 'application/pdf',
  });

  await storageProvider.simulateDirectUpload({
    storageBucket: sessB.result.session.storageBucket,
    storageKey: sessB.result.session.storageKey,
    content: Buffer.from('Session B content'),
    mimeType: 'application/pdf',
  });

  // Complete both sessions concurrently
  const [resA, resB] = await Promise.all([
    completeUploadSessionCommand({
      pool,
      context,
      storageProvider,
      idempotencyKey: 'idemp-complete-a',
      input: {
        sessionId: sessA.result.session.id,
        rawToken: sessA.result.rawToken,
        provenance: {
          originType: 'user_upload',
          sourceDomain: 'portal',
          method: 'direct_upload',
        },
      },
    }),
    completeUploadSessionCommand({
      pool,
      context,
      storageProvider,
      idempotencyKey: 'idemp-complete-b',
      input: {
        sessionId: sessB.result.session.id,
        rawToken: sessB.result.rawToken,
        provenance: {
          originType: 'user_upload',
          sourceDomain: 'portal',
          method: 'direct_upload',
        },
      },
    }),
  ]);

  const seqVersions = await docRepo.listVersions(client, institutionId, seqDoc.id);
  assert.strictEqual(seqVersions.length, 2);
  const versionNumbers = seqVersions.map((v) => v.versionNumber).sort((a, b) => a - b);
  assert.deepStrictEqual(versionNumbers, [1, 2], 'Versions must sequence sequentially without duplicates');

  // 4. IDEMPOTENCY CONFLICT CHECK
  await assert.rejects(
    async () => {
      await createUploadSessionCommand({
        pool,
        context,
        idempotencyKey: 'idemp-seq-a', // Reusing key with different input
        input: {
          documentId: seqDoc.id,
          declaredFilename: 'different_filename.pdf',
          declaredMimeType: 'application/pdf',
          declaredByteSize: 99999,
          policyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
          storageProvider: 'test-memory',
          storageBucket: 'vault',
        },
      });
    },
    /IDEMPOTENCY_CONFLICT/,
    'Reusing idempotency key with different payload must throw IDEMPOTENCY_CONFLICT',
  );

  console.log('[DOCUMENTS-UPLOAD-CONCURRENCY] PASS: Double completion, cancel/complete race, sequence concurrency and idempotency conflicts verified.');
} finally {
  try {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } finally {
    client.release();
    await pool.end();
  }
}
