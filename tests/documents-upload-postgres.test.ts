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
import { verifyUploadToken } from '../src/modules/documents/document-upload-model.ts';

await verifyApprovedTestConnection();

const schema = `doc_up_pg_${randomUUID().replaceAll('-', '')}`;
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
  const auditRepo = new PostgresDocumentAuditRepository();
  const storageProvider = new MemoryObjectStorageProvider();

  // Create test document
  const doc = await docRepo.createDocument(client, {
    institutionId,
    category: 'identification',
    classification: 'passport',
    createdByPersonId: personId,
  });

  // 1. CREATE_SESSION_SAME_TENANT
  const createRes = await createUploadSessionCommand({
    pool,
    context,
    idempotencyKey: 'idemp-session-create-1',
    input: {
      documentId: doc.id,
      declaredFilename: '../../../injected/passport_scan.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 1048576,
      policyConfig: {
        globalMaxByteSize: 50 * 1024 * 1024,
        institutionMaxByteSize: 20 * 1024 * 1024,
      },
      storageProvider: 'test-memory',
      storageBucket: 'nexus-vault',
      provenance: {
        sourceDomain: 'portal',
        method: 'direct_upload',
        correlationId: 'req-001',
      },
    },
  });

  const session = createRes.result.session;
  const rawToken1 = createRes.result.rawToken;

  assert.ok(session.id);
  assert.strictEqual(session.institutionId, institutionId);
  assert.strictEqual(session.documentId, doc.id);
  assert.strictEqual(session.status, 'authorized');
  assert.strictEqual(session.declaredFilename, 'passport_scan.pdf', 'Path traversal must be sanitized');
  assert.strictEqual(session.declaredMimeType, 'application/pdf');
  assert.strictEqual(session.declaredByteSize, 1048576);
  assert.strictEqual(createRes.result.effectiveLimit, 20 * 1024 * 1024);

  // 2. AUTHORIZATION_TTL_15M & ABSOLUTE_EXPIRY_24H
  const nowMs = Date.now();
  const authTtlMs = session.authorizedUntil.getTime() - session.createdAt.getTime();
  const expiryTtlMs = session.expiresAt.getTime() - session.createdAt.getTime();
  assert.ok(Math.abs(authTtlMs - 15 * 60 * 1000) < 5000, 'Authorization window must be ~15m');
  assert.ok(Math.abs(expiryTtlMs - 24 * 60 * 60 * 1000) < 5000, 'Session absolute expiry must be ~24h');

  // 3. TOKEN_HASH_ONLY_PERSISTED & AUDIT_PRIVACY
  const rawInDb = await client.query<{ upload_token_hash: string }>(
    `SELECT upload_token_hash FROM document_upload_sessions WHERE id = $1`,
    [session.id],
  );
  assert.notStrictEqual(rawInDb.rows[0].upload_token_hash, rawToken1);
  assert.strictEqual(verifyUploadToken(rawToken1, rawInDb.rows[0].upload_token_hash), true);

  const audits = await auditRepo.getAuditEventsForDocument(client, institutionId, doc.id);
  assert.ok(audits.length >= 1);
  const createAudit = audits.find((a) => a.action === 'document.upload_session_created');
  assert.ok(createAudit);
  assert.strictEqual(createAudit.details.sessionId, session.id);
  assert.strictEqual(createAudit.details.rawToken, undefined, 'Raw token must NEVER appear in audit');
  assert.strictEqual(createAudit.details.uploadTokenHash, undefined, 'Token hash must NEVER appear in audit');

  // 4. RESUME_VALID_SESSION & TOKEN_ROTATION
  const resumeRes = await resumeUploadSessionCommand({
    pool,
    context,
    idempotencyKey: 'idemp-session-resume-1',
    input: {
      sessionId: session.id,
      rawToken: rawToken1,
      correlationId: 'req-002',
    },
  });

  const rawToken2 = resumeRes.result.rawToken;
  const resumedSession = resumeRes.result.session;
  assert.notStrictEqual(rawToken2, rawToken1, 'Token must be rotated upon resume');
  assert.strictEqual(verifyUploadToken(rawToken2, resumedSession.uploadTokenHash), true);
  assert.strictEqual(verifyUploadToken(rawToken1, resumedSession.uploadTokenHash), false, 'Old token must be invalidated');

  // 5. CANCEL_SESSION & RESUME_CANCELLED_DENIED
  const cancelDoc = await docRepo.createDocument(client, {
    institutionId,
    category: 'identification',
    createdByPersonId: personId,
  });
  const cancelSessionRes = await createUploadSessionCommand({
    pool,
    context,
    idempotencyKey: 'idemp-cancel-create',
    input: {
      documentId: cancelDoc.id,
      declaredFilename: 'cancel_me.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 1024,
      policyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
      storageProvider: 'test-memory',
      storageBucket: 'nexus-vault',
    },
  });

  const cancelledSession = await cancelUploadSessionCommand({
    pool,
    context,
    idempotencyKey: 'idemp-cancel-1',
    input: {
      sessionId: cancelSessionRes.result.session.id,
      reason: 'User cancelled form',
    },
  });
  assert.strictEqual(cancelledSession.result.status, 'cancelled');

  await assert.rejects(
    async () => {
      await resumeUploadSessionCommand({
        pool,
        context,
        idempotencyKey: 'idemp-cancel-resume-denied',
        input: {
          sessionId: cancelSessionRes.result.session.id,
          rawToken: cancelSessionRes.result.rawToken,
        },
      });
    },
    /RESUME_CANCELLED_DENIED/,
    'Resuming a cancelled session must be denied',
  );

  // 6. RESUME_EXPIRED_DENIED
  await client.query(
    `UPDATE document_upload_sessions SET expires_at = now() - interval '1 hour', authorized_until = now() - interval '1 hour' WHERE id = $1`,
    [cancelSessionRes.result.session.id],
  );

  const expDoc = await docRepo.createDocument(client, { institutionId, category: 'identification', createdByPersonId: personId });
  const expSessionRes = await createUploadSessionCommand({
    pool,
    context,
    idempotencyKey: 'idemp-exp-create',
    input: {
      documentId: expDoc.id,
      declaredFilename: 'expired.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 1024,
      policyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
      storageProvider: 'test-memory',
      storageBucket: 'nexus-vault',
    },
  });

  await client.query(
    `UPDATE document_upload_sessions SET expires_at = now() - interval '1 hour', authorized_until = now() - interval '1 hour' WHERE id = $1`,
    [expSessionRes.result.session.id],
  );

  await assert.rejects(
    async () => {
      await resumeUploadSessionCommand({
        pool,
        context,
        idempotencyKey: 'idemp-exp-resume-denied',
        input: {
          sessionId: expSessionRes.result.session.id,
          rawToken: expSessionRes.result.rawToken,
        },
      });
    },
    /RESUME_EXPIRED_DENIED/,
    'Resuming an expired session must be denied',
  );

  // 7. COMPLETE_UPLOAD_CREATES_ONE_VERSION & VERSION_STATE_CONTENT_RECEIVED
  const fileBytes = Buffer.from('%PDF-1.4 Mock PDF file binary data for Nexus');
  await storageProvider.simulateDirectUpload({
    storageBucket: resumedSession.storageBucket,
    storageKey: resumedSession.storageKey,
    content: fileBytes,
    mimeType: 'application/pdf',
  });

  const completeRes = await completeUploadSessionCommand({
    pool,
    context,
    storageProvider,
    idempotencyKey: 'idemp-complete-1',
    input: {
      sessionId: resumedSession.id,
      rawToken: rawToken2,
      provenance: {
        originType: 'user_upload',
        actorPersonId: personId,
        sourceDomain: 'portal',
        method: 'direct_upload',
        correlationId: 'req-003',
      },
    },
  });

  const { session: completedSessionRecord, version, provenance, storageReference } = completeRes.result;
  assert.strictEqual(completedSessionRecord.status, 'completed');
  assert.strictEqual(completedSessionRecord.completedVersionId, version.id);

  assert.strictEqual(version.documentId, doc.id);
  assert.strictEqual(version.versionNumber, 1);
  assert.strictEqual(version.status, 'content_received', 'DocumentVersion status MUST be content_received');
  assert.notStrictEqual(version.status, 'available', 'DocumentVersion status MUST NEVER be available in I3');
  assert.strictEqual(version.byteSize, fileBytes.length);

  assert.strictEqual(provenance.versionId, version.id);
  assert.strictEqual(provenance.originType, 'user_upload');
  assert.strictEqual(provenance.correlationId, 'req-003');

  assert.ok(storageReference);
  assert.strictEqual(storageReference.versionId, version.id);
  assert.strictEqual(storageReference.storageKey, resumedSession.storageKey);

  // 8. ORPHAN_OBJECT_FAILURE_PATH_SAFE
  const orphanDoc = await docRepo.createDocument(client, { institutionId, category: 'identification', createdByPersonId: personId });
  const orphanSessRes = await createUploadSessionCommand({
    pool,
    context,
    idempotencyKey: 'idemp-orphan-create',
    input: {
      documentId: orphanDoc.id,
      declaredFilename: 'orphan.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 500,
      policyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
      storageProvider: 'test-memory',
      storageBucket: 'nexus-vault',
    },
  });

  // Upload object to storage
  await storageProvider.simulateDirectUpload({
    storageBucket: orphanSessRes.result.session.storageBucket,
    storageKey: orphanSessRes.result.session.storageKey,
    content: Buffer.from('Orphan test bytes'),
    mimeType: 'application/pdf',
  });

  // Corrupt DB session or simulate DB failure on completion
  await client.query(`UPDATE document_upload_sessions SET status = 'cancelled' WHERE id = $1`, [
    orphanSessRes.result.session.id,
  ]);

  await assert.rejects(
    async () => {
      await completeUploadSessionCommand({
        pool,
        context,
        storageProvider,
        idempotencyKey: 'idemp-orphan-complete',
        input: {
          sessionId: orphanSessRes.result.session.id,
          rawToken: orphanSessRes.result.rawToken,
          provenance: {
            originType: 'user_upload',
            actorPersonId: personId,
            sourceDomain: 'portal',
            method: 'direct_upload',
          },
        },
      });
    },
    /UPLOAD_SESSION_CANCELLED/,
    'Completion on corrupted/cancelled session must fail and leave zero committed versions',
  );

  const orphanDocVersions = await docRepo.listVersions(client, institutionId, orphanDoc.id);
  assert.strictEqual(orphanDocVersions.length, 0, 'No committed versions must exist for failed completion');

  // Object is uncommitted candidate and can be safely deleted
  const orphanCleanup = await storageProvider.deleteUncommittedObject({
    storageBucket: orphanSessRes.result.session.storageBucket,
    storageKey: orphanSessRes.result.session.storageKey,
  });
  assert.strictEqual(orphanCleanup, true);

  console.log('[DOCUMENTS-UPLOAD-POSTGRES] PASS: Full PostgreSQL upload lifecycle, token rotation, expiry, completion and orphan safety verified.');
} finally {
  try {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } finally {
    client.release();
    await pool.end();
  }
}
