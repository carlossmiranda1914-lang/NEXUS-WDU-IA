/**
 * Documents API — HTTP Idempotency Tests (I8A)
 *
 * Mandatory test scenarios:
 *
 *  1. MISSING_IDEMPOTENCY_KEY
 *     ? 428 Precondition Required
 *     ? zero domain mutation (no document, no outbox event, no audit event)
 *
 *  2. SAME_HTTP_REQUEST_SAME_KEY
 *     ? canonical replay returns identical result
 *     ? no duplicate document
 *     ? no duplicate outbox event
 *     ? no duplicate audit success
 *
 *  3. SAME_KEY_DIFFERENT_PAYLOAD
 *     ? IDEMPOTENCY_FINGERPRINT_MISMATCH
 *     ? 409 Conflict
 *
 *  4. RESPONSE_LOSS_SIMULATION
 *     ? first request commits; response treated as lost
 *     ? client retries identical request with same key
 *     ? canonical replay; exactly one logical mutation
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { resolveInstitutionalContext } from '../src/auth/institutional-context.ts';
import { createRequireAuth } from '../src/middleware/auth.ts';
import { registerDocumentRoutes } from '../src/modules/documents/document.controller.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { ConfigurableDocumentAccessPolicyEngine } from '../src/modules/documents/document-access-policy.ts';
import { ConfigurableRetentionPolicyEngine } from '../src/modules/documents/document-retention-policy.ts';

await verifyApprovedTestConnection();

const schema = `doc_idem_http_${randomUUID().replaceAll('-', '')}`;
const quote = (v: string) => `"${v.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/db/migrations',
);

let server: http.Server | undefined;

const client = await pool.connect();
try {
  await client.query(`CREATE SCHEMA ${quote(schema)}`);
  await client.query(`SET search_path TO ${quote(schema)}, public`);

  const migrations = await discoverMigrations(migrationsDir);
  await runMigrations(client, migrations);

  const institutionId = randomUUID();
  const adminPersonId = randomUUID();
  const membershipId = randomUUID();

  await client.query(
    `INSERT INTO institutions (id, name, slug, status)
     VALUES ($1, 'Idem HTTP Test Inst', 'idem-http-test', 'active')`,
    [institutionId],
  );
  await client.query(`INSERT INTO people (id, name) VALUES ($1, 'Idem Admin')`, [adminPersonId]);
  await client.query(
    `INSERT INTO identities (person_id, provider, provider_subject)
     VALUES ($1, 'firebase', 'idem-admin-uid')`,
    [adminPersonId],
  );
  await client.query(
    `INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at)
     VALUES ($1, $2, $3, 'institution_admin', 'active', now())`,
    [membershipId, adminPersonId, institutionId],
  );

  const storageProvider = new MemoryObjectStorageProvider();
  const policyEngine = new ConfigurableDocumentAccessPolicyEngine([
    { role: 'institution_admin', category: '*', allowedActions: ['open_content', 'download_content'] },
  ]);
  const retentionPolicyEngine = new ConfigurableRetentionPolicyEngine([]);

  const app = express();
  app.use(express.json());
  const auth = createRequireAuth({
    verifyIdToken: async (token) => ({ uid: token }),
    pool: pool as any,
    resolveInstitutionalContext,
  });

  registerDocumentRoutes(app, {
    pool: pool as any,
    requireAuth: auth,
    storageProvider,
    storageBucket: 'idem-test-vault',
    uploadPolicyConfig: {
      globalMaxByteSize: 10 * 1024 * 1024,
      institutionMaxByteSize: 5 * 1024 * 1024,
    },
    policyEngine,
    retentionPolicyEngine,
    accessGrantTokenKey: 'idem-test-token-key-minimum-32-chars-long-secret',
    deletionPseudonymizationKey: 'idem-test-deletion-pseudonymization-key-32-bytes',
  });

  server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const request = async (
    urlPath: string,
    options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
  ) => {
    const { method = 'GET', body, headers = {} } = options;
    const reqHeaders: Record<string, string> = {
      Authorization: 'Bearer idem-admin-uid',
      ...headers,
    };
    if (body !== undefined) reqHeaders['Content-Type'] = 'application/json';
    return fetch(`${baseUrl}${urlPath}`, {
      method,
      headers: reqHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  // -------------------------------------------------------------------------
  // SCENARIO 1: MISSING_IDEMPOTENCY_KEY -> 428, zero domain mutation
  // -------------------------------------------------------------------------
  console.log('[IDEM-HTTP-1] MISSING_IDEMPOTENCY_KEY -> 428, zero domain mutation');

  const missingKeyRes = await request('/api/documents/upload-sessions', {
    method: 'POST',
    body: {
      category: 'identification',
      classification: 'bi',
      declaredFilename: 'missing_key_test.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 512,
      // deliberately omit idempotencyKey
    },
  });

  assert.equal(missingKeyRes.status, 428, 'Missing idempotency key MUST return 428 Precondition Required');
  const missingKeyBody = (await missingKeyRes.json()) as any;
  assert.equal(missingKeyBody.code, 'IDEMPOTENCY_KEY_REQUIRED', 'Must include IDEMPOTENCY_KEY_REQUIRED code');

  const docCountAfterMissingKey = (
    await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM documents WHERE institution_id = $1`,
      [institutionId],
    )
  ).rows[0].count;
  assert.equal(Number(docCountAfterMissingKey), 0, 'MISSING_KEY: zero documents after rejected request');

  const outboxCountAfterMissingKey = (
    await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM document_outbox_events WHERE institution_id = $1`,
      [institutionId],
    )
  ).rows[0].count;
  assert.equal(Number(outboxCountAfterMissingKey), 0, 'MISSING_KEY: zero outbox events after rejected request');

  const auditCountAfterMissingKey = (
    await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM document_audit_events WHERE institution_id = $1`,
      [institutionId],
    )
  ).rows[0].count;
  assert.equal(Number(auditCountAfterMissingKey), 0, 'MISSING_KEY: zero audit events after rejected request');

  // -------------------------------------------------------------------------
  // SCENARIO 2: SAME_HTTP_REQUEST_SAME_KEY -> canonical replay, no duplicates
  // -------------------------------------------------------------------------
  console.log('[IDEM-HTTP-2] SAME_HTTP_REQUEST_SAME_KEY -> canonical replay, no duplicates');

  const sameKeyIdem = `idem-http-same-key-${randomUUID()}`;
  const samePayload = {
    category: 'identification',
    classification: 'bi',
    declaredFilename: 'same_key_test.pdf',
    declaredMimeType: 'application/pdf',
    declaredByteSize: 1024,
    idempotencyKey: sameKeyIdem,
  };

  const firstRes = await request('/api/documents/upload-sessions', { method: 'POST', body: samePayload });
  assert.equal(firstRes.status, 201, 'First request must succeed with 201');
  const firstBody = (await firstRes.json()) as any;
  assert.ok(firstBody.documentId);
  assert.ok(firstBody.sessionId);
  assert.equal(firstBody.replayed, false, 'First request must not be marked replayed');

  const firstDocumentId = firstBody.documentId;

  const replayRes = await request('/api/documents/upload-sessions', { method: 'POST', body: samePayload });
  assert.equal(replayRes.status, 201, 'Replay must succeed with 201');
  const replayBody = (await replayRes.json()) as any;
  assert.equal(replayBody.documentId, firstDocumentId, 'Replay must return same documentId');
  assert.equal(replayBody.sessionId, firstBody.sessionId, 'Replay must return same sessionId');
  assert.equal(replayBody.replayed, true, 'Replay must be marked replayed');

  const docCountAfterReplay = (
    await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM documents WHERE institution_id = $1`,
      [institutionId],
    )
  ).rows[0].count;
  assert.equal(Number(docCountAfterReplay), 1, 'SAME_KEY: exactly one document after replay');

  const outboxCountAfterReplay = (
    await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM document_outbox_events
       WHERE institution_id = $1 AND aggregate_id = $2 AND event_type = 'document.created'`,
      [institutionId, firstDocumentId],
    )
  ).rows[0].count;
  assert.equal(Number(outboxCountAfterReplay), 1, 'SAME_KEY: exactly one document.created outbox event');

  const auditCountAfterReplay = (
    await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM document_audit_events
       WHERE institution_id = $1 AND document_id = $2 AND action = 'document.created' AND outcome = 'success'`,
      [institutionId, firstDocumentId],
    )
  ).rows[0].count;
  assert.equal(Number(auditCountAfterReplay), 1, 'SAME_KEY: exactly one document.created audit success event');

  // -------------------------------------------------------------------------
  // SCENARIO 3: SAME_KEY_DIFFERENT_PAYLOAD -> 409 IDEMPOTENCY_FINGERPRINT_MISMATCH
  // -------------------------------------------------------------------------
  console.log('[IDEM-HTTP-3] SAME_KEY_DIFFERENT_PAYLOAD -> 409 IDEMPOTENCY_FINGERPRINT_MISMATCH');

  const conflictKeyIdem = `idem-http-conflict-${randomUUID()}`;

  const conflictFirstRes = await request('/api/documents/upload-sessions', {
    method: 'POST',
    body: {
      category: 'identification',
      classification: 'bi',
      declaredFilename: 'conflict_payload_a.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 1024,
      idempotencyKey: conflictKeyIdem,
    },
  });
  assert.equal(conflictFirstRes.status, 201, 'First conflict-key request must succeed with 201');
  const conflictFirstBody = (await conflictFirstRes.json()) as any;
  const conflictDocumentId = conflictFirstBody.documentId;

  const conflictSecondRes = await request('/api/documents/upload-sessions', {
    method: 'POST',
    body: {
      category: 'identification',
      classification: 'bi',
      declaredFilename: 'conflict_payload_DIFFERENT.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 2048,
      idempotencyKey: conflictKeyIdem,
    },
  });
  assert.equal(conflictSecondRes.status, 409, 'Different payload with same key MUST return 409');
  const conflictSecondBody = (await conflictSecondRes.json()) as any;
  assert.ok(
    conflictSecondBody.error?.includes('IDEMPOTENCY_FINGERPRINT_MISMATCH') ||
      conflictSecondBody.code === 'CONFLICT',
    'Response must indicate idempotency fingerprint mismatch',
  );

  // After conflict rejection: two docs total (scenario 2 + conflict first request), not three
  const docCountAfterConflict = (
    await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM documents WHERE institution_id = $1`,
      [institutionId],
    )
  ).rows[0].count;
  assert.equal(
    Number(docCountAfterConflict),
    2,
    'SAME_KEY_DIFFERENT_PAYLOAD: exactly two documents total (conflict rejection must not create a third)',
  );

  const conflictOutboxCount = (
    await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM document_outbox_events
       WHERE institution_id = $1 AND aggregate_id = $2 AND event_type = 'document.created'`,
      [institutionId, conflictDocumentId],
    )
  ).rows[0].count;
  assert.equal(
    Number(conflictOutboxCount),
    1,
    'SAME_KEY_DIFFERENT_PAYLOAD: conflict rejection must not produce a second outbox event',
  );

  // -------------------------------------------------------------------------
  // SCENARIO 4: RESPONSE_LOSS_SIMULATION
  // -------------------------------------------------------------------------
  console.log('[IDEM-HTTP-4] RESPONSE_LOSS_SIMULATION -> retry same key replays cleanly');

  const lostResponseKey = `idem-http-lost-resp-${randomUUID()}`;
  const lostResponsePayload = {
    category: 'general',
    declaredFilename: 'lost_response_doc.pdf',
    declaredMimeType: 'application/pdf',
    declaredByteSize: 2048,
    idempotencyKey: lostResponseKey,
  };

  // First request commits. Client treats the response as lost (e.g., timeout before body read).
  const lostFirstRes = await request('/api/documents/upload-sessions', {
    method: 'POST',
    body: lostResponsePayload,
  });
  assert.equal(lostFirstRes.status, 201);
  const lostFirstBody = (await lostFirstRes.json()) as any;
  const lostDocumentId = lostFirstBody.documentId;
  // Simulate: client ignores lostFirstBody and retries

  const retryRes = await request('/api/documents/upload-sessions', {
    method: 'POST',
    body: lostResponsePayload,
  });
  assert.equal(retryRes.status, 201, 'Retry after response loss must succeed with 201');
  const retryBody = (await retryRes.json()) as any;
  assert.equal(retryBody.documentId, lostDocumentId, 'Retry must return same documentId as original commit');
  assert.equal(retryBody.sessionId, lostFirstBody.sessionId, 'Retry must return same sessionId');
  assert.equal(retryBody.replayed, true, 'Retry must be identified as canonical replay');

  const lostDocCount = (
    await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM documents WHERE institution_id = $1 AND id = $2`,
      [institutionId, lostDocumentId],
    )
  ).rows[0].count;
  assert.equal(Number(lostDocCount), 1, 'RESPONSE_LOSS: exactly one document with the committed documentId');

  const lostOutboxCount = (
    await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM document_outbox_events
       WHERE institution_id = $1 AND aggregate_id = $2 AND event_type = 'document.created'`,
      [institutionId, lostDocumentId],
    )
  ).rows[0].count;
  assert.equal(Number(lostOutboxCount), 1, 'RESPONSE_LOSS: exactly one document.created outbox event after retry');

  const lostAuditCount = (
    await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM document_audit_events
       WHERE institution_id = $1 AND document_id = $2 AND action = 'document.created' AND outcome = 'success'`,
      [institutionId, lostDocumentId],
    )
  ).rows[0].count;
  assert.equal(Number(lostAuditCount), 1, 'RESPONSE_LOSS: exactly one audit success after retry');

  console.log('[DOCUMENTS-API-IDEMPOTENCY-HTTP] All four mandatory idempotency scenarios PASSED.');
} finally {
  client.release();
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
  await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined);
  await pool.end();
}
