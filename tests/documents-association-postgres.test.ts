import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import { PostgresDocumentAssociationRepository } from '../src/modules/documents/document-association-repository.ts';
import { PostgresDocumentAuditRepository } from '../src/modules/documents/document-audit.ts';

await verifyApprovedTestConnection();

const schema = `doc_assoc_${randomUUID().replaceAll('-', '')}`;
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
  const assocRepo = new PostgresDocumentAssociationRepository();
  const auditRepo = new PostgresDocumentAuditRepository();

  // 1. Create Document and Version (I1 foundation)
  const doc = await docRepo.createDocument(client, {
    institutionId,
    category: 'identity_proof',
    createdByPersonId: personId,
  });

  const { version: ver1 } = await docRepo.createNextVersion(client, {
    institutionId,
    documentId: doc.id,
    mimeType: 'application/pdf',
    byteSize: 1024,
    sha256Hash: 'a'.repeat(64),
    createdByPersonId: personId,
    provenance: {
      originType: 'user_upload',
      sourceDomain: 'portal',
      method: 'upload',
    },
  });

  // 2. Create DocumentAssociation targeting Enrollment Application
  const assoc = await assocRepo.createAssociation(client, {
    institutionId,
    documentId: doc.id,
    targetDomain: 'enrollment',
    targetResourceType: 'enrollment_application',
    targetResourceId: 'app-9988',
    purpose: 'identity_verification',
    createdByPersonId: personId,
  });

  assert.ok(assoc.id);
  assert.strictEqual(assoc.institutionId, institutionId);
  assert.strictEqual(assoc.documentId, doc.id);
  assert.strictEqual(assoc.pinnedVersionId, null, 'Initial association without version pinning has null pinnedVersionId');
  assert.strictEqual(assoc.targetDomain, 'enrollment');
  assert.strictEqual(assoc.targetResourceType, 'enrollment_application');
  assert.strictEqual(assoc.targetResourceId, 'app-9988');
  assert.strictEqual(assoc.purpose, 'identity_verification');
  assert.strictEqual(assoc.status, 'active');

  // 3. List associations for document & target
  const docAssocs = await assocRepo.listAssociationsForDocument(client, institutionId, doc.id);
  assert.strictEqual(docAssocs.length, 1);
  assert.strictEqual(docAssocs[0].id, assoc.id);

  const targetAssocs = await assocRepo.listAssociationsForTarget(
    client,
    institutionId,
    'enrollment',
    'enrollment_application',
    'app-9988',
  );
  assert.strictEqual(targetAssocs.length, 1);
  assert.strictEqual(targetAssocs[0].id, assoc.id);

  // 4. Pin Version to Association
  const pinnedAssoc = await assocRepo.pinVersion(client, institutionId, assoc.id, ver1.id);
  assert.strictEqual(pinnedAssoc.pinnedVersionId, ver1.id);

  // 5. Record Factual BusinessDecisionReference
  const decisionRef = await assocRepo.recordBusinessDecisionReference(client, {
    institutionId,
    associationId: assoc.id,
    documentId: doc.id,
    versionId: ver1.id,
    authorityDomain: 'enrollment',
    decisionType: 'intake_identity_verification',
    decisionOutcome: 'accepted',
    decisionReason: 'Document validated against national registry',
    externalReference: 'app-9988:step-04',
    decidedByPersonId: personId,
    correlationId: 'corr-decision-001',
  });

  assert.ok(decisionRef.id);
  assert.strictEqual(decisionRef.institutionId, institutionId);
  assert.strictEqual(decisionRef.associationId, assoc.id);
  assert.strictEqual(decisionRef.versionId, ver1.id);
  assert.strictEqual(decisionRef.decisionOutcome, 'accepted');

  // 6. Prove decision reference does NOT mutate Document, Version, or Association status
  const refreshedDoc = await docRepo.getDocumentById(client, institutionId, doc.id);
  const refreshedVer = await docRepo.getVersionById(client, institutionId, ver1.id);
  const refreshedAssoc = await assocRepo.getAssociationById(client, institutionId, assoc.id);

  assert.strictEqual(refreshedDoc?.status, 'active', 'Document status must remain unchanged by external decision');
  assert.strictEqual(refreshedVer?.status, 'content_received', 'Version status must remain unchanged by external decision');
  assert.strictEqual(refreshedAssoc?.status, 'active', 'Association status must remain unchanged by external decision');

  // 7. Transition Association Status
  const withdrawnAssoc = await assocRepo.transitionStatus(client, institutionId, assoc.id, 'withdrawn');
  assert.strictEqual(withdrawnAssoc.status, 'withdrawn');

  // Further mutations on withdrawn association are rejected
  await assert.rejects(
    async () => {
      await assocRepo.pinVersion(client, institutionId, assoc.id, ver1.id);
    },
    /Cannot pin version on association with status "withdrawn"/,
  );

  console.log('[DOCUMENTS-ASSOCIATION-POSTGRES] PASS: Full PostgreSQL association & decision reference lifecycle verified.');
} finally {
  try {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } finally {
    client.release();
    await pool.end();
  }
}
