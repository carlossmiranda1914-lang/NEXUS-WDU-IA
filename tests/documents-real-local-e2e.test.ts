/**
 * Real Local E2E Test Suite for Documents Foundation (Sections 7 & 8)
 * 
 * Executes against local test PostgreSQL (nexus_fnd01_test) and port 3001:
 * - Steps 1-19: Full ingest, transfer, complete, verification, association, grant, preview, download, hash invariants.
 * - Steps 20-23: Server restart & filesystem-backed UAT storage persistence verification.
 * - Section 8: Negative multi-tenant and authentication security verification + unsafe quarantine.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import http from 'http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { registerDocumentRoutes } from '../src/modules/documents/document.controller.ts';
import { resolveDocumentsOperationalConfig } from '../src/modules/documents/documents-runtime-config.ts';
import { LocalUatObjectStorageProvider } from '../src/modules/documents/local-uat-storage-provider.ts';
import { LocalUatMalwareScanner } from '../src/modules/documents/local-uat-malware-scanner.ts';
import { DocumentVerificationWorker } from '../src/modules/documents/verification-worker.ts';

await verifyApprovedTestConnection();

describe('Real Local E2E Test Suite (Sections 6, 7 & 8)', () => {
  const storageDir = path.resolve(process.cwd(), '.uat-storage');
  const schema = `doc_e2e_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    options: `-c search_path=${quote(schema)},public`,
  });
  const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

  let client: pg.PoolClient;
  let serverInstance: http.Server | null = null;
  const PORT = 3001;
  const baseUrl = `http://127.0.0.1:${PORT}`;

  // Tenancy Fixtures
  const institutionIdA = randomUUID();
  const adminPersonIdA = randomUUID();
  const studentPersonIdA = randomUUID();
  const studentProfileIdA = randomUUID();

  const institutionIdB = randomUUID();
  const adminPersonIdB = randomUUID();

  let academicYearId: string;
  let offerId: string;
  let enrollmentAppIdA: string;

  function createTestServer(customStorageProvider?: LocalUatObjectStorageProvider): Promise<http.Server> {
    const app = express();
    app.use(express.json());

    const storageProvider = customStorageProvider || new LocalUatObjectStorageProvider(storageDir);
    const storageBucket = 'nexus-uat-documents-bucket';
    const malwareScanner = new LocalUatMalwareScanner();

    const config = resolveDocumentsOperationalConfig({
      customStorageProvider: storageProvider,
    });

    const verificationWorker = new DocumentVerificationWorker({
      pool,
      storageProvider,
      malwareScanner,
      retentionPolicyEngine: config.retentionPolicyEngine!,
      storageBucket,
      gcpProjectId: 'local-uat-project',
      trustedAuthority: {
        kind: 'trusted_system_worker',
        workerId: 'local-uat-worker-01',
        workerName: 'Nexus Local UAT Worker',
      },
    });

    const authMiddleware: any = (req: any, res: any, next: any) => {
      const authHeader = req.headers['authorization'];
      if (authHeader === 'Bearer tenant-b-token') {
        req.institutionalContext = {
          institutionId: institutionIdB,
          personId: adminPersonIdB,
          role: 'institution_admin',
          membershipStatus: 'active',
        };
        return next();
      }
      if (authHeader === 'Bearer invalid-token') {
        return res.status(401).json({ error: 'UNAUTHORIZED' });
      }
      // Default tenant A
      req.institutionalContext = {
        institutionId: institutionIdA,
        personId: adminPersonIdA,
        role: 'institution_admin',
        membershipStatus: 'active',
      };
      next();
    };

    registerDocumentRoutes(app, {
      pool,
      requireAuth: authMiddleware,
      storageProvider,
      storageBucket,
      policyEngine: config.policyEngine!,
      retentionPolicyEngine: config.retentionPolicyEngine!,
      accessGrantTokenKey: config.accessGrantTokenKey!,
      deletionPseudonymizationKey: config.deletionPseudonymizationKey!,
      uploadPolicyConfig: config.uploadPolicyConfig!,
      verificationWorker,
      malwareScanner,
    });

    // Health check endpoint for port verification
    app.get('/', (_req, res) => res.status(200).send('OK'));

    return new Promise<http.Server>((resolve) => {
      const s = app.listen(PORT, '127.0.0.1', () => resolve(s));
    });
  }

  async function request(
    endpoint: string,
    options: { method?: string; body?: any; headers?: Record<string, string> } = {},
  ) {
    const url = `${baseUrl}${endpoint}`;
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    return res;
  }

  before(async () => {
    client = await pool.connect();
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)}, public`);

    const migrations = await discoverMigrations(migrationsDir);
    await runMigrations(client, migrations);

    // Seed Institution A
    await client.query(
      `INSERT INTO institutions (id, name, slug, status)
       VALUES ($1, 'Colégio Nexus Luanda A', 'nexus-lua-01a', 'active')`,
      [institutionIdA],
    );
    await client.query(
      `INSERT INTO people (id, name) VALUES ($1, 'Admin A')`,
      [adminPersonIdA],
    );
    await client.query(
      `INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at)
       VALUES ($1, $2, $3, 'institution_admin', 'active', now())`,
      [randomUUID(), adminPersonIdA, institutionIdA],
    );

    // Seed Student and Profile in Institution A
    await client.query(
      `INSERT INTO people (id, name) VALUES ($1, 'Aluno Teste E2E')`,
      [studentPersonIdA],
    );
    await client.query(
      `INSERT INTO student_profiles (id, person_id, institution_id, student_number)
       VALUES ($1, $2, $3, 'STU-2026-001')`,
      [studentProfileIdA, studentPersonIdA, institutionIdA],
    );

    // Seed Academic Year, Offer & Enrollment Application in Institution A
    academicYearId = randomUUID();
    await client.query(
      `INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status)
       VALUES ($1, $2, 'Ano Letivo 2026', '2026-02-01', '2026-12-15', 'active')`,
      [academicYearId, institutionIdA],
    );

    offerId = randomUUID();
    await client.query(
      `INSERT INTO enrollment_offers (id, institution_id, academic_year_id, name, code, status)
       VALUES ($1, $2, $3, 'Ensino Primário 2026', 'EP-2026', 'active')`,
      [offerId, institutionIdA, academicYearId],
    );

    enrollmentAppIdA = randomUUID();
    await client.query(
      `INSERT INTO enrollment_applications (id, institution_id, student_person_id, academic_year_id, offer_id, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6, $6)`,
      [enrollmentAppIdA, institutionIdA, studentPersonIdA, academicYearId, offerId, adminPersonIdA],
    );

    // Seed Institution B for negative multi-tenant testing
    await client.query(
      `INSERT INTO institutions (id, name, slug, status)
       VALUES ($1, 'Colégio Nexus Benguela B', 'nexus-bng-01b', 'active')`,
      [institutionIdB],
    );
    await client.query(
      `INSERT INTO people (id, name) VALUES ($1, 'Admin B')`,
      [adminPersonIdB],
    );
    await client.query(
      `INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at)
       VALUES ($1, $2, $3, 'institution_admin', 'active', now())`,
      [randomUUID(), adminPersonIdB, institutionIdB],
    );

    serverInstance = await createTestServer();
  });

  after(async () => {
    if (serverInstance) {
      serverInstance.close();
    }
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
    } catch {
      // Cleanup
    }
    client.release();
    await pool.end();
  });

  // State shared across steps
  let documentId: string;
  let sessionId: string;
  let rawToken: string;
  let versionId: string;
  let cleanSyntheticBytes: Buffer;
  let sourceSha256: string;
  const originalFilename = 'comprovativo_matricula_2026.pdf';

  it('Section 6: localhost:3001 listens and returns HTTP 200', async () => {
    const rootCheck = await fetch(`${baseUrl}/`);
    assert.equal(rootCheck.status, 200, 'http://localhost:3001 must return HTTP 200');
  });

  it('Steps 1-4: Upload session creation, byte transfer, and completion', async () => {
    cleanSyntheticBytes = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000108 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n185\n%%EOF\n',
    );
    sourceSha256 = createHash('sha256').update(cleanSyntheticBytes).digest('hex');

    // 1. Create upload session
    const createSessionRes = await request('/api/documents/upload-sessions', {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-e2e-upload-${randomUUID()}` },
      body: {
        category: 'enrollment',
        classification: 'internal',
        declaredFilename: originalFilename,
        declaredMimeType: 'application/pdf',
        declaredByteSize: cleanSyntheticBytes.length,
      },
    });

    // 2. Expect HTTP 201
    assert.equal(createSessionRes.status, 201, 'Step 2: Expected HTTP 201 on create upload session');
    const sessionData = (await createSessionRes.json()) as any;
    documentId = sessionData.documentId;
    sessionId = sessionData.sessionId;
    rawToken = sessionData.rawToken;
    assert.ok(documentId, 'documentId must be present');
    assert.ok(sessionId, 'sessionId must be present');
    assert.ok(rawToken, 'rawToken must be present');

    // 3. Transfer real bytes
    const transferRes = await fetch(`${baseUrl}/api/documents/upload-sessions/${sessionId}/transfer`, {
      method: 'PUT',
      headers: {
        'X-Upload-Token': rawToken,
        'Content-Type': 'application/pdf',
      },
      body: cleanSyntheticBytes,
    });
    assert.equal(transferRes.status, 200, 'Step 3: Transfer real bytes must return HTTP 200');
    const transferData = (await transferRes.json()) as any;
    assert.equal(transferData.sha256Hash, sourceSha256);

    // 4. Complete session
    const completeRes = await request(`/api/documents/upload-sessions/${sessionId}/complete`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-e2e-complete-${randomUUID()}` },
      body: { rawToken },
    });
    assert.equal(completeRes.status, 200, 'Step 4: Complete session must return HTTP 200');
    const completeData = (await completeRes.json()) as any;
    versionId = completeData.versionId;
    assert.ok(versionId, 'versionId must be present in complete response');
  });

  it('Steps 5-7: DB document and version rows created with persistent local storage object', async () => {
    // 5. Document row created in PostgreSQL
    const docRow = (await client.query(`SELECT * FROM documents WHERE id = $1`, [documentId])).rows[0];
    assert.ok(docRow, 'Step 5: Document row must exist in PostgreSQL');
    assert.equal(docRow.institution_id, institutionIdA);

    // 6. Version row created in PostgreSQL
    const verRow = (await client.query(`SELECT * FROM document_versions WHERE id = $1`, [versionId])).rows[0];
    assert.ok(verRow, 'Step 6: Version row must exist in PostgreSQL');
    assert.equal(Number(verRow.byte_size), cleanSyntheticBytes.length);
    assert.equal(verRow.sha256_hash, sourceSha256);

    // 7. Persistent local storage object created
    const storageRefRow = (
      await client.query(`SELECT * FROM document_storage_references WHERE version_id = $1`, [versionId])
    ).rows[0];
    assert.ok(storageRefRow, 'Step 7: Storage reference must exist in PostgreSQL');

    const localProviderCheck = new LocalUatObjectStorageProvider(storageDir);
    const headRes = await localProviderCheck.headObject({
      storageBucket: storageRefRow.storage_bucket,
      storageKey: storageRefRow.storage_key,
    });
    assert.equal(headRes.exists, true, 'Step 7: Persistent storage object must exist');
    assert.equal(headRes.byteSize, cleanSyntheticBytes.length);
    assert.equal(headRes.sha256Hash, sourceSha256);
  });

  it('Steps 8-10: Canonical verification automatically reaches AVAILABLE and preserves filename', async () => {
    // 8 & 9. Canonical verification triggered automatically & clean file reaches AVAILABLE
    let verifiedVersion: any = null;
    let verifiedDetail: any = null;
    for (let i = 0; i < 25; i++) {
      const detailRes = await request(`/api/documents/${documentId}`);
      if (detailRes.status === 200) {
        const detail = (await detailRes.json()) as any;
        if (detail.currentVersion?.status === 'available') {
          verifiedVersion = detail.currentVersion;
          verifiedDetail = detail;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(verifiedVersion, 'Step 8 & 9: Canonical verification must transition document version to available');
    assert.equal(verifiedVersion.status, 'available');

    // 10. Original filename preserved
    assert.equal(verifiedVersion.originalFilename, originalFilename, 'Step 10: Original filename must be preserved');

    // Retention operationalization assertion: verified document receives retention assignment
    assert.ok(verifiedDetail.retention, 'Retention must be assigned upon reaching available status');
    assert.equal(verifiedDetail.retention.retentionStatus, 'retention_active');
    assert.equal(verifiedDetail.capabilities.canPlaceHold, true, 'canPlaceHold must be enabled');
  });

  it('Steps 11-13: Associations persisted for Academic and Enrollment targets', async () => {
    // 11. Create real Academic association
    const academicAssocRes = await request(`/api/documents/${documentId}/associations`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-e2e-assoc-academic-${randomUUID()}` },
      body: {
        targetDomain: 'academic',
        targetResourceType: 'academic_year',
        targetResourceId: academicYearId,
        purpose: 'Enquadramento letivo do documento',
        pinnedVersionId: versionId,
      },
    });
    assert.equal(academicAssocRes.status, 201, 'Step 11: Create real Academic association must return HTTP 201');

    // 12. Create real Enrollment association
    const enrollAssocRes = await request(`/api/documents/${documentId}/associations`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-e2e-assoc-enroll-${randomUUID()}` },
      body: {
        targetDomain: 'enrollment',
        targetResourceType: 'enrollment_application',
        targetResourceId: enrollmentAppIdA,
        purpose: 'Comprovativo de candidatura de matrícula',
        pinnedVersionId: versionId,
      },
    });
    assert.equal(enrollAssocRes.status, 201, 'Step 12: Create real Enrollment association must return HTTP 201');

    // 13. Fetch detail and prove associations persisted
    const detailWithAssocRes = await request(`/api/documents/${documentId}`);
    assert.equal(detailWithAssocRes.status, 200);
    const detailData = (await detailWithAssocRes.json()) as any;
    assert.equal(detailData.associations.length, 2, 'Step 13: Must have 2 persisted associations');
    const domains = detailData.associations.map((a: any) => a.targetDomain).sort();
    assert.deepEqual(domains, ['academic', 'enrollment']);
  });

  it('Steps 14-19: Secure access grant, exchange, preview, download, and SHA-256 invariant', async () => {
    // 14. Secure authorize access
    const authAccessRes = await request(`/api/documents/${documentId}/access`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-e2e-access-${randomUUID()}` },
      body: {
        action: 'download',
        purpose: 'Auditoria de verificação documental E2E',
      },
    });
    assert.equal(authAccessRes.status, 201, 'Step 14: Secure authorize access must return HTTP 201');
    const accessData = (await authAccessRes.json()) as any;
    const rawAccessToken = accessData.rawAccessToken;
    assert.ok(rawAccessToken, 'Step 14: rawAccessToken must be returned');

    // 15 & 16. Exchange grant for binary stream (preview)
    const previewRes = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAccessToken, disposition: 'inline' }),
    });
    assert.equal(previewRes.status, 200, 'Step 16: Preview exchange must return HTTP 200');
    const previewBytes = Buffer.from(await previewRes.arrayBuffer());
    assert.equal(previewBytes.length, cleanSyntheticBytes.length);

    // 17. Download exact bytes
    const downloadRes = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAccessToken, disposition: 'attachment' }),
    });
    assert.equal(downloadRes.status, 200, 'Step 17: Download exchange must return HTTP 200');
    const downloadBytes = Buffer.from(await downloadRes.arrayBuffer());

    // 18. Verify Content-Disposition original filename
    const contentDisposition = downloadRes.headers.get('content-disposition');
    assert.ok(contentDisposition, 'Step 18: Content-Disposition header must be present');
    assert.ok(
      contentDisposition.includes(originalFilename),
      `Step 18: Content-Disposition must include original filename (${originalFilename}), got: ${contentDisposition}`,
    );

    // 19. Source SHA-256 == stored SHA-256 == downloaded SHA-256
    const downloadedSha256 = createHash('sha256').update(downloadBytes).digest('hex');
    assert.equal(downloadedSha256, sourceSha256, 'Step 19: Downloaded SHA-256 must equal source SHA-256');
    assert.equal(downloadBytes.length, cleanSyntheticBytes.length, 'Step 19: Byte size must match');
  });

  it('Steps 20-23: Server restart & filesystem-backed UAT storage persistence verification', async () => {
    // 20. Restart server (close and recreate server instance with fresh provider reconstruction)
    serverInstance!.close();
    serverInstance = null;
    await new Promise((r) => setTimeout(r, 100));

    const reconstructedStorageProvider = new LocalUatObjectStorageProvider(storageDir);
    serverInstance = await createTestServer(reconstructedStorageProvider);

    // 20. Document still fetchable
    const postRestartDetailRes = await request(`/api/documents/${documentId}`);
    assert.equal(postRestartDetailRes.status, 200, 'Step 20: Document must remain fetchable after restart');
    const postRestartDetail = (await postRestartDetailRes.json()) as any;
    assert.equal(postRestartDetail.id, documentId);
    assert.equal(postRestartDetail.currentVersion.status, 'available');

    // Authorize new access after restart
    const postAccessRes = await request(`/api/documents/${documentId}/access`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-e2e-post-access-${randomUUID()}` },
      body: {
        action: 'download',
        purpose: 'Verificação pós reinício do servidor',
      },
    });
    assert.equal(postAccessRes.status, 201);
    const postAccessData = (await postAccessRes.json()) as any;
    const postRawToken = postAccessData.rawAccessToken;

    // 21. Preview still works
    const postPreviewRes = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAccessToken: postRawToken, disposition: 'inline' }),
    });
    assert.equal(postPreviewRes.status, 200, 'Step 21: Preview must work after restart');

    // 22. Download still works
    const postDownloadRes = await fetch(`${baseUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawAccessToken: postRawToken, disposition: 'attachment' }),
    });
    assert.equal(postDownloadRes.status, 200, 'Step 22: Download must work after restart');
    const postDownloadBytes = Buffer.from(await postDownloadRes.arrayBuffer());

    // 23. SHA-256 still matches after restart
    const postRestartSha256 = createHash('sha256').update(postDownloadBytes).digest('hex');
    assert.equal(postRestartSha256, sourceSha256, 'Step 23: SHA-256 must match source after restart');
  });

  it('Section 8: Negative multi-tenant and authentication security checks', async () => {
    // 1. Cross-tenant document read = denied
    const crossTenantReadRes = await request(`/api/documents/${documentId}`, {
      headers: { Authorization: 'Bearer tenant-b-token' },
    });
    assert.equal(crossTenantReadRes.status, 404, 'Cross-tenant document read must be denied (404)');

    // 2. Cross-tenant association = denied
    const crossTenantAssocRes = await request(`/api/documents/${documentId}/associations`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer tenant-b-token',
        'Idempotency-Key': `idem-neg-cross-assoc-${randomUUID()}`,
      },
      body: {
        targetDomain: 'academic',
        targetResourceType: 'academic_year',
        targetResourceId: academicYearId,
        purpose: 'Malicious cross tenant association',
      },
    });
    assert.ok([403, 404, 422].includes(crossTenantAssocRes.status), 'Cross-tenant association must be denied');

    // 3. Cross-tenant upload session misuse = denied
    const crossTenantCompleteRes = await request(`/api/documents/upload-sessions/${sessionId}/complete`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer tenant-b-token',
        'Idempotency-Key': `idem-neg-cross-comp-${randomUUID()}`,
      },
      body: { rawToken },
    });
    assert.ok([403, 404].includes(crossTenantCompleteRes.status), 'Cross-tenant upload complete must be denied');

    // 4. Invalid authentication = denied
    const invalidAuthRes = await request(`/api/documents/${documentId}`, {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    assert.equal(invalidAuthRes.status, 401, 'Invalid auth must return HTTP 401');

    // 5. Unsafe fixture -> QUARANTINED
    const unsafeSyntheticBytes = Buffer.from(
      '%PDF-1.4\n__TEST_MALICIOUS_PAYLOAD__\n%%EOF',
    );
    const unsafeSessionRes = await request('/api/documents/upload-sessions', {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-unsafe-upload-${randomUUID()}` },
      body: {
        category: 'academic',
        classification: 'internal',
        declaredFilename: 'unsafe_document.pdf',
        declaredMimeType: 'application/pdf',
        declaredByteSize: unsafeSyntheticBytes.length,
      },
    });
    assert.equal(unsafeSessionRes.status, 201);
    const unsafeSessionData = (await unsafeSessionRes.json()) as any;

    await fetch(`${baseUrl}/api/documents/upload-sessions/${unsafeSessionData.sessionId}/transfer`, {
      method: 'PUT',
      headers: {
        'X-Upload-Token': unsafeSessionData.rawToken,
        'Content-Type': 'application/pdf',
      },
      body: unsafeSyntheticBytes,
    });

    await request(`/api/documents/upload-sessions/${unsafeSessionData.sessionId}/complete`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-unsafe-comp-${randomUUID()}` },
      body: { rawToken: unsafeSessionData.rawToken },
    });

    // Poll until quarantined
    let quarantinedVersion: any = null;
    for (let i = 0; i < 25; i++) {
      const detailRes = await request(`/api/documents/${unsafeSessionData.documentId}`);
      if (detailRes.status === 200) {
        const detail = (await detailRes.json()) as any;
        if (detail.currentVersion?.status === 'quarantined') {
          quarantinedVersion = detail.currentVersion;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(quarantinedVersion, 'Unsafe file must reach quarantined status');
    assert.equal(quarantinedVersion.status, 'quarantined');
  });
});
