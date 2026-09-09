import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import {
  createDocumentAssociationCommand,
  pinAssociationToVersionCommand,
  transitionAssociationStatusCommand,
  recordBusinessDecisionReferenceCommand,
} from '../src/modules/documents/document-association-command.ts';

await verifyApprovedTestConnection();

const schema = `doc_assoc_idemp_${randomUUID().replaceAll('-', '')}`;
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

  const docRepo = new PostgresDocumentRepository();
  const doc = await docRepo.createDocument(client, {
    institutionId,
    category: 'identity_proof',
    createdByPersonId: personId,
  });

  const { version: ver1 } = await docRepo.createNextVersion(client, {
    institutionId,
    documentId: doc.id,
    mimeType: 'application/pdf',
    byteSize: 1024,
    sha256Hash: 'a'.repeat(64),
    createdByPersonId: personId,
    provenance: {
      originType: 'user_upload',
      sourceDomain: 'portal',
      method: 'upload',
    },
  });

  // 1. Sequential Idempotency Replay
  const key1 = 'key-assoc-create-001';
  const payload1 = {
    documentId: doc.id,
    targetDomain: 'enrollment',
    targetResourceType: 'enrollment_application',
    targetResourceId: 'app-100',
    purpose: 'identity_proof',
  };

  const firstRun = await createDocumentAssociationCommand({
    pool,
    context,
    idempotencyKey: key1,
    input: payload1,
  });

  assert.strictEqual(firstRun.replayed, false);
  assert.ok(firstRun.result.id);

  const replayRun = await createDocumentAssociationCommand({
    pool,
    context,
    idempotencyKey: key1,
    input: payload1,
  });

  assert.strictEqual(replayRun.replayed, true);
  assert.strictEqual(replayRun.result.id, firstRun.result.id);

  // 2. Mismatched Fingerprint Rejection
  await assert.rejects(
    async () => {
      await createDocumentAssociationCommand({
        pool,
        context,
        idempotencyKey: key1,
        input: {
          ...payload1,
          purpose: 'different_purpose',
        },
      });
    },
    /IDEMPOTENCY_CONFLICT/,
  );

  // 3. True Parallel Race (Same Key, Same Fingerprint)
  const raceKey = 'key-assoc-race-same-fingerprint';
  const racePayload = {
    documentId: doc.id,
    targetDomain: 'academic',
    targetResourceType: 'student_record',
    targetResourceId: 'req-500',
    purpose: 'credit_transfer',
  };

  const concurrentCount = 4;
  const raceResults = await Promise.all(
    Array.from({ length: concurrentCount }).map(() =>
      createDocumentAssociationCommand({
        pool,
        context,
        idempotencyKey: raceKey,
        input: racePayload,
      }),
    ),
  );

  const executedCount = raceResults.filter((r) => !r.replayed).length;
  const replayedCount = raceResults.filter((r) => r.replayed).length;
  assert.strictEqual(executedCount, 1, 'Exactly one concurrent request must execute');
  assert.strictEqual(replayedCount, concurrentCount - 1, 'Remaining concurrent requests must resolve by replay');

  const uniqueAssocIds = new Set(raceResults.map((r) => r.result.id));
  assert.strictEqual(uniqueAssocIds.size, 1, 'All concurrent requests must return identical association ID');

  // 4. Concurrent Conflict Race (Same Key, Different Fingerprint)
  const conflictKey = 'key-assoc-race-conflict';
  const conflictA = { ...racePayload, targetResourceId: 'conflict-res-a' };
  const conflictB = { ...racePayload, targetResourceId: 'conflict-res-b' };

  const conflictResults = await Promise.allSettled([
    createDocumentAssociationCommand({ pool, context, idempotencyKey: conflictKey, input: conflictA }),
    createDocumentAssociationCommand({ pool, context, idempotencyKey: conflictKey, input: conflictB }),
  ]);

  const fulfilled = conflictResults.filter((r) => r.status === 'fulfilled');
  const rejected = conflictResults.filter((r) => r.status === 'rejected');
  assert.strictEqual(fulfilled.length, 1, 'Exactly one contestant in conflict race must succeed');
  assert.strictEqual(rejected.length, 1, 'Contestant with conflicting fingerprint must fail closed');
  assert.match(
    (rejected[0] as PromiseRejectedResult).reason.message,
    /IDEMPOTENCY_CONFLICT/,
  );

  // 5. Concurrent Status Transitions (Withdraw vs Close Race on same association)
  const assocToRace = firstRun.result.id;

  const transitionResults = await Promise.allSettled([
    transitionAssociationStatusCommand({
      pool,
      context,
      idempotencyKey: 'key-trans-race-withdrawn',
      input: { associationId: assocToRace, targetStatus: 'withdrawn' },
    }),
    transitionAssociationStatusCommand({
      pool,
      context,
      idempotencyKey: 'key-trans-race-closed',
      input: { associationId: assocToRace, targetStatus: 'closed' },
    }),
  ]);

  const transFulfilled = transitionResults.filter((r) => r.status === 'fulfilled');
  const transRejected = transitionResults.filter((r) => r.status === 'rejected');

  assert.strictEqual(transFulfilled.length, 1, 'Exactly one transition must succeed');
  assert.strictEqual(transRejected.length, 1, 'Second transition on terminal status must fail closed');
  assert.match(
    (transRejected[0] as PromiseRejectedResult).reason.message,
    /Cannot transition from terminal state/,
  );

  // 5.1 Terminal Status Immutability Evidence:
  // Query state after terminal transition
  const checkAssocQuery = await client.query<{ status: string; updated_at: Date }>(
    `SELECT status, updated_at FROM document_associations WHERE institution_id = $1 AND id = $2`,
    [institutionId, assocToRace],
  );
  const terminalStatus = checkAssocQuery.rows[0].status;
  const originalUpdatedAt = checkAssocQuery.rows[0].updated_at;

  const countAuditsBefore = await client.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM document_audit_events WHERE institution_id = $1`,
    [institutionId],
  );

  // Retry same terminal state as a NEW command -> REJECTED
  await assert.rejects(
    async () => {
      await transitionAssociationStatusCommand({
        pool,
        context,
        idempotencyKey: 'key-trans-retry-same-terminal-new-command',
        input: { associationId: assocToRace, targetStatus: terminalStatus as any },
      });
    },
    /Cannot transition from terminal state/,
    'Attempting same terminal transition with new command must be rejected',
  );

  // Transition to another terminal state as a NEW command -> REJECTED
  await assert.rejects(
    async () => {
      await transitionAssociationStatusCommand({
        pool,
        context,
        idempotencyKey: 'key-trans-to-other-terminal',
        input: { associationId: assocToRace, targetStatus: 'superseded' },
      });
    },
    /Cannot transition from terminal state/,
    'Attempting different terminal transition with new command must be rejected',
  );

  // Verify NO MUTATION on failed attempts
  const checkAssocAfter = await client.query<{ status: string; updated_at: Date }>(
    `SELECT status, updated_at FROM document_associations WHERE institution_id = $1 AND id = $2`,
    [institutionId, assocToRace],
  );
  assert.strictEqual(
    checkAssocAfter.rows[0].updated_at.getTime(),
    originalUpdatedAt.getTime(),
    'updated_at must remain unchanged after rejected terminal transitions',
  );

  // Verify NO SUCCESS AUDIT generated on rejected attempts
  const countAuditsAfter = await client.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM document_audit_events WHERE institution_id = $1`,
    [institutionId],
  );
  assert.strictEqual(
    countAuditsAfter.rows[0].count,
    countAuditsBefore.rows[0].count,
    'No success audit event may be recorded for failed transitions',
  );

  // 6. Concurrent Business Decision Reference Recording Idempotency
  const decisionKey = 'key-decision-idemp-01';
  const decisionPayload = {
    associationId: raceResults[0].result.id,
    documentId: doc.id,
    versionId: ver1.id,
    authorityDomain: 'academic',
    decisionType: 'transfer_credit_evaluation',
    decisionOutcome: 'accepted' as const,
    decisionReason: 'Credits verified',
    externalReference: 'req-500:step-1',
  };

  const decResults = await Promise.all([
    recordBusinessDecisionReferenceCommand({
      pool,
      context,
      idempotencyKey: decisionKey,
      input: decisionPayload,
    }),
    recordBusinessDecisionReferenceCommand({
      pool,
      context,
      idempotencyKey: decisionKey,
      input: decisionPayload,
    }),
  ]);

  assert.strictEqual(decResults.filter((r) => !r.replayed).length, 1);
  assert.strictEqual(decResults.filter((r) => r.replayed).length, 1);
  assert.strictEqual(decResults[0].result.id, decResults[1].result.id);

  console.log('[DOCUMENTS-ASSOCIATION-IDEMPOTENCY-CONCURRENCY] PASS: Association idempotency, concurrency races, and transition safety verified.');
} finally {
  try {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } finally {
    client.release();
    await pool.end();
  }
}
