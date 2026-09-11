/**
 * Documents Foundation I7 - Multi-Tenant Negative PostgreSQL Integration Tests
 * Mission: DOCUMENTS-FOUNDATION-I7
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import {
  PostgresDocumentOutboxRepository,
  PostgresDocumentConsumerLedgerRepository,
} from '../src/modules/documents/document-event-repository.ts';

await verifyApprovedTestConnection();

const schema = `doc_evt_tenant_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionA = '00000000-0000-0000-0000-000000000001';
const institutionB = '00000000-0000-0000-0000-000000000002';
const personA = '00000000-0000-0000-0000-000000000010';
const personB = '00000000-0000-0000-0000-000000000020';

const outboxRepo = new PostgresDocumentOutboxRepository();
const ledgerRepo = new PostgresDocumentConsumerLedgerRepository();

describe('Documents Events Multi-Tenant Negative Security Tests (I7)', () => {
  before(async () => {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${quote(schema)}`);
      await client.query(`SET search_path TO ${quote(schema)}, public`);
      const migrations = await discoverMigrations(migrationsDir);
      await runMigrations(client, migrations);

      await client.query(
        `INSERT INTO institutions (id, name, slug) VALUES ($1, $2, $3), ($4, $5, $6) ON CONFLICT DO NOTHING`,
        [institutionA, 'Institution Alpha', 'inst-alpha', institutionB, 'Institution Beta', 'inst-beta'],
      );
      await client.query(
        `INSERT INTO people (id, name) VALUES ($1, $2), ($3, $4) ON CONFLICT DO NOTHING`,
        [personA, 'Actor A', personB, 'Actor B'],
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

  it('CROSS_TENANT_READ_DENIED: Institution B cannot read Institution A outbox event', async () => {
    const client = await pool.connect();
    let eventAId: string;
    try {
      const eventA = await outboxRepo.insertEvent(client, {
        institutionId: institutionA,
        eventType: 'document.created',
        aggregateType: 'document',
        aggregateId: randomUUID(),
        actorPersonId: personA,
        payload: { sensitive: 'Institution Alpha Confidential Data' },
      });
      eventAId = eventA.id;

      // Institution A can read its own event
      const readByA = await outboxRepo.getEventById(client, institutionA, eventAId);
      assert.ok(readByA != null);
      assert.equal(readByA.id, eventAId);

      // Institution B querying the same event ID returns null
      const readByB = await outboxRepo.getEventById(client, institutionB, eventAId);
      assert.equal(readByB, null, 'Institution B must not read Institution A event');
    } finally {
      client.release();
    }
  });

  it('CROSS_TENANT_CLAIM_DENIED: Institution B cannot claim Institution A pending events', async () => {
    const client = await pool.connect();
    try {
      // Seed an event for Institution A only
      await outboxRepo.insertEvent(client, {
        institutionId: institutionA,
        eventType: 'document.upload_completed',
        aggregateType: 'document',
        aggregateId: randomUUID(),
        actorPersonId: personA,
        payload: { file: 'transcript_a.pdf' },
      });

      // Institution B attempts to claim pending events
      const claimedByB = await outboxRepo.claimPendingEvents(client, institutionB, 10, 60);
      assert.equal(claimedByB.length, 0, 'Institution B must claim 0 events from Institution A');

      // Institution A claims and gets its pending event
      const claimedByA = await outboxRepo.claimPendingEvents(client, institutionA, 10, 60);
      assert.ok(claimedByA.length >= 1);
      for (const evt of claimedByA) {
        assert.equal(evt.institutionId, institutionA);
      }
    } finally {
      client.release();
    }
  });

  it('CROSS_TENANT_ACK_AND_PUBLISH_DENIED: Institution B cannot mark Institution A event published', async () => {
    const client = await pool.connect();
    try {
      const eventA = await outboxRepo.insertEvent(client, {
        institutionId: institutionA,
        eventType: 'document.version_created',
        aggregateType: 'document_version',
        aggregateId: randomUUID(),
        payload: { ver: 1 },
      });

      // Claim as Institution A
      const claimed = await outboxRepo.claimPendingEvents(client, institutionA, 10, 60);
      const claimedEventA = claimed.find((e) => e.id === eventA.id);
      assert.ok(claimedEventA != null);

      // Institution B attempts to mark Institution A event as published
      const publishByB = await outboxRepo.markEventPublished(client, institutionB, eventA.id);
      assert.equal(publishByB, false, 'Institution B must not be able to mark Institution A event published');

      // Institution B attempts to mark Institution A event as failed
      const failByB = await outboxRepo.markEventFailed(client, institutionB, eventA.id, {
        errorCode: 'ERR_HACK',
        errorMessage: 'Unauthorized state update',
        backoffSeconds: 10,
        policyMaxAttempts: 3,
      });
      assert.equal(failByB, false, 'Institution B must not be able to fail Institution A event');

      // Institution A successfully marks it published
      const publishByA = await outboxRepo.markEventPublished(client, institutionA, eventA.id);
      assert.equal(publishByA, true);
    } finally {
      client.release();
    }
  });

  it('CROSS_TENANT_LEDGER_DENIED: Institution B cannot inspect or mutate Institution A consumer ledger', async () => {
    const client = await pool.connect();
    const consumerId = 'notification-worker';
    try {
      const eventA = await outboxRepo.insertEvent(client, {
        institutionId: institutionA,
        eventType: 'document.created',
        aggregateType: 'document',
        aggregateId: randomUUID(),
        payload: { validRef: 'doc-alpha-1' },
      });
      const eventId = eventA.id;

      // Record ledger entry for Institution A
      const recordedA = await ledgerRepo.recordProcessed(client, {
        institutionId: institutionA,
        consumerId,
        eventId,
        status: 'completed',
        result: { delivered: true },
      });
      assert.equal(recordedA.inserted, true);

      // Institution B checks if event was processed -> should return null
      const checkB = await ledgerRepo.getEntry(client, institutionB, consumerId, eventId);
      assert.equal(checkB, null, 'Institution B must not see Institution A ledger entries');

      // Institution B cannot record ledger entry for Institution A's eventId (foreign key + tenant check)
      const isAProcessedForB = await ledgerRepo.isEventProcessed(client, institutionB, consumerId, eventId);
      assert.equal(isAProcessedForB, false);
    } finally {
      client.release();
    }
  });

  it('CROSS_TENANT_OBSERVABILITY_METRICS_ISOLATED: Institution B metrics reflect only Institution B', async () => {
    const client = await pool.connect();
    try {
      const metricsB = await outboxRepo.getOutboxMetrics(client, institutionB);
      assert.equal(metricsB.pendingCount, 0);
      assert.equal(metricsB.claimedCount, 0);
      assert.equal(metricsB.deadLetterCount, 0);
    } finally {
      client.release();
    }
  });
});
