import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import {
  createDocumentWithInitialVersionCommand,
  appendDocumentVersionCommand,
  executeIdempotentDocumentsCommand,
} from '../src/modules/documents/document-command.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';

await verifyApprovedTestConnection();

const schema = `doc_tenant_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionA = '00000000-0000-0000-0000-00000000000a';
const institutionB = '00000000-0000-0000-0000-00000000000b';
const actorA = '00000000-0000-0000-0000-00000000001a';
const actorB = '00000000-0000-0000-0000-00000000001b';

const contextA: InstitutionalContext = {
  institutionId: institutionA,
  institutionName: 'Institution Alpha',
  institutionSlug: 'inst-alpha',
  personId: actorA,
  personName: 'Actor Alpha',
  identityEmail: 'alpha@nexus.edu',
  membershipId: '00000000-0000-0000-0000-00000000002a',
  role: 'institution_admin',
};

const contextB: InstitutionalContext = {
  institutionId: institutionB,
  institutionName: 'Institution Beta',
  institutionSlug: 'inst-beta',
  personId: actorB,
  personName: 'Actor Beta',
  identityEmail: 'beta@nexus.edu',
  membershipId: '00000000-0000-0000-0000-00000000002b',
  role: 'institution_admin',
};

const client = await pool.connect();
try {
  await client.query(`CREATE SCHEMA ${quote(schema)}`);
  await client.query(`SET search_path TO ${quote(schema)}, public`);

  const migrations = await discoverMigrations(migrationsDir);
  await runMigrations(client, migrations);

  // Seed fixture institutions and actors
  await client.query(`INSERT INTO institutions (id, name, slug, status) VALUES ($1, 'Institution Alpha', 'inst-alpha', 'active')`, [institutionA]);
  await client.query(`INSERT INTO institutions (id, name, slug, status) VALUES ($1, 'Institution Beta', 'inst-beta', 'active')`, [institutionB]);
  await client.query(`INSERT INTO people (id, name) VALUES ($1, 'Actor Alpha')`, [actorA]);
  await client.query(`INSERT INTO people (id, name) VALUES ($1, 'Actor Beta')`, [actorB]);

  // 1. Institution A creates Document D_A1
  const createdA1 = await createDocumentWithInitialVersionCommand({
    pool,
    context: contextA,
    idempotencyKey: 'key-alpha-doc-01',
    input: {
      category: 'confidential_contract',
      classification: 'tuition_agreement',
      mimeType: 'application/pdf',
      byteSize: 1024,
      sha256Hash: 'a'.repeat(64),
      provenance: {
        originType: 'user_upload',
        sourceDomain: 'finance',
        method: 'portal_upload',
        correlationId: 'corr-alpha-01',
      },
      storageReference: {
        storageProvider: 'gcs',
        storageBucket: 'alpha-vault',
        storageKey: 'tenants/alpha/docs/doc1.pdf',
      },
    },
  });

  const docA1Id = createdA1.result.document.id;
  const versionA1Id = createdA1.result.version.id;

  // 2. Institution A creates Document D_A2
  const createdA2 = await createDocumentWithInitialVersionCommand({
    pool,
    context: contextA,
    idempotencyKey: 'key-alpha-doc-02',
    input: {
      category: 'academic_record',
      mimeType: 'application/pdf',
      byteSize: 2048,
      sha256Hash: '2'.repeat(64),
      provenance: {
        originType: 'user_upload',
        sourceDomain: 'academic',
        method: 'portal_upload',
      },
    },
  });
  const docA2Id = createdA2.result.document.id;
  const versionA2Id = createdA2.result.version.id;

  // 3. Institution B creates Document D_B1
  const createdB1 = await createDocumentWithInitialVersionCommand({
    pool,
    context: contextB,
    idempotencyKey: 'key-beta-doc-01',
    input: {
      category: 'identity_proof',
      mimeType: 'application/pdf',
      byteSize: 3072,
      sha256Hash: 'b'.repeat(64),
      provenance: {
        originType: 'user_upload',
        sourceDomain: 'enrollment',
        method: 'portal_upload',
      },
    },
  });
  const docB1Id = createdB1.result.document.id;
  const versionB1Id = createdB1.result.version.id;

  const repo = new PostgresDocumentRepository();

  // 4. Institution B attempts to read D_A1 via repository -> null
  const docFromB = await repo.getDocumentById(client, institutionB, docA1Id);
  assert.strictEqual(docFromB, null, 'Institution B must NOT be able to read Institution A document');

  // 5. Institution B attempts to list versions of D_A1 -> empty
  const versionsFromB = await repo.listVersions(client, institutionB, docA1Id);
  assert.strictEqual(versionsFromB.length, 0, 'Institution B must get 0 versions for Institution A document');

  // 6. Institution B attempts to append version to D_A1 via command -> rejected
  await assert.rejects(
    async () => {
      await appendDocumentVersionCommand({
        pool,
        context: contextB,
        idempotencyKey: 'key-beta-attack-01',
        input: {
          documentId: docA1Id,
          mimeType: 'application/pdf',
          byteSize: 2048,
          sha256Hash: 'b'.repeat(64),
          provenance: {
            originType: 'user_upload',
            sourceDomain: 'portal',
            method: 'cross_tenant_injection',
          },
        },
      });
    },
    /Document .* not found in institution/,
    'Institution B must be denied when attempting to append version to Institution A document',
  );

  // 7. Direct SQL injection: Attempt cross-tenant version link in PostgreSQL
  await assert.rejects(
    async () => {
      await client.query(
        `INSERT INTO document_versions (
          institution_id, document_id, version_number, mime_type, byte_size, sha256_hash, created_by_person_id
        ) VALUES ($1, $2, 99, 'application/pdf', 1024, $3, $4)`,
        [institutionB, docA1Id, 'f'.repeat(64), actorB],
      );
    },
    /violates foreign key constraint "document_versions_document_tenant_fk"/,
    'PostgreSQL composite foreign key must reject cross-tenant version insertion',
  );

  // 8. BLOCKER 1: Document Audit Event Version Tenant Integrity Negative Test
  // Attempt to log an audit event in Institution A referencing a version belonging to Institution B
  await assert.rejects(
    async () => {
      await client.query(
        `INSERT INTO document_audit_events (
          institution_id, document_id, version_id, actor_person_id, action, outcome
        ) VALUES ($1, $2, $3, $4, 'document.view', 'success')`,
        [institutionA, docA1Id, versionB1Id, actorA],
      );
    },
    /violates foreign key constraint "document_audit_events_version_tenant_fk"/,
    'PostgreSQL composite FK document_audit_events_version_tenant_fk must reject cross-tenant version_id in audit events',
  );

  // Valid audit event with matching tenant version succeeds
  await client.query(
    `INSERT INTO document_audit_events (
      institution_id, document_id, version_id, actor_person_id, action, outcome
    ) VALUES ($1, $2, $3, $4, 'document.view', 'success')`,
    [institutionA, docA1Id, versionA1Id, actorA],
  );

  // 9. BLOCKER 2: Provenance Document/Version Consistency Negative Tests
  // 9a. Same Tenant Mismatch: Document D_A1 + Version V_A2_1 (which belongs to D_A2, not D_A1)
  await assert.rejects(
    async () => {
      await client.query(
        `INSERT INTO document_provenance (
          institution_id, document_id, version_id, origin_type, source_domain, method
        ) VALUES ($1, $2, $3, 'user_upload', 'portal', 'same_tenant_mismatch')`,
        [institutionA, docA1Id, versionA2Id],
      );
    },
    /violates foreign key constraint "document_provenance_version_doc_tenant_fk"/,
    'PostgreSQL composite FK must reject provenance insertion where version does not belong to the specified document',
  );

  // 9b. Cross Tenant Mismatch: Document D_A1 + Version V_B1 (belonging to Institution B)
  await assert.rejects(
    async () => {
      await client.query(
        `INSERT INTO document_provenance (
          institution_id, document_id, version_id, origin_type, source_domain, method
        ) VALUES ($1, $2, $3, 'user_upload', 'portal', 'cross_tenant_mismatch')`,
        [institutionA, docA1Id, versionB1Id],
      );
    },
    /violates foreign key constraint "document_provenance_version_doc_tenant_fk"/,
    'PostgreSQL composite FK must reject provenance insertion referencing cross-tenant version',
  );

  // 10. Direct SQL injection: Attempt cross-tenant storage reference link
  await assert.rejects(
    async () => {
      await client.query(
        `INSERT INTO document_storage_references (
          institution_id, version_id, storage_provider, storage_bucket, storage_key
        ) VALUES ($1, $2, 'gcs', 'beta-bucket', 'beta-key')`,
        [institutionB, versionA1Id],
      );
    },
    /violates foreign key constraint/,
    'PostgreSQL composite foreign key must reject cross-tenant storage reference insertion',
  );

  // 11. Caller context spoofing attempt
  await assert.rejects(
    async () => {
      await executeIdempotentDocumentsCommand({
        pool,
        context: contextA, // Actor belongs to A
        identity: {
          institutionId: institutionB, // Identity targets B
          commandScope: 'documents.spoof_test',
          idempotencyKey: 'key-spoofed-01',
          canonicalFingerprint: 'f'.repeat(64),
        },
        execute: async () => ({ resultRef: 'test', result: true }),
        loadResult: async () => true,
      });
    },
    /InstitutionalContext mismatch: caller is not authorized for target institution/,
    'executeIdempotentDocumentsCommand must fail closed when caller context does not match target institution',
  );

  console.log('[DOCUMENTS-MULTI-TENANT-NEGATIVE] PASS: Multi-tenant negative isolation & relational constraints verified.');
} finally {
  try {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } finally {
    client.release();
    await pool.end();
  }
}
