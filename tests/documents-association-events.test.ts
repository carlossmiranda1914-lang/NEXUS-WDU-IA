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
  transitionAssociationStatusCommand,
} from '../src/modules/documents/document-association-command.ts';
import {
  validateEventPayloadSecurity,
  type DocumentOutboxEvent,
} from '../src/modules/documents/document-event-model.ts';

await verifyApprovedTestConnection();

const schema = `doc_assoc_evt_${randomUUID().replaceAll('-', '')}`;
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
  personName: 'Test Administrator',
  identityEmail: 'admin@nexus.edu',
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
    `INSERT INTO people (id, name) VALUES ($1, 'Test Administrator')`,
    [personId],
  );

  const docRepo = new PostgresDocumentRepository();
  const doc = await docRepo.createDocument(client, {
    institutionId,
    category: 'identity_proof',
    createdByPersonId: personId,
  });

  console.log('[TEST 1] Create association -> withdraw -> verify persistence, audit, and outbox event');
  const createRes = await createDocumentAssociationCommand({
    pool,
    context,
    idempotencyKey: 'idemp-assoc-evt-create-1',
    input: {
      documentId: doc.id,
      targetDomain: 'enrollment',
      targetResourceType: 'enrollment_application',
      targetResourceId: 'app-uuid-1',
      purpose: 'enrollment_verification',
    },
  });
  const assocId = createRes.result.id;
  assert.strictEqual(createRes.result.status, 'active');

  // Verify create outbox event was recorded
  const createEvtRes = await client.query<DocumentOutboxEvent>(
    `SELECT event_type, aggregate_type, aggregate_id, payload
       FROM document_outbox_events
      WHERE institution_id = $1 AND aggregate_id = $2 AND event_type = 'document.association_created'`,
    [institutionId, assocId],
  );
  assert.strictEqual(createEvtRes.rows.length, 1, 'Exactly 1 create event in outbox');

  // Execute withdrawal
  const withdrawKey = 'idemp-assoc-evt-withdraw-1';
  const withdrawRes = await transitionAssociationStatusCommand({
    pool,
    context,
    idempotencyKey: withdrawKey,
    expectedDocumentId: doc.id,
    input: {
      associationId: assocId,
      targetStatus: 'withdrawn',
      reason: 'superseded_by_new_passport',
    },
  });

  assert.strictEqual(withdrawRes.replayed, false);
  assert.strictEqual(withdrawRes.result.status, 'withdrawn');

  // 1. Verify Persistence
  const dbAssoc = await client.query<{ status: string }>(
    `SELECT status FROM document_associations WHERE institution_id = $1 AND id = $2`,
    [institutionId, assocId],
  );
  assert.strictEqual(dbAssoc.rows[0].status, 'withdrawn');

  // 2. Verify Audit
  const auditRes = await client.query<{ action: string; outcome: string; details: any }>(
    `SELECT action, outcome, details
       FROM document_audit_events
      WHERE institution_id = $1 AND document_id = $2 AND action = 'association.withdrawn'`,
    [institutionId, doc.id],
  );
  assert.strictEqual(auditRes.rows.length, 1, 'Audit record exists for withdrawal');
  assert.strictEqual(auditRes.rows[0].outcome, 'success');

  // 3. Verify Outbox Event
  const outboxRes = await client.query<{
    event_type: string;
    aggregate_type: string;
    aggregate_id: string;
    payload: any;
  }>(
    `SELECT event_type, aggregate_type, aggregate_id, payload
       FROM document_outbox_events
      WHERE institution_id = $1 AND aggregate_id = $2 AND event_type = 'document.association_changed'`,
    [institutionId, assocId],
  );
  assert.strictEqual(outboxRes.rows.length, 1, 'Exactly one document.association_changed event in outbox');
  const outboxEvent = outboxRes.rows[0];
  assert.strictEqual(outboxEvent.event_type, 'document.association_changed');
  assert.strictEqual(outboxEvent.aggregate_type, 'document_association');
  assert.strictEqual(outboxEvent.aggregate_id, assocId);

  // 4. Verify Payload Semantics & Security
  const payload = outboxEvent.payload;
  assert.strictEqual(payload.associationId, assocId);
  assert.strictEqual(payload.documentId, doc.id);
  assert.strictEqual(payload.previousStatus, 'active');
  assert.strictEqual(payload.newStatus, 'withdrawn');
  assert.strictEqual(payload.targetDomain, 'enrollment');
  assert.strictEqual(payload.targetResourceType, 'enrollment_application');
  assert.strictEqual(payload.purpose, 'enrollment_verification');

  // Check that security scanner passes
  assert.doesNotThrow(() => validateEventPayloadSecurity(payload));

  // Verify no forbidden PII or secret fields exist
  const forbiddenKeys = ['name', 'studentName', 'token', 'secret', 'password', 'nif', 'bi', 'email', 'phone'];
  for (const k of forbiddenKeys) {
    assert.strictEqual(k in payload, false, `Payload must not contain key ${k}`);
  }

  console.log('[TEST 2] Idempotent replay produces exactly one logical event');
  const replayRes = await transitionAssociationStatusCommand({
    pool,
    context,
    idempotencyKey: withdrawKey,
    expectedDocumentId: doc.id,
    input: {
      associationId: assocId,
      targetStatus: 'withdrawn',
      reason: 'superseded_by_new_passport',
    },
  });
  assert.strictEqual(replayRes.replayed, true);
  assert.strictEqual(replayRes.result.status, 'withdrawn');

  const outboxAfterReplay = await client.query(
    `SELECT count(*)::int as count
       FROM document_outbox_events
      WHERE institution_id = $1 AND aggregate_id = $2 AND event_type = 'document.association_changed'`,
    [institutionId, assocId],
  );
  assert.strictEqual(outboxAfterReplay.rows[0].count, 1, 'Event count must remain exactly 1 after replay');

  console.log('[TEST 3] Transactional integrity: outbox failure rolls back logical success');
  const doc2 = await docRepo.createDocument(client, {
    institutionId,
    category: 'identity_proof',
    createdByPersonId: personId,
  });
  const create2 = await createDocumentAssociationCommand({
    pool,
    context,
    idempotencyKey: 'idemp-rollback-create-1',
    input: {
      documentId: doc2.id,
      targetDomain: 'enrollment',
      targetResourceType: 'enrollment_application',
      targetResourceId: 'app-uuid-2',
      purpose: 'enrollment_verification',
    },
  });
  const assoc2Id = create2.result.id;

  // Install trigger causing outbox insertion to fail
  await client.query(`
    CREATE OR REPLACE FUNCTION fail_outbox_trigger() RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'SIMULATED_OUTBOX_INSERTION_FAILURE';
    END;
    $$ LANGUAGE plpgsql;
  `);
  await client.query(`
    CREATE TRIGGER trg_fail_outbox
    BEFORE INSERT ON document_outbox_events
    FOR EACH ROW
    WHEN (NEW.event_type = 'document.association_changed')
    EXECUTE FUNCTION fail_outbox_trigger();
  `);

  await assert.rejects(
    transitionAssociationStatusCommand({
      pool,
      context,
      idempotencyKey: 'idemp-fail-outbox-trans',
      expectedDocumentId: doc2.id,
      input: {
        associationId: assoc2Id,
        targetStatus: 'withdrawn',
      },
    }),
    /SIMULATED_OUTBOX_INSERTION_FAILURE/,
    'Outbox failure must abort the command',
  );

  // Status must remain 'active' because transaction rolled back!
  const checkStatus = await client.query<{ status: string }>(
    `SELECT status FROM document_associations WHERE institution_id = $1 AND id = $2`,
    [institutionId, assoc2Id],
  );
  assert.strictEqual(checkStatus.rows[0].status, 'active', 'Mutation must be rolled back on event failure');

  // Tear down trigger
  await client.query(`DROP TRIGGER trg_fail_outbox ON document_outbox_events`);
  await client.query(`DROP FUNCTION fail_outbox_trigger`);

  console.log('ALL_ASSOCIATION_EVENTS_TESTS_PASS');
} finally {
  await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  client.release();
  await pool.end();
}
