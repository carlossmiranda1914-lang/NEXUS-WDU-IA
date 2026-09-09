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
} from '../src/modules/documents/document-verification-command.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

await verifyApprovedTestConnection();

const schema = `doc_tech_tenant_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const instA = '00000000-0000-0000-0000-00000000000a';
const instB = '00000000-0000-0000-0000-00000000000b';
const actorA = '00000000-0000-0000-0000-000000000001';
const actorB = '00000000-0000-0000-0000-000000000002';

const contextA: InstitutionalContext = {
  institutionId: instA,
  institutionName: 'Institution A',
  institutionSlug: 'inst-a',
  personId: actorA,
  personName: 'Actor A',
  identityEmail: 'a@nexus.edu',
  membershipId: '00000000-0000-0000-0000-000000000011',
  role: 'institution_admin',
};

const contextB: InstitutionalContext = {
  institutionId: instB,
  institutionName: 'Institution B',
  institutionSlug: 'inst-b',
  personId: actorB,
  personName: 'Actor B',
  identityEmail: 'b@nexus.edu',
  membershipId: '00000000-0000-0000-0000-000000000022',
  role: 'institution_admin',
};

const client = await pool.connect();
try {
  await client.query(`CREATE SCHEMA ${quote(schema)}`);
  await client.query(`SET search_path TO ${quote(schema)}, public`);

  const migrations = await discoverMigrations(migrationsDir);
  await runMigrations(client, migrations);

  // Seed institutions and people
  await client.query(
    `INSERT INTO institutions (id, name, slug, status) VALUES
     ($1, 'Institution A', 'inst-a', 'active'),
     ($2, 'Institution B', 'inst-b', 'active')`,
    [instA, instB],
  );
  await client.query(
    `INSERT INTO people (id, name) VALUES ($1, 'Actor A'), ($2, 'Actor B')`,
    [actorA, actorB],
  );

  const docRepo = new PostgresDocumentRepository();
  const uploadRepo = new PostgresDocumentUploadRepository();
  const verificationRepo = new PostgresDocumentVerificationRepository();
  const storageProvider = new MemoryObjectStorageProvider();

  // Institution A creates and completes upload for Document Version
  const docA = await docRepo.createDocument(client, {
    institutionId: instA,
    category: 'identification',
    createdByPersonId: actorA,
  });

  const pdfBytes = Buffer.from('%PDF-1.4 Institution A private document bytes');
  const sessA = await createUploadSessionCommand({
    pool,
    context: contextA,
    idempotencyKey: 'idemp-tenant-sess-a',
    input: {
      documentId: docA.id,
      declaredFilename: 'secret_a.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: pdfBytes.length,
      policyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
      storageProvider: 'test-memory',
      storageBucket: 'vault',
    },
  });

  await storageProvider.simulateDirectUpload({
    storageBucket: sessA.result.session.storageBucket,
    storageKey: sessA.result.session.storageKey,
    content: pdfBytes,
    mimeType: 'application/pdf',
  });

  const compA = await completeUploadSessionCommand({
    pool,
    context: contextA,
    storageProvider,
    idempotencyKey: 'idemp-tenant-comp-a',
    input: {
      sessionId: sessA.result.session.id,
      rawToken: sessA.result.rawToken,
      provenance: {
        originType: 'user_upload',
        sourceDomain: 'portal',
        method: 'direct_upload',
      },
    },
  });

  const verA = compA.result.version;

  // 1. TENANT B ATTEMPTING TO START VERIFICATION FOR TENANT A VERSION IS DENIED
  await assert.rejects(
    async () => {
      await startTechnicalVerificationCommand({
        pool,
        context: contextB, // Tenant B context
        idempotencyKey: 'idemp-tenant-b-attack-start',
        input: {
          documentId: docA.id,
          versionId: verA.id, // Tenant A version
        },
      });
    },
    /DOCUMENT_VERSION_NOT_FOUND/,
    'Tenant B cannot start verification on Tenant A version',
  );

  // Tenant A starts verification normally
  const startResA = await startTechnicalVerificationCommand({
    pool,
    context: contextA,
    idempotencyKey: 'idemp-tenant-a-start',
    input: {
      documentId: docA.id,
      versionId: verA.id,
    },
  });
  const verificationA = startResA.result;

  // 2. TENANT B ATTEMPTING TO RECORD ASSESSMENT FOR TENANT A VERIFICATION IS DENIED
  await assert.rejects(
    async () => {
      await recordTechnicalAssessmentCommand({
        pool,
        context: contextB, // Tenant B context
        idempotencyKey: 'idemp-tenant-b-attack-assess',
        input: {
          documentId: docA.id,
          versionId: verA.id,
          verificationId: verificationA.id,
          assessmentType: 'malware',
          status: 'pass',
          provider: 'rogue_provider',
          attemptNumber: 1,
        },
      });
    },
    /Verification .* not found in institution/,
    'Tenant B cannot record assessment for Tenant A verification',
  );

  // 3. POSTGRESQL COMPOSITE FOREIGN KEY INTEGRITY NEGATIVES
  // Direct SQL injection attempt with mismatched institution_id
  await assert.rejects(
    async () => {
      await client.query(
        `INSERT INTO document_technical_verifications (
          institution_id, document_id, version_id, status
        ) VALUES ($1, $2, $3, 'under_verification')`,
        [instB, docA.id, verA.id], // Mismatched institution_id
      );
    },
    /fk_doc_tech_verifications_inst_doc_ver|foreign key constraint/,
    'PostgreSQL composite FK must prevent cross-tenant verification records',
  );

  await assert.rejects(
    async () => {
      await client.query(
        `INSERT INTO document_technical_assessments (
          institution_id, document_id, version_id, verification_id, assessment_type, status, provider, attempt_number
        ) VALUES ($1, $2, $3, $4, 'malware', 'pass', 'test', 1)`,
        [instB, docA.id, verA.id, verificationA.id], // Mismatched institution_id
      );
    },
    /fk_doc_tech_assessments_verification|fk_doc_tech_assessments_inst_doc_ver|foreign key constraint/,
    'PostgreSQL composite FK must prevent cross-tenant assessment records',
  );

  console.log('[DOCUMENTS-VERIFICATION-MULTI-TENANT] PASS: Cross-tenant command boundaries and composite PostgreSQL FK integrity verified.');
} finally {
  try {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } finally {
    client.release();
    await pool.end();
  }
}
