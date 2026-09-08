import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import {
  createDocumentWithInitialVersionCommand,
  appendDocumentVersionCommand,
} from '../src/modules/documents/document-command.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';

await verifyApprovedTestConnection();

const schema = `doc_idemp_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

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

  // 1. Initial Creation
  const key1 = 'key-doc-creation-001';
  const initialPayload = {
    category: 'legal_guardian_consent',
    classification: 'standard_enrollment',
    mimeType: 'application/pdf',
    byteSize: 1024,
    sha256Hash: '1'.repeat(64),
    provenance: {
      originType: 'user_upload' as const,
      sourceDomain: 'enrollment',
      method: 'upload_form',
      correlationId: 'req-001',
    },
    storageReference: {
      storageProvider: 'gcs',
      storageBucket: 'vault',
      storageKey: 'tenants/1/docs/c1.pdf',
    },
  };

  const firstRun = await createDocumentWithInitialVersionCommand({
    pool,
    context,
    idempotencyKey: key1,
    input: initialPayload,
  });

  assert.strictEqual(firstRun.replayed, false, 'First command execution must not be replayed');
  assert.ok(firstRun.result.document.id);
  assert.strictEqual(firstRun.result.version.versionNumber, 1);

  // 2. Replay with identical key and payload
  const replayRun = await createDocumentWithInitialVersionCommand({
    pool,
    context,
    idempotencyKey: key1,
    input: initialPayload,
  });

  assert.strictEqual(replayRun.replayed, true, 'Second command execution must be replayed');
  assert.strictEqual(replayRun.result.document.id, firstRun.result.document.id, 'Replayed document ID must match');
  assert.strictEqual(replayRun.result.version.id, firstRun.result.version.id, 'Replayed version ID must match');

  // 3. Mismatched fingerprint rejection
  const mismatchedPayload = {
    ...initialPayload,
    byteSize: 999999, // Mismatched size
  };

  await assert.rejects(
    async () => {
      await createDocumentWithInitialVersionCommand({
        pool,
        context,
        idempotencyKey: key1,
        input: mismatchedPayload,
      });
    },
    /IDEMPOTENCY_CONFLICT/,
    'Same key with different payload must fail closed with IDEMPOTENCY_CONFLICT',
  );

  // 4. Concurrent Version Creation (Race Condition Safety)
  const docId = firstRun.result.document.id;
  const parallelVersionCount = 5;

  const results = await Promise.all(
    Array.from({ length: parallelVersionCount }).map((_, idx) =>
      appendDocumentVersionCommand({
        pool,
        context,
        idempotencyKey: `key-concurrent-ver-${idx}`,
        input: {
          documentId: docId,
          mimeType: 'application/pdf',
          byteSize: 2000 + idx,
          sha256Hash: (idx + 2).toString().repeat(64),
          provenance: {
            originType: 'user_upload',
            sourceDomain: 'enrollment',
            method: 'parallel_upload',
            correlationId: `corr-parallel-${idx}`,
          },
        },
      }),
    ),
  );

  // Verify that all 5 appended versions succeeded and each received a unique, gapless version number
  const versionNumbers = results.map((r) => r.result.version.versionNumber).sort((a, b) => a - b);
  assert.deepStrictEqual(
    versionNumbers,
    [2, 3, 4, 5, 6],
    'Concurrent version creation must produce sequential unique version numbers without duplicates or gaps',
  );

  const repo = new PostgresDocumentRepository();
  const allPersisted = await repo.listVersions(client, institutionId, docId);
  assert.strictEqual(allPersisted.length, 6, 'Document must now have 6 versions persisted in total');

  console.log('[DOCUMENTS-IDEMPOTENCY-CONCURRENCY] PASS: Idempotency replay, conflict rejection, and concurrency safety verified.');
} finally {
  try {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } finally {
    client.release();
    await pool.end();
  }
}
