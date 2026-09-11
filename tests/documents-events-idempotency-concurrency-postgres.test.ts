/**
 * Documents Foundation I7 - Events Idempotency, Concurrency & Lease Recovery PostgreSQL Integration Tests
 * Mission: DOCUMENTS-FOUNDATION-I7
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
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
  processDocumentEventWithIdempotency,
} from '../src/modules/documents/document-event-consumer.ts';
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

  it('DUPLICATE_DELIVERY_CONSUMER_IDEMPOTENCY: consumer processes side-effect only once', async () => {
    let sideEffectExecutionCount = 0;
    const consumerId = 'consumer-audit-indexer';

    const client = await pool.connect();
    let eventToConsume: any;
    try {
      eventToConsume = await outboxRepo.insertEvent(client, {
        institutionId,
        eventType: 'document.created',
        aggregateType: 'document',
        aggregateId: randomUUID(),
        payload: { docRef: 'audit-target-1' },
      });
    } finally {
      client.release();
    }

    const handler = async () => {
      sideEffectExecutionCount++;
    };

    // First delivery
    const firstResult = await processDocumentEventWithIdempotency({
      pool,
      institutionId,
      consumerId,
      event: eventToConsume,
      handler,
    });

    assert.equal(firstResult.success, true);
    assert.equal(firstResult.alreadyProcessed, false);
    assert.equal(sideEffectExecutionCount, 1);

    // Duplicate delivery (redelivery)
    const duplicateResult = await processDocumentEventWithIdempotency({
      pool,
      institutionId,
      consumerId,
      event: eventToConsume,
      handler,
    });

    assert.equal(duplicateResult.success, true);
    assert.equal(duplicateResult.alreadyProcessed, true);
    assert.equal(sideEffectExecutionCount, 1, 'Duplicate delivery MUST NOT trigger handler again');
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
      handler: async () => {
        handlerExecuted = true;
      },
    });

    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'UNSUPPORTED_SCHEMA_VERSION');
    assert.equal(handlerExecuted, false, 'Handler must not execute for unsupported schema version');
  });
});
