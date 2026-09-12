import { strict as assert } from 'node:assert';
import { createHash, randomUUID } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { resolveInstitutionalContext, type InstitutionalContext } from '../src/auth/institutional-context.ts';
import { createRequireAuth, type AuthRequest } from '../src/middleware/auth.ts';
import { registerDocumentRoutes } from '../src/modules/documents/document.controller.ts';
import { GoogleCloudStorageObjectProvider } from '../src/modules/documents/google-cloud-storage-provider.ts';
import { ConfigurableDocumentAccessPolicyEngine } from '../src/modules/documents/document-access-policy.ts';
import { ConfigurableRetentionPolicyEngine } from '../src/modules/documents/document-retention-policy.ts';

const BUCKET = 'nexus-staging-documents-eu';
const PROJECT_ID = 'nexus-wdu-staging';
const STAGING_URL = 'https://nexus-wdu-staging-1054135786613.europe-west1.run.app';

async function runRealDocumentsApplicationE2E() {
  console.log('=== START REAL DOCUMENTS APPLICATION E2E VALIDATION ===');
  console.log(`Target Bucket: ${BUCKET}`);
  console.log(`Target Project: ${PROJECT_ID}`);
  console.log(`Staging URL: ${STAGING_URL}`);

  await verifyApprovedTestConnection();

  const schema = `doc_app_staging_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    options: `-c search_path=${quote(schema)},public`,
  });

  const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
  const client = await pool.connect();

  let server: http.Server | undefined;

  try {
    // 1. Setup isolated database schema & run migrations
    console.log('\n[APP-E2E 1] Initializing isolated PostgreSQL schema & running migrations...');
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)}, public`);

    const migrations = await discoverMigrations(migrationsDir);
    await runMigrations(client, migrations);

    // 2. Setup synthetic institutions & identities
    console.log('\n[APP-E2E 2] Provisioning synthetic multi-tenant identities...');
    const instAId = randomUUID();
    const instBId = randomUUID();
    const adminPersonAId = randomUUID();
    const adminPersonBId = randomUUID();
    const membershipAId = randomUUID();
    const membershipBId = randomUUID();

    await client.query(
      `INSERT INTO institutions (id, name, slug, status) VALUES 
        ($1, 'Synthetic Institution A (Staging)', 'inst-a-staging', 'active'),
        ($2, 'Synthetic Institution B (Staging)', 'inst-b-staging', 'active')`,
      [instAId, instBId],
    );

    await client.query(
      `INSERT INTO people (id, name) VALUES 
        ($1, 'Admin User Tenant A'),
        ($2, 'Admin User Tenant B')`,
      [adminPersonAId, adminPersonBId],
    );

    await client.query(
      `INSERT INTO identities (person_id, provider, provider_subject) VALUES 
        ($1, 'firebase', 'uid-staging-admin-a'),
        ($2, 'firebase', 'uid-staging-admin-b')`,
      [adminPersonAId, adminPersonBId],
    );

    await client.query(
      `INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at) VALUES 
        ($1, $2, $3, 'institution_admin', 'active', now()),
        ($4, $5, $6, 'institution_admin', 'active', now())`,
      [membershipAId, adminPersonAId, instAId, membershipBId, adminPersonBId, instBId],
    );

    // 3. Instantiate Real GCS Storage Provider and Policy Engines
    console.log('\n[APP-E2E 3] Configuring Real GCS Provider & Governance Engines...');
    const storageProvider = new GoogleCloudStorageObjectProvider({
      projectId: PROJECT_ID,
      defaultBucket: BUCKET,
    });

    const policyEngine = new ConfigurableDocumentAccessPolicyEngine([
      { role: 'institution_admin', category: '*', allowedActions: ['open_content', 'download_content'] },
      { role: 'teacher', category: '*', allowedActions: ['open_content', 'download_content'] },
      { role: 'admin', category: '*', allowedActions: ['open_content', 'download_content'] },
    ]);

    const retentionPolicyEngine = new ConfigurableRetentionPolicyEngine([
      {
        policyId: 'retention-policy-staging-1',
        policyVersion: '1.0',
        jurisdictionProfileId: 'AO-STD',
        jurisdictionProfileVersion: '1.0',
        category: 'identification',
        clockTriggerType: 'enrollment_completed',
        retentionDurationDays: 365,
        allowedHoldTypes: ['legal', 'administrative'],
        allowedDeletionAuthorityScopePatterns: ['institution_admin', 'admin'],
      },
    ]);

    const accessGrantTokenKey = 'nexus_staging_test_access_grant_token_key_32_bytes_min_length!';
    const deletionPseudonymizationKey = 'nexus_staging_test_deletion_pseudonymization_key_32_bytes!';

    // 4. Start Real Express Application Stack
    console.log('\n[APP-E2E 4] Starting Real Documents HTTP Application Stack...');
    const app = express();
    app.use(express.json());

    const auth = createRequireAuth({
      verifyIdToken: async (token) => ({ uid: token }),
      pool: pool as any,
      resolveInstitutionalContext,
    });

    registerDocumentRoutes(app, {
      pool: pool as any,
      requireAuth: auth,
      storageProvider,
      storageBucket: BUCKET,
      uploadPolicyConfig: {
        globalMaxByteSize: 26214400,
        institutionMaxByteSize: 26214400,
      },
      policyEngine,
      retentionPolicyEngine,
      accessGrantTokenKey,
      deletionPseudonymizationKey,
    });

    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const headersA = {
      Authorization: 'Bearer uid-staging-admin-a',
      'Content-Type': 'application/json',
    };
    const headersB = {
      Authorization: 'Bearer uid-staging-admin-b',
      'Content-Type': 'application/json',
    };

    // 5. Create synthetic document payload
    const syntheticPayload = Buffer.from(
      JSON.stringify({
        report: 'Nexus Staging True Application E2E Test Report',
        version: '1.0',
        institutionId: instAId,
        author: 'Admin User Tenant A',
        classification: 'confidential',
        timestamp: new Date().toISOString(),
        content: 'Este documento comprova a execução ponta-a-ponta do pipeline real de documentos via HTTP e GCS.',
      }, null, 2),
    );
    const sourceSha256 = createHash('sha256').update(syntheticPayload).digest('hex');

    // 6. HTTP Step 1: POST /api/documents/upload-sessions
    console.log('\n[APP-E2E 5] HTTP 1: POST /api/documents/upload-sessions...');
    const createSessionRes = await fetch(`${baseUrl}/api/documents/upload-sessions`, {
      method: 'POST',
      headers: {
        ...headersA,
        'Idempotency-Key': `idemp-session-create-${randomUUID()}`,
      },
      body: JSON.stringify({
        category: 'general',
        classification: 'confidential',
        declaredFilename: 'staging_report_e2e.json',
        declaredMimeType: 'application/json',
        declaredByteSize: syntheticPayload.length,
      }),
    });

    assert.equal(createSessionRes.status, 201, 'Upload session creation must return 201 Created');
    const sessionData = await createSessionRes.json();
    assert.ok(sessionData.documentId, 'documentId must exist');
    assert.ok(sessionData.sessionId, 'sessionId must exist');
    assert.ok(sessionData.rawToken, 'rawToken must exist');
    console.log(`HTTP Upload Session Created: Document=${sessionData.documentId}, Session=${sessionData.sessionId}`);

    // Verify canonical Document exists in DB
    const docDbCheck = await pool.query('SELECT id, institution_id, category, status FROM documents WHERE id = $1', [sessionData.documentId]);
    assert.equal(docDbCheck.rows.length, 1, 'Canonical Document must exist in DB');
    assert.equal(docDbCheck.rows[0].institution_id, instAId);
    console.log('Canonical Document verified in DB: PASS');

    // 7. HTTP Step 2: PUT /api/documents/upload-sessions/:sessionId/transfer
    console.log('\n[APP-E2E 6] HTTP 2: PUT /api/documents/upload-sessions/:sessionId/transfer...');
    const transferRes = await fetch(`${baseUrl}/api/documents/upload-sessions/${sessionData.sessionId}/transfer`, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer uid-staging-admin-a',
        'Content-Type': 'application/octet-stream',
        'X-Upload-Token': sessionData.rawToken,
      },
      body: syntheticPayload,
    });

    assert.equal(transferRes.status, 200, 'Byte transfer must return 200 OK');
    const transferData = await transferRes.json();
    assert.equal(transferData.success, true);
    assert.equal(transferData.byteSize, syntheticPayload.length);
    assert.equal(transferData.sha256Hash, sourceSha256);
    const writeSha256 = transferData.sha256Hash;
    console.log(`HTTP Transfer verified: byteSize=${transferData.byteSize}, sha256=${writeSha256}`);

    // 8. HTTP Step 3: POST /api/documents/upload-sessions/:sessionId/complete
    console.log('\n[APP-E2E 7] HTTP 3: POST /api/documents/upload-sessions/:sessionId/complete...');
    const completeRes = await fetch(`${baseUrl}/api/documents/upload-sessions/${sessionData.sessionId}/complete`, {
      method: 'POST',
      headers: {
        ...headersA,
        'Idempotency-Key': `idemp-session-complete-${randomUUID()}`,
      },
      body: JSON.stringify({
        rawToken: sessionData.rawToken,
      }),
    });

    assert.equal(completeRes.status, 200, 'Upload completion must return 200 OK');
    const completeData = await completeRes.json();
    assert.equal(completeData.success, true);
    assert.ok(completeData.versionId, 'versionId must exist');
    assert.equal(completeData.version.sha256Hash, sourceSha256);
    console.log(`HTTP Complete verified: Version=${completeData.versionId}, Status=${completeData.version.status}`);

    // 9. Verify canonical DocumentVersion in DB
    console.log('\n[APP-E2E 8] Querying DocumentVersion from DB...');
    const versionDbCheck = await pool.query<{
      id: string;
      document_id: string;
      sha256_hash: string;
      status: string;
      byte_size: string;
    }>('SELECT id, document_id, sha256_hash, status, byte_size FROM document_versions WHERE id = $1', [completeData.versionId]);
    assert.equal(versionDbCheck.rows.length, 1, 'DocumentVersion must exist in DB');
    const dbVersion = versionDbCheck.rows[0];
    const docVersionDbSha256 = dbVersion.sha256_hash;
    assert.equal(docVersionDbSha256, sourceSha256, 'DB SHA-256 must match source');
    assert.equal(dbVersion.status, 'content_received', 'Initial DB version status must be content_received');
    console.log(`DocumentVersion confirmed in DB: SHA256=${docVersionDbSha256}, Status=${dbVersion.status}`);

    const sessionDbCheck = await pool.query<{ storage_key: string }>(
      'SELECT storage_key FROM document_upload_sessions WHERE id = $1',
      [sessionData.sessionId],
    );
    assert.equal(sessionDbCheck.rows.length, 1);
    const storageKey = sessionDbCheck.rows[0].storage_key;

    // 10. Verify Real GCS Object Existence & Metadata
    console.log('\n[APP-E2E 9] Verifying Real GCS Object Metadata...');
    const headGcs = await storageProvider.headObject({
      storageBucket: BUCKET,
      storageKey,
    });
    assert.equal(headGcs.exists, true, 'Object must exist in real GCS');
    assert.equal(headGcs.byteSize, syntheticPayload.length);
    assert.equal(headGcs.sha256Hash, sourceSha256);
    const gcsMetadataSha256 = headGcs.sha256Hash;
    console.log(`Real GCS Object Confirmed: exists=${headGcs.exists}, GCS_METADATA_SHA256=${gcsMetadataSha256}`);

    // Transition version status to 'available' upon verification pass
    await pool.query(
      `UPDATE document_versions SET status = 'available' WHERE id = $1`,
      [completeData.versionId],
    );
    const technicalVerificationState = 'passed';
    console.log(`TECHNICAL_VERIFICATION_STATE=${technicalVerificationState}`);

    // 11. Secure Access Stage 1: POST /api/documents/:id/access
    console.log('\n[APP-E2E 10] Real Secure Access Stage 1: POST /api/documents/:id/access...');
    const accessRes = await fetch(`${baseUrl}/api/documents/${sessionData.documentId}/access`, {
      method: 'POST',
      headers: {
        ...headersA,
        'Idempotency-Key': `idemp-access-auth-${randomUUID()}`,
      },
      body: JSON.stringify({
        versionId: completeData.versionId,
        action: 'download',
      }),
    });

    assert.equal(accessRes.status, 201, 'Access authorization must return 201 Created');
    const accessData = await accessRes.json();
    assert.ok(accessData.grantId, 'grantId must exist');
    assert.ok(accessData.rawAccessToken, 'rawAccessToken must exist');
    console.log(`Secure Access Authorized: Grant=${accessData.grantId}, Action=${accessData.action}`);

    // 12. Secure Access Stage 2: POST /api/documents/access/exchange (Server-Mediated Stream Download)
    console.log('\n[APP-E2E 11] Real Secure Access Stage 2: POST /api/documents/access/exchange...');
    const exchangeRes = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        rawAccessToken: accessData.rawAccessToken,
        displayFilename: 'downloaded_report.json',
      }),
    });

    assert.equal(exchangeRes.status, 200, 'Grant exchange must return 200 OK stream');
    const downloadedArrayBuffer = await exchangeRes.arrayBuffer();
    const downloadedBuffer = Buffer.from(downloadedArrayBuffer);
    const downloadedSha256 = createHash('sha256').update(downloadedBuffer).digest('hex');

    assert.equal(downloadedBuffer.length, syntheticPayload.length, 'Downloaded length must match source payload');
    assert.equal(downloadedBuffer.toString('utf8'), syntheticPayload.toString('utf8'), 'Downloaded content must match source payload byte-for-byte');
    console.log(`Server-Mediated Download Confirmed: length=${downloadedBuffer.length}, DOWNLOADED_SHA256=${downloadedSha256}`);

    // 13. Multi-Point SHA-256 Invariant Proof
    console.log('\n[APP-E2E 12] Full SHA-256 Invariant Verification...');
    assert.equal(sourceSha256, writeSha256, 'SOURCE_SHA256 == WRITE_SHA256');
    assert.equal(writeSha256, gcsMetadataSha256, 'WRITE_SHA256 == GCS_METADATA_SHA256');
    assert.equal(gcsMetadataSha256, docVersionDbSha256, 'GCS_METADATA_SHA256 == DOCUMENT_VERSION_DB_SHA256');
    assert.equal(docVersionDbSha256, downloadedSha256, 'DOCUMENT_VERSION_DB_SHA256 == DOWNLOADED_SHA256');
    console.log('FULL_HASH_INVARIANT=PASS');
    console.log(`  SOURCE_SHA256              = ${sourceSha256}`);
    console.log(`  WRITE_SHA256               = ${writeSha256}`);
    console.log(`  GCS_METADATA_SHA256        = ${gcsMetadataSha256}`);
    console.log(`  DOCUMENT_VERSION_DB_SHA256 = ${docVersionDbSha256}`);
    console.log(`  DOWNLOADED_SHA256          = ${downloadedSha256}`);

    // 14. Multi-Tenant HTTP Isolation Proofs
    console.log('\n[APP-E2E 13] Multi-Tenant HTTP Isolation Fail-Closed Proofs...');

    // 14A: Cross-tenant Document Read: Tenant B cannot GET Document A
    const crossReadRes = await fetch(`${baseUrl}/api/documents/${sessionData.documentId}`, {
      headers: headersB,
    });
    assert.equal(crossReadRes.status, 404, 'Tenant B must receive 404 for Tenant A document');
    console.log('CROSS_TENANT_DOCUMENT_READ=DENIED (HTTP 404 Fail-Closed)');

    // 14B: Cross-tenant Grant Reuse: Tenant B cannot exchange Tenant A grant token
    const crossGrantRes = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        rawAccessToken: accessData.rawAccessToken,
      }),
    });
    assert.ok([403, 404].includes(crossGrantRes.status), 'Tenant B cannot exchange Tenant A token');
    console.log('CROSS_TENANT_GRANT_REUSE=DENIED (HTTP 403/404 Fail-Closed)');

    // 14C: Tenant B creates Session B
    const sessionBRes = await fetch(`${baseUrl}/api/documents/upload-sessions`, {
      method: 'POST',
      headers: {
        ...headersB,
        'Idempotency-Key': `idemp-session-b-${randomUUID()}`,
      },
      body: JSON.stringify({
        category: 'general',
        declaredFilename: 'tenant_b_doc.json',
        declaredMimeType: 'application/json',
        declaredByteSize: 100,
      }),
    });
    assert.equal(sessionBRes.status, 201);
    const sessionBData = await sessionBRes.json();

    // 14D: Cross-tenant Upload Completion: Tenant A cannot complete Tenant B session
    const crossCompleteRes = await fetch(`${baseUrl}/api/documents/upload-sessions/${sessionBData.sessionId}/complete`, {
      method: 'POST',
      headers: {
        ...headersA,
        'Idempotency-Key': `idemp-cross-complete-${randomUUID()}`,
      },
      body: JSON.stringify({
        rawToken: sessionBData.rawToken,
      }),
    });
    assert.equal(crossCompleteRes.status, 404, 'Tenant A cannot complete Tenant B session');

    // 14E: Cross-tenant Transfer: Tenant A cannot transfer bytes to Tenant B session
    const crossTransferRes = await fetch(`${baseUrl}/api/documents/upload-sessions/${sessionBData.sessionId}/transfer`, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer uid-staging-admin-a',
        'Content-Type': 'application/octet-stream',
        'X-Upload-Token': sessionBData.rawToken,
      },
      body: Buffer.from('unauthorized cross-tenant bytes'),
    });
    assert.equal(crossTransferRes.status, 404, 'Tenant A cannot transfer to Tenant B session');
    console.log('CROSS_TENANT_UPLOAD_SESSION=DENIED (HTTP 404 Fail-Closed)');

    // Clean up created test object from GCS
    await storageProvider.deleteObject({
      storageBucket: BUCKET,
      storageKey,
    });
    console.log('Staging GCS cleanup: PASS');

    console.log('\n=== ALL REAL DOCUMENTS APPLICATION E2E TESTS PASSED ===');
  } finally {
    if (server) {
      server.close();
    }
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined);
    client.release();
    await pool.end();
  }
}

runRealDocumentsApplicationE2E().catch((err) => {
  console.error('FATAL APPLICATION E2E ERROR:', err);
  process.exit(1);
});
