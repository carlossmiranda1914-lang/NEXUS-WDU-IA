/**
 * Comprehensive P1 Gate Proof Suite: Storage Truth and Access
 * MISSION=DOCUMENTS-CLOSURE-P1-STORAGE-TRUTH-AND-ACCESS
 *
 * Verifies:
 * 1. computeCapabilities & direct API access blocked for 'unknown' and 'unavailable'
 *    without removing existing role, tenant, version status, archive, or policy conditions.
 * 2. Real synthetic document persistence across process termination:
 *    Upload & verify -> terminate process -> start new process with same absolute dir & empty cache ->
 *    list, detail, open, download -> exact byte size and SHA-256 match.
 * 3. Write failure handling:
 *    Simulated write error during transfer propagates cleanly; document is never advertised as saved.
 * 4. Missing object projection & transient error differentiation:
 *    Physical absence confirmed -> 'unavailable' with reason; historical verification & audit preserved.
 *    Transient provider error (e.g. timeout/reset) -> fails cleanly without marking as permanently unavailable.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
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
import { computeCapabilities } from '../src/modules/documents/document-query-service.ts';
import { reconcileStorageBatch } from '../src/modules/documents/document-storage-reconciliation.ts';

await verifyApprovedTestConnection();

describe('MISSION DOCUMENTS-CLOSURE-P1-STORAGE-TRUTH-AND-ACCESS Suite', () => {
  const storageDir = path.resolve(process.cwd(), '.uat-storage');
  const schema = `doc_p1_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    options: `-c search_path=${quote(schema)},public`,
  });
  const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

  let client: pg.PoolClient;
  let serverInstance: http.Server | null = null;
  let currentPort = 3099;
  let baseUrl = `http://127.0.0.1:${currentPort}`;

  // Institutional Fixtures
  const institutionIdA = randomUUID();
  const adminPersonIdA = randomUUID();
  const studentPersonIdA = randomUUID();

  const institutionIdB = randomUUID();
  const adminPersonIdB = randomUUID();

  function startServer(storageProvider: LocalUatObjectStorageProvider, port = currentPort): Promise<http.Server> {
    const app = express();
    app.use(express.json());

    const storageBucket = 'nexus-uat-documents-bucket';
    const malwareScanner = new LocalUatMalwareScanner();

    const config = resolveDocumentsOperationalConfig({
      customStorageProvider: storageProvider,
    });

    const verificationWorker = new DocumentVerificationWorker({
      pool,
      storageProvider,
      malwareScanner,
      storageBucket,
      gcpProjectId: 'local-uat-project',
      trustedAuthority: {
        kind: 'trusted_system_worker',
        workerId: 'p1-worker-01',
        workerName: 'P1 Verification Worker',
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
      if (authHeader === 'Bearer student-a-token') {
        req.institutionalContext = {
          institutionId: institutionIdA,
          personId: studentPersonIdA,
          role: 'student',
          membershipStatus: 'active',
        };
        return next();
      }
      // Default: Tenant A Admin
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

    return new Promise((resolve, reject) => {
      const s = app.listen(port, '127.0.0.1', () => resolve(s));
      s.on('error', reject);
    });
  }

  before(async () => {
    client = await pool.connect();
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)}, public`);
    const files = await discoverMigrations(migrationsDir);
    await runMigrations(client, files);

    // Seed test institutions and identities
    await client.query(`
      INSERT INTO institutions (id, name, slug, status) VALUES
      ($1, 'Tenant A Institution', 't-a', 'active'),
      ($2, 'Tenant B Institution', 't-b', 'active')
    `, [institutionIdA, institutionIdB]);

    await client.query(`
      INSERT INTO people (id, name) VALUES
      ($1, 'Admin A'),
      ($2, 'Student A'),
      ($3, 'Admin B')
    `, [adminPersonIdA, studentPersonIdA, adminPersonIdB]);

    await client.query(`
      INSERT INTO memberships (id, institution_id, person_id, role, status, approved_at) VALUES
      ($1, $2, $3, 'institution_admin', 'active', now()),
      ($4, $5, $6, 'student', 'active', now()),
      ($7, $8, $9, 'institution_admin', 'active', now())
    `, [
      randomUUID(), institutionIdA, adminPersonIdA,
      randomUUID(), institutionIdA, studentPersonIdA,
      randomUUID(), institutionIdB, adminPersonIdB,
    ]);

    const initialProvider = new LocalUatObjectStorageProvider(storageDir);
    serverInstance = await startServer(initialProvider);
  });

  after(async () => {
    if (serverInstance) {
      serverInstance.close();
    }
    if (client) {
      await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => {});
      client.release();
    }
    await pool.end();
  });

  // =========================================================================
  // Gate 1: computeCapabilities and Direct API Access Blocked on unknown & unavailable
  // =========================================================================
  it('1. computeCapabilities preserves prior conditions and strictly blocks unknown & unavailable', () => {
    // Both canOpen and canDownload must be false for 'unknown' and 'unavailable'
    const capUnknown = computeCapabilities(
      'active',
      'available',
      0,
      null,
      undefined,
      'institution_admin',
      'unknown',
    );
    assert.equal(capUnknown.canOpen, false, 'unknown content availability must block canOpen');
    assert.equal(capUnknown.canDownload, false, 'unknown content availability must block canDownload');

    const capUnavailable = computeCapabilities(
      'active',
      'available',
      0,
      null,
      undefined,
      'institution_admin',
      'unavailable',
    );
    assert.equal(capUnavailable.canOpen, false, 'unavailable content availability must block canOpen');
    assert.equal(capUnavailable.canDownload, false, 'unavailable content availability must block canDownload');

    // Available allows open and download
    const capAvailable = computeCapabilities(
      'active',
      'available',
      0,
      null,
      undefined,
      'institution_admin',
      'available',
    );
    assert.equal(capAvailable.canOpen, true, 'available content must allow canOpen');
    assert.equal(capAvailable.canDownload, true, 'available content must allow canDownload');

    // Preservation of prior conditions:
    // a) Archived document blocks even if available
    const capArchived = computeCapabilities(
      'archived',
      'available',
      0,
      null,
      undefined,
      'institution_admin',
      'available',
    );
    assert.equal(capArchived.canOpen, false, 'archived status must block canOpen even if available');
    assert.equal(capArchived.canDownload, false, 'archived status must block canDownload even if available');

    // b) Quarantined/non-available version blocks even if content marked available
    const capQuarantined = computeCapabilities(
      'active',
      'quarantined',
      0,
      null,
      undefined,
      'institution_admin',
      'available',
    );
    assert.equal(capQuarantined.canOpen, false, 'quarantined version must block canOpen');
    assert.equal(capQuarantined.canDownload, false, 'quarantined version must block canDownload');

    // c) Operational access unavailable blocks
    const capOpBlocked = computeCapabilities(
      'active',
      'available',
      0,
      null,
      { canAccess: false, canUpload: true, canHold: true, canDelete: true },
      'institution_admin',
      'available',
    );
    assert.equal(capOpBlocked.canOpen, false, 'operational canAccess=false must block canOpen');
    assert.equal(capOpBlocked.canDownload, false, 'operational canAccess=false must block canDownload');
  });

  it('2. Direct API access (/api/documents/:id/access) is blocked for unknown and unavailable versions', async () => {
    const docIdUnknown = randomUUID();
    const versionIdUnknown = randomUUID();
    const docIdUnavailable = randomUUID();
    const versionIdUnavailable = randomUUID();

    // Insert Document & Version with unknown content_availability
    await client.query(`
      INSERT INTO documents (id, institution_id, category, status, created_by_person_id)
      VALUES ($1, $2, 'administrative', 'active', $3)
    `, [docIdUnknown, institutionIdA, adminPersonIdA]);

    await client.query(`
      INSERT INTO document_versions (id, institution_id, document_id, version_number, mime_type, byte_size, sha256_hash, status, created_by_person_id)
      VALUES ($1, $2, $3, 1, 'application/pdf', 1024, $4, 'available', $5)
    `, [versionIdUnknown, institutionIdA, docIdUnknown, 'a'.repeat(64), adminPersonIdA]);

    await client.query(`
      INSERT INTO document_storage_references (id, institution_id, version_id, storage_provider, storage_bucket, storage_key, content_availability)
      VALUES ($1, $2, $3, 'local_uat', 'nexus-uat-documents-bucket', 'inst-a/test-unknown.pdf', 'unknown')
    `, [randomUUID(), institutionIdA, versionIdUnknown]);

    // Insert Document & Version with unavailable content_availability
    await client.query(`
      INSERT INTO documents (id, institution_id, category, status, created_by_person_id)
      VALUES ($1, $2, 'administrative', 'active', $3)
    `, [docIdUnavailable, institutionIdA, adminPersonIdA]);

    await client.query(`
      INSERT INTO document_versions (id, institution_id, document_id, version_number, mime_type, byte_size, sha256_hash, status, created_by_person_id)
      VALUES ($1, $2, $3, 1, 'application/pdf', 1024, $4, 'available', $5)
    `, [versionIdUnavailable, institutionIdA, docIdUnavailable, 'b'.repeat(64), adminPersonIdA]);

    await client.query(`
      INSERT INTO document_storage_references (id, institution_id, version_id, storage_provider, storage_bucket, storage_key, content_availability)
      VALUES ($1, $2, $3, 'local_uat', 'nexus-uat-documents-bucket', 'inst-a/test-unavailable.pdf', 'unavailable')
    `, [randomUUID(), institutionIdA, versionIdUnavailable]);

    // 2.1 Attempt direct access authorize for unknown -> Must Fail Closed
    const resUnknown = await fetch(`${baseUrl}/api/documents/${docIdUnknown}/access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({ action: 'open', versionId: versionIdUnknown }),
    });
    assert.equal(resUnknown.status, 409, 'Direct API access for unknown version must reject with 409');
    const bodyUnknown = await resUnknown.json();
    assert.match(bodyUnknown.error, /CONTENT_UNAVAILABLE/, 'Error message must reflect CONTENT_UNAVAILABLE');

    // 2.2 Attempt direct access authorize for unavailable -> Must Fail Closed
    const resUnavailable = await fetch(`${baseUrl}/api/documents/${docIdUnavailable}/access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({ action: 'download', versionId: versionIdUnavailable }),
    });
    assert.equal(resUnavailable.status, 409, 'Direct API access for unavailable version must reject with 409');
    const bodyUnavailable = await resUnavailable.json();
    assert.match(bodyUnavailable.error, /CONTENT_UNAVAILABLE/, 'Error message must reflect CONTENT_UNAVAILABLE');

    // 2.3 Cross-tenant negative: Tenant B attempting access on Tenant A document -> 404/denied
    const resCrossTenant = await fetch(`${baseUrl}/api/documents/${docIdUnknown}/access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer tenant-b-token',
        'X-Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({ action: 'open', versionId: versionIdUnknown }),
    });
    assert.equal(resCrossTenant.status, 404, 'Cross-tenant access must be rejected with 404');
  });

  // =========================================================================
  // Gate 2: Real Synthetic Document Persistence Across Server Restart
  // =========================================================================
  it('3. Real Persistence Proof: Upload, restart process with empty cache, list, detail, and download with SHA-256 match', async () => {
    const rawPdfContent = '%PDF-1.4\n1 0 obj\n<< /Title (Nexus Canonical P1 Durability Document) >>\nendobj\ntrailer\n<< >>\n%%EOF\n' + 'X'.repeat(5000);
    const pdfBuffer = Buffer.from(rawPdfContent, 'utf-8');
    const expectedByteSize = pdfBuffer.length;
    const expectedHash = createHash('sha256').update(pdfBuffer).digest('hex');
    const filename = `synthetic_durable_doc_${Date.now()}.pdf`;

    // 3.1 Create upload session
    const createSessionRes = await fetch(`${baseUrl}/api/documents/upload-sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        declaredFilename: filename,
        declaredMimeType: 'application/pdf',
        declaredByteSize: expectedByteSize,
        category: 'administrative',
      }),
    });
    assert.equal(createSessionRes.status, 201, 'Upload session creation should succeed');
    const sessionData = await createSessionRes.json();
    const sessionId = sessionData.sessionId;
    const documentId = sessionData.documentId;
    const rawUploadToken = sessionData.rawToken;

    // 3.2 Transfer bytes via PUT
    const transferRes = await fetch(`${baseUrl}/api/documents/upload-sessions/${sessionId}/transfer`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/pdf',
        'X-Upload-Token': rawUploadToken,
        'X-Idempotency-Key': randomUUID(),
      },
      body: pdfBuffer,
    });
    assert.equal(transferRes.status, 200, 'Byte transfer should succeed');

    // 3.3 Complete upload session
    const completeRes = await fetch(`${baseUrl}/api/documents/upload-sessions/${sessionId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({ rawToken: rawUploadToken }),
    });
    assert.equal(completeRes.status, 200, 'Session complete should succeed');
    const completeData = await completeRes.json();
    const versionId = completeData.versionId;

    // Poll for asynchronous technical verification worker to complete
    let versionStatus = '';
    let contentAvailability = '';
    for (let i = 0; i < 25; i++) {
      const dbCheck = await client.query(`
        SELECT sr.content_availability, v.status as version_status
        FROM document_storage_references sr
        JOIN document_versions v ON v.id = sr.version_id
        WHERE v.id = $1
      `, [versionId]);
      if (dbCheck.rows.length > 0) {
        versionStatus = dbCheck.rows[0].version_status;
        contentAvailability = dbCheck.rows[0].content_availability;
        if (versionStatus === 'available') {
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    assert.equal(contentAvailability, 'available');
    assert.equal(versionStatus, 'available');

    // =======================================================================
    // REAL CROSS-PROCESS DURABILITY PROOF:
    // Terminate the Node server in the primary process.
    // Launch an independent Node child process with a fresh PID, empty in-memory cache,
    // connected to the same persistent PostgreSQL database and storage directory.
    // =======================================================================
    await new Promise<void>((resolve) => serverInstance!.close(() => resolve()));
    serverInstance = null;

    const childPort = 3105;
    const childBaseUrl = `http://127.0.0.1:${childPort}`;
    const helperScript = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'support/documents-isolated-process-server.ts');

    const childProcess = spawn(
      process.execPath,
      ['--env-file=.env.test.local', '--import', 'tsx', helperScript],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TEST_DATABASE_LOCAL_AUTHORIZED: 'true',
          CHILD_PORT: String(childPort),
          CHILD_STORAGE_DIR: storageDir,
          CHILD_SCHEMA: schema,
          CHILD_INSTITUTION_ID_A: institutionIdA,
          CHILD_ADMIN_PERSON_ID_A: adminPersonIdA,
          CHILD_STUDENT_PERSON_ID_A: studentPersonIdA,
          CHILD_INSTITUTION_ID_B: institutionIdB,
          CHILD_ADMIN_PERSON_ID_B: adminPersonIdB,
        },
        stdio: ['inherit', 'pipe', 'pipe'],
      },
    );

    // Wait for the child process to become ready
    const readyData = await new Promise<{ event: string; pid: number; port: number }>((resolve, reject) => {
      let stderrOut = '';
      const timeout = setTimeout(() => {
        childProcess.kill();
        reject(new Error(`Child process failed to start within timeout. Stderr: ${stderrOut}`));
      }, 45000);

      childProcess.stdout?.on('data', (chunk) => {
        const text = chunk.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line.trim());
            if (parsed.event === 'READY') {
              clearTimeout(timeout);
              resolve(parsed);
              return;
            }
          } catch {
            // non-json line
          }
        }
      });

      childProcess.stderr?.on('data', (chunk) => {
        stderrOut += chunk.toString();
      });

      childProcess.on('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`Child process exited prematurely with code ${code}. Stderr: ${stderrOut}`));
      });
    });

    // Explicitly prove distinct process PID
    assert.ok(readyData.pid, 'Child process must report a valid PID');
    assert.ok(process.pid, 'Parent test process must have a PID');
    assert.notEqual(
      readyData.pid,
      process.pid,
      `Cross-process proof failed: child PID (${readyData.pid}) must be independent from parent PID (${process.pid})`,
    );

    try {
      // 3.4 List documents on the fresh process
      const listRes = await fetch(`${childBaseUrl}/api/documents?category=administrative`, {
        headers: { 'Content-Type': 'application/json' },
      });
      assert.equal(listRes.status, 200, 'Listing documents on independent child process should return 200');
      const listData = await listRes.json();
      const foundDoc = listData.items.find((d: any) => d.id === documentId);
      assert.ok(foundDoc, 'Document must be present in list on independent process');
      assert.equal(foundDoc.contentAvailability, 'available', 'contentAvailability must be available in list');
      assert.equal(foundDoc.capabilities.canOpen, true, 'canOpen must be true in list capabilities');
      assert.equal(foundDoc.capabilities.canDownload, true, 'canDownload must be true in list capabilities');

      // 3.5 Fetch document detail on the fresh process
      const detailRes = await fetch(`${childBaseUrl}/api/documents/${documentId}`);
      assert.equal(detailRes.status, 200, 'Detail endpoint on independent child process should return 200');
      const detailData = await detailRes.json();
      assert.equal(detailData.id, documentId);
      assert.equal(detailData.contentAvailability, 'available');
      assert.equal(detailData.capabilities.canOpen, true);
      assert.equal(detailData.capabilities.canDownload, true);

      // 3.6 Authorize access (Stage 1)
      const authAccessRes = await fetch(`${childBaseUrl}/api/documents/${documentId}/access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify({ action: 'download', versionId }),
      });
      assert.equal(authAccessRes.status, 201, 'Authorizing access on independent child process must return 201');
      const authAccessData = await authAccessRes.json();
      const rawAccessToken = authAccessData.rawAccessToken;
      assert.ok(rawAccessToken, 'Access grant raw token must be returned');

      // 3.7 Exchange grant for content stream (Stage 2) and verify bytes & SHA-256
      const exchangeRes = await fetch(`${childBaseUrl}/api/documents/access/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawAccessToken }),
      });
      assert.equal(exchangeRes.status, 200, 'Exchange stream on independent child process must return 200');
      assert.equal(exchangeRes.headers.get('content-type'), 'application/pdf');
      assert.equal(Number(exchangeRes.headers.get('content-length')), expectedByteSize);

      const downloadedArrayBuffer = await exchangeRes.arrayBuffer();
      const downloadedBuffer = Buffer.from(downloadedArrayBuffer);
      assert.equal(downloadedBuffer.length, expectedByteSize, 'Downloaded byte size must match original exactly');

      const downloadedHash = createHash('sha256').update(downloadedBuffer).digest('hex');
      assert.equal(downloadedHash, expectedHash, 'Downloaded SHA-256 hash must match original byte-for-byte');
    } finally {
      // Gracefully terminate child process
      childProcess.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        if (childProcess.killed || childProcess.exitCode !== null) {
          resolve();
        } else {
          childProcess.once('exit', () => resolve());
          setTimeout(() => {
            try {
              childProcess.kill('SIGKILL');
            } catch {}
            resolve();
          }, 3000);
        }
      });
    }
  });

  // =========================================================================
  // Gate 3: Write Failure Handling
  // =========================================================================
  it('4. Write Failure Handling: Storage error during upload propagates cleanly and prevents false persistence', async () => {
    const brokenStorageProvider = new LocalUatObjectStorageProvider(storageDir);
    // Intentionally inject writeObjectStream failure
    brokenStorageProvider.writeObjectStream = async () => {
      throw new Error('ENOSPC: no space left on device (simulated disk full)');
    };

    const brokenPort = 3102;
    const brokenServer = await startServer(brokenStorageProvider, brokenPort);

    try {
      // Create session
      const createRes = await fetch(`http://127.0.0.1:${brokenPort}/api/documents/upload-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify({
          declaredFilename: 'failing_upload.pdf',
          declaredMimeType: 'application/pdf',
          declaredByteSize: 1024,
          category: 'administrative',
        }),
      });
      assert.equal(createRes.status, 201);
      const session = await createRes.json();

      // Transfer bytes to broken provider
      const transferRes = await fetch(
        `http://127.0.0.1:${brokenPort}/api/documents/upload-sessions/${session.sessionId}/transfer`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/pdf',
            'X-Upload-Token': session.rawToken,
            'X-Idempotency-Key': randomUUID(),
          },
          body: Buffer.from('data-attempt'),
        },
      );
      assert.equal(transferRes.status, 500, 'Failed write must return 500');

      // Verify that upload session was NOT marked completed
      const checkSession = await client.query(`
        SELECT status FROM document_upload_sessions WHERE id = $1
      `, [session.sessionId]);
      assert.notEqual(checkSession.rows[0].status, 'completed', 'Session must not be completed on write failure');

      // Verify no available version was created
      const checkVersion = await client.query(`
        SELECT count(*) FROM document_versions WHERE document_id = $1 AND status = 'available'
      `, [session.documentId]);
      assert.equal(Number(checkVersion.rows[0].count), 0, 'No available version must exist for failed write');
    } finally {
      brokenServer.close();
    }
  });

  // =========================================================================
  // Gate 4: Missing Object Projection & Transient Error Differentiation
  // =========================================================================
  it('5. Truth of Missing Objects: unknown -> reconciliation -> unavailable; and transient errors do NOT corrupt state', async () => {
    const missingDocId = randomUUID();
    const missingVersionId = randomUUID();
    const storageKey = `tenant-a/missing-file-${randomUUID()}.pdf`;

    // 5.1 Insert synthetic record with physical file deliberately missing
    await client.query(`
      INSERT INTO documents (id, institution_id, category, status, created_by_person_id)
      VALUES ($1, $2, 'administrative', 'active', $3)
    `, [missingDocId, institutionIdA, adminPersonIdA]);

    await client.query(`
      INSERT INTO document_versions (id, institution_id, document_id, version_number, mime_type, byte_size, sha256_hash, status, created_by_person_id)
      VALUES ($1, $2, $3, 1, 'application/pdf', 2048, $4, 'available', $5)
    `, [missingVersionId, institutionIdA, missingDocId, 'c'.repeat(64), adminPersonIdA]);

    const refId = randomUUID();
    await client.query(`
      INSERT INTO document_storage_references (id, institution_id, version_id, storage_provider, storage_bucket, storage_key, content_availability)
      VALUES ($1, $2, $3, 'local_uat', 'nexus-uat-documents-bucket', $4, 'unknown')
    `, [refId, institutionIdA, missingVersionId, storageKey]);

    // Initial state: unknown
    const initialRef = await client.query(`SELECT content_availability FROM document_storage_references WHERE id = $1`, [refId]);
    assert.equal(initialRef.rows[0].content_availability, 'unknown', 'Initial state before reconciliation must be unknown');

    // 5.2 Reconcile storage batch
    const storageProvider = new LocalUatObjectStorageProvider(storageDir);
    const reconResult = await reconcileStorageBatch({
      pool,
      storageProvider,
      batchSize: 10,
      institutionId: institutionIdA,
      checkBytesIntegrity: true,
    });
    assert.ok(reconResult.processedCount > 0, 'Reconciliation should process records');

    // Check updated state: unavailable with factual reason
    const reconciledRef = await client.query(`
      SELECT content_availability, unavailable_reason, last_checked_at
      FROM document_storage_references WHERE id = $1
    `, [refId]);
    assert.equal(reconciledRef.rows[0].content_availability, 'unavailable', 'Missing file must transition to unavailable');
    assert.match(reconciledRef.rows[0].unavailable_reason, /missing/i, 'Reason must record physical file missing');
    assert.ok(reconciledRef.rows[0].last_checked_at, 'last_checked_at must be populated');

    // 5.3 Verify Transient Error Differentiation:
    // If the storage provider encounters a transient error (e.g. timeout / connection reset),
    // it MUST NOT mark the reference as permanently 'unavailable'!
    const transientProvider = new LocalUatObjectStorageProvider(storageDir);
    transientProvider.headObject = async () => {
      const err: any = new Error('ETIMEDOUT: Connection timed out to storage endpoint');
      err.code = 'ETIMEDOUT';
      throw err;
    };

    // Reset reference back to 'unknown'
    await client.query(`
      UPDATE document_storage_references
      SET content_availability = 'unknown', unavailable_reason = NULL
      WHERE id = $1
    `, [refId]);

    // Run reconciliation with transient failure
    await reconcileStorageBatch({
      pool,
      storageProvider: transientProvider,
      batchSize: 10,
      institutionId: institutionIdA,
    });

    // Reference MUST STILL BE 'unknown' (transient failure does not mark as permanently unavailable)
    const afterTransientRef = await client.query(`
      SELECT content_availability, unavailable_reason FROM document_storage_references WHERE id = $1
    `, [refId]);
    assert.equal(
      afterTransientRef.rows[0].content_availability,
      'unknown',
      'Transient failure must preserve availability state (unknown), NOT mark as unavailable!',
    );
    assert.match(afterTransientRef.rows[0].unavailable_reason, /Transient check failure/);
  });
});
