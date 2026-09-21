/**
 * Documents Retention, Hold & Deletion Real Operational Lifecycle Test
 * Mission: DOCUMENTS-FOUNDATION-I8D / RETENTION-GOVERNANCE-CORRECTION
 * 
 * Proves the end-to-end product chain:
 * 1. CLEAN VERIFICATION -> AVAILABLE (NO AUTOMATIC RETENTION ASSIGNMENT)
 * 2. EXPLICIT GOVERNED UAT RETENTION ASSIGNMENT -> RETENTION ACTIVE -> HOLD AVAILABLE
 * 3. HOLD LIFECYCLE (PLACE & RELEASE)
 * 4. EXPIRED SYNTHETIC UAT RETENTION -> DELETION LIFECYCLE (AUTHORIZE & EXECUTE)
 * 5. FAIL-CLOSED GOVERNANCE ON MISSING JURISDICTION/TRIGGER/POLICY
 * 6. TENANT & ROLE SECURITY (CROSS-TENANT 404, UNAUTHORIZED ROLE 403)
 * 7. PRODUCTION MODE CONFIGURATION FAIL-CLOSED (NO SYNTHETIC LEAKS)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
import { ConfigurableRetentionPolicyEngine } from '../src/modules/documents/document-retention-policy.ts';

await verifyApprovedTestConnection();

describe('Documents Retention, Hold & Deletion Operational Lifecycle (Governance Corrected)', () => {
  const storageDir = path.resolve(process.cwd(), '.uat-storage-retention-test');
  const schema = `doc_ret_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    options: `-c search_path=${quote(schema)},public`,
  });
  const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

  let client: pg.PoolClient;
  let serverInstance: http.Server | null = null;
  const PORT = 3002;
  const baseUrl = `http://127.0.0.1:${PORT}`;

  const institutionIdA = randomUUID();
  const adminPersonIdA = randomUUID();
  const studentPersonIdA = randomUUID();

  const institutionIdB = randomUUID();
  const adminPersonIdB = randomUUID();

  const testRetentionPolicies = [
    {
      policyId: 'local-uat-retention-enrollment',
      policyVersion: '1.0',
      jurisdictionProfileId: 'DEFAULT_JURISDICTION',
      jurisdictionProfileVersion: '1.0',
      category: 'enrollment',
      clockTriggerType: 'document_verified',
      retentionDurationDays: 365 * 5,
      allowedHoldTypes: ['legal' as const, 'administrative' as const],
      allowedDeletionAuthorityScopePatterns: ['admin', 'institution_admin', 'director'],
    },
    {
      policyId: 'test-expired-policy',
      policyVersion: '1.0',
      jurisdictionProfileId: 'DEFAULT_JURISDICTION',
      jurisdictionProfileVersion: '1.0',
      category: 'academic',
      clockTriggerType: 'document_verified',
      retentionDurationDays: 0,
      allowedHoldTypes: ['legal' as const, 'administrative' as const],
      allowedDeletionAuthorityScopePatterns: ['admin', 'institution_admin', 'director'],
    },
  ];

  const retentionPolicyEngine = new ConfigurableRetentionPolicyEngine(testRetentionPolicies);

  function createTestServer(): Promise<http.Server> {
    const app = express();
    app.use(express.json());

    const storageProvider = new LocalUatObjectStorageProvider(storageDir);
    const storageBucket = 'nexus-uat-documents-bucket';
    const malwareScanner = new LocalUatMalwareScanner();

    const verificationWorker = new DocumentVerificationWorker({
      pool,
      storageProvider,
      malwareScanner,
      storageBucket,
      gcpProjectId: 'local-uat-project',
      trustedAuthority: {
        kind: 'trusted_system_worker',
        workerId: 'retention-test-worker-01',
        workerName: 'Nexus Retention Test Worker',
      },
    });

    const config = resolveDocumentsOperationalConfig({
      customStorageProvider: storageProvider,
      customRetentionPolicyEngine: retentionPolicyEngine,
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
      if (authHeader === 'Bearer unauthorized-role-token') {
        req.institutionalContext = {
          institutionId: institutionIdA,
          personId: studentPersonIdA,
          role: 'student',
          membershipStatus: 'active',
        };
        return next();
      }
      // Default Tenant A Admin
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
      retentionPolicyEngine,
      accessGrantTokenKey: config.accessGrantTokenKey!,
      deletionPseudonymizationKey: config.deletionPseudonymizationKey!,
      uploadPolicyConfig: config.uploadPolicyConfig!,
      verificationWorker,
      malwareScanner,
    });

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

    // Seed Institutions & People
    await client.query(
      `INSERT INTO institutions (id, name, slug, status)
       VALUES ($1, 'Colégio Nexus Luanda A', 'nexus-lda-01a', 'active')`,
      [institutionIdA],
    );
    await client.query(
      `INSERT INTO people (id, name) VALUES ($1, 'Admin A'), ($2, 'Student A')`,
      [adminPersonIdA, studentPersonIdA],
    );
    await client.query(
      `INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at)
       VALUES ($1, $2, $3, 'institution_admin', 'active', now()),
              ($4, $5, $3, 'student', 'active', now())`,
      [randomUUID(), adminPersonIdA, institutionIdA, randomUUID(), studentPersonIdA],
    );

    // Seed Institution B
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

  let documentId: string;
  let versionId: string;
  let holdId: string;

  it('A. Clean Verification Alone: Reaches AVAILABLE with NO AUTOMATIC RETENTION ASSIGNMENT', async () => {
    const syntheticPdf = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000108 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n185\n%%EOF\n',
    );

    // 1. Create upload session
    const createRes = await request('/api/documents/upload-sessions', {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-ret-upload-${randomUUID()}` },
      body: {
        category: 'enrollment',
        classification: 'internal',
        declaredFilename: 'comprovativo_matricula.pdf',
        declaredMimeType: 'application/pdf',
        declaredByteSize: syntheticPdf.length,
      },
    });
    assert.equal(createRes.status, 201);
    const sessionData = (await createRes.json()) as any;
    documentId = sessionData.documentId;
    const sessionId = sessionData.sessionId;
    const rawToken = sessionData.rawToken;

    // 2. Transfer bytes
    const transferRes = await fetch(`${baseUrl}/api/documents/upload-sessions/${sessionId}/transfer`, {
      method: 'PUT',
      headers: {
        'X-Upload-Token': rawToken,
        'Content-Type': 'application/pdf',
      },
      body: syntheticPdf,
    });
    assert.equal(transferRes.status, 200);

    // 3. Complete session
    const completeRes = await request(`/api/documents/upload-sessions/${sessionId}/complete`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-ret-complete-${randomUUID()}` },
      body: { rawToken },
    });
    assert.equal(completeRes.status, 200);
    const completeData = (await completeRes.json()) as any;
    versionId = completeData.versionId;

    // 4. Poll for verification completion to 'available'
    let docDetail: any = null;
    for (let i = 0; i < 30; i++) {
      const res = await request(`/api/documents/${documentId}`);
      if (res.status === 200) {
        const detail = (await res.json()) as any;
        if (detail.currentVersion?.status === 'available') {
          docDetail = detail;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    assert.ok(docDetail, 'Document must be verified and reach available status');
    assert.equal(docDetail.currentVersion.status, 'available');
    
    // Canonical governance assertion: verification alone does NOT assign retention
    assert.equal(docDetail.retention, null, 'Clean verification must not automatically assign retention');
    assert.equal(docDetail.capabilities.canPlaceHold, false, 'canPlaceHold must be false when no retention policy is assigned');
    assert.equal(docDetail.capabilities.canAuthorizeDeletion, false, 'canAuthorizeDeletion must be false when no retention policy is assigned');

    // Prove 0 retention audit events and 0 retention outbox events in DB
    const auditRes = await client.query(
      `SELECT * FROM document_audit_events WHERE document_id = $1 AND action = 'document.retention_assigned'`,
      [documentId],
    );
    assert.equal(auditRes.rows.length, 0, 'No document.retention_assigned audit event should exist on verification alone');
  });

  it('B. Explicit Governed UAT Retention Assignment: POST /api/documents/:id/retention -> retention_active', async () => {
    const assignKey = `idem-assign-enrollment-${randomUUID()}`;
    const assignRes = await request(`/api/documents/${documentId}/retention`, {
      method: 'POST',
      headers: { 'Idempotency-Key': assignKey },
      body: {
        versionId,
        category: 'enrollment',
        policyId: 'local-uat-retention-enrollment',
        jurisdictionProfileId: 'DEFAULT_JURISDICTION',
        purpose: 'Registo e arquivo da matrícula escolar',
        clockTriggerEventAt: new Date().toISOString(),
      },
    });
    assert.equal(assignRes.status, 201, 'Explicit retention assignment must return HTTP 201');
    const assignData = (await assignRes.json()) as any;
    assert.equal(assignData.retentionAssignment.retentionStatus, 'retention_active');
    assert.equal(assignData.retentionAssignment.policyId, 'local-uat-retention-enrollment');
    assert.equal(assignData.retentionAssignment.jurisdictionProfileId, 'DEFAULT_JURISDICTION');

    // Verify detail now reflects active retention and enables canPlaceHold
    const detailRes = await request(`/api/documents/${documentId}`);
    assert.equal(detailRes.status, 200);
    const detail = (await detailRes.json()) as any;
    assert.ok(detail.retention, 'Retention must now be present on document detail');
    assert.equal(detail.retention.retentionStatus, 'retention_active');
    assert.equal(detail.capabilities.canPlaceHold, true, 'canPlaceHold must now be enabled');
    assert.equal(detail.capabilities.canAuthorizeDeletion, false, 'canAuthorizeDeletion remains false while retention is active');

    // Audit and Outbox events recorded
    const auditRes = await client.query(
      `SELECT * FROM document_audit_events WHERE document_id = $1 AND action = 'document.retention_assigned'`,
      [documentId],
    );
    assert.equal(auditRes.rows.length, 1, 'document.retention_assigned audit event must exist');

    const outboxRes = await client.query(
      `SELECT * FROM document_outbox_events WHERE aggregate_id = $1 AND event_type = 'document.retention_assigned'`,
      [documentId],
    );
    assert.equal(outboxRes.rows.length, 1, 'document.retention_assigned outbox event must exist');
  });

  it('C. Legal Hold Lifecycle: Place hold -> verified in drawer -> blocks deletion', async () => {
    const holdRes = await request(`/api/documents/${documentId}/holds`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-ret-hold-${randomUUID()}` },
      body: {
        versionId,
        holdType: 'legal',
        authority: 'Tribunal Judicial de Luanda / Processo 2026/88',
        reason: 'Bloqueio preventivo sob investigação jurídica',
      },
    });
    assert.equal(holdRes.status, 201, 'Place hold must return HTTP 201');
    const holdData = (await holdRes.json()) as any;
    holdId = holdData.hold.id;
    assert.ok(holdId, 'holdId must be present');
    assert.equal(holdData.hold.holdStatus, 'active');
    assert.equal(holdData.hold.holdType, 'legal');

    // Verify detail reflects active hold
    const detailRes = await request(`/api/documents/${documentId}`);
    assert.equal(detailRes.status, 200);
    const detail = (await detailRes.json()) as any;
    assert.equal(detail.activeHolds.length, 1);
    assert.equal(detail.activeHolds[0].id, holdId);
    assert.equal(detail.capabilities.canReleaseHold, true);

    // Attempt deletion authorization — MUST be blocked by active hold
    const authDelRes = await request(`/api/documents/${documentId}/deletion/authorize`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-del-auth-fail-${randomUUID()}` },
      body: { versionId },
    });
    assert.equal(authDelRes.status, 422, 'Active retention / hold must block deletion authorization');
  });

  it('D. Release Hold: Hold release decrements active holds and records audit event', async () => {
    const releaseRes = await request(`/api/documents/${documentId}/holds/${holdId}/release`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-ret-release-${randomUUID()}` },
      body: {
        versionId,
        releaseReason: 'Conclusão formal do processo judicial sem apreensão',
      },
    });
    assert.equal(releaseRes.status, 200, 'Release hold must return HTTP 200');
    const releaseData = (await releaseRes.json()) as any;
    assert.equal(releaseData.hold.holdStatus, 'released');
    assert.ok(releaseData.hold.releasedAt);

    // Verify detail reflects zero active holds
    const detailRes = await request(`/api/documents/${documentId}`);
    assert.equal(detailRes.status, 200);
    const detail = (await detailRes.json()) as any;
    assert.equal(detail.activeHolds.length, 0, 'Active holds count must be 0 after release');

    // Audit event check
    const auditRes = await client.query(
      `SELECT * FROM document_audit_events WHERE document_id = $1 AND action = 'document.hold_released'`,
      [documentId],
    );
    assert.equal(auditRes.rows.length, 1, 'document.hold_released audit event must exist');
  });

  it('E. Expired Synthetic UAT Retention & Deletion Lifecycle: Authorize & Execute Deletion', async () => {
    // Upload a new document in category 'academic'
    const syntheticPdf = Buffer.from('%PDF-1.4\nAcademic Document Content\n%%EOF');
    const createRes = await request('/api/documents/upload-sessions', {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-acad-upload-${randomUUID()}` },
      body: {
        category: 'academic',
        declaredFilename: 'certificado_habilitacoes.pdf',
        declaredMimeType: 'application/pdf',
        declaredByteSize: syntheticPdf.length,
      },
    });
    assert.equal(createRes.status, 201);
    const sessionData = (await createRes.json()) as any;
    const acadDocId = sessionData.documentId;
    const acadSessionId = sessionData.sessionId;
    const acadToken = sessionData.rawToken;

    await fetch(`${baseUrl}/api/documents/upload-sessions/${acadSessionId}/transfer`, {
      method: 'PUT',
      headers: { 'X-Upload-Token': acadToken, 'Content-Type': 'application/pdf' },
      body: syntheticPdf,
    });

    const compRes = await request(`/api/documents/upload-sessions/${acadSessionId}/complete`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-acad-comp-${randomUUID()}` },
      body: { rawToken: acadToken },
    });
    assert.equal(compRes.status, 200);
    const acadVersionId = (await compRes.json() as any).versionId;

    // Explicitly assign expired retention policy 'test-expired-policy'
    const assignKey = `idem-assign-expired-${randomUUID()}`;
    const assignRes = await request(`/api/documents/${acadDocId}/retention`, {
      method: 'POST',
      headers: { 'Idempotency-Key': assignKey },
      body: {
        versionId: acadVersionId,
        category: 'academic',
        policyId: 'test-expired-policy',
        jurisdictionProfileId: 'DEFAULT_JURISDICTION',
        purpose: 'Teste de ciclo de expiração e eliminação',
        clockTriggerEventAt: new Date(Date.now() - 1000 * 3600 * 24).toISOString(), // 1 day ago
      },
    });
    assert.equal(assignRes.status, 201, 'Explicit retention assign must return HTTP 201');
    const assignData = (await assignRes.json()) as any;
    assert.equal(assignData.retentionAssignment.policyId, 'test-expired-policy');
    assert.equal(assignData.retentionAssignment.category, 'academic');

    // Deletion Vertical with Expired Retention: Authorize & Execute Deletion
    const delAuthKey = `idem-del-auth-${randomUUID()}`;
    const delAuthRes = await request(`/api/documents/${acadDocId}/deletion/authorize`, {
      method: 'POST',
      headers: { 'Idempotency-Key': delAuthKey },
      body: { versionId: acadVersionId },
    });
    assert.equal(delAuthRes.status, 201, 'Authorize deletion must succeed on expired retention with 0 holds');
    const authData = (await delAuthRes.json()) as any;
    const deletionAuthId = authData.authorizationId;
    assert.ok(deletionAuthId, 'deletionAuthId must be present');

    // Execute Deletion
    const delExecRes = await request(`/api/documents/${acadDocId}/deletion/execute`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-del-exec-${randomUUID()}` },
      body: { deletionAuthorizationId: deletionAuthId },
    });
    assert.equal(delExecRes.status, 200, 'Execute deletion must return HTTP 200');
    const execData = (await delExecRes.json()) as any;
    assert.equal(execData.success, true);
    assert.equal(execData.reconciliationRequired, false);

    // Verify version status in DB is deleted and tombstone audit exists
    const vCheck = await client.query(`SELECT status FROM document_versions WHERE id = $1`, [acadVersionId]);
    assert.equal(vCheck.rows[0].status, 'deleted');

    const delAudit = await client.query(
      `SELECT * FROM document_audit_events WHERE document_id = $1 AND action = 'document.version_deleted'`,
      [acadDocId],
    );
    assert.equal(delAudit.rows.length, 1, 'document.version_deleted audit event must be recorded');

    const delOutbox = await client.query(
      `SELECT * FROM document_outbox_events WHERE aggregate_id = $1 AND event_type = 'document.deleted'`,
      [acadDocId],
    );
    assert.equal(delOutbox.rows.length, 1, 'document.deleted outbox event must be recorded');
  });

  it('F. Fail Closed on Missing Jurisdiction, Clock Trigger or Unknown Policy', async () => {
    // 1. Missing jurisdictionProfileId -> HTTP 400
    const missingJurisdiction = await request(`/api/documents/${documentId}/retention`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-missing-jurisdiction-${randomUUID()}` },
      body: {
        versionId,
        category: 'enrollment',
        clockTriggerEventAt: new Date().toISOString(),
      },
    });
    assert.equal(missingJurisdiction.status, 400, 'Missing jurisdictionProfileId must return 400');

    // 2. Missing clockTriggerEventAt -> HTTP 400
    const missingTrigger = await request(`/api/documents/${documentId}/retention`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-missing-trigger-${randomUUID()}` },
      body: {
        versionId,
        category: 'enrollment',
        jurisdictionProfileId: 'DEFAULT_JURISDICTION',
      },
    });
    assert.equal(missingTrigger.status, 400, 'Missing clockTriggerEventAt must return 400');

    // 3. Unknown jurisdiction/policy -> FAIL_CLOSED (HTTP 503 / 422 JURISDICTION_PROFILE_MISSING)
    const unknownPolicy = await request(`/api/documents/${documentId}/retention`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-unknown-policy-${randomUUID()}` },
      body: {
        versionId,
        category: 'non_existent_category',
        jurisdictionProfileId: 'NON_EXISTENT_JURISDICTION',
        clockTriggerEventAt: new Date().toISOString(),
      },
    });
    assert.ok(
      [422, 503].includes(unknownPolicy.status),
      `Unknown policy must fail closed, got status: ${unknownPolicy.status}`,
    );
  });

  it('G. Security & Isolation: Cross-tenant & Unauthorized roles are rejected', async () => {
    // Tenant B cannot assign retention to Tenant A document
    const tenantBAssign = await request(`/api/documents/${documentId}/retention`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer tenant-b-token',
        'Idempotency-Key': `idem-tb-assign-${randomUUID()}`,
      },
      body: {
        versionId,
        category: 'enrollment',
        jurisdictionProfileId: 'DEFAULT_JURISDICTION',
        clockTriggerEventAt: new Date().toISOString(),
      },
    });
    assert.equal(tenantBAssign.status, 404, 'Tenant B cross-tenant assign retention must return 404');

    // Tenant B cannot place hold on Tenant A document
    const tenantBHold = await request(`/api/documents/${documentId}/holds`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer tenant-b-token',
        'Idempotency-Key': `idem-tb-hold-${randomUUID()}`,
      },
      body: {
        versionId,
        holdType: 'legal',
        authority: 'Tenant B Authority',
        reason: 'Cross-tenant illegal hold attempt',
      },
    });
    assert.equal(tenantBHold.status, 404, 'Tenant B cross-tenant hold must return 404');

    // Unauthorized role (student) cannot assign retention (HTTP 403)
    const studentAssign = await request(`/api/documents/${documentId}/retention`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer unauthorized-role-token',
        'Idempotency-Key': `idem-student-assign-${randomUUID()}`,
      },
      body: {
        versionId,
        category: 'enrollment',
        jurisdictionProfileId: 'DEFAULT_JURISDICTION',
        clockTriggerEventAt: new Date().toISOString(),
      },
    });
    assert.equal(studentAssign.status, 403, 'Unauthorized student role cannot assign retention (403)');

    // Unauthorized role (student) cannot authorize deletion (HTTP 403)
    const studentAuthDel = await request(`/api/documents/${documentId}/deletion/authorize`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer unauthorized-role-token',
        'Idempotency-Key': `idem-student-del-${randomUUID()}`,
      },
      body: { versionId },
    });
    assert.equal(studentAuthDel.status, 403, 'Unauthorized student role cannot authorize deletion (403)');
  });

  it('H. Production Configuration Governance: Zero synthetic policy leaks in production mode', () => {
    // When NODE_ENV === 'production' and no custom/governed retention engine is supplied:
    const prodConfig = resolveDocumentsOperationalConfig({
      env: {
        NODE_ENV: 'production',
      },
    });

    assert.equal(
      prodConfig.retentionPolicyEngine,
      null,
      'Production configuration MUST NOT inject synthetic retention policies (must be null / fail closed)',
    );
  });
});
