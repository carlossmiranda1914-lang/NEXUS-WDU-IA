/**
 * Documents Foundation I5 - Multi-Tenant Negative Isolation Integration Tests
 * Mission: DOCUMENTS-FOUNDATION-I5
 */

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import {
  createUploadSessionCommand,
  completeUploadSessionCommand,
} from '../src/modules/documents/document-upload-command.ts';
import {
  executeTechnicalVerificationPipelineCommand,
} from '../src/modules/documents/document-verification-command.ts';
import {
  authorizeContentAccessCommand,
  exchangeGrantForContentStreamCommand,
  revokeContentAccessGrantCommand,
} from '../src/modules/documents/document-access-command.ts';
import {
  ConfigurableDocumentAccessPolicyEngine,
} from '../src/modules/documents/document-access-policy.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { DeterministicTestMalwareScanner } from './support/deterministic-test-malware-scanner.ts';
import { ContentTypeDetector } from '../src/modules/documents/content-type-detector.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

await verifyApprovedTestConnection();

const schema = `doc_access_tenant_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const instA = '00000000-0000-0000-0000-000000000001';
const instB = '00000000-0000-0000-0000-000000000002';

const personA = '00000000-0000-0000-0000-000000000010';
const personB = '00000000-0000-0000-0000-000000000020';

const contextA: InstitutionalContext = {
  institutionId: instA,
  institutionName: 'Institution A',
  institutionSlug: 'inst-a',
  personId: personA,
  personName: 'Actor A',
  identityEmail: 'actorA@inst-a.edu',
  membershipId: '00000000-0000-0000-0000-000000000100',
  role: 'institution_admin',
};

const contextB: InstitutionalContext = {
  institutionId: instB,
  institutionName: 'Institution B',
  institutionSlug: 'inst-b',
  personId: personB,
  personName: 'Actor B',
  identityEmail: 'actorB@inst-b.edu',
  membershipId: '00000000-0000-0000-0000-000000000200',
  role: 'institution_admin',
};

const detector = new ContentTypeDetector({
  maxPrefixInspectionBytes: 4096,
  zipMetadataInspectionLimit: 64 * 1024,
  maxContainerEntryCount: 100,
  maxContainerMetadataBytes: 128 * 1024,
});

const policyEngine = new ConfigurableDocumentAccessPolicyEngine([
  {
    role: 'institution_admin',
    category: '*',
    allowedActions: ['view_metadata', 'open_content', 'download_content'],
  },
]);

const storageProvider = new MemoryObjectStorageProvider();
const malwareScanner = new DeterministicTestMalwareScanner();
const docRepo = new PostgresDocumentRepository();

try {
  await pool.query(`CREATE SCHEMA ${quote(schema)}`);
  const migrations = await discoverMigrations(migrationsDir);
  await runMigrations(pool, migrations);

  const client = await pool.connect();
  try {
    // Seed institutions and memberships
    await client.query(`
      INSERT INTO institutions (id, name, slug)
      VALUES
        ('${instA}', 'Institution A', 'inst-a'),
        ('${instB}', 'Institution B', 'inst-b')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO people (id, name)
      VALUES
        ('${personA}', 'Actor A'),
        ('${personB}', 'Actor B')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO memberships (id, institution_id, person_id, role, status)
      VALUES
        ('${contextA.membershipId}', '${instA}', '${personA}', 'institution_admin', 'active'),
        ('${contextB.membershipId}', '${instB}', '${personB}', 'institution_admin', 'active')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Create available document in Institution A
    const pdfBytes = Buffer.from('%PDF-1.4 Institution A private document');

    const docA = await docRepo.createDocument(client, {
      institutionId: instA,
      category: 'identification',
      createdByPersonId: personA,
    });

    const uploadSessionA = await createUploadSessionCommand({
      pool,
      context: contextA,
      idempotencyKey: 'idemp-tenant-upload-a',
      input: {
        documentId: docA.id,
        declaredFilename: 'id_a.pdf',
        declaredMimeType: 'application/pdf',
        declaredByteSize: pdfBytes.length,
        policyConfig: { globalMaxByteSize: 50 * 1024 * 1024 },
        storageProvider: 'test-memory',
        storageBucket: 'inst-a-bucket',
      },
    });

    await storageProvider.simulateDirectUpload({
      storageBucket: uploadSessionA.result.session.storageBucket,
      storageKey: uploadSessionA.result.session.storageKey,
      content: pdfBytes,
      mimeType: 'application/pdf',
    });

    const completeA = await completeUploadSessionCommand({
      pool,
      context: contextA,
      storageProvider,
      idempotencyKey: 'idemp-tenant-complete-a',
      input: {
        sessionId: uploadSessionA.result.session.id,
        rawToken: uploadSessionA.result.rawToken,
        provenance: {
          originType: 'user_upload',
          actorPersonId: personA,
          sourceDomain: 'documents.tenant.test',
          method: 'direct_upload',
        },
      },
    });

    await executeTechnicalVerificationPipelineCommand({
      pool,
      context: contextA,
      idempotencyKey: 'idemp-tenant-pipe-a',
      input: {
        documentId: docA.id,
        versionId: completeA.result.version.id,
        storageProvider,
        malwareScanner,
        contentTypeDetector: detector,
        retryPolicy: { maxAttempts: 3, baseBackoffMs: 1000, maxBackoffMs: 10000 },
      },
    });

    const docAId = docA.id;
    const verAId = completeA.result.version.id;

    // 1. CROSS_TENANT_AUTHORIZE_DENIED: Context B cannot authorize access to Inst A document
    await assert.rejects(
      async () => {
        await authorizeContentAccessCommand({
          pool,
          context: contextB,
          idempotencyKey: 'idemp-cross-tenant-auth',
          policyEngine,
          input: {
            documentId: docAId,
            versionId: verAId,
            action: 'open',
          },
        });
      },
      /DOCUMENT_NOT_FOUND/,
      'Cross-tenant access authorization must fail with DOCUMENT_NOT_FOUND',
    );

    // 2. CROSS_TENANT_GRANT_EXCHANGE_DENIED: Issue valid grant in Inst A, try exchange with Context B
    const grantA = await authorizeContentAccessCommand({
      pool,
      context: contextA,
      idempotencyKey: 'idemp-grant-a',
      policyEngine,
      input: {
        documentId: docAId,
        versionId: verAId,
        action: 'open',
      },
    });

    await assert.rejects(
      async () => {
        await exchangeGrantForContentStreamCommand({
          pool,
          context: contextB, // Using Institution B context
          policyEngine,
          storageProvider,
          input: {
            rawAccessToken: grantA.result.rawAccessToken!,
          },
        });
      },
      /GRANT_NOT_FOUND/,
      'Exchange of Institution A grant with Institution B context must fail with GRANT_NOT_FOUND',
    );

    // 3. CROSS_TENANT_REVOKE_DENIED: Admin B cannot revoke grant from Inst A
    await assert.rejects(
      async () => {
        await revokeContentAccessGrantCommand({
          pool,
          context: contextB,
          idempotencyKey: 'idemp-cross-revoke',
          input: {
            grantId: grantA.result.grant.id,
            reason: 'Malicious cross-tenant revocation attempt',
          },
        });
      },
      /GRANT_NOT_FOUND/,
      'Cross-tenant revocation must fail with GRANT_NOT_FOUND',
    );

    // 4. COMPOSITE_FK_INTEGRITY: Direct SQL insertion with cross-tenant document_id fails fk_doc_content_grants_inst_doc
    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO document_content_access_grants (
            institution_id,
            document_id,
            version_id,
            grantee_person_id,
            action,
            status,
            token_hash,
            issued_at,
            expires_at
          ) VALUES (
            $1, -- instB
            $2, -- docAId
            $3, -- verAId
            $4, -- personB
            'open',
            'active',
            '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            NOW(),
            NOW() + INTERVAL '5 minutes'
          )`,
          [instB, docAId, verAId, personB],
        );
      },
      /violates foreign key constraint "fk_doc_content_grants_inst_doc"/,
      'Composite FK must reject mismatched institution_id and document_id',
    );

    // 5. COMPOSITE_FK_INTEGRITY: Direct SQL insertion with matching instB+docB but cross-tenant version_id fails fk_doc_content_grants_inst_doc_ver
    const docB = await docRepo.createDocument(client, {
      institutionId: instB,
      category: 'identification',
      createdByPersonId: personB,
    });

    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO document_content_access_grants (
            institution_id,
            document_id,
            version_id,
            grantee_person_id,
            action,
            status,
            token_hash,
            issued_at,
            expires_at
          ) VALUES (
            $1, -- instB
            $2, -- docB.id (valid in instB)
            $3, -- verAId (belongs to instA)
            $4, -- personB
            'open',
            'active',
            '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            NOW(),
            NOW() + INTERVAL '5 minutes'
          )`,
          [instB, docB.id, verAId, personB],
        );
      },
      /violates foreign key constraint "fk_doc_content_grants_inst_doc_ver"/,
      'Composite FK must reject mismatched institution_id, document_id, and version_id',
    );

    console.log('[DOCUMENTS-ACCESS-MULTI-TENANT] PASS: Multi-tenant isolation, cross-tenant denial and composite FK integrity verified.');
  } finally {
    client.release();
  }
} finally {
  await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  await pool.end();
}
