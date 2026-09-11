/**
 * Documents Foundation I7 - Events Idempotency, Concurrency & Lease Recovery PostgreSQL Integration Tests
 * Mission: DOCUMENTS-FOUNDATION-I7
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg, { type PoolClient } from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import {
  PostgresDocumentOutboxRepository,
  PostgresDocumentConsumerLedgerRepository,
} from '../src/modules/documents/document-event-repository.ts';
import {
  createDocumentWithInitialVersionCommand,
} from '../src/modules/documents/document-command.ts';
import {
  processDocumentOutboxBatchCommand,
} from '../src/modules/documents/document-outbox-command.ts';
import {
  processDocumentEventWithIdempotency,
} from '../src/modules/documents/document-event-consumer.ts';
import type { DocumentOutboxEvent } from '../src/modules/documents/document-event-model.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

await verifyApprovedTestConnection();

const schema = `doc_evt_idem_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionId = '00000000-0000-0000-0000-000000000001';
const adminPersonId = '00000000-0000-0000-0000-000000000002';

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

const outboxRepo = new PostgresDocumentOutboxRepository();
const ledgerRepo = new PostgresDocumentConsumerLedgerRepository();

describe('Documents Events Idempotency & Concurrency Integration (I7)', () => {
  before(async () => {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${quote(schema)}`);
      await client.query(`SET search_path TO ${quote(schema)}, public`);
      const migrations = await discoverMigrations(migrationsDir);
      await runMigrations(client, migrations);

      await client.query(
        `INSERT INTO institutions (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [institutionId, 'Nexus Academy', 'nexus-academy'],
      );
      await client.query(
        `INSERT INTO people (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [adminPersonId, 'Admin Person'],
      );

      // Dedicated persistent side-effects test table to prove atomic PostgreSQL transactions under redelivery/crash
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_consumer_persistent_effects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
          event_id UUID NOT NULL REFERENCES document_outbox_events(id) ON DELETE CASCADE,
          effect_payload TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
    } finally {
      client.release();
    }
  });

  after(async () => {
    const client = await pool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
    } finally {
      client.release();
      await pool.end();
    }
  });

  it('IDEMPOTENT_COMMAND_REPLAY: produces ZERO duplicate outbox events', async () => {
    const idempotencyKey = `idem-replay-test-${randomUUID()}`;

    // First execution
    const firstRes = await createDocumentWithInitialVersionCommand({
      pool,
      context: adminContext,
      idempotencyKey,
      input: {
        category: 'academic_transcript',
        mimeType: 'application/pdf',
        byteSize: 1024,
        sha256Hash: 'd'.repeat(64),
        provenance: {
          originType: 'user_upload',
          sourceDomain: 'documents.intake',
          method: 'api_upload',
        },
      },
    });
    assert.equal(firstRes.replayed, false);

    const client = await pool.connect();
    let eventsAfterFirst: number;
    try {
      const countRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) FROM document_outbox_events WHERE institution_id = $1`,
        [institutionId],
      );
      eventsAfterFirst = Number(countRes.rows[0].count);
      assert.ok(eventsAfterFirst >= 2); // document.created + document.version_created
    } finally {
      client.release();
    }

    // Replay execution with identical key and fingerprint
    const replayRes = await createDocumentWithInitialVersionCommand({
      pool,
      context: adminContext,
      idempotencyKey,
      input: {
        category: 'academic_transcript',
        mimeType: 'application/pdf',
        byteSize: 1024,
        sha256Hash: 'd'.repeat(64),
        provenance: {
          originType: 'user_upload',
          sourceDomain: 'documents.intake',
          method: 'api_upload',
        },
      },
    });
    assert.equal(replayRes.replayed, true);
    assert.equal(replayRes.result.document.id, firstRes.result.document.id);

    // Verify outbox row count did not change
    const checkClient = await pool.connect();
    try {
      const countRes = await checkClient.query<{ count: string }>(
        `SELECT COUNT(*) FROM document_outbox_events WHERE institution_id = $1`,
        [institutionId],
      );
      const eventsAfterReplay = Number(countRes.rows[0].count);
      assert.equal(eventsAfterReplay, eventsAfterFirst, 'Replay MUST NOT create new outbox events');
    } finally {
      checkClient.release();
    }
  });

  it('TWO_CONCURRENT_CLAIMS: workers receive disjoint sets of events (1 worker per event)', async () => {
    const client = await pool.connect();
    try {
      // Seed 6 pending events
      for (let i = 0; i < 6; i++) {
        await outboxRepo.insertEvent(client, {
          institutionId,
          eventType: 'document.created',
          aggregateType: 'document',
          aggregateId: randomUUID(),
          payload: { index: i },
        });
      }
    } finally {
      client.release();
    }

    // Run 2 concurrent worker claims
    const [worker1Events, worker2Events] = await Promise.all([
      (async () => {
        const c = await pool.connect();
        try {
          return await outboxRepo.claimPendingEvents(c, institutionId, 3, 60);
        } finally {
          c.release();
        }
      })(),
      (async () => {
        const c = await pool.connect();
        try {
          return await outboxRepo.claimPendingEvents(c, institutionId, 3, 60);
        } finally {
          c.release();
        }
      })(),
    ]);

    assert.equal(worker1Events.length, 3);
    assert.equal(worker2Events.length, 3);

    const w1Ids = new Set(worker1Events.map((e) => e.id));
    const w2Ids = new Set(worker2Events.map((e) => e.id));

    // Assert intersection is empty (disjoint)
    for (const id of w1Ids) {
      assert.equal(w2Ids.has(id), false, `Event ${id} claimed by both workers! Concurrency violation.`);
    }
  });

  it('CLAIM_CRASH_AND_LEASE_EXPIRY: crashed claim with expired lease is reclaimed', async () => {
    const client = await pool.connect();
    let crashedEventId: string;
    try {
      const inserted = await outboxRepo.insertEvent(client, {
        institutionId,
        eventType: 'document.version_created',
        aggregateType: 'document_version',
        aggregateId: randomUUID(),
        payload: { test: 'lease-expiry' },
      });
      crashedEventId = inserted.id;

      // Simulate a crashed claim by manually setting status='claimed' and claim_expires_at in the past
      await client.query(
        `UPDATE document_outbox_events
            SET status = 'claimed',
                claimed_at = now() - INTERVAL '2 minutes',
                claim_expires_at = now() - INTERVAL '1 minute'
          WHERE institution_id = $1 AND id = $2`,
        [institutionId, crashedEventId],
      );
    } finally {
      client.release();
    }

    // Claim next batch
    const claimClient = await pool.connect();
    try {
      const reclaimed = await outboxRepo.claimPendingEvents(claimClient, institutionId, 10, 60);
      const reclaimedIds = reclaimed.map((e) => e.id);
      assert.ok(
        reclaimedIds.includes(crashedEventId),
        `Crashed event ${crashedEventId} should have been reclaimed after lease expiry`,
      );
    } finally {
      claimClient.release();
    }
  });

  it('DUPLICATE_DELIVERY_PERSISTENT_DB_SIDE_EFFECT_EXACTLY_ONCE: transactional DB mutation occurs exactly once', async () => {
    const consumerId = 'consumer-persistent-indexer';

    const client = await pool.connect();
    let eventToConsume: DocumentOutboxEvent;
    try {
      eventToConsume = await outboxRepo.insertEvent(client, {
        institutionId,
        eventType: 'document.created',
        aggregateType: 'document',
        aggregateId: randomUUID(),
        payload: { docRef: 'persistent-target-1' },
      });
    } finally {
      client.release();
    }

    // Transactional handler writing a real database side effect using the provided transaction client
    const transactionalHandler = async (txClient: PoolClient, evt: DocumentOutboxEvent) => {
      await txClient.query(
        `INSERT INTO test_consumer_persistent_effects (institution_id, event_id, effect_payload) VALUES ($1, $2, $3)`,
        [institutionId, evt.id, JSON.stringify(evt.payload)],
      );
    };

    // First delivery: processes successfully and commits DB side effect + ledger record atomically
    const firstResult = await processDocumentEventWithIdempotency({
      pool,
      institutionId,
      consumerId,
      event: eventToConsume,
      handler: transactionalHandler,
    });

    assert.equal(firstResult.success, true);
    assert.equal(firstResult.alreadyProcessed, false);
    assert.equal(firstResult.executed, true);

    // Verify DB side-effect table has EXACTLY 1 row
    const verifyClient = await pool.connect();
    try {
      const dbRows = await verifyClient.query<{ count: string }>(
        `SELECT COUNT(*) FROM test_consumer_persistent_effects WHERE institution_id = $1 AND event_id = $2`,
        [institutionId, eventToConsume.id],
      );
      assert.equal(Number(dbRows.rows[0].count), 1, 'Exactly 1 DB side-effect row must exist after first delivery');
    } finally {
      verifyClient.release();
    }

    // Second delivery (redelivery): duplicate delivery detected, handler skipped, no duplicate DB side-effect
    const duplicateResult = await processDocumentEventWithIdempotency({
      pool,
      institutionId,
      consumerId,
      event: eventToConsume,
      handler: transactionalHandler,
    });

    assert.equal(duplicateResult.success, true);
    assert.equal(duplicateResult.alreadyProcessed, true);
    assert.equal(duplicateResult.executed, false);

    // Verify DB side-effect table STILL has EXACTLY 1 row
    const recheckClient = await pool.connect();
    try {
      const dbRowsAfterDup = await recheckClient.query<{ count: string }>(
        `SELECT COUNT(*) FROM test_consumer_persistent_effects WHERE institution_id = $1 AND event_id = $2`,
        [institutionId, eventToConsume.id],
      );
      assert.equal(
        Number(dbRowsAfterDup.rows[0].count),
        1,
        'Duplicate delivery MUST NOT create duplicate database rows',
      );
    } finally {
      recheckClient.release();
    }

    // Concurrent duplicate deliveries: 5 concurrent workers processing the same event
    const concurrentDeliveries = await Promise.all(
      Array.from({ length: 5 }).map(() =>
        processDocumentEventWithIdempotency({
          pool,
          institutionId,
          consumerId,
          event: eventToConsume,
          handler: transactionalHandler,
        }),
      ),
    );

    for (const r of concurrentDeliveries) {
      assert.equal(r.success, true);
      assert.equal(r.alreadyProcessed, true);
      assert.equal(r.executed, false);
    }

    // Verify DB side-effect table still remains exactly 1 row
    const finalCheckClient = await pool.connect();
    try {
      const finalCount = await finalCheckClient.query<{ count: string }>(
        `SELECT COUNT(*) FROM test_consumer_persistent_effects WHERE institution_id = $1 AND event_id = $2`,
        [institutionId, eventToConsume.id],
      );
      assert.equal(Number(finalCount.rows[0].count), 1);
    } finally {
      finalCheckClient.release();
    }
  });

  it('CRASH_RETRY_TRANSACTIONAL_SIDE_EFFECT_ROLLBACK: failed handler rolls back persistent side effect and succeeds on retry', async () => {
    const consumerId = 'consumer-crash-retry-test';

    const client = await pool.connect();
    let crashEvent: DocumentOutboxEvent;
    try {
      crashEvent = await outboxRepo.insertEvent(client, {
        institutionId,
        eventType: 'document.created',
        aggregateType: 'document',
        aggregateId: randomUUID(),
        payload: { docRef: 'crash-target-1' },
      });
    } finally {
      client.release();
    }

    let shouldCrash = true;
    const crashingHandler = async (txClient: PoolClient, evt: DocumentOutboxEvent) => {
      // Perform persistent DB insert
      await txClient.query(
        `INSERT INTO test_consumer_persistent_effects (institution_id, event_id, effect_payload) VALUES ($1, $2, $3)`,
        [institutionId, evt.id, JSON.stringify(evt.payload)],
      );

      if (shouldCrash) {
        throw new Error('SIMULATED_CONSUMER_CRASH_DURING_PROCESSING');
      }
    };

    // Attempt 1: Handler crashes -> atomic transaction rollback
    await assert.rejects(
      async () => {
        await processDocumentEventWithIdempotency({
          pool,
          institutionId,
          consumerId,
          event: crashEvent,
          handler: crashingHandler,
        });
      },
      /SIMULATED_CONSUMER_CRASH_DURING_PROCESSING/,
    );

    // Verify DB side-effect table and ledger have 0 rows (fully rolled back!)
    const verifyClient = await pool.connect();
    try {
      const sideEffectsRes = await verifyClient.query<{ count: string }>(
        `SELECT COUNT(*) FROM test_consumer_persistent_effects WHERE institution_id = $1 AND event_id = $2`,
        [institutionId, crashEvent.id],
      );
      assert.equal(Number(sideEffectsRes.rows[0].count), 0, 'Side-effect table must have 0 rows after crash rollback');

      const ledgerRes = await verifyClient.query<{ count: string }>(
        `SELECT COUNT(*) FROM document_event_consumer_ledger WHERE institution_id = $1 AND event_id = $2`,
        [institutionId, crashEvent.id],
      );
      assert.equal(Number(ledgerRes.rows[0].count), 0, 'Consumer ledger must have 0 rows after crash rollback');
    } finally {
      verifyClient.release();
    }

    // Attempt 2: Retry succeeds
    shouldCrash = false;
    const retryResult = await processDocumentEventWithIdempotency({
      pool,
      institutionId,
      consumerId,
      event: crashEvent,
      handler: crashingHandler,
    });

    assert.equal(retryResult.success, true);
    assert.equal(retryResult.alreadyProcessed, false);
    assert.equal(retryResult.executed, true);

    // Verify DB side-effect table and ledger now have EXACTLY 1 row
    const retryVerifyClient = await pool.connect();
    try {
      const sideEffectsRes = await retryVerifyClient.query<{ count: string }>(
        `SELECT COUNT(*) FROM test_consumer_persistent_effects WHERE institution_id = $1 AND event_id = $2`,
        [institutionId, crashEvent.id],
      );
      assert.equal(Number(sideEffectsRes.rows[0].count), 1, 'Side-effect table must have 1 row after successful retry');

      const ledgerRes = await retryVerifyClient.query<{ count: string }>(
        `SELECT COUNT(*) FROM document_event_consumer_ledger WHERE institution_id = $1 AND event_id = $2`,
        [institutionId, crashEvent.id],
      );
      assert.equal(Number(ledgerRes.rows[0].count), 1, 'Consumer ledger must have 1 row after successful retry');
    } finally {
      retryVerifyClient.release();
    }
  });

  it('UNSUPPORTED_SCHEMA_VERSION: consumer fails closed and does not record success', async () => {
    const consumerId = 'consumer-strict-schema';
    const unsupportedEvent: any = {
      id: randomUUID(),
      institutionId,
      eventType: 'document.created',
      schemaVersion: '99.0', // Unsupported version
      aggregateType: 'document',
      aggregateId: randomUUID(),
      occurredAt: new Date(),
      actorPersonId: null,
      actorKind: 'system',
      correlationId: null,
      causationId: null,
      payload: { valid: true },
      status: 'pending',
      attempts: 0,
      maxAttempts: 5,
      nextAttemptAt: new Date(),
      claimedAt: null,
      claimExpiresAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      publishedAt: null,
      deadLetteredAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let handlerExecuted = false;
    const result = await processDocumentEventWithIdempotency({
      pool,
      institutionId,
      consumerId,
      event: unsupportedEvent,
      handler: async (_client, _event) => {
        handlerExecuted = true;
      },
    });

    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'UNSUPPORTED_SCHEMA_VERSION');
    assert.equal(handlerExecuted, false, 'Handler must not execute for unsupported schema version');
  });

  it('FORGED_WORKER_AUTHORITY: rejected with UNAUTHORIZED_WORKER_AUTHORITY and claims ZERO events', async () => {
    // Insert a pending event
    const client = await pool.connect();
    let pendingEvtId: string;
    try {
      const inserted = await outboxRepo.insertEvent(client, {
        institutionId,
        eventType: 'document.created',
        aggregateType: 'document',
        aggregateId: randomUUID(),
        payload: { doc: 'forged-authority-test' },
      });
      pendingEvtId = inserted.id;
    } finally {
      client.release();
    }

    // Attempt batch processing with forged worker authority
    let claimedCount = 0;
    await assert.rejects(
      async () => {
        const res = await processDocumentOutboxBatchCommand({
          pool,
          authority: {
            institutionId,
            workerId: 'forged-worker-99',
            workerRole: 'system_worker',
            authorizedAt: new Date(),
          } as any,
          operationalPolicy: {
            batchSize: 10,
            leaseDurationSeconds: 30,
            maxAttempts: 3,
            calculateBackoffSeconds: () => 10,
          },
          dispatcher: async () => {
            claimedCount++;
          },
        });
        claimedCount = res.claimedCount;
      },
      /UNAUTHORIZED_WORKER_AUTHORITY/,
    );

    assert.equal(claimedCount, 0, 'ZERO events must be claimed or dispatched when authority is forged');

    // Verify pending event was NOT claimed
    const checkClient = await pool.connect();
    try {
      const evt = await outboxRepo.getEventById(checkClient, institutionId, pendingEvtId);
      assert.ok(evt != null);
      assert.equal(evt.status, 'pending');
      assert.equal(evt.claimedAt, null);
    } finally {
      checkClient.release();
    }
  });
});
