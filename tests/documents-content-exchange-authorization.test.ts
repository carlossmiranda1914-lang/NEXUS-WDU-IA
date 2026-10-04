import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import express, { type Request, type Response, type NextFunction } from 'express';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import { PostgresDocumentAccessRepository } from '../src/modules/documents/document-access-repository.ts';
import {
  authorizeContentAccessCommand,
  exchangeGrantForContentStreamCommand,
} from '../src/modules/documents/document-access-command.ts';
import {
  ConfigurableDocumentAccessPolicyEngine,
} from '../src/modules/documents/document-access-policy.ts';
import { registerDocumentRoutes } from '../src/modules/documents/document.controller.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { DeterministicTestMalwareScanner } from './support/deterministic-test-malware-scanner.ts';

await verifyApprovedTestConnection();

const schema = `doc_exchange_auth_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const instA = '00000000-0000-0000-0000-000000000001';
const instB = '00000000-0000-0000-0000-000000000002';

const adminAId = '00000000-0000-0000-0000-000000000010';
const manager2AId = '00000000-0000-0000-0000-000000000019';
const studentAId = '00000000-0000-0000-0000-000000000011';
const teacherAId = '00000000-0000-0000-0000-000000000012';
const parentAId = '00000000-0000-0000-0000-000000000013';

const adminBId = '00000000-0000-0000-0000-000000000020';

const adminContext: InstitutionalContext = {
  institutionId: instA,
  institutionName: 'Inst A',
  institutionSlug: 'inst-a',
  personId: adminAId,
  personName: 'Admin A',
  identityEmail: 'admin@inst-a.edu',
  membershipId: '00000000-0000-0000-0000-000000000100',
  role: 'institution_admin',
};

const manager2Context: InstitutionalContext = {
  institutionId: instA,
  institutionName: 'Inst A',
  institutionSlug: 'inst-a',
  personId: manager2AId,
  personName: 'Manager 2 A',
  identityEmail: 'manager2@inst-a.edu',
  membershipId: '00000000-0000-0000-0000-000000000109',
  role: 'institution_admin',
};

const studentContext: InstitutionalContext = {
  institutionId: instA,
  institutionName: 'Inst A',
  institutionSlug: 'inst-a',
  personId: studentAId,
  personName: 'Student A',
  identityEmail: 'student@inst-a.edu',
  membershipId: '00000000-0000-0000-0000-000000000101',
  role: 'student',
};

const teacherContext: InstitutionalContext = {
  institutionId: instA,
  institutionName: 'Inst A',
  institutionSlug: 'inst-a',
  personId: teacherAId,
  personName: 'Teacher A',
  identityEmail: 'teacher@inst-a.edu',
  membershipId: '00000000-0000-0000-0000-000000000102',
  role: 'teacher',
};

const parentContext: InstitutionalContext = {
  institutionId: instA,
  institutionName: 'Inst A',
  institutionSlug: 'inst-a',
  personId: parentAId,
  personName: 'Parent A',
  identityEmail: 'parent@inst-a.edu',
  membershipId: '00000000-0000-0000-0000-000000000103',
  role: 'parent',
};

const adminBContext: InstitutionalContext = {
  institutionId: instB,
  institutionName: 'Inst B',
  institutionSlug: 'inst-b',
  personId: adminBId,
  personName: 'Admin B',
  identityEmail: 'admin@inst-b.edu',
  membershipId: '00000000-0000-0000-0000-000000000200',
  role: 'institution_admin',
};

const TEST_KEY = 'EXPLICIT_TEST_SECRET_minimum_32_bytes_for_hmac_derivation';

const policyEngine = new ConfigurableDocumentAccessPolicyEngine([
  {
    role: 'institution_admin',
    category: '*',
    allowedActions: ['view_metadata', 'open_content', 'download_content'],
  },
  {
    role: 'teacher',
    category: '*',
    allowedActions: ['view_metadata'],
  },
  {
    role: 'student',
    category: '*',
    allowedActions: ['view_metadata'],
  },
  {
    role: 'parent',
    category: '*',
    allowedActions: ['view_metadata'],
  },
]);

const storageProvider = new MemoryObjectStorageProvider();
const malwareScanner = new DeterministicTestMalwareScanner();

const client = await pool.connect();
try {
  await client.query(`CREATE SCHEMA ${quote(schema)}`);
  await client.query(`SET search_path TO ${quote(schema)}, public`);

  const migrations = await discoverMigrations(migrationsDir);
  await runMigrations(client, migrations);

  // Seed fixture institutions and people
  await client.query(
    `INSERT INTO institutions (id, name, slug, status) VALUES
     ($1, 'Inst A', 'inst-a', 'active'),
     ($2, 'Inst B', 'inst-b', 'active')`,
    [instA, instB],
  );

  await client.query(
    `INSERT INTO people (id, name) VALUES
     ($1, 'Admin A'),
     ($2, 'Student A'),
     ($3, 'Teacher A'),
     ($4, 'Parent A'),
     ($5, 'Admin B'),
     ($6, 'Manager 2 A')`,
    [adminAId, studentAId, teacherAId, parentAId, adminBId, manager2AId],
  );

  await client.query(
    `INSERT INTO memberships (id, institution_id, person_id, role, status) VALUES
     ($1, $2, $3, 'institution_admin', 'active'),
     ($4, $2, $5, 'student', 'active'),
     ($6, $2, $7, 'teacher', 'active'),
     ($8, $2, $9, 'parent', 'active'),
     ($10, $11, $12, 'institution_admin', 'active'),
     ($13, $2, $14, 'institution_admin', 'active')`,
    [
      adminContext.membershipId, instA, adminAId,
      studentContext.membershipId, studentAId,
      teacherContext.membershipId, teacherAId,
      parentContext.membershipId, parentAId,
      adminBContext.membershipId, instB, adminBId,
      manager2Context.membershipId, manager2AId,
    ],
  );

  const docRepo = new PostgresDocumentRepository();
  const accessRepo = new PostgresDocumentAccessRepository();

  // Create documents and versions in Inst A
  const samplePdfBytes = Buffer.from('%PDF-1.4 test document content for streaming proof', 'utf-8');
  const storageBucketA = 'bucket-a';
  const storageKeyA = `documents/${instA}/test_ver_a.pdf`;

  // Seed storage
  await storageProvider.simulateDirectUpload(
    storageBucketA,
    storageKeyA,
    samplePdfBytes,
    'application/pdf',
  );

  const docA = await docRepo.createDocument(client, {
    institutionId: instA,
    category: 'identity_proof',
    createdByPersonId: adminAId,
  });

  const { version: verA } = await docRepo.createNextVersion(client, {
    institutionId: instA,
    documentId: docA.id,
    mimeType: 'application/pdf',
    byteSize: samplePdfBytes.length,
    sha256Hash: 'a'.repeat(64),
    createdByPersonId: adminAId,
    provenance: {
      originType: 'user_upload',
      sourceDomain: 'documents',
      method: 'test',
    },
  });

  await client.query(`UPDATE document_versions SET status = 'available' WHERE id = $1`, [verA.id]);
  await client.query(
    `INSERT INTO document_storage_references (
       id, institution_id, version_id, storage_provider, storage_bucket, storage_key, content_availability, created_at
     ) VALUES ($1, $2, $3, 'memory', $4, $5, 'available', NOW())`,
    [randomUUID(), instA, verA.id, storageBucketA, storageKeyA],
  );

  // Inst B Document and Version
  const docB = await docRepo.createDocument(client, {
    institutionId: instB,
    category: 'academic_transcript',
    createdByPersonId: adminBId,
  });
  const { version: verB } = await docRepo.createNextVersion(client, {
    institutionId: instB,
    documentId: docB.id,
    mimeType: 'application/pdf',
    byteSize: 1024,
    sha256Hash: 'b'.repeat(64),
    createdByPersonId: adminBId,
    provenance: {
      originType: 'user_upload',
      sourceDomain: 'documents',
      method: 'test',
    },
  });
  await client.query(`UPDATE document_versions SET status = 'available' WHERE id = $1`, [verB.id]);
  await client.query(
    `INSERT INTO document_storage_references (
       id, institution_id, version_id, storage_provider, storage_bucket, storage_key, content_availability, created_at
     ) VALUES ($1, $2, $3, 'memory', 'bucket-b', 'key-b', 'available', NOW())`,
    [randomUUID(), instB, verB.id],
  );

  // Setup express test server
  let currentContext: InstitutionalContext = adminContext;
  const app = express();
  app.use(express.json());
  registerDocumentRoutes(app, {
    pool,
    requireAuth: (req: Request, res: Response, next: NextFunction) => {
      (req as any).institutionalContext = currentContext;
      next();
    },
    policyEngine,
    accessGrantTokenKey: TEST_KEY,
    storageProvider,
    malwareScanner,
  });

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ==========================================
    // [TEST 1] POSITIVE STREAM
    // ==========================================
    console.log('[TEST 1] Positive Stream: active manager with valid token receives stream');
    currentContext = adminContext;
    const auth1 = await authorizeContentAccessCommand({
      pool,
      context: adminContext,
      idempotencyKey: 'auth-token-test-1',
      policyEngine,
      accessGrantTokenKey: TEST_KEY,
      input: {
        documentId: docA.id,
        versionId: verA.id,
        action: 'open',
      },
    });

    const res1 = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAccessToken: auth1.result.rawAccessToken }),
    });

    assert.strictEqual(res1.status, 200, 'Exchange must return 200 OK');
    assert.strictEqual(res1.headers.get('content-type'), 'application/pdf');
    assert.strictEqual(res1.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(res1.headers.get('storage-bucket'), null, 'Bucket must not be exposed');
    assert.strictEqual(res1.headers.get('storage-key'), null, 'Key must not be exposed');

    const streamedBuf = Buffer.from(await res1.arrayBuffer());
    assert.deepStrictEqual(streamedBuf, samplePdfBytes, 'Streamed bytes must match storage object');

    // Verify usage recorded
    const grantRow1 = await accessRepo.getGrantById(client, instA, auth1.result.grant.id);
    assert.ok(grantRow1);
    assert.ok(grantRow1.consumedAt, 'Grant consumedAt must be populated on successful stream');

    // ==========================================
    // [TEST 2] CURRENT ROLE REVALIDATION / DOWNGRADE
    // ==========================================
    console.log('[TEST 2] Role downgrade revalidation: historical role does not survive authority loss');
    const auth2 = await authorizeContentAccessCommand({
      pool,
      context: adminContext,
      idempotencyKey: 'auth-token-test-2',
      policyEngine,
      accessGrantTokenKey: TEST_KEY,
      input: {
        documentId: docA.id,
        versionId: verA.id,
        action: 'open',
      },
    });

    // 2.1 Downgrade to teacher
    await client.query(`UPDATE memberships SET role = 'teacher' WHERE id = $1`, [adminContext.membershipId]);
    const resTeacher = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAccessToken: auth2.result.rawAccessToken }),
    });
    assert.strictEqual(resTeacher.status, 403, 'Downgraded teacher must be denied with 403');
    const teacherBody = await resTeacher.json() as any;
    assert.strictEqual(teacherBody.code, 'AUTHORIZATION_DENIED');

    // 2.2 Downgrade to student
    await client.query(`UPDATE memberships SET role = 'student' WHERE id = $1`, [adminContext.membershipId]);
    const resStudent = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAccessToken: auth2.result.rawAccessToken }),
    });
    assert.strictEqual(resStudent.status, 403, 'Downgraded student must be denied with 403');

    // 2.3 Downgrade to parent
    await client.query(`UPDATE memberships SET role = 'parent' WHERE id = $1`, [adminContext.membershipId]);
    const resParent = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAccessToken: auth2.result.rawAccessToken }),
    });
    assert.strictEqual(resParent.status, 403, 'Downgraded parent must be denied with 403');

    // Restore role
    await client.query(`UPDATE memberships SET role = 'institution_admin' WHERE id = $1`, [adminContext.membershipId]);

    // ==========================================
    // [TEST 3] MEMBERSHIP INACTIVATION & DELETION
    // ==========================================
    console.log('[TEST 3] Membership inactivation and deletion denies exchange');
    const auth3 = await authorizeContentAccessCommand({
      pool,
      context: adminContext,
      idempotencyKey: 'auth-token-test-3',
      policyEngine,
      accessGrantTokenKey: TEST_KEY,
      input: {
        documentId: docA.id,
        versionId: verA.id,
        action: 'open',
      },
    });

    // Inactivate (suspend) membership
    await client.query(`UPDATE memberships SET status = 'suspended' WHERE id = $1`, [adminContext.membershipId]);
    const resInactive = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAccessToken: auth3.result.rawAccessToken }),
    });
    assert.strictEqual(resInactive.status, 403, 'Suspended membership must be denied with 403');

    // Delete membership
    await client.query(`DELETE FROM memberships WHERE id = $1`, [adminContext.membershipId]);
    const resDeleted = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAccessToken: auth3.result.rawAccessToken }),
    });
    assert.strictEqual(resDeleted.status, 403, 'Deleted membership must be denied with 403');

    // Re-insert active membership
    await client.query(
      `INSERT INTO memberships (id, institution_id, person_id, role, status)
       VALUES ($1, $2, $3, 'institution_admin', 'active')`,
      [adminContext.membershipId, instA, adminAId],
    );

    // ==========================================
    // [TEST 4] GRANT STATE: REVOKED, EXPIRED, INACTIVE
    // ==========================================
    console.log('[TEST 4] Grant state validation: revoked, expired, and inactive grants deny exchange');
    // 4.1 Revoked grant
    const authRevoked = await authorizeContentAccessCommand({
      pool,
      context: adminContext,
      idempotencyKey: 'auth-token-test-4-revoked',
      policyEngine,
      accessGrantTokenKey: TEST_KEY,
      input: {
        documentId: docA.id,
        versionId: verA.id,
        action: 'open',
      },
    });
    await client.query(
      `UPDATE document_content_access_grants SET status = 'revoked', revocation_reason = 'Manual test revoke' WHERE id = $1`,
      [authRevoked.result.grant.id],
    );
    const resRevoked = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAccessToken: authRevoked.result.rawAccessToken }),
    });
    assert.strictEqual(resRevoked.status, 409, 'Revoked grant must return 409 Conflict');

    // 4.2 Expired grant
    const authExpired = await authorizeContentAccessCommand({
      pool,
      context: adminContext,
      idempotencyKey: 'auth-token-test-4-expired',
      policyEngine,
      accessGrantTokenKey: TEST_KEY,
      input: {
        documentId: docA.id,
        versionId: verA.id,
        action: 'open',
      },
    });
    await client.query(
      `UPDATE document_content_access_grants SET expires_at = NOW() - INTERVAL '1 hour', status = 'expired' WHERE id = $1`,
      [authExpired.result.grant.id],
    );
    const resExpired = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAccessToken: authExpired.result.rawAccessToken }),
    });
    assert.strictEqual(resExpired.status, 409, 'Expired grant must return 409 Conflict');

    // 4.3 Inactive grant
    const authInactive = await authorizeContentAccessCommand({
      pool,
      context: adminContext,
      idempotencyKey: 'auth-token-test-4-inactive',
      policyEngine,
      accessGrantTokenKey: TEST_KEY,
      input: {
        documentId: docA.id,
        versionId: verA.id,
        action: 'open',
      },
    });
    await client.query(
      `UPDATE document_content_access_grants SET status = 'consumed' WHERE id = $1`,
      [authInactive.result.grant.id],
    );
    const resInactiveGrant = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAccessToken: authInactive.result.rawAccessToken }),
    });
    assert.strictEqual(resInactiveGrant.status, 409, 'Inactive grant must return 409 Conflict');

    // ==========================================
    // [TEST 5] IDENTITY & TENANT BINDING
    // ==========================================
    console.log('[TEST 5] Identity and Tenant binding: wrong actor or wrong tenant denies exchange');
    const auth5 = await authorizeContentAccessCommand({
      pool,
      context: adminContext,
      idempotencyKey: 'auth-token-test-5',
      policyEngine,
      accessGrantTokenKey: TEST_KEY,
      input: {
        documentId: docA.id,
        versionId: verA.id,
        action: 'open',
      },
    });

    // 5.1 Actor B in same institution attempts to use Actor A's token
    currentContext = manager2Context;
    const resWrongActor = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAccessToken: auth5.result.rawAccessToken }),
    });
    assert.strictEqual(resWrongActor.status, 403, 'Actor mismatch must return 403 Forbidden');

    // 5.2 Actor in different institution attempts to use Token from Inst A
    currentContext = adminBContext;
    const resWrongTenant = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAccessToken: auth5.result.rawAccessToken }),
    });
    assert.strictEqual(resWrongTenant.status, 404, 'Cross-tenant token must return 404 Not Found');

    currentContext = adminContext;

    // ==========================================
    // [TEST 6] RESOURCE LIFECYCLE & INTEGRITY
    // ==========================================
    console.log('[TEST 6] Resource lifecycle, quarantine, and version-document integrity');
    // 6.1 Quarantined document
    const auth6 = await authorizeContentAccessCommand({
      pool,
      context: adminContext,
      idempotencyKey: 'auth-token-test-6',
      policyEngine,
      accessGrantTokenKey: TEST_KEY,
      input: {
        documentId: docA.id,
        versionId: verA.id,
        action: 'open',
      },
    });

    // 6.1 Archived document
    await client.query(`UPDATE documents SET status = 'archived' WHERE id = $1`, [docA.id]);
    const resArchivedDoc = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAccessToken: auth6.result.rawAccessToken }),
    });
    assert.strictEqual(resArchivedDoc.status, 403, 'Archived document must return 403');
    await client.query(`UPDATE documents SET status = 'active' WHERE id = $1`, [docA.id]);

    // 6.2 Quarantined version
    await client.query(`UPDATE document_versions SET status = 'quarantined' WHERE id = $1`, [verA.id]);
    const resQuarantineVer = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAccessToken: auth6.result.rawAccessToken }),
    });
    assert.strictEqual(resQuarantineVer.status, 403, 'Quarantined version must return 403');
    await client.query(`UPDATE document_versions SET status = 'available' WHERE id = $1`, [verA.id]);

    // 6.3 Non-available version (e.g. superseded)
    await client.query(`UPDATE document_versions SET status = 'superseded' WHERE id = $1`, [verA.id]);
    const resSuperseded = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAccessToken: auth6.result.rawAccessToken }),
    });
    assert.strictEqual(resSuperseded.status, 422, 'Non-available version must return 422');
    await client.query(`UPDATE document_versions SET status = 'available' WHERE id = $1`, [verA.id]);

    // 6.4 Version-Document Mismatch
    // Proves B8 invariant: Composite FK fk_doc_content_grants_inst_doc_ver structurally blocks mismatched document/version
    await assert.rejects(
      client.query(
        `UPDATE document_content_access_grants SET version_id = $1 WHERE id = $2`,
        [verB.id, auth6.result.grant.id],
      ),
      /fk_doc_content_grants_inst_doc_ver/,
      'Composite FK must structurally block mismatched document_id/version_id in grants',
    );

    // ==========================================
    // [TEST 7] DIRECT COMMAND BYPASS TESTS
    // ==========================================
    console.log('[TEST 7] Direct command bypass defense: exchangeGrantForContentStreamCommand fails closed');
    const authDirect = await authorizeContentAccessCommand({
      pool,
      context: adminContext,
      idempotencyKey: 'auth-token-test-7-direct',
      policyEngine,
      accessGrantTokenKey: TEST_KEY,
      input: {
        documentId: docA.id,
        versionId: verA.id,
        action: 'open',
      },
    });

    // 7.1 Direct call with teacher current role in DB
    await client.query(`UPDATE memberships SET role = 'teacher' WHERE id = $1`, [adminContext.membershipId]);
    await assert.rejects(
      exchangeGrantForContentStreamCommand({
        pool,
        context: adminContext,
        policyEngine,
        storageProvider,
        input: { rawAccessToken: authDirect.result.rawAccessToken! },
      }),
      /AUTHORIZATION_DENIED/,
      'Direct command must reject unauthorized current role',
    );
    await client.query(`UPDATE memberships SET role = 'institution_admin' WHERE id = $1`, [adminContext.membershipId]);

    // 7.2 Direct call with suspended membership
    await client.query(`UPDATE memberships SET status = 'suspended' WHERE id = $1`, [adminContext.membershipId]);
    await assert.rejects(
      exchangeGrantForContentStreamCommand({
        pool,
        context: adminContext,
        policyEngine,
        storageProvider,
        input: { rawAccessToken: authDirect.result.rawAccessToken! },
      }),
      /MEMBERSHIP_REVOKED_OR_INACTIVE/,
      'Direct command must reject inactive membership',
    );
    await client.query(`UPDATE memberships SET status = 'active' WHERE id = $1`, [adminContext.membershipId]);

    // 7.3 Direct call with wrong actor
    await assert.rejects(
      exchangeGrantForContentStreamCommand({
        pool,
        context: manager2Context,
        policyEngine,
        storageProvider,
        input: { rawAccessToken: authDirect.result.rawAccessToken! },
      }),
      /GRANT_GRANTEE_MISMATCH/,
      'Direct command must reject wrong actor',
    );

    // 7.4 Direct call with quarantined version
    await client.query(`UPDATE document_versions SET status = 'quarantined' WHERE id = $1`, [verA.id]);
    await assert.rejects(
      exchangeGrantForContentStreamCommand({
        pool,
        context: adminContext,
        policyEngine,
        storageProvider,
        input: { rawAccessToken: authDirect.result.rawAccessToken! },
      }),
      /ACCESS_DENIED_QUARANTINED/,
      'Direct command must reject quarantined version',
    );
    await client.query(`UPDATE document_versions SET status = 'available' WHERE id = $1`, [verA.id]);

    // 7.5 Direct call with non-available version
    await client.query(`UPDATE document_versions SET status = 'superseded' WHERE id = $1`, [verA.id]);
    await assert.rejects(
      exchangeGrantForContentStreamCommand({
        pool,
        context: adminContext,
        policyEngine,
        storageProvider,
        input: { rawAccessToken: authDirect.result.rawAccessToken! },
      }),
      /NOT_AVAILABLE_FOR_ACCESS/,
      'Direct command must reject non-available version',
    );
    await client.query(`UPDATE document_versions SET status = 'available' WHERE id = $1`, [verA.id]);

    // ==========================================
    // [TEST 8] USAGE ORDERING DEFECT RESOLUTION & AUDIT PRIVACY
    // ==========================================
    console.log('[TEST 8] Usage ordering correctness: usage not incremented if storage open fails');
    const auth8 = await authorizeContentAccessCommand({
      pool,
      context: adminContext,
      idempotencyKey: 'auth-token-test-8-usage',
      policyEngine,
      accessGrantTokenKey: TEST_KEY,
      input: {
        documentId: docA.id,
        versionId: verA.id,
        action: 'open',
      },
    });

    // Create a mock storage provider that throws on openReadStream
    const failingStorageProvider = {
      openReadStream: async () => {
        const err: any = new Error('Simulated transient storage failure');
        err.code = 'ETIMEDOUT';
        throw err;
      },
    } as any;

    await assert.rejects(
      exchangeGrantForContentStreamCommand({
        pool,
        context: adminContext,
        policyEngine,
        storageProvider: failingStorageProvider,
        input: { rawAccessToken: auth8.result.rawAccessToken! },
      }),
      /STORAGE_PROVIDER_TRANSIENT_ERROR/,
      'Failing storage provider must bubble error',
    );

    // Assert that grant usage was NOT recorded!
    const grantRow8 = await accessRepo.getGrantById(client, instA, auth8.result.grant.id);
    assert.strictEqual(grantRow8?.consumedAt, null, 'consumedAt MUST NOT be updated if storage stream failed to open!');

    // Token Privacy: Ensure raw token is absent from DB tables
    const rawToken = auth8.result.rawAccessToken!;
    const checkGrantTokens = await client.query(
      `SELECT id FROM document_content_access_grants WHERE token_hash = $1`,
      [rawToken],
    );
    assert.strictEqual(checkGrantTokens.rows.length, 0, 'Raw token must never be stored as hash');

    const checkAuditTokens = await client.query(
      `SELECT id FROM document_audit_events WHERE details::text LIKE $1`,
      [`%${rawToken}%`],
    );
    assert.strictEqual(checkAuditTokens.rows.length, 0, 'Raw token must never appear in audit events');

    const checkOutboxTokens = await client.query(
      `SELECT id FROM document_outbox_events WHERE payload::text LIKE $1`,
      [`%${rawToken}%`],
    );
    assert.strictEqual(checkOutboxTokens.rows.length, 0, 'Raw token must never appear in outbox events');

    console.log('ALL_CONTENT_EXCHANGE_AUTHORIZATION_TESTS_PASS');
  } finally {
    server.close();
  }
} finally {
  await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  client.release();
  await pool.end();
}
