import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import {
  createUploadSessionCommand,
  resumeUploadSessionCommand,
  cancelUploadSessionCommand,
  completeUploadSessionCommand,
} from '../src/modules/documents/document-upload-command.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';

await verifyApprovedTestConnection();

const schema = `doc_up_tenant_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

const instA = '00000000-0000-0000-0000-000000000001';
const personA = '00000000-0000-0000-0000-000000000002';
const contextA: InstitutionalContext = {
  institutionId: instA,
  institutionName: 'Tenant Alpha',
  institutionSlug: 'tenant-alpha',
  personId: personA,
  personName: 'Actor Alpha',
  identityEmail: 'alpha@nexus.edu',
  membershipId: '00000000-0000-0000-0000-000000000005',
  role: 'institution_admin',
};

const instB = '00000000-0000-0000-0000-000000000003';
const personB = '00000000-0000-0000-0000-000000000004';
const contextB: InstitutionalContext = {
  institutionId: instB,
  institutionName: 'Tenant Beta',
  institutionSlug: 'tenant-beta',
  personId: personB,
  personName: 'Actor Beta',
  identityEmail: 'beta@nexus.edu',
  membershipId: '00000000-0000-0000-0000-000000000006',
  role: 'institution_admin',
};

const client = await pool.connect();
try {
  await client.query(`CREATE SCHEMA ${quote(schema)}`);
  await client.query(`SET search_path TO ${quote(schema)}, public`);

  const migrations = await discoverMigrations(migrationsDir);
  await runMigrations(client, migrations);

  // Seed two distinct institutions
  await client.query(
    `INSERT INTO institutions (id, name, slug, status) VALUES
      ($1, 'Tenant Alpha', 'tenant-alpha', 'active'),
      ($2, 'Tenant Beta', 'tenant-beta', 'active')`,
    [instA, instB],
  );
  await client.query(
    `INSERT INTO people (id, name) VALUES
      ($1, 'Actor Alpha'),
      ($2, 'Actor Beta')`,
    [personA, personB],
  );

  const docRepo = new PostgresDocumentRepository();
  const storageProvider = new MemoryObjectStorageProvider();

  // Tenant A creates a document
  const docA = await docRepo.createDocument(client, {
    institutionId: instA,
    category: 'identification',
    createdByPersonId: personA,
  });

  // 1. CREATE_SESSION_CROSS_TENANT_DENIED
  await assert.rejects(
    async () => {
      await createUploadSessionCommand({
        pool,
        context: contextB, // Tenant B calling
        idempotencyKey: 'idemp-cross-create-1',
        input: {
          documentId: docA.id, // Targeting Tenant A's document
          declaredFilename: 'hack.pdf',
          declaredMimeType: 'application/pdf',
          declaredByteSize: 1024,
          policyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
          storageProvider: 'test-memory',
          storageBucket: 'vault',
        },
      });
    },
    /not found in institution/,
    'Tenant B must not be able to create upload session for Tenant A document',
  );

  // Valid session created for Tenant A
  const sessionResA = await createUploadSessionCommand({
    pool,
    context: contextA,
    idempotencyKey: 'idemp-sess-a-valid',
    input: {
      documentId: docA.id,
      declaredFilename: 'valid.pdf',
      declaredMimeType: 'application/pdf',
      declaredByteSize: 1024,
      policyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
      storageProvider: 'test-memory',
      storageBucket: 'vault',
    },
  });

  const sessionA = sessionResA.result.session;
  const rawTokenA = sessionResA.result.rawToken;

  // 2. CROSS_TENANT_SESSION_RESUME_DENIED
  await assert.rejects(
    async () => {
      await resumeUploadSessionCommand({
        pool,
        context: contextB, // Tenant B
        idempotencyKey: 'idemp-cross-resume-1',
        input: {
          sessionId: sessionA.id,
          rawToken: rawTokenA,
        },
      });
    },
    /not found in institution/,
    'Tenant B must not be able to resume Tenant A upload session',
  );

  // 3. CROSS_TENANT_SESSION_CANCEL_DENIED
  await assert.rejects(
    async () => {
      await cancelUploadSessionCommand({
        pool,
        context: contextB, // Tenant B
        idempotencyKey: 'idemp-cross-cancel-1',
        input: {
          sessionId: sessionA.id,
          rawToken: rawTokenA,
        },
      });
    },
    /not found in institution/,
    'Tenant B must not be able to cancel Tenant A upload session',
  );

  // 4. CROSS_TENANT_SESSION_COMPLETE_DENIED
  await storageProvider.simulateDirectUpload({
    storageBucket: sessionA.storageBucket,
    storageKey: sessionA.storageKey,
    content: Buffer.from('Alpha content'),
    mimeType: 'application/pdf',
  });

  await assert.rejects(
    async () => {
      await completeUploadSessionCommand({
        pool,
        context: contextB, // Tenant B
        storageProvider,
        idempotencyKey: 'idemp-cross-complete-1',
        input: {
          sessionId: sessionA.id,
          rawToken: rawTokenA,
          provenance: {
            originType: 'user_upload',
            sourceDomain: 'portal',
            method: 'direct_upload',
          },
        },
      });
    },
    /not found in institution/,
    'Tenant B must not be able to complete Tenant A upload session',
  );

  // 5. WRONG_TOKEN_COMPLETE_DENIED
  await assert.rejects(
    async () => {
      await completeUploadSessionCommand({
        pool,
        context: contextA,
        storageProvider,
        idempotencyKey: 'idemp-wrong-token-complete',
        input: {
          sessionId: sessionA.id,
          rawToken: '0'.repeat(128), // Completely wrong token
          provenance: {
            originType: 'user_upload',
            sourceDomain: 'portal',
            method: 'direct_upload',
          },
        },
      });
    },
    /INVALID_UPLOAD_TOKEN/,
    'Completing with invalid raw token must be denied',
  );

  // 6. DATABASE COMPOSITE FK FENCE: CROSS-TENANT CORRUPT LINKAGE
  await assert.rejects(
    async () => {
      const badKey = `inst_${instB}/doc_${docA.id}/session_11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222`;
      await client.query(
        `INSERT INTO document_upload_sessions (
          institution_id, document_id, declared_filename, declared_mime_type, declared_byte_size,
          storage_provider, storage_bucket, storage_key, status, upload_token_hash, authorized_until, expires_at, created_by_person_id
        ) VALUES ($1, $2, 'bad.pdf', 'application/pdf', 1024, 'test-memory', 'vault', $3, 'authorized', $4, now() + interval '15m', now() + interval '24h', $5)`,
        [instB, docA.id, badKey, 'a'.repeat(64), personB],
      );
    },
    /violates foreign key constraint/,
    'Composite FK (institution_id, document_id) must prevent cross-tenant document linkage',
  );

  console.log('[DOCUMENTS-UPLOAD-MULTI-TENANT] PASS: Strict multi-tenant isolation, cross-tenant denial and composite FK constraints verified.');
} finally {
  try {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } finally {
    client.release();
    await pool.end();
  }
}
