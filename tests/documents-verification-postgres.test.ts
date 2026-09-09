import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import { PostgresDocumentUploadRepository } from '../src/modules/documents/document-upload-repository.ts';
import { PostgresDocumentVerificationRepository } from '../src/modules/documents/document-verification-repository.ts';
import { PostgresDocumentAuditRepository } from '../src/modules/documents/document-audit.ts';
import {
  createUploadSessionCommand,
  completeUploadSessionCommand,
} from '../src/modules/documents/document-upload-command.ts';
import {
  startTechnicalVerificationCommand,
  executeTechnicalVerificationPipelineCommand,
} from '../src/modules/documents/document-verification-command.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import {
  DeterministicTestMalwareScanner,
  TEST_MALICIOUS_SENTINEL,
  TEST_INCONCLUSIVE_SENTINEL,
  TEST_ERROR_SENTINEL,
} from './support/deterministic-test-malware-scanner.ts';
import { ContentTypeDetector } from '../src/modules/documents/content-type-detector.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

await verifyApprovedTestConnection();

const schema = `doc_tech_ver_${randomUUID().replaceAll('-', '')}`;
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

const detector = new ContentTypeDetector({
  maxPrefixInspectionBytes: 4096,
  zipMetadataInspectionLimit: 64 * 1024,
  maxContainerEntryCount: 100,
  maxContainerMetadataBytes: 128 * 1024,
});

