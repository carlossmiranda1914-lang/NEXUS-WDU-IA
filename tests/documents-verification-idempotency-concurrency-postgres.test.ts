import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import { PostgresDocumentUploadRepository } from '../src/modules/documents/document-upload-repository.ts';
import { PostgresDocumentVerificationRepository } from '../src/modules/documents/document-verification-repository.ts';
import {
  createUploadSessionCommand,
  completeUploadSessionCommand,
} from '../src/modules/documents/document-upload-command.ts';
import {
  startTechnicalVerificationCommand,
  recordTechnicalAssessmentCommand,
  finalizeTechnicalVerificationCommand,
  executeTechnicalVerificationPipelineCommand,
} from '../src/modules/documents/document-verification-command.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { DeterministicTestMalwareScanner } from './support/deterministic-test-malware-scanner.ts';
import { ContentTypeDetector } from '../src/modules/documents/content-type-detector.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

await verifyApprovedTestConnection();

const schema = `doc_tech_idemp_${randomUUID().replaceAll('-', '')}`;
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
  const storageProvider = new MemoryObjectStorageProvider();
  const malwareScanner = new DeterministicTestMalwareScanner();

  async function createTestVersion(content: Buffer, keyPrefix: string) {
    const doc = await docRepo.createDocument(client, {
      institutionId,
      category: 'identification',
      createdByPersonId: personId,
    });

    const sessRes = await createUploadSessionCommand({
      pool,
      context,
      idempotencyKey: `${keyPrefix}:sess`,
      input: {
        documentId: doc.id,
        declaredFilename: 'id.pdf',
        declaredMimeType: 'application/pdf',
        declaredByteSize: content.length,
        policyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
        storageProvider: 'test-memory',
        storageBucket: 'vault',
      },
    });

    await storageProvider.simulateDirectUpload({
      storageBucket: sessRes.result.session.storageBucket,
      storageKey: sessRes.result.session.storageKey,
      content,
      mimeType: 'application/pdf',
    });

    const compRes = await completeUploadSessionCommand({
      pool,
      context,
      storageProvider,
      idempotencyKey: `${keyPrefix}:comp`,
      input: {
        sessionId: sessRes.result.session.id,
        rawToken: sessRes.result.rawToken,
        provenance: {
          originType: 'user_upload',
          sourceDomain: 'portal',
          method: 'direct_upload',
        },
      },
    });

    return { doc, version: compRes.result.version };
  }

  // 1. CONCURRENT VERIFICATION WORKERS SAME VERSION
  const cleanPdf = Buffer.from('%PDF-1.4 Concurrent pipeline race test PDF');
  const { doc: raceDoc, version: raceVer } = await createTestVersion(cleanPdf, 'idemp-race-1');

  // Launch 5 workers concurrently on the exact same version
  const concurrentPipelines = await Promise.all(
    Array.from({ length: 5 }).map((_, i) =>
      executeTechnicalVerificationPipelineCommand({
        pool,
        context,
        idempotencyKey: `idemp-worker-pipe-${i}`,
        input: {
          documentId: raceDoc.id,
          versionId: raceVer.id,
          storageProvider,
          malwareScanner,
          contentTypeDetector: detector,
          retryPolicy,
        },
      }),
    ),
  );

  assert.strictEqual(concurrentPipelines.length, 5);
  for (const p of concurrentPipelines) {
    assert.strictEqual(p.result.verification.status, 'available');
    assert.strictEqual(p.result.versionStatus, 'available');
  }

  // Verify only 1 verification row exists in DB
  const verCount = await client.query<{ count: string }>(
    `SELECT count(*) FROM document_technical_verifications WHERE institution_id = $1 AND version_id = $2`,
    [institutionId, raceVer.id],
  );
  assert.strictEqual(parseInt(verCount.rows[0].count, 10), 1, 'Exactly 1 canonical verification record must exist');

  // 2. CONCURRENT FINALIZE VS FAIL -> FAIL-CLOSED DOMINATES
  const { doc: failRaceDoc, version: failRaceVer } = await createTestVersion(cleanPdf, 'idemp-fail-race');

  const startRes = await startTechnicalVerificationCommand({
    pool,
    context,
    idempotencyKey: 'idemp-fail-race-start',
    input: {
      documentId: failRaceDoc.id,
      versionId: failRaceVer.id,
    },
  });

  const verificationId = startRes.result.id;

  // Record 3 passing assessments
  await recordTechnicalAssessmentCommand({
    pool,
    context,
    idempotencyKey: 'idemp-pass-1',
    input: {
      documentId: failRaceDoc.id,
      versionId: failRaceVer.id,
      verificationId,
      assessmentType: 'integrity',
      status: 'pass',
      provider: 'test',
      attemptNumber: 1,
    },
  });
  await recordTechnicalAssessmentCommand({
    pool,
    context,
    idempotencyKey: 'idemp-pass-2',
    input: {
      documentId: failRaceDoc.id,
      versionId: failRaceVer.id,
      verificationId,
      assessmentType: 'size',
      status: 'pass',
      provider: 'test',
      attemptNumber: 1,
    },
  });
  await recordTechnicalAssessmentCommand({
    pool,
    context,
    idempotencyKey: 'idemp-pass-3',
    input: {
      documentId: failRaceDoc.id,
      versionId: failRaceVer.id,
      verificationId,
      assessmentType: 'real_type',
      status: 'pass',
      provider: 'test',
      attemptNumber: 1,
    },
  });

  // Launch concurrently: Worker A records malware fail vs Worker B attempts finalize
  const [failRes, finalizeRes] = await Promise.all([
    recordTechnicalAssessmentCommand({
      pool,
      context,
      idempotencyKey: 'idemp-fail-malware',
      input: {
        documentId: failRaceDoc.id,
        versionId: failRaceVer.id,
        verificationId,
        assessmentType: 'malware',
        status: 'fail',
        provider: 'test_scanner',
        attemptNumber: 1,
        errorMessage: 'EICAR detected in concurrent race',
      },
    }),
    finalizeTechnicalVerificationCommand({
      pool,
      context,
      idempotencyKey: 'idemp-finalize-race',
      input: {
        documentId: failRaceDoc.id,
        versionId: failRaceVer.id,
        verificationId,
        retryPolicy,
      },
    }),
  ]);

  const finalVerDb = await docRepo.getVersionById(client, institutionId, failRaceVer.id);
  assert.strictEqual(finalVerDb?.status, 'quarantined', 'Version MUST be quarantined in race with failing assessment');

  // 3. STALE ATTEMPT RESULT REJECTED
  // Increment attempt to 2
  await verificationRepo.incrementAttempt(client, institutionId, verificationId);

  await assert.rejects(
    async () => {
      await recordTechnicalAssessmentCommand({
        pool,
        context,
        idempotencyKey: 'idemp-stale-attempt',
        input: {
          documentId: failRaceDoc.id,
          versionId: failRaceVer.id,
          verificationId,
          assessmentType: 'integrity',
          status: 'pass',
          provider: 'test',
          attemptNumber: 1, // Stale attempt
        },
      });
    },
    /STALE_ATTEMPT_REJECTED/,
    'Assessment result for older attempt must be rejected',
  );

  // 4. IDEMPOTENCY CONFLICT CHECK
  await assert.rejects(
    async () => {
      await startTechnicalVerificationCommand({
        pool,
        context,
        idempotencyKey: 'idemp-fail-race-start', // Reused key
        input: {
          documentId: failRaceDoc.id,
          versionId: raceVer.id, // Different version payload
        },
      });
    },
    /IDEMPOTENCY_CONFLICT/,
    'Reusing idempotency key with different payload must throw IDEMPOTENCY_CONFLICT',
  );

  console.log('[DOCUMENTS-VERIFICATION-CONCURRENCY] PASS: Concurrent workers, fail-closed domination, stale attempt rejection, and idempotency verified.');
} finally {
  try {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } catch {
    // Schema cleanup best effort
  } finally {
    client.release();
    await pool.end();
  }
}
