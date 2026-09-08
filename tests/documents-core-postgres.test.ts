import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import { PostgresDocumentAuditRepository } from '../src/modules/documents/document-audit.ts';

await verifyApprovedTestConnection();

const schema = `doc_core_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionId = '00000000-0000-0000-0000-000000000001';
const personId = '00000000-0000-0000-0000-000000000002';

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
  const auditRepo = new PostgresDocumentAuditRepository();

  // 1. Create Document
  const doc = await docRepo.createDocument(client, {
    institutionId,
    category: 'identification',
    classification: 'citizen_card',
    createdByPersonId: personId,
  });

  assert.ok(doc.id, 'Document ID must be generated');
  assert.strictEqual(doc.institutionId, institutionId);
  assert.strictEqual(doc.category, 'identification');
  assert.strictEqual(doc.classification, 'citizen_card');
  assert.strictEqual(doc.status, 'active');

  // 2. Create Initial Version with Provenance and Storage Reference
  const v1 = await docRepo.createNextVersion(client, {
    institutionId,
    documentId: doc.id,
    mimeType: 'application/pdf',
    byteSize: 2048,
    sha256Hash: 'a'.repeat(64),
    createdByPersonId: personId,
    provenance: {
      originType: 'user_upload',
      actorPersonId: personId,
      sourceDomain: 'portal',
      method: 'direct_upload',
      correlationId: 'corr-001',
    },
    storageReference: {
      storageProvider: 'gcs',
      storageBucket: 'nexus-vault',
      storageKey: 'tenants/1/docs/v1.pdf',
    },
  });

  assert.strictEqual(v1.version.versionNumber, 1);
  assert.strictEqual(v1.version.documentId, doc.id);
  assert.strictEqual(v1.provenance.originType, 'user_upload');
  assert.strictEqual(v1.storageReference?.storageKey, 'tenants/1/docs/v1.pdf');

  // 3. Append Version 2
  const v2 = await docRepo.createNextVersion(client, {
    institutionId,
    documentId: doc.id,
    mimeType: 'application/pdf',
    byteSize: 4096,
    sha256Hash: 'b'.repeat(64),
    createdByPersonId: personId,
    provenance: {
      originType: 'user_upload',
      actorPersonId: personId,
      sourceDomain: 'portal',
      method: 'version_update',
      correlationId: 'corr-002',
    },
    storageReference: {
      storageProvider: 'gcs',
      storageBucket: 'nexus-vault',
      storageKey: 'tenants/1/docs/v2.pdf',
    },
  });

  assert.strictEqual(v2.version.versionNumber, 2);
  assert.strictEqual(v2.version.documentId, doc.id);

  // 4. List and verify immutability
  const allVersions = await docRepo.listVersions(client, institutionId, doc.id);
  assert.strictEqual(allVersions.length, 2);
  assert.strictEqual(allVersions[0].versionNumber, 1);
  assert.strictEqual(allVersions[1].versionNumber, 2);

  // 5. Query Provenance and Storage Ref
  const prov1 = await docRepo.getProvenanceForVersion(client, institutionId, v1.version.id);
  assert.strictEqual(prov1.length, 1);
  assert.strictEqual(prov1[0].correlationId, 'corr-001');

  const storage2 = await docRepo.getStorageReferenceForVersion(client, institutionId, v2.version.id);
  assert.strictEqual(storage2?.storageKey, 'tenants/1/docs/v2.pdf');

  // 6. Record and query Audit Events
  await auditRepo.recordAuditEvent(client, {
    institutionId,
    documentId: doc.id,
    versionId: v1.version.id,
    actorPersonId: personId,
    action: 'document.created',
    outcome: 'success',
    correlationId: 'audit-001',
    details: { note: 'Initial upload' },
  });

  const auditEvents = await auditRepo.getAuditEventsForDocument(client, institutionId, doc.id);
  assert.strictEqual(auditEvents.length, 1);
  assert.strictEqual(auditEvents[0].action, 'document.created');
  assert.strictEqual(auditEvents[0].outcome, 'success');

  // 7. Test Rollback in transaction
  await client.query('BEGIN');
  await docRepo.createDocument(client, {
    institutionId,
    category: 'temporary',
    createdByPersonId: personId,
  });
  await client.query('ROLLBACK');

  const rolledBack = await client.query(`SELECT count(*)::int as c FROM documents WHERE category = 'temporary'`);
  assert.strictEqual(rolledBack.rows[0].c, 0, 'Rolled back document must not be persisted');

  console.log('[DOCUMENTS-CORE-POSTGRES] PASS: Full PostgreSQL persistence lifecycle verified.');
} finally {
  try {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } finally {
    client.release();
    await pool.end();
  }
}