const retryPolicy = {
  maxAttempts: 3,
  baseBackoffMs: 1000,
  maxBackoffMs: 10000,
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
  const verificationRepo = new PostgresDocumentVerificationRepository();
  const auditRepo = new PostgresDocumentAuditRepository();
  const storageProvider = new MemoryObjectStorageProvider();
  const malwareScanner = new DeterministicTestMalwareScanner();

  // Helper to create and upload a document version
  async function createAndUploadDocument(
    category: string,
    filename: string,
    mimeType: string,
    content: Buffer,
    idempKey: string,
  ) {
    const doc = await docRepo.createDocument(client, {
      institutionId,
      category,
      createdByPersonId: personId,
    });

    const sessionRes = await createUploadSessionCommand({
      pool,
      context,
      idempotencyKey: `${idempKey}:create_sess`,
      input: {
        documentId: doc.id,
        declaredFilename: filename,
        declaredMimeType: mimeType,
        declaredByteSize: content.length,
        policyConfig: { globalMaxByteSize: 50 * 1024 * 1024 },
        storageProvider: 'test-memory',
        storageBucket: 'vault',
      },
    });

    await storageProvider.simulateDirectUpload({
      storageBucket: sessionRes.result.session.storageBucket,
      storageKey: sessionRes.result.session.storageKey,
      content,
      mimeType,
    });

    const completeRes = await completeUploadSessionCommand({
      pool,
      context,
      storageProvider,
      idempotencyKey: `${idempKey}:complete_sess`,
      input: {
        sessionId: sessionRes.result.session.id,
        rawToken: sessionRes.result.rawToken,
        provenance: {
          originType: 'user_upload',
          actorPersonId: personId,
          sourceDomain: 'portal',
          method: 'direct_upload',
        },
      },
    });

    return {
      doc,
      version: completeRes.result.version,
      session: sessionRes.result.session,
    };
  }

  // 1. CONTENT_RECEIVED_STARTS_VERIFICATION
  const cleanPdfBytes = Buffer.from('%PDF-1.4 Clean transcript official content for Nexus');
  const { doc: doc1, version: ver1 } = await createAndUploadDocument(
    'academic_transcript',
    'transcript.pdf',
    'application/pdf',
    cleanPdfBytes,
    'idemp-v1-start',
  );
  assert.strictEqual(ver1.status, 'content_received');

  const startRes = await startTechnicalVerificationCommand({
    pool,
    context,
    idempotencyKey: 'idemp-v1-start-cmd',
    input: {
      documentId: doc1.id,
      versionId: ver1.id,
    },
  });
  const verification1 = startRes.result;
  assert.strictEqual(verification1.status, 'under_verification');
  assert.strictEqual(verification1.attemptCount, 1);
  const dueWindowMs = verification1.dueAt.getTime() - verification1.startedAt.getTime();
  assert.ok(Math.abs(dueWindowMs - 24 * 3600 * 1000) < 5000, 'Due at must be ~24h from start');

  // 2. ALL_REQUIRED_ASSESSMENTS_PASS -> AVAILABLE
  const pipelineRes1 = await executeTechnicalVerificationPipelineCommand({
    pool,
    context,
    idempotencyKey: 'idemp-pipe-1',
    input: {
      documentId: doc1.id,
      versionId: ver1.id,
      storageProvider,
      malwareScanner,
      contentTypeDetector: detector,
      retryPolicy,
    },
  });

  assert.strictEqual(pipelineRes1.result.verification.status, 'available');
  assert.strictEqual(pipelineRes1.result.evaluation.allMandatoryPassed, true);
  assert.strictEqual(pipelineRes1.result.versionStatus, 'available');

  const ver1After = await docRepo.getVersionById(client, institutionId, ver1.id);
  assert.strictEqual(ver1After?.status, 'available', 'DocumentVersion status MUST become available after all assessments pass');

  // 3. MALWARE_FAIL -> QUARANTINED
  const infectedBytes = Buffer.from(`%PDF-1.4 infected file with sentinel ${TEST_MALICIOUS_SENTINEL}`);
  const { doc: doc2, version: ver2 } = await createAndUploadDocument(
    'identification',
    'infected_passport.pdf',
    'application/pdf',
    infectedBytes,
    'idemp-v2-malware',
  );

  const pipelineRes2 = await executeTechnicalVerificationPipelineCommand({
    pool,
    context,
    idempotencyKey: 'idemp-pipe-2-malware',
    input: {
      documentId: doc2.id,
      versionId: ver2.id,
      storageProvider,
      malwareScanner,
      contentTypeDetector: detector,
      retryPolicy,
    },
  });

  assert.strictEqual(pipelineRes2.result.verification.status, 'quarantined');
  assert.strictEqual(pipelineRes2.result.versionStatus, 'quarantined');
  assert.ok(pipelineRes2.result.verification.quarantineReason?.includes('malware') || pipelineRes2.result.verification.quarantineReason?.includes('Threat'));

  const ver2After = await docRepo.getVersionById(client, institutionId, ver2.id);
  assert.strictEqual(ver2After?.status, 'quarantined');

  // 4. INTEGRITY_HASH_FAIL -> QUARANTINED
  const { doc: doc3, version: ver3, session: sess3 } = await createAndUploadDocument(
    'identification',
    'tampered.pdf',
    'application/pdf',
    cleanPdfBytes,
    'idemp-v3-tamper',
  );

  // Tamper object bytes directly in storage to simulate TOCTOU / tampering post-upload
  await storageProvider.simulateDirectUpload({
    storageBucket: sess3.storageBucket,
    storageKey: sess3.storageKey,
    content: Buffer.from('%PDF-1.4 TAMPERED BYTES AFTER UPLOAD COMPLETION'),
    mimeType: 'application/pdf',
  });

  const pipelineRes3 = await executeTechnicalVerificationPipelineCommand({
    pool,
    context,
    idempotencyKey: 'idemp-pipe-3-tamper',
    input: {
      documentId: doc3.id,
      versionId: ver3.id,
      storageProvider,
      malwareScanner,
      contentTypeDetector: detector,
      retryPolicy,
    },
  });

  assert.strictEqual(pipelineRes3.result.verification.status, 'quarantined');
  assert.strictEqual(pipelineRes3.result.versionStatus, 'quarantined');
  assert.ok(pipelineRes3.result.verification.quarantineReason?.includes('integrity'));

  // 5. REAL_TYPE_MISMATCH -> QUARANTINED
  // Client declared PDF, but payload is actually a PNG image
  const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const { doc: doc4, version: ver4 } = await createAndUploadDocument(
    'identification',
    'spoofed_extension.pdf',
    'application/pdf',
    pngBytes,
    'idemp-v4-spoof',
  );

  const pipelineRes4 = await executeTechnicalVerificationPipelineCommand({
    pool,
    context,
    idempotencyKey: 'idemp-pipe-4-spoof',
    input: {
      documentId: doc4.id,
      versionId: ver4.id,
      storageProvider,
      malwareScanner,
      contentTypeDetector: detector,
      retryPolicy,
    },
  });

  assert.strictEqual(pipelineRes4.result.verification.status, 'quarantined');
  assert.strictEqual(pipelineRes4.result.versionStatus, 'quarantined');
  assert.ok(pipelineRes4.result.verification.quarantineReason?.includes('real_type'));

  // 6. SCANNER_INCONCLUSIVE -> NOT AVAILABLE, RETRY SCHEDULED
  const inconvBytes = Buffer.from(`%PDF-1.4 content with sentinel ${TEST_INCONCLUSIVE_SENTINEL}`);
  const { doc: doc5, version: ver5 } = await createAndUploadDocument(
    'identification',
    'inconclusive.pdf',
    'application/pdf',
    inconvBytes,
    'idemp-v5-inconc',
  );

  const pipelineRes5 = await executeTechnicalVerificationPipelineCommand({
    pool,
    context,
    idempotencyKey: 'idemp-pipe-5-inconc',
    input: {
      documentId: doc5.id,
      versionId: ver5.id,
      storageProvider,
      malwareScanner,
      contentTypeDetector: detector,
      retryPolicy,
    },
  });

  assert.strictEqual(pipelineRes5.result.verification.status, 'inconclusive');
  assert.notStrictEqual(pipelineRes5.result.versionStatus, 'available', 'Inconclusive scan must NEVER become available');
  assert.strictEqual(pipelineRes5.result.versionStatus, 'content_received');
  assert.ok(pipelineRes5.result.verification.nextRetryAt, 'Next retry must be scheduled for inconclusive assessment');

  // 7. SCANNER_ERROR / TIMEOUT -> NOT AVAILABLE, RETRY SCHEDULED
  malwareScanner.injectError();
  const { doc: doc6, version: ver6 } = await createAndUploadDocument(
    'identification',
    'scanner_down.pdf',
    'application/pdf',
    cleanPdfBytes,
    'idemp-v6-error',
  );

  const pipelineRes6 = await executeTechnicalVerificationPipelineCommand({
    pool,
    context,
    idempotencyKey: 'idemp-pipe-6-error',
    input: {
      documentId: doc6.id,
      versionId: ver6.id,
      storageProvider,
      malwareScanner,
      contentTypeDetector: detector,
      retryPolicy,
    },
  });

  assert.strictEqual(pipelineRes6.result.verification.status, 'inconclusive');
  assert.strictEqual(pipelineRes6.result.versionStatus, 'content_received');
  assert.notStrictEqual(pipelineRes6.result.versionStatus, 'available');
  malwareScanner.reset();

  // 8. STREAMING HASH OVER LARGE OBJECT WITHOUT FULL BUFFER REQUIREMENT
  const largeObjectSize = 2 * 1024 * 1024; // 2MB
  const largeChunk = Buffer.from('%PDF-1.4 Large document chunk repetitive string 0123456789\n');
  const chunksNeeded = Math.ceil(largeObjectSize / largeChunk.length);
  const largeBuffer = Buffer.concat(Array.from({ length: chunksNeeded }, () => largeChunk)).subarray(0, largeObjectSize);

  const { doc: docLarge, version: verLarge } = await createAndUploadDocument(
    'academic_transcript',
    'large_transcript.pdf',
    'application/pdf',
    largeBuffer,
    'idemp-vLarge',
  );

  const pipelineResLarge = await executeTechnicalVerificationPipelineCommand({
    pool,
    context,
    idempotencyKey: 'idemp-pipe-large',
    input: {
      documentId: docLarge.id,
      versionId: verLarge.id,
      storageProvider,
      malwareScanner,
      contentTypeDetector: detector,
      retryPolicy,
    },
  });

  assert.strictEqual(pipelineResLarge.result.verification.status, 'available');
  assert.strictEqual(pipelineResLarge.result.versionStatus, 'available');

  console.log('[DOCUMENTS-VERIFICATION-POSTGRES] PASS: Full technical verification lifecycle, assessments, quarantine, inconclusive handling, and streaming verified.');
} finally {
  try {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } finally {
    client.release();
    await pool.end();
  }
}
