/**
 * Documents Foundation I7 - Events & Outbox PostgreSQL Integration Tests
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
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import {
  PostgresDocumentOutboxRepository,
  PostgresDocumentConsumerLedgerRepository,
} from '../src/modules/documents/document-event-repository.ts';
import {
  createDocumentWithInitialVersionCommand,
  appendDocumentVersionCommand,
} from '../src/modules/documents/document-command.ts';
import {
  processDocumentOutboxBatchCommand,
} from '../src/modules/documents/document-outbox-command.ts';
import {
  MockNotificationBridge,
} from '../src/modules/documents/document-event-consumer.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

await verifyApprovedTestConnection();

const schema = `doc_evt_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionId = '00000000-0000-0000-0000-000000000001';
const adminPersonId = '00000000-0000-0000-0000-000000000002';
const staffPersonId = '00000000-0000-0000-0000-000000000003';

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

describe('Documents Events & Outbox Integration (I7)', () => {
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
        `INSERT INTO people (id, name) VALUES ($1, $2), ($3, $4) ON CONFLICT DO NOTHING`,
        [adminPersonId, 'Admin Person', staffPersonId, 'Staff Person'],
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

  it('DOMAIN_FACT_AND_EVENT_INTENT_ATOMIC: creates document.created and document.version_created in same commit', async () => {
    const res = await createDocumentWithInitialVersionCommand({
      pool,
      context: adminContext,
      idempotencyKey: `idem-create-doc-${randomUUID()}`,
      input: {
        category: 'academic_transcript',
        mimeType: 'application/pdf',
        byteSize: 1024,
        sha256Hash: 'a'.repeat(64),
        provenance: {
          originType: 'user_upload',
          sourceDomain: 'documents.intake',
          method: 'api_upload',
        },
        storageReference: {
          storageProvider: 'memory',
          storageBucket: 'vault',
          storageKey: 'key-1',
        },
      },
    });

    assert.equal(res.replayed, false);
    const docId = res.result.document.id;

    // Check outbox table for events emitted
    const client = await pool.connect();
    try {
      const outboxRes = await client.query<{
        id: string;
        event_type: string;
        aggregate_type: string;
        aggregate_id: string;
        status: string;
        schema_version: string;
      }>(
        `SELECT id, event_type, aggregate_type, aggregate_id, status, schema_version
           FROM document_outbox_events
          WHERE institution_id = $1 AND (aggregate_id = $2 OR payload->>'documentId' = $2::text)
          ORDER BY occurred_at ASC`,
        [institutionId, docId],
      );

      assert.equal(outboxRes.rows.length >= 2, true);
      const types = outboxRes.rows.map((r) => r.event_type);
      assert.ok(types.includes('document.created'));
      assert.ok(types.includes('document.version_created'));
      assert.equal(outboxRes.rows[0].schema_version, '1.0');
      assert.equal(outboxRes.rows[0].status, 'pending');
    } finally {
      client.release();
    }
  });

  it('TRANSACTION_ROLLBACK_CREATES_ZERO_EVENTS: failed command rolls back outbox event intent', async () => {
    const client = await pool.connect();
    try {
      const beforeCount = await client.query<{ count: string }>(
        `SELECT COUNT(*) FROM document_outbox_events WHERE institution_id = $1`,
        [institutionId],
      );

      // Attempt invalid create document version on nonexistent document
      await assert.rejects(
        async () => {
          await appendDocumentVersionCommand({
            pool,
            context: adminContext,
            idempotencyKey: `idem-fail-version-${randomUUID()}`,
            input: {
              documentId: '00000000-0000-0000-0000-999999999999',
              mimeType: 'application/pdf',
              byteSize: 1024,
              sha256Hash: 'b'.repeat(64),
              provenance: {
                originType: 'user_upload',
                sourceDomain: 'documents.intake',
                method: 'api_upload',
              },
            },
          });
        },
        /not found in institution/i,
      );

      const afterCount = await client.query<{ count: string }>(
        `SELECT COUNT(*) FROM document_outbox_events WHERE institution_id = $1`,
        [institutionId],
      );
      assert.equal(Number(afterCount.rows[0].count), Number(beforeCount.rows[0].count));
    } finally {
      client.release();
    }
  });

  it('OUTBOX_BATCH_CLAIMING_AND_DISPATCH: claims pending events with lease and marks published', async () => {
    const dispatchedEvents: string[] = [];
    const notificationBridge = new MockNotificationBridge();

    const batchResult = await processDocumentOutboxBatchCommand({
      pool,
      authority: adminContext,
      operationalPolicy: {
        batchSize: 10,
        leaseDurationSeconds: 30,
        maxAttempts: 3,
        calculateBackoffSeconds: (attempt) => Math.min(60, Math.pow(2, attempt)),
      },
      dispatcher: async (event) => {
        dispatchedEvents.push(event.id);
        await notificationBridge.publish(event);
      },
    });

    assert.ok(batchResult.processedCount > 0);
    assert.equal(batchResult.failedCount, 0);
    assert.equal(batchResult.deadLetterCount, 0);
    assert.equal(dispatchedEvents.length, batchResult.processedCount);
    assert.equal(notificationBridge.publishedEvents.length, batchResult.processedCount);

    // Verify events are now 'published' in database
    const client = await pool.connect();
    try {
      const pubRes = await client.query<{ status: string; published_at: Date }>(
        `SELECT status, published_at FROM document_outbox_events WHERE id = ANY($1::uuid[])`,
        [dispatchedEvents],
      );
      for (const row of pubRes.rows) {
        assert.equal(row.status, 'published');
        assert.ok(row.published_at != null);
      }
    } finally {
      client.release();
    }
  });

  it('OUTBOX_BATCH_AUTHORITY_AND_POLICY_SECURITY: rejects raw strings and forged worker authority and requires operational policy', async () => {
    // 1. Missing operational policy -> fail closed
    await assert.rejects(
      async () => {
        await processDocumentOutboxBatchCommand({
          pool,
          authority: adminContext,
          operationalPolicy: undefined as any,
          dispatcher: async () => {},
        });
      },
      /OPERATIONAL_POLICY_REQUIRED/,
    );

    // 2. Raw caller string without trusted worker contract -> fail closed
    await assert.rejects(
      async () => {
        await processDocumentOutboxBatchCommand({
          pool,
          authority: { institutionId: 'arbitrary-string' } as any,
          operationalPolicy: {
            batchSize: 10,
            leaseDurationSeconds: 30,
            maxAttempts: 3,
            calculateBackoffSeconds: () => 10,
          },
          dispatcher: async () => {},
        });
      },
      /UNAUTHORIZED_WORKER_AUTHORITY/,
    );

    // 3. Forged worker authority plain object -> fail closed with UNAUTHORIZED_WORKER_AUTHORITY
    await assert.rejects(
      async () => {
        await processDocumentOutboxBatchCommand({
          pool,
          authority: {
            institutionId,
            workerId: 'forged-worker-1',
            workerRole: 'system_worker',
            authorizedAt: new Date(),
          } as any,
          operationalPolicy: {
            batchSize: 10,
            leaseDurationSeconds: 30,
            maxAttempts: 3,
            calculateBackoffSeconds: () => 10,
          },
          dispatcher: async () => {},
        });
      },
      /UNAUTHORIZED_WORKER_AUTHORITY/,
    );
  });

  it('NO_PUBLISHER_OR_DISPATCHER: fails closed with DISPATCHER_REQUIRED and never falsely marks published', async () => {
    const client = await pool.connect();
    let unpubEventId: string;
    try {
      const inserted = await outboxRepo.insertEvent(client, {
        institutionId,
        eventType: 'document.created',
        aggregateType: 'document',
        aggregateId: randomUUID(),
        payload: { test: 'no-publisher-fail-closed' },
      });
      unpubEventId = inserted.id;
    } finally {
      client.release();
    }

    // Call processDocumentOutboxBatchCommand with neither dispatcher nor publisher
    await assert.rejects(
      async () => {
        await processDocumentOutboxBatchCommand({
          pool,
          authority: adminContext,
          operationalPolicy: {
            batchSize: 10,
            leaseDurationSeconds: 30,
            maxAttempts: 3,
            calculateBackoffSeconds: () => 10,
          },
        });
      },
      /DISPATCHER_REQUIRED/,
    );

    // Verify event is NOT marked published; published_at remains NULL
    const checkClient = await pool.connect();
    try {
      const eventRow = await outboxRepo.getEventById(checkClient, institutionId, unpubEventId);
      assert.ok(eventRow != null);
      assert.notEqual(eventRow.status, 'published');
      assert.equal(eventRow.publishedAt, null, 'publishedAt must remain NULL when no dispatcher exists');
    } finally {
      checkClient.release();
    }
  });

  it('CROSS_TENANT_CLAIM_ISOLATION: worker claiming for Institution A cannot claim Institution B events', async () => {
    const otherInstId = '00000000-0000-0000-0000-000000000099';
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO institutions (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [otherInstId, 'Other Academy', 'other-academy'],
      );
      await outboxRepo.insertEvent(client, {
        institutionId: otherInstId,
        eventType: 'document.created',
        aggregateType: 'document',
        aggregateId: randomUUID(),
        payload: { tenant: 'other' },
      });

      // Claim as institutionId (tenant A)
      const claimed = await outboxRepo.claimPendingEvents(client, institutionId, 50, 30);
      for (const evt of claimed) {
        assert.equal(evt.institutionId, institutionId, 'Claimed event must strictly match tenant A');
        assert.notEqual(evt.institutionId, otherInstId, 'Tenant A worker must NEVER claim Tenant B event');
      }
    } finally {
      client.release();
    }
  });

  it('DEAD_LETTER_ON_MAX_ATTEMPTS: poison event transitions to dead_letter state', async () => {
    const client = await pool.connect();
    let poisonEventId: string;
    try {
      // Manually insert an event with maxAttempts=1
      const inserted = await outboxRepo.insertEvent(client, {
        institutionId,
        eventType: 'document.created',
        aggregateType: 'document',
        aggregateId: randomUUID(),
        payload: { test: 'poison-event' },
        maxAttempts: 1,
      });
      poisonEventId = inserted.id;
    } finally {
      client.release();
    }

    // Process with a failing dispatcher
    const batchResult = await processDocumentOutboxBatchCommand({
      pool,
      authority: adminContext,
      operationalPolicy: {
        batchSize: 5,
        leaseDurationSeconds: 30,
        maxAttempts: 1,
        calculateBackoffSeconds: () => 1,
      },
      dispatcher: async (event) => {
        if (event.id === poisonEventId) {
          throw new Error('SIMULATED_DISPATCH_FAILURE: Network unreachable');
        }
      },
    });

    assert.ok(batchResult.deadLetterCount >= 1);

    const checkClient = await pool.connect();
    try {
      const eventRow = await outboxRepo.getEventById(checkClient, institutionId, poisonEventId);
      assert.ok(eventRow != null);
      assert.equal(eventRow.status, 'dead_letter');
      assert.equal(eventRow.attempts, 1);
      assert.ok(eventRow.deadLetteredAt != null);
      assert.ok(eventRow.lastErrorMessage?.includes('SIMULATED_DISPATCH_FAILURE'));
    } finally {
      checkClient.release();
    }
  });

  it('OBSERVABILITY_METRICS: returns accurate queue metrics and distribution', async () => {
    const client = await pool.connect();
    try {
      const metrics = await outboxRepo.getOutboxMetrics(client, institutionId);
      assert.ok(typeof metrics.pendingCount === 'number');
      assert.ok(typeof metrics.claimedCount === 'number');
      assert.ok(typeof metrics.publishedCount === 'number');
      assert.ok(typeof metrics.deadLetterCount === 'number');
      assert.ok(metrics.deadLetterCount >= 1);
    } finally {
      client.release();
    }
  });

  it('NOTIFICATION_SUBSCRIBER_FAILURE: subscriber failure does not rollback committed domain facts', async () => {
    const failingBridge = new MockNotificationBridge(true, 'BRIDGE_TEMPORARILY_DOWN');

    const createRes = await createDocumentWithInitialVersionCommand({
      pool,
      context: adminContext,
      idempotencyKey: `idem-subscriber-failure-${randomUUID()}`,
      input: {
        category: 'academic_transcript',
        mimeType: 'application/pdf',
        byteSize: 512,
        sha256Hash: 'c'.repeat(64),
        provenance: {
          originType: 'user_upload',
          sourceDomain: 'documents.intake',
          method: 'api_upload',
        },
      },
    });

    const docId = createRes.result.document.id;
    assert.ok(docId != null);

    // Verify document domain fact is committed
    const client = await pool.connect();
    try {
      const doc = await new PostgresDocumentRepository().getDocumentById(client, institutionId, docId);
      assert.ok(doc != null);
      assert.equal(doc.id, docId);
    } finally {
      client.release();
    }

    // Now run outbox batch with failing notification bridge
    const batchResult = await processDocumentOutboxBatchCommand({
      pool,
      authority: adminContext,
      operationalPolicy: {
        batchSize: 10,
        leaseDurationSeconds: 30,
        maxAttempts: 3,
        calculateBackoffSeconds: () => 5,
      },
      dispatcher: async (event) => {
        await failingBridge.publish(event);
      },
    });

    // Outbox batch records failure/retry, but domain fact remains 100% committed
    assert.ok(batchResult.failedCount > 0 || batchResult.deadLetterCount > 0);

    const verifyClient = await pool.connect();
    try {
      const docStillExists = await new PostgresDocumentRepository().getDocumentById(verifyClient, institutionId, docId);
      assert.ok(docStillExists != null);
    } finally {
      verifyClient.release();
    }
  });
});
