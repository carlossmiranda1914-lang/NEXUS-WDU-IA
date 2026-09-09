import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import { PostgresDocumentUploadRepository } from '../src/modules/documents/document-upload-repository.ts';
import { PostgresDocumentAuditRepository } from '../src/modules/documents/document-audit.ts';
import {
  createUploadSessionCommand,
  resumeUploadSessionCommand,
  cancelUploadSessionCommand,
  completeUploadSessionCommand,
} from '../src/modules/documents/document-upload-command.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import { verifyUploadToken } from '../src/modules/documents/document-upload-model.ts';

await verifyApprovedTestConnection();

const schema = `doc_up_idemp_${randomUUID().replaceAll('-', '')}`;
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

  // 2. COMPLETE VS CANCEL REAL CONCURRENCY RACE -> EXACTLY ONE TERMINAL OUTCOME
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

  // Verify exactly one won and other was rejected with conflict/terminal-rejection
  const fulfilledCount = results.filter((r) => r.status === 'fulfilled').length;
  const rejectedCount = results.filter((r) => r.status === 'rejected').length;
  assert.strictEqual(fulfilledCount, 1, 'Exactly one terminal operation must succeed in complete vs cancel race');
  assert.strictEqual(rejectedCount, 1, 'The losing operation must receive a deterministic rejection');

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

  // 4. CONCURRENT RESUME TOKEN ROTATION TEST
  const rotDoc = await docRepo.createDocument(client, {
    institutionId,
    category: 'identification',
    createdByPersonId: personId,
  });

  const rotSessRes = await createUploadSessionCommand({
    pool,
    context,
    idempotencyKey: 'idemp-rot-create',
    input: {
      documentId: rotDoc.id,
      declaredFilename: 'rot.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 1024,
      policyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
      storageProvider: 'test-memory',
      storageBucket: 'vault',
    },
  });

  const originalRawToken = rotSessRes.result.rawToken;
  const rotSessionId = rotSessRes.result.session.id;

  // Two workers concurrently try to resume using the same initial raw token
  const rotResults = await Promise.allSettled([
    resumeUploadSessionCommand({
      pool,
      context,
      idempotencyKey: 'idemp-resume-worker-1',
      input: {
        sessionId: rotSessionId,
        rawToken: originalRawToken,
      },
    }),
    resumeUploadSessionCommand({
      pool,
      context,
      idempotencyKey: 'idemp-resume-worker-2',
      input: {
        sessionId: rotSessionId,
        rawToken: originalRawToken,
      },
    }),
  ]);

  // One worker rotates token; the second worker with the old raw token gets rejected with INVALID_UPLOAD_TOKEN
  const rotFulfilled = rotResults.filter((r) => r.status === 'fulfilled');
  const rotRejected = rotResults.filter((r) => r.status === 'rejected');
  assert.strictEqual(rotFulfilled.length, 1, 'Exactly one concurrent resume must succeed with the original token');
  assert.strictEqual(rotRejected.length, 1, 'Second concurrent resume using invalidated token must be rejected');

  const activeRotSession = await uploadRepo.getSessionById(client, institutionId, rotSessionId);
  assert.ok(activeRotSession);
  // Old token is strictly invalid
  assert.strictEqual(
    verifyUploadToken(originalRawToken, activeRotSession.uploadTokenHash),
    false,
    'Old raw token must be invalid in database after rotation',
  );

  // 5. STALE STATUS UPDATE REJECTED (NO_SILENT_LAST_WRITE_WINS)
  const staleDoc = await docRepo.createDocument(client, {
    institutionId,
    category: 'identification',
    createdByPersonId: personId,
  });

  const staleSessRes = await createUploadSessionCommand({
    pool,
    context,
    idempotencyKey: 'idemp-stale-create',
    input: {
      documentId: staleDoc.id,
      declaredFilename: 'stale.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 1024,
      policyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
      storageProvider: 'test-memory',
      storageBucket: 'vault',
    },
  });

  // Transition to cancelled
  await uploadRepo.transitionSessionStatus(client, institutionId, staleSessRes.result.session.id, 'cancelled');

  // Stale client/thread attempting to transition from 'authorized' to 'uploading'
  await assert.rejects(
    async () => {
      await uploadRepo.transitionSessionStatus(
        client,
        institutionId,
        staleSessRes.result.session.id,
        'uploading',
        ['authorized'], // Stale expected state
      );
    },
    /UPLOAD_SESSION_CONCURRENT_STATE_CONFLICT/,
    'Attempting CAS update with stale expected state must be rejected and prevent silent overwrite',
  );

  const finalStaleSession = await uploadRepo.getSessionById(client, institutionId, staleSessRes.result.session.id);
  assert.strictEqual(finalStaleSession?.status, 'cancelled', 'Terminal cancelled status must not be overwritten');

  // 6. IDEMPOTENCY CONFLICT CHECK
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

  // 7. CREATE SESSION REQUIRED TEST — RESPONSE LOSS RETRY
  const createRetryDoc = await docRepo.createDocument(client, {
    institutionId,
    category: 'identification',
    createdByPersonId: personId,
  });

  const createLossKey = 'idemp-create-response-loss-key';
  const createPayload = {
    documentId: createRetryDoc.id,
    declaredFilename: 'idemp_create_test.pdf',
    declaredMimeType: 'application/pdf',
    declaredByteSize: 4096,
    policyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
    storageProvider: 'test-memory',
    storageBucket: 'vault',
    provenance: {
      sourceDomain: 'portal',
      method: 'direct_upload',
      correlationId: 'req-loss-001',
    },
  };

  // First call succeeds in DB, but simulate response lost before client receives it
  const firstCreateRes = await createUploadSessionCommand({
    pool,
    context,
    idempotencyKey: createLossKey,
    input: createPayload,
  });
  const firstCreatedSessionId = firstCreateRes.result.session.id;
  const firstCreatedRawToken = firstCreateRes.result.rawToken;

  // Client retries with EXACT SAME idempotency key and payload
  const retryCreateRes = await createUploadSessionCommand({
    pool,
    context,
    idempotencyKey: createLossKey,
    input: createPayload,
  });
  const retryCreatedSessionId = retryCreateRes.result.session.id;
  const retryCreatedRawToken = retryCreateRes.result.rawToken;

  // Assertions:
  // SAME_SESSION_ID=YES
  assert.strictEqual(retryCreatedSessionId, firstCreatedSessionId, 'Retry must yield the EXACT same logical session ID');

  // SESSION_COUNT=1 & DUPLICATE_SESSION=NO
  const sessionCountRes = await client.query<{ count: string }>(
    `SELECT count(*) FROM document_upload_sessions WHERE document_id = $1`,
    [createRetryDoc.id],
  );
  assert.strictEqual(parseInt(sessionCountRes.rows[0].count, 10), 1, 'Only exactly 1 upload session must exist in DB');

  // DUPLICATE_SUCCESS_AUDIT=NO
  const auditRepo = new PostgresDocumentAuditRepository();
  const createAudits = await auditRepo.getAuditEventsForDocument(client, institutionId, createRetryDoc.id);
  const createdAuditEvents = createAudits.filter((a) => a.action === 'document.upload_session_created');
  assert.strictEqual(createdAuditEvents.length, 1, 'Idempotent replay must NOT emit duplicate success audit events');

  // RETRY_TOKEN_USABLE=YES
  assert.ok(retryCreatedRawToken, 'Retry must provide a usable raw token');
  assert.notStrictEqual(retryCreatedRawToken, '[REPLAYED_MASKED_TOKEN]', 'Masked token placeholder is prohibited');

  // Verify token is usable to complete upload
  await storageProvider.simulateDirectUpload({
    storageBucket: retryCreateRes.result.session.storageBucket,
    storageKey: retryCreateRes.result.session.storageKey,
    content: Buffer.from('Idempotent create retry upload content'),
    mimeType: 'application/pdf',
  });

  const completeRetryCreateRes = await completeUploadSessionCommand({
    pool,
    context,
    storageProvider,
    idempotencyKey: 'idemp-complete-after-create-retry',
    input: {
      sessionId: retryCreatedSessionId,
      rawToken: retryCreatedRawToken,
      provenance: {
        originType: 'user_upload',
        actorPersonId: personId,
        sourceDomain: 'portal',
        method: 'direct_upload',
      },
    },
  });
  assert.strictEqual(completeRetryCreateRes.result.session.status, 'completed');
  assert.strictEqual(completeRetryCreateRes.result.version.documentId, createRetryDoc.id);

  // 8. RESUME REQUIRED TEST — RESPONSE LOSS RETRY
  const resumeRetryDoc = await docRepo.createDocument(client, {
    institutionId,
    category: 'academic_transcript',
    createdByPersonId: personId,
  });

  const initialResumeSessRes = await createUploadSessionCommand({
    pool,
    context,
    idempotencyKey: 'idemp-resume-loss-init',
    input: {
      documentId: resumeRetryDoc.id,
      declaredFilename: 'resume_loss_test.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 8192,
      policyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
      storageProvider: 'test-memory',
      storageBucket: 'vault',
    },
  });

  const initialRawToken = initialResumeSessRes.result.rawToken;
  const initialSessionId = initialResumeSessRes.result.session.id;

  const resumeLossKey = 'idemp-resume-loss-op-key';
  const resumePayload = {
    sessionId: initialSessionId,
    rawToken: initialRawToken,
    correlationId: 'req-resume-loss-001',
  };

  // First resume call succeeds in DB (token rotated from initialRawToken -> firstResumeToken)
  // Simulate HTTP response lost: client never received firstResumeToken
  const firstResumeRes = await resumeUploadSessionCommand({
    pool,
    context,
    idempotencyKey: resumeLossKey,
    input: resumePayload,
  });
  const firstResumeRawToken = firstResumeRes.result.rawToken;

  // Client retries SAME resume command with SAME idempotency key and SAME initial fingerprint
  const retryResumeRes = await resumeUploadSessionCommand({
    pool,
    context,
    idempotencyKey: resumeLossKey,
    input: resumePayload,
  });
  const retryResumeRawToken = retryResumeRes.result.rawToken;

  // Assertions:
  // SAME_SESSION_ID=YES
  assert.strictEqual(retryResumeRes.result.session.id, initialSessionId, 'Resume retry must preserve same session ID');

  // Fetch current session from DB
  const dbSessionAfterResumeRetry = await uploadRepo.getSessionById(client, institutionId, initialSessionId);
  assert.ok(dbSessionAfterResumeRetry);

  // OLD_TOKEN_INVALID=YES
  assert.strictEqual(
    verifyUploadToken(initialRawToken, dbSessionAfterResumeRetry.uploadTokenHash),
    false,
    'Initial pre-resume token must be invalid',
  );

  // PREVIOUS_REPLAY_CREDENTIAL_INVALIDATED=YES & ONE_CANONICAL_ACTIVE_TOKEN=YES
  // The first rotation token is superseded by the retry replay rotation token
  assert.strictEqual(
    verifyUploadToken(firstResumeRawToken, dbSessionAfterResumeRetry.uploadTokenHash),
    false,
    'First rotated token (lost in transit) must be invalidated upon replay rotation',
  );
  assert.strictEqual(
    verifyUploadToken(retryResumeRawToken, dbSessionAfterResumeRetry.uploadTokenHash),
    true,
    'Retry token must be the ONE canonical active token in database',
  );

  // RETRY_RETURNS_USABLE_TOKEN=YES & SESSION_NOT_STRANDED=YES
  await storageProvider.simulateDirectUpload({
    storageBucket: dbSessionAfterResumeRetry.storageBucket,
    storageKey: dbSessionAfterResumeRetry.storageKey,
    content: Buffer.from('Resume retry upload content'),
    mimeType: 'application/pdf',
  });

  const completeAfterResumeRetry = await completeUploadSessionCommand({
    pool,
    context,
    storageProvider,
    idempotencyKey: 'idemp-complete-after-resume-retry',
    input: {
      sessionId: initialSessionId,
      rawToken: retryResumeRawToken,
      provenance: {
        originType: 'user_upload',
        actorPersonId: personId,
        sourceDomain: 'portal',
        method: 'direct_upload',
      },
    },
  });
  assert.strictEqual(completeAfterResumeRetry.result.session.status, 'completed');
  assert.strictEqual(completeAfterResumeRetry.result.version.documentId, resumeRetryDoc.id);

  // 9. SECURITY NEGATIVES & RAW TOKEN DB SCAN
  const allRawTokens = [
    rawToken,
    raceSessRes.result.rawToken,
    sessA.result.rawToken,
    sessB.result.rawToken,
    originalRawToken,
    staleSessRes.result.rawToken,
    firstCreatedRawToken,
    retryCreatedRawToken,
    initialRawToken,
    firstResumeRawToken,
    retryResumeRawToken,
  ];

  // Scan document_upload_sessions
  const allSessionsInDb = await client.query(`SELECT * FROM document_upload_sessions`);
  for (const row of allSessionsInDb.rows) {
    const rowJson = JSON.stringify(row);
    for (const tok of allRawTokens) {
      assert.strictEqual(
        rowJson.includes(tok),
        false,
        `RAW_TOKEN_IN_DOCUMENT_UPLOAD_SESSIONS detected! Token "${tok}" found in row: ${rowJson}`,
      );
    }
  }

  // Scan document_idempotency_records
  const allIdempRecords = await client.query(`SELECT * FROM document_idempotency_records`);
  for (const row of allIdempRecords.rows) {
    const rowJson = JSON.stringify(row);
    for (const tok of allRawTokens) {
      assert.strictEqual(
        rowJson.includes(tok),
        false,
        `RAW_TOKEN_IN_IDEMPOTENCY_LEDGER detected! Token "${tok}" found in row: ${rowJson}`,
      );
    }
  }

  // Scan document_audit_events
  const allAuditsInDb = await client.query(`SELECT * FROM document_audit_events`);
  for (const row of allAuditsInDb.rows) {
    const rowJson = JSON.stringify(row);
    for (const tok of allRawTokens) {
      assert.strictEqual(
        rowJson.includes(tok),
        false,
        `RAW_TOKEN_IN_DOCUMENT_AUDIT_EVENTS detected! Token "${tok}" found in row: ${rowJson}`,
      );
    }
  }

  console.log('[DOCUMENTS-UPLOAD-CONCURRENCY] PASS: Double completion, cancel/complete race, token rotation concurrency, CAS stale rejection, idempotency retry replay, and security DB scans verified.');
} finally {
  try {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } finally {
    client.release();
    await pool.end();
  }
}
