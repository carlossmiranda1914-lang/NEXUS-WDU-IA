/**
 * GATE 2 REAL ASSOCIATION TEST SUITE
 * MISSION=DOCUMENTS-GATE2-REAL-ASSOCIATION
 *
 * Validates:
 * 1. Target Search & Selection: finding valid same-institution student/enrollment target.
 * 2. Real Association Creation: API response 201, PostgreSQL row persistence, Audit & Outbox events.
 * 3. Detail Drawer Presentation: target name, entity type, pinned version, purpose.
 * 4. Durability Across Process Restart: independent Node process querying detail & list.
 * 5. Multi-Tenant Negative Isolation: Tenant B rejected with 404, no data leakage.
 * 6. Idempotency & Invalid Contract Rejection: replay returns 201 (replayed: true), no duplicates or orphan rows.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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

await verifyApprovedTestConnection();

describe('MISSION DOCUMENTS-GATE2-REAL-ASSOCIATION Suite', () => {
  const storageDir = path.resolve(process.cwd(), '.uat-storage');
  const schema = `doc_gate2_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    options: `-c search_path=${quote(schema)},public`,
  });
  const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

  let client: pg.PoolClient;
  let serverInstance: http.Server | null = null;
  const currentPort = 3110;
  const baseUrl = `http://127.0.0.1:${currentPort}`;

  // Institutional Fixtures (Tenant A & Tenant B)
  const institutionIdA = randomUUID();
  const adminPersonIdA = randomUUID();
  const studentPersonIdA = randomUUID();
  const academicYearIdA = randomUUID();
  const offerIdA = randomUUID();
  const enrollmentAppIdA = randomUUID();

  const institutionIdB = randomUUID();
  const adminPersonIdB = randomUUID();

  // Synthetic Document in Tenant A
  const docIdA = randomUUID();
  const versionIdA = randomUUID();

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
        workerId: 'gate2-worker-01',
        workerName: 'Gate 2 Verification Worker',
      },
    });

    const authMiddleware: any = (req: any, _res: any, next: any) => {
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

    // Seed Institutions
    await client.query(`
      INSERT INTO institutions (id, name, slug, status) VALUES
      ($1, 'Tenant A Institution', 't-a', 'active'),
      ($2, 'Tenant B Institution', 't-b', 'active')
    `, [institutionIdA, institutionIdB]);

    // Seed People
    await client.query(`
      INSERT INTO people (id, name, national_id_number) VALUES
      ($1, 'Admin A', 'BI-ADMIN-A-01'),
      ($2, 'Student Manuel Silva', 'BI-STUDENT-SILVA-01'),
      ($3, 'Admin B', 'BI-ADMIN-B-01')
    `, [adminPersonIdA, studentPersonIdA, adminPersonIdB]);

    // Seed Memberships
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

    // Seed Academic Year for Tenant A
    await client.query(`
      INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status) VALUES
      ($1, $2, '2026/2027', '2026-09-01', '2027-06-30', 'active')
    `, [academicYearIdA, institutionIdA]);

    // Seed Enrollment Offer for Tenant A
    await client.query(`
      INSERT INTO enrollment_offers (id, institution_id, academic_year_id, name, code, status) VALUES
      ($1, $2, $3, '10º Ano - Ciências e Tecnologias', '10-CT-2026', 'active')
    `, [offerIdA, institutionIdA, academicYearIdA]);

    // Seed Enrollment Application for Student Manuel Silva in Tenant A
    await client.query(`
      INSERT INTO enrollment_applications (id, institution_id, student_person_id, academic_year_id, offer_id, status, created_by, updated_by) VALUES
      ($1, $2, $3, $4, $5, 'active', $6, $6)
    `, [enrollmentAppIdA, institutionIdA, studentPersonIdA, academicYearIdA, offerIdA, adminPersonIdA]);

    // Seed Document in Tenant A (status: active, category: identity_proof)
    await client.query(`
      INSERT INTO documents (id, institution_id, category, classification, status, created_by_person_id) VALUES
      ($1, $2, 'identity_proof', 'confidential', 'active', $3)
    `, [docIdA, institutionIdA, adminPersonIdA]);

    // Seed Document Version 1 in Tenant A (status: available)
    await client.query(`
      INSERT INTO document_versions (id, institution_id, document_id, version_number, mime_type, byte_size, sha256_hash, status, created_by_person_id) VALUES
      ($1, $2, $3, 1, 'application/pdf', 4096, $4, 'available', $5)
    `, [versionIdA, institutionIdA, docIdA, 'd'.repeat(64), adminPersonIdA]);

    // Seed Storage Reference in Tenant A (content_availability: available)
    await client.query(`
      INSERT INTO document_storage_references (id, institution_id, version_id, storage_provider, storage_bucket, storage_key, content_availability) VALUES
      ($1, $2, $3, 'local_uat', 'nexus-uat-documents-bucket', 'inst-a/bi_manuel_silva.pdf', 'available')
    `, [randomUUID(), institutionIdA, versionIdA]);

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
  // Step 1: Select an available document and find a valid entity in the same institution
  // =========================================================================
  it('1. Step 1: Search and discover valid same-institution student entity for association', async () => {
    // 1.1 Verify available document exists in list
    const listRes = await fetch(`${baseUrl}/api/documents?category=identity_proof`, {
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(listRes.status, 200, 'Listing documents must return 200');
    const listData = await listRes.json();
    const doc = listData.items.find((d: any) => d.id === docIdA);
    assert.ok(doc, 'Synthetic document must exist in list');
    assert.equal(doc.status, 'active');
    assert.equal(doc.currentVersion?.contentAvailability, 'available');
    assert.equal(doc.capabilities.canOpen, true);

    // 1.2 Search association targets for student / enrollment domain
    const searchRes = await fetch(`${baseUrl}/api/documents/association-targets/search?domain=enrollment&q=Silva`, {
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(searchRes.status, 200, 'Target search must return 200');
    const searchData = await searchRes.json();
    assert.ok(Array.isArray(searchData.targets), 'Targets must be an array');
    assert.ok(searchData.targets.length >= 1, 'Search must return at least one target');

    const foundTarget = searchData.targets.find((t: any) => t.id === enrollmentAppIdA);
    assert.ok(foundTarget, 'Student Manuel Silva enrollment application must be returned');
    assert.equal(foundTarget.domain, 'enrollment');
    assert.equal(foundTarget.resourceType, 'enrollment_application');
    assert.match(foundTarget.name, /Manuel Silva/);
    assert.match(foundTarget.name, /2026\/2027/);
    assert.match(foundTarget.detail, /10º Ano/);
  });

  // =========================================================================
  // Step 2: Create association and confirm API response, persisted row, and audit event
  // =========================================================================
  let createdAssociationId = '';
  const associationIdemKey = `gate2-assoc-${randomUUID()}`;

  it('2. Step 2: Create association via API, verify PostgreSQL row, and check audit & outbox events', async () => {
    const assocPayload = {
      targetDomain: 'enrollment',
      targetResourceType: 'enrollment_application',
      targetResourceId: enrollmentAppIdA,
      purpose: 'Identificação para Matrícula no 10º Ano',
      pinnedVersionId: versionIdA,
    };

    const res = await fetch(`${baseUrl}/api/documents/${docIdA}/associations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': associationIdemKey,
      },
      body: JSON.stringify(assocPayload),
    });

    assert.equal(res.status, 201, 'POST /api/documents/:id/associations must return 201');
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.replayed, false);
    assert.ok(body.association);
    assert.equal(body.association.documentId, docIdA);
    assert.equal(body.association.targetDomain, 'enrollment');
    assert.equal(body.association.targetResourceType, 'enrollment_application');
    assert.equal(body.association.targetResourceId, enrollmentAppIdA);
    assert.equal(body.association.pinnedVersionId, versionIdA);
    assert.equal(body.association.status, 'active');
    createdAssociationId = body.association.id;
    assert.ok(createdAssociationId);

    // 2.1 Verify PostgreSQL persistence in document_associations
    const dbAssoc = await client.query(`
      SELECT id, institution_id, document_id, pinned_version_id, target_domain, target_resource_type, target_resource_id, purpose, status, created_by_person_id
      FROM document_associations
      WHERE id = $1
    `, [createdAssociationId]);
    assert.equal(dbAssoc.rows.length, 1, 'Association row must be persisted in database');
    const assocRow = dbAssoc.rows[0];
    assert.equal(assocRow.institution_id, institutionIdA);
    assert.equal(assocRow.document_id, docIdA);
    assert.equal(assocRow.pinned_version_id, versionIdA);
    assert.equal(assocRow.target_domain, 'enrollment');
    assert.equal(assocRow.target_resource_type, 'enrollment_application');
    assert.equal(assocRow.target_resource_id, enrollmentAppIdA);
    assert.equal(assocRow.purpose, 'Identificação para Matrícula no 10º Ano');
    assert.equal(assocRow.status, 'active');

    // 2.2 Verify Audit Log event in document_audit_events
    const dbAudit = await client.query(`
      SELECT id, institution_id, document_id, version_id, actor_person_id, action, outcome, details
      FROM document_audit_events
      WHERE document_id = $1 AND action = 'association.created'
      ORDER BY occurred_at DESC LIMIT 1
    `, [docIdA]);
    assert.equal(dbAudit.rows.length, 1, 'Audit log event association.created must exist');
    const auditRow = dbAudit.rows[0];
    assert.equal(auditRow.institution_id, institutionIdA);
    assert.equal(auditRow.document_id, docIdA);
    assert.equal(auditRow.version_id, versionIdA);
    assert.equal(auditRow.action, 'association.created');
    assert.equal(auditRow.outcome, 'success');
    assert.equal(auditRow.details.associationId, createdAssociationId);
    assert.equal(auditRow.details.targetResourceId, enrollmentAppIdA);

    // 2.3 Verify Outbox event in document_outbox_events
    const dbOutbox = await client.query(`
      SELECT id, institution_id, event_type, aggregate_type, aggregate_id, payload
      FROM document_outbox_events
      WHERE aggregate_id = $1
    `, [createdAssociationId]);
    assert.equal(dbOutbox.rows.length, 1, 'Outbox event document.association_created must exist');
    assert.equal(dbOutbox.rows[0].event_type, 'document.association_created');
    assert.equal(dbOutbox.rows[0].aggregate_type, 'document_association');
  });

  // =========================================================================
  // Step 3: Close and reopen detail; confirm link, name, and associated version
  // =========================================================================
  it('3. Step 3: Fetch document detail and verify association name, link, and pinned version', async () => {
    const detailRes = await fetch(`${baseUrl}/api/documents/${docIdA}`);
    assert.equal(detailRes.status, 200, 'GET /api/documents/:id must return 200');
    const docDetail = await detailRes.json();

    assert.ok(Array.isArray(docDetail.associations));
    assert.equal(docDetail.associations.length, 1);
    const assoc = docDetail.associations[0];
    assert.equal(assoc.id, createdAssociationId);
    assert.equal(assoc.targetDomain, 'enrollment');
    assert.equal(assoc.targetResourceType, 'enrollment_application');
    assert.equal(assoc.targetResourceId, enrollmentAppIdA);
    assert.match(assoc.targetEntityName, /Manuel Silva/);
    assert.match(assoc.targetEntityName, /2026\/2027/);
    assert.equal(assoc.pinnedVersionId, versionIdA, 'Associated version must match pinnedVersionId');
    assert.equal(assoc.purpose, 'Identificação para Matrícula no 10º Ano');
    assert.equal(assoc.status, 'active');

    // Also check document activity endpoint reflects association event
    const actRes = await fetch(`${baseUrl}/api/documents/${docIdA}/activity`);
    assert.equal(actRes.status, 200);
    const actData = await actRes.json();
    const assocActivity = actData.items.find((a: any) => a.eventType === 'association.created');
    assert.ok(assocActivity, 'Document activity feed must reflect association.created event');
  });

  // =========================================================================
  // Step 4: Restart the service and repeat query to prove durability
  // =========================================================================
  it('4. Step 4: Durability across process restart: independent Node process confirms association persistence', async () => {
    // Terminate initial HTTP server
    await new Promise<void>((resolve) => serverInstance!.close(() => resolve()));
    serverInstance = null;

    const childPort = 3115;
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

    const readyData = await new Promise<{ event: string; pid: number; port: number }>((resolve, reject) => {
      let stderrOut = '';
      const timeout = setTimeout(() => {
        childProcess.kill();
        reject(new Error(`Child process failed to start within timeout. Stderr: ${stderrOut}`));
      }, 45000);

      childProcess.stdout?.on('data', (chunk) => {
        const text = chunk.toString();
        for (const line of text.split('\n')) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line.trim());
            if (parsed.event === 'READY') {
              clearTimeout(timeout);
              resolve(parsed);
              return;
            }
          } catch {}
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

    assert.ok(readyData.pid, 'Child process must report a valid PID');
    assert.notEqual(readyData.pid, process.pid, 'Independent process must have distinct PID');

    try {
      // 4.1 Query detail on the fresh restarted process
      const restartDetailRes = await fetch(`${childBaseUrl}/api/documents/${docIdA}`);
      assert.equal(restartDetailRes.status, 200, 'GET /api/documents/:id after restart must return 200');
      const docDetail = await restartDetailRes.json();
      assert.equal(docDetail.associations.length, 1, 'Association must persist across server restart');
      const persistedAssoc = docDetail.associations[0];
      assert.equal(persistedAssoc.id, createdAssociationId);
      assert.match(persistedAssoc.targetEntityName, /Manuel Silva/);
      assert.equal(persistedAssoc.pinnedVersionId, versionIdA);
      assert.equal(persistedAssoc.status, 'active');

      // 4.2 Query list with association filter on the fresh restarted process
      const filterRes = await fetch(`${childBaseUrl}/api/documents?associationDomain=enrollment`);
      assert.equal(filterRes.status, 200, 'GET /api/documents with association filter must return 200');
      const filterData = await filterRes.json();
      const match = filterData.items.find((d: any) => d.id === docIdA);
      assert.ok(match, 'Document with active association must match association domain filter');
    } finally {
      childProcess.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        if (childProcess.killed || childProcess.exitCode !== null) resolve();
        else {
          childProcess.once('exit', () => resolve());
          setTimeout(() => {
            try { childProcess.kill('SIGKILL'); } catch {}
            resolve();
          }, 3000);
        }
      });
    }

    // Restart serverInstance for remaining tests
    serverInstance = await startServer(new LocalUatObjectStorageProvider(storageDir), currentPort);
  });

  // =========================================================================
  // Step 5: Multi-Tenant Negative Isolation
  // =========================================================================
  it('5. Step 5: Tenant B access attempts strictly rejected with 404 without leaking Tenant A data', async () => {
    // 5.1 Tenant B attempts to read Tenant A document detail -> 404
    const resBGet = await fetch(`${baseUrl}/api/documents/${docIdA}`, {
      headers: {
        'Authorization': 'Bearer tenant-b-token',
        'Content-Type': 'application/json',
      },
    });
    assert.equal(resBGet.status, 404, 'Cross-tenant GET must return 404');
    const bodyGet = await resBGet.json();
    assert.match(bodyGet.error, /não encontrado/i, 'Error message must not reveal Tenant A document existence');

    // 5.2 Tenant B attempts to create association on Tenant A document -> 404
    const resBPost = await fetch(`${baseUrl}/api/documents/${docIdA}/associations`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer tenant-b-token',
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        targetDomain: 'enrollment',
        targetResourceType: 'enrollment_application',
        targetResourceId: enrollmentAppIdA,
        purpose: 'Tentativa Ilegítima de Associação Cruzada',
      }),
    });
    assert.equal(resBPost.status, 404, 'Cross-tenant association creation must return 404');

    // 5.3 Tenant B searches association targets -> must NOT see Tenant A student
    const resBSearch = await fetch(`${baseUrl}/api/documents/association-targets/search?domain=enrollment&q=Silva`, {
      headers: {
        'Authorization': 'Bearer tenant-b-token',
        'Content-Type': 'application/json',
      },
    });
    assert.equal(resBSearch.status, 200);
    const bodySearch = await resBSearch.json();
    assert.equal(bodySearch.targets.length, 0, 'Tenant B search must return zero targets from Tenant A');

    // 5.4 Confirm in PostgreSQL that Tenant B created zero associations
    const checkB = await client.query(`
      SELECT count(*) FROM document_associations WHERE institution_id = $1
    `, [institutionIdB]);
    assert.equal(Number(checkB.rows[0].count), 0, 'Tenant B must have zero association records');
  });

  // =========================================================================
  // Step 6: Idempotency Replay and Invalid Contract Rejection
  // =========================================================================
  it('6. Step 6: Request replay returns 201 (replayed: true) without duplicates; invalid payloads rejected with 400', async () => {
    // 6.1 Idempotent replay of identical association request
    const replayRes = await fetch(`${baseUrl}/api/documents/${docIdA}/associations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': associationIdemKey,
      },
      body: JSON.stringify({
        targetDomain: 'enrollment',
        targetResourceType: 'enrollment_application',
        targetResourceId: enrollmentAppIdA,
        purpose: 'Identificação para Matrícula no 10º Ano',
        pinnedVersionId: versionIdA,
      }),
    });
    assert.equal(replayRes.status, 201, 'Replayed request must return 201');
    const replayBody = await replayRes.json();
    assert.equal(replayBody.success, true);
    assert.equal(replayBody.replayed, true, 'Replay flag must be true');
    assert.equal(replayBody.association.id, createdAssociationId);

    // Verify row count remains exactly 1 (no duplicate rows)
    const countCheck = await client.query(`
      SELECT count(*) FROM document_associations WHERE document_id = $1
    `, [docIdA]);
    assert.equal(Number(countCheck.rows[0].count), 1, 'No duplicate association row must be created');

    // 6.2 Invalid domain rejection
    const invalidDomainRes = await fetch(`${baseUrl}/api/documents/${docIdA}/associations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        targetDomain: 'unauthorized_domain_xyz',
        targetResourceType: 'enrollment_application',
        targetResourceId: enrollmentAppIdA,
        purpose: 'Tentativa inválida',
      }),
    });
    assert.equal(invalidDomainRes.status, 400, 'Invalid targetDomain must return 400');
    const invalidDomainBody = await invalidDomainRes.json();
    assert.match(invalidDomainBody.error, /unrecognized|invalid|unsupported|domínio/i);

    // 6.3 Missing purpose rejection
    const missingPurposeRes = await fetch(`${baseUrl}/api/documents/${docIdA}/associations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        targetDomain: 'enrollment',
        targetResourceType: 'enrollment_application',
        targetResourceId: enrollmentAppIdA,
        purpose: '',
      }),
    });
    assert.equal(missingPurposeRes.status, 400, 'Missing purpose must return 400');

    // 6.4 Invalid pinned version UUID
    const invalidUuidRes = await fetch(`${baseUrl}/api/documents/${docIdA}/associations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        targetDomain: 'enrollment',
        targetResourceType: 'enrollment_application',
        targetResourceId: enrollmentAppIdA,
        purpose: 'Valid purpose',
        pinnedVersionId: 'not-a-valid-uuid',
      }),
    });
    assert.equal(invalidUuidRes.status, 400, 'Invalid pinnedVersionId must return 400');

    // 6.5 Verify no orphan rows created in PostgreSQL
    const finalCount = await client.query(`
      SELECT count(*) FROM document_associations WHERE document_id = $1
    `, [docIdA]);
    assert.equal(Number(finalCount.rows[0].count), 1, 'Row count must strictly remain 1 with zero orphan records');
  });
});
