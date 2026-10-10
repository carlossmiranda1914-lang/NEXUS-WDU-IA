/**
 * Comprehensive Factual Proof Suite for Documents Module Closure
 * MISSIONS: GATE 1 (Storage Truth), GATE 2 (Real Association), GATE 3 (Retention & Lifecycle)
 *
 * Verifies end-to-end:
 * Part 1: Gate 2 Real Association (search, link, reopen detail, pinned version, persistence, audit, tenant B isolation, idempotency)
 * Part 2: Gate 3 Lifecycle (no policy -> blocked; explicit policy -> hold & release; eligible -> authorize & execute delete with physical deletion and audit)
 * Part 3: Durability & Unavailable Historical Records (synthetic upload, stream download, empty-cache restart, unavailable 6007 records truth preservation)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import http from 'http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import express from 'express';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { registerDocumentRoutes } from '../src/modules/documents/document.controller.ts';
import { resolveDocumentsOperationalConfig } from '../src/modules/documents/documents-runtime-config.ts';
import { LocalUatObjectStorageProvider } from '../src/modules/documents/local-uat-storage-provider.ts';
import { LocalUatMalwareScanner } from '../src/modules/documents/local-uat-malware-scanner.ts';
import { DocumentVerificationWorker } from '../src/modules/documents/verification-worker.ts';
import {
  ConfigurableRetentionPolicyEngine,
  type RetentionPolicyConfig,
} from '../src/modules/documents/document-retention-policy.ts';

await verifyApprovedTestConnection();

describe('DOCUMENTS MODULE FINAL FACTUAL CLOSURE PROOF', () => {
  const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../');
  const storageDir = path.resolve(REPO_ROOT, '.uat-storage-closure-proof');
  const schema = `doc_closure_${randomUUID().replaceAll('-', '')}`;
  const quote = (v: string) => `"${v.replaceAll('"', '""')}"`;

  const pool = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    options: `-c search_path=${quote(schema)},public`,
  });

  const testPort = 3139;
  const baseUrl = `http://127.0.0.1:${testPort}`;
  let server: http.Server;
  let storageProvider: LocalUatObjectStorageProvider;

  // Institutional Fixtures
  const instA = randomUUID();
  const adminA = randomUUID();
  const studentA = randomUUID();
  const offerA = randomUUID();
  const yearA = randomUUID();
  const appA = randomUUID();

  const instB = randomUUID();
  const adminB = randomUUID();

  // Test storage keys
  const storageBucket = 'nexus-uat-closure-bucket';

  before(async () => {
    if (fs.existsSync(storageDir)) {
      fs.rmSync(storageDir, { recursive: true, force: true });
    }
    fs.mkdirSync(storageDir, { recursive: true });

    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA ${quote(schema)}`);
      await client.query(`SET search_path TO ${quote(schema)}, public`);
      const migrationsDir = path.resolve(REPO_ROOT, 'src/db/migrations');
      const migrations = await discoverMigrations(migrationsDir);
      await runMigrations(client, migrations);

      // Seed Institutions
      await client.query(
        `INSERT INTO institutions (id, name, slug, status) VALUES ($1, 'Colégio Nexus A', 'nexus-a', 'active'), ($2, 'Colégio Nexus B', 'nexus-b', 'active')`,
        [instA, instB],
      );

      // Seed People
      await client.query(
        `INSERT INTO people (id, name, national_id_number) VALUES ($1, 'Admin A', 'BI-A-01'), ($2, 'Carlos António', 'BI-STUDENT-01'), ($3, 'Admin B', 'BI-B-01')`,
        [adminA, studentA, adminB],
      );

      // Seed Memberships
      await client.query(
        `INSERT INTO memberships (id, institution_id, person_id, role, status) VALUES
         ($1, $2, $3, 'institution_admin', 'active'),
         ($4, $5, $6, 'student', 'active'),
         ($7, $8, $9, 'institution_admin', 'active')`,
        [randomUUID(), instA, adminA, randomUUID(), instA, studentA, randomUUID(), instB, adminB],
      );

      // Seed Academic Year & Offer & Enrollment Application
      await client.query(
        `INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status) VALUES ($1, $2, '2026', '2026-01-01', '2026-12-31', 'active')`,
        [yearA, instA],
      );
      await client.query(
        `INSERT INTO enrollment_offers (id, institution_id, academic_year_id, name, code, status) VALUES ($1, $2, $3, 'Matrícula 2026', 'MAT-2026', 'active')`,
        [offerA, instA, yearA],
      );
      await client.query(
        `INSERT INTO enrollment_applications (id, institution_id, student_person_id, academic_year_id, offer_id, status, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, 'active', $6, $6)`,
        [appA, instA, studentA, yearA, offerA, adminA],
      );
    } finally {
      client.release();
    }

    storageProvider = new LocalUatObjectStorageProvider(storageDir);
    const malwareScanner = new LocalUatMalwareScanner();

    const policies: RetentionPolicyConfig[] = [
      {
        policyId: 'academic_records_10y',
        policyVersion: '1',
        jurisdictionProfileId: 'AO-STANDARD',
        jurisdictionProfileVersion: '1',
        category: 'academic',
        clockTriggerType: 'academic_year_ended',
        retentionDurationDays: 3650,
        allowedHoldTypes: ['legal', 'administrative'],
        allowedDeletionAuthorityScopePatterns: ['admin', 'institution_admin'],
      },
      {
        policyId: 'short_expired_policy',
        policyVersion: '1',
        jurisdictionProfileId: 'AO-STANDARD',
        jurisdictionProfileVersion: '1',
        category: 'administrative',
        clockTriggerType: 'document_creation',
        retentionDurationDays: -1, // Expired immediately for eligible deletion testing
        allowedHoldTypes: ['legal', 'administrative'],
        allowedDeletionAuthorityScopePatterns: ['admin', 'institution_admin'],
      },
    ];
    const retentionPolicyEngine = new ConfigurableRetentionPolicyEngine(policies);

    const config = resolveDocumentsOperationalConfig({
      customStorageProvider: storageProvider,
      customRetentionPolicyEngine: retentionPolicyEngine,
    });

    const verificationWorker = new DocumentVerificationWorker({
      pool,
      storageProvider,
      malwareScanner,
      storageBucket,
      gcpProjectId: 'local-uat-project',
      trustedAuthority: {
        kind: 'trusted_system_worker',
        workerId: 'closure-worker-01',
        workerName: 'Closure Verification Worker',
      },
    });

    const app = express();
    app.use(express.json());

    // Contextual Auth Middleware supporting Tenant A and Tenant B
    const authMiddleware: any = (req: any, _res: any, next: any) => {
      const authHeader = req.headers['authorization'];
      if (authHeader === 'Bearer tenant-b-token') {
        req.institutionalContext = {
          institutionId: instB,
          personId: adminB,
          role: 'institution_admin',
          membershipStatus: 'active',
        };
      } else {
        req.institutionalContext = {
          institutionId: instA,
          personId: adminA,
          role: 'institution_admin',
          membershipStatus: 'active',
        };
      }
      next();
    };

    registerDocumentRoutes(app, {
      pool,
      requireAuth: authMiddleware,
      storageProvider,
      storageBucket,
      policyEngine: config.policyEngine!,
      retentionPolicyEngine,
      accessGrantTokenKey: 'test-grant-token-key-for-documents-32-chars!',
      deletionPseudonymizationKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      uploadPolicyConfig: { globalMaxByteSize: 50 * 1024 * 1024 },
      verificationWorker,
      malwareScanner,
    });

    await new Promise<void>((resolve) => {
      server = app.listen(testPort, '127.0.0.1', () => resolve());
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    const client = await pool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
    } finally {
      client.release();
    }
    await pool.end();
    if (fs.existsSync(storageDir)) {
      fs.rmSync(storageDir, { recursive: true, force: true });
    }
  });

  // Helper to make authenticated requests
  async function apiRequest(
    method: string,
    endpoint: string,
    body?: any,
    headers: Record<string, string> = {},
  ): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
    const url = `${baseUrl}${endpoint}`;
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer tenant-a-token',
      ...headers,
    };

    const res = await fetch(url, {
      method,
      headers: reqHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    return { status: res.status, data, headers: Object.fromEntries(res.headers.entries()) };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PART 1: GATE 2 — REAL ASSOCIATION
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Gate 2: Real Association Proof', () => {
    let gate2DocId: string;
    let gate2VersionId: string;
    let gate2AssocId: string;

    it('1.1 Search target entity in same institution', async () => {
      const res = await apiRequest('GET', '/api/documents/association-targets/search?domain=enrollment&q=Carlos');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data.targets));
      assert.ok(res.data.targets.length >= 1);
      const target = res.data.targets[0];
      assert.equal(target.resourceType, 'enrollment_application');
      assert.equal(target.id, appA);
      assert.match(target.name, /Carlos António/);
    });

    it('1.2 Create synthetic document and establish real association', async () => {
      gate2DocId = randomUUID();
      gate2VersionId = randomUUID();

      // Seed synthetic document in PostgreSQL
      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO documents (id, institution_id, category, classification, status, created_by_person_id)
           VALUES ($1, $2, 'academic', 'internal', 'active', $3)`,
          [gate2DocId, instA, adminA],
        );
        await client.query(
          `INSERT INTO document_versions (id, institution_id, document_id, version_number, mime_type, byte_size, sha256_hash, status, created_by_person_id)
           VALUES ($1, $2, $3, 1, 'application/pdf', 2048, $4, 'available', $5)`,
          [gate2VersionId, instA, gate2DocId, 'a'.repeat(64), adminA],
        );
        await client.query(
          `INSERT INTO document_storage_references (institution_id, version_id, storage_provider, storage_bucket, storage_key, content_availability)
           VALUES ($1, $2, 'local_uat', $3, 'key-doc-gate2.pdf', 'available')`,
          [instA, gate2VersionId, storageBucket],
        );
      } finally {
        client.release();
      }

      // Associate via API
      const idempotencyKey = `idem-assoc-${randomUUID()}`;
      const assocRes = await apiRequest(
        'POST',
        `/api/documents/${gate2DocId}/associations`,
        {
          targetDomain: 'enrollment',
          targetResourceType: 'enrollment_application',
          targetResourceId: appA,
          purpose: 'Certificado de Matrícula',
          pinnedVersionId: gate2VersionId,
        },
        { 'Idempotency-Key': idempotencyKey },
      );

      assert.equal(assocRes.status, 201);
      assert.equal(assocRes.data.replayed, false);
      assert.ok(assocRes.data.association?.id);
      gate2AssocId = assocRes.data.association.id;

      // Verify PostgreSQL row
      const client2 = await pool.connect();
      try {
        const row = await client2.query(`SELECT * FROM document_associations WHERE id = $1`, [gate2AssocId]);
        assert.equal(row.rows.length, 1);
        assert.equal(row.rows[0].document_id, gate2DocId);
        assert.equal(row.rows[0].target_resource_id, appA);
        assert.equal(row.rows[0].pinned_version_id, gate2VersionId);
        assert.equal(row.rows[0].purpose, 'Certificado de Matrícula');
        assert.equal(row.rows[0].status, 'active');

        // Verify audit event
        const audit = await client2.query(
          `SELECT * FROM document_audit_events WHERE document_id = $1 AND action = 'association.created'`,
          [gate2DocId],
        );
        assert.ok(audit.rows.length >= 1);
        assert.equal(audit.rows[0].outcome, 'success');

        // Verify outbox event with aggregate_id = association.id
        const outbox = await client2.query(
          `SELECT * FROM document_outbox_events WHERE aggregate_id = $1 AND event_type = 'document.association_created'`,
          [gate2AssocId],
        );
        assert.ok(outbox.rows.length >= 1);
      } finally {
        client2.release();
      }
    });

    it('1.3 Reopen detail: verify target name, entity type, and pinned version badge in UI DTO', async () => {
      const detailRes = await apiRequest('GET', `/api/documents/${gate2DocId}`);
      assert.equal(detailRes.status, 200);
      assert.equal(detailRes.data.id, gate2DocId);
      assert.ok(Array.isArray(detailRes.data.associations));
      assert.equal(detailRes.data.associations.length, 1);

      const assocDto = detailRes.data.associations[0];
      assert.equal(assocDto.id, gate2AssocId);
      assert.equal(assocDto.targetDomain, 'enrollment');
      assert.equal(assocDto.targetResourceType, 'enrollment_application');
      assert.equal(assocDto.pinnedVersionId, gate2VersionId);
      assert.match(assocDto.targetEntityName, /Carlos António/);
      assert.equal(assocDto.purpose, 'Certificado de Matrícula');
    });

    it('1.4 Tenant B isolation: rejected with 404 on query and association creation', async () => {
      // Tenant B queries Tenant A document detail
      const queryB = await apiRequest('GET', `/api/documents/${gate2DocId}`, undefined, {
        Authorization: 'Bearer tenant-b-token',
      });
      assert.equal(queryB.status, 404);

      // Tenant B attempts to associate Tenant A document
      const assocB = await apiRequest(
        'POST',
        `/api/documents/${gate2DocId}/associations`,
        {
          targetDomain: 'enrollment',
          targetResourceType: 'enrollment_application',
          targetResourceId: appA,
          purpose: 'Cross-tenant illegal association',
        },
        {
          Authorization: 'Bearer tenant-b-token',
          'Idempotency-Key': `idem-illegal-${randomUUID()}`,
        },
      );
      assert.equal(assocB.status, 404);
    });

    it('1.5 Idempotency: exact replay returns 201 with replayed=true and zero extra rows', async () => {
      const replayKey = `idem-replay-${randomUUID()}`;
      const payload = {
        targetDomain: 'enrollment',
        targetResourceType: 'enrollment_application',
        targetResourceId: appA,
        purpose: 'Idempotency Replay Test',
        pinnedVersionId: gate2VersionId,
      };

      const first = await apiRequest('POST', `/api/documents/${gate2DocId}/associations`, payload, {
        'Idempotency-Key': replayKey,
      });
      assert.equal(first.status, 201);
      assert.equal(first.data.replayed, false);
      const createdId = first.data.association.id;

      const second = await apiRequest('POST', `/api/documents/${gate2DocId}/associations`, payload, {
        'Idempotency-Key': replayKey,
      });
      assert.equal(second.status, 201);
      assert.equal(second.data.replayed, true);
      assert.equal(second.data.association.id, createdId);

      // Ensure no duplicate rows in DB
      const client = await pool.connect();
      try {
        const rows = await client.query(
          `SELECT count(*)::int AS cnt FROM document_associations WHERE document_id = $1 AND purpose = 'Idempotency Replay Test'`,
          [gate2DocId],
        );
        assert.equal(rows.rows[0].cnt, 1);
      } finally {
        client.release();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PART 2: GATE 3 — RETENTION, HOLD, AND DELETION LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Gate 3: Retention and Lifecycle Proof', () => {
    it('2.1 Document without policy: Hold and Delete are strictly blocked (422)', async () => {
      const docNoPolicyId = randomUUID();
      const verNoPolicyId = randomUUID();

      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO documents (id, institution_id, category, classification, status, created_by_person_id)
           VALUES ($1, $2, 'administrative', 'internal', 'active', $3)`,
          [docNoPolicyId, instA, adminA],
        );
        await client.query(
          `INSERT INTO document_versions (id, institution_id, document_id, version_number, mime_type, byte_size, sha256_hash, status, created_by_person_id)
           VALUES ($1, $2, $3, 1, 'application/pdf', 1024, $4, 'available', $5)`,
          [verNoPolicyId, instA, docNoPolicyId, 'b'.repeat(64), adminA],
        );
      } finally {
        client.release();
      }

      // Check capabilities in Detail query
      const detail = await apiRequest('GET', `/api/documents/${docNoPolicyId}`);
      assert.equal(detail.status, 200);
      assert.equal(detail.data.capabilities.canPlaceHold, false);
      assert.equal(detail.data.capabilities.canAuthorizeDeletion, false);

      // Attempt Hold API -> 422
      const holdRes = await apiRequest(
        'POST',
        `/api/documents/${docNoPolicyId}/holds`,
        {
          holdType: 'legal',
          authority: 'Tribunal Judicial de Luanda',
          reason: 'Attempt hold without retention policy',
        },
        { 'Idempotency-Key': `idem-hold-fail-${randomUUID()}` },
      );
      assert.equal(holdRes.status, 422);
      assert.match(holdRes.data.error, /NO_RETENTION_ASSIGNED|política de retenção/i);

      // Attempt Deletion Authorization API -> 422
      const delRes = await apiRequest(
        'POST',
        `/api/documents/${docNoPolicyId}/deletion/authorize`,
        { reason: 'Attempt deletion without retention policy' },
        { 'Idempotency-Key': `idem-del-fail-${randomUUID()}` },
      );
      assert.equal(delRes.status, 422);
      assert.match(delRes.data.error, /NO_RETENTION_ASSIGNED|política de retenção/i);

      // Verify 0 rows in PostgreSQL
      const client2 = await pool.connect();
      try {
        const holds = await client2.query(`SELECT count(*)::int as cnt FROM document_retention_holds WHERE document_id = $1`, [docNoPolicyId]);
        assert.equal(holds.rows[0].cnt, 0);
        const auths = await client2.query(`SELECT count(*)::int as cnt FROM document_deletion_authorizations WHERE document_id = $1`, [docNoPolicyId]);
        assert.equal(auths.rows[0].cnt, 0);
      } finally {
        client2.release();
      }
    });

    it('2.2 Explicit policy assigned: Place Hold and Release Hold lifecycle with audit', async () => {
      const docHoldId = randomUUID();
      const verHoldId = randomUUID();

      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO documents (id, institution_id, category, classification, status, created_by_person_id)
           VALUES ($1, $2, 'academic', 'internal', 'active', $3)`,
          [docHoldId, instA, adminA],
        );
        await client.query(
          `INSERT INTO document_versions (id, institution_id, document_id, version_number, mime_type, byte_size, sha256_hash, status, created_by_person_id)
           VALUES ($1, $2, $3, 1, 'application/pdf', 1024, $4, 'available', $5)`,
          [verHoldId, instA, docHoldId, 'c'.repeat(64), adminA],
        );
      } finally {
        client.release();
      }

      // Assign explicit retention policy with valid 4+ char jurisdictionProfileId
      const assignRes = await apiRequest(
        'POST',
        `/api/documents/${docHoldId}/retention`,
        {
          policyId: 'academic_records_10y',
          jurisdictionProfileId: 'AO-STANDARD',
          clockTriggerEventAt: new Date().toISOString(),
        },
        { 'Idempotency-Key': `idem-ret-${randomUUID()}` },
      );
      assert.equal(assignRes.status, 201);
      assert.ok(assignRes.data.retentionAssignment?.id || assignRes.data.assignment?.id);

      // Now place hold
      const placeHoldRes = await apiRequest(
        'POST',
        `/api/documents/${docHoldId}/holds`,
        {
          holdType: 'legal',
          authority: 'Conselho Pedagógico Distrital',
          reason: 'Inquérito Judicial Pedagógico',
        },
        { 'Idempotency-Key': `idem-hold-${randomUUID()}` },
      );
      assert.equal(placeHoldRes.status, 201);
      const holdId = placeHoldRes.data.hold.id;
      assert.ok(holdId);

      // Verify PostgreSQL state & audit
      const client2 = await pool.connect();
      try {
        const holdRow = await client2.query(`SELECT * FROM document_retention_holds WHERE id = $1`, [holdId]);
        assert.equal(holdRow.rows[0].hold_status, 'active');
        assert.equal(holdRow.rows[0].reason, 'Inquérito Judicial Pedagógico');

        const audit = await client2.query(
          `SELECT * FROM document_audit_events WHERE document_id = $1 AND action = 'document.hold_placed'`,
          [docHoldId],
        );
        assert.ok(audit.rows.length >= 1);
      } finally {
        client2.release();
      }

      // Verify UI drawer detail shows active hold
      const detailActive = await apiRequest('GET', `/api/documents/${docHoldId}`);
      assert.equal(detailActive.status, 200);
      assert.equal(detailActive.data.activeHolds.length, 1);
      assert.equal(detailActive.data.activeHolds[0].id, holdId);
      assert.equal(detailActive.data.capabilities.canPlaceHold, true);
      assert.equal(detailActive.data.capabilities.canReleaseHold, true);

      // Release Hold
      const releaseRes = await apiRequest(
        'POST',
        `/api/documents/${docHoldId}/holds/${holdId}/release`,
        { releaseReason: 'Processo arquivado sem infrações' },
        { 'Idempotency-Key': `idem-rel-${randomUUID()}` },
      );
      assert.equal(releaseRes.status, 200);

      // Verify PostgreSQL state & audit
      const client3 = await pool.connect();
      try {
        const holdRow = await client3.query(`SELECT * FROM document_retention_holds WHERE id = $1`, [holdId]);
        assert.equal(holdRow.rows[0].hold_status, 'released');
        assert.equal(holdRow.rows[0].release_reason, 'Processo arquivado sem infrações');

        const audit = await client3.query(
          `SELECT * FROM document_audit_events WHERE document_id = $1 AND action = 'document.hold_released'`,
          [docHoldId],
        );
        assert.ok(audit.rows.length >= 1);
      } finally {
        client3.release();
      }

      // Verify UI drawer detail shows zero active holds
      const detailReleased = await apiRequest('GET', `/api/documents/${docHoldId}`);
      assert.equal(detailReleased.status, 200);
      assert.equal(detailReleased.data.activeHolds.length, 0);
      assert.equal(detailReleased.data.capabilities.canPlaceHold, true);
      assert.equal(detailReleased.data.capabilities.canReleaseHold, false);
    });

    it('2.3 Eligible document: Authorize and execute Delete with physical object removal and audit', async () => {
      const docDelId = randomUUID();
      const verDelId = randomUUID();
      const delKey = `inst-a/doc-del-${randomUUID()}.pdf`;

      // Write physical file to storage using stream
      const content = Buffer.from('%PDF-1.4 Synthetic file eligible for deletion proof');
      const hash = createHash('sha256').update(content).digest('hex');
      await storageProvider.writeObjectStream({
        storageBucket,
        storageKey: delKey,
        mimeType: 'application/pdf',
        stream: Readable.from(content),
      });

      // Verify file is physically on disk
      const headBefore = await storageProvider.headObject({ storageBucket, storageKey: delKey });
      assert.equal(headBefore.exists, true);

      // Seed document in PostgreSQL
      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO documents (id, institution_id, category, classification, status, created_by_person_id)
           VALUES ($1, $2, 'administrative', 'internal', 'active', $3)`,
          [docDelId, instA, adminA],
        );
        await client.query(
          `INSERT INTO document_versions (id, institution_id, document_id, version_number, mime_type, byte_size, sha256_hash, status, created_by_person_id)
           VALUES ($1, $2, $3, 1, 'application/pdf', $4, $5, 'available', $6)`,
          [verDelId, instA, docDelId, content.length, hash, adminA],
        );
        await client.query(
          `INSERT INTO document_storage_references (institution_id, version_id, storage_provider, storage_bucket, storage_key, content_availability)
           VALUES ($1, $2, 'local_uat', $3, $4, 'available')`,
          [instA, verDelId, storageBucket, delKey],
        );
      } finally {
        client.release();
      }

      // Assign short expired policy so document becomes eligible for deletion
      const assignRes = await apiRequest(
        'POST',
        `/api/documents/${docDelId}/retention`,
        {
          policyId: 'short_expired_policy',
          jurisdictionProfileId: 'AO-STANDARD',
          clockTriggerEventAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        },
        { 'Idempotency-Key': `idem-ret-del-${randomUUID()}` },
      );
      assert.equal(assignRes.status, 201);

      // Background lifecycle evaluation marks expired policy as retention_expired
      const clientRet = await pool.connect();
      try {
        await clientRet.query(
          `UPDATE document_retention_assignments SET retention_status = 'retention_expired' WHERE document_id = $1`,
          [docDelId],
        );
      } finally {
        clientRet.release();
      }

      // Verify capabilities shows canAuthorizeDeletion
      const detailEligible = await apiRequest('GET', `/api/documents/${docDelId}`);
      assert.equal(detailEligible.status, 200);
      assert.equal(detailEligible.data.capabilities.canAuthorizeDeletion, true);

      // Authorize deletion
      const authRes = await apiRequest(
        'POST',
        `/api/documents/${docDelId}/deletion/authorize`,
        { reason: 'Fim do ciclo de retenção institucional' },
        { 'Idempotency-Key': `idem-auth-del-${randomUUID()}` },
      );
      assert.equal(authRes.status, 201);
      const authId = authRes.data.authorizationId || authRes.data.authorization?.id;
      assert.ok(authId);

      // Execute deletion
      const execRes = await apiRequest(
        'POST',
        `/api/documents/${docDelId}/deletion/execute`,
        { deletionAuthorizationId: authId },
        { 'Idempotency-Key': `idem-exec-del-${randomUUID()}` },
      );
      assert.equal(execRes.status, 200);
      assert.equal(execRes.data.success, true);

      // VERIFY PHYSICAL STORAGE: File MUST be physically deleted!
      const headAfter = await storageProvider.headObject({ storageBucket, storageKey: delKey });
      assert.equal(headAfter.exists, false, 'Physical object must be deleted from storage');

      // VERIFY POSTGRESQL STATE
      const client2 = await pool.connect();
      try {
        const verRow = await client2.query(`SELECT status FROM document_versions WHERE id = $1`, [verDelId]);
        assert.equal(verRow.rows[0].status, 'deleted');

        // Storage reference must be removed
        const refRow = await client2.query(`SELECT count(*)::int as cnt FROM document_storage_references WHERE version_id = $1`, [verDelId]);
        assert.equal(refRow.rows[0].cnt, 0);

        // Deletion record must be recorded
        const delRec = await client2.query(`SELECT * FROM document_deletion_records WHERE deletion_authorization_id = $1`, [authId]);
        assert.ok(delRec.rows.length >= 1);

        // Audit events for both authorization and execution
        const auditAuth = await client2.query(
          `SELECT * FROM document_audit_events WHERE document_id = $1 AND action = 'document.deletion_authorized'`,
          [docDelId],
        );
        assert.ok(auditAuth.rows.length >= 1);

        const auditExec = await client2.query(
          `SELECT * FROM document_audit_events WHERE document_id = $1 AND action = 'document.version_deleted'`,
          [docDelId],
        );
        assert.ok(auditExec.rows.length >= 1);
      } finally {
        client2.release();
      }

      // Content access is blocked
      const accessRes = await apiRequest(
        'POST',
        `/api/documents/${docDelId}/access`,
        { action: 'open' },
        { 'Idempotency-Key': `idem-acc-del-${randomUUID()}` },
      );
      assert.ok(accessRes.status === 410 || accessRes.status === 404 || accessRes.status === 422);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PART 3: VISUALIZAÇÃO E DURABILIDADE (STORAGE TRUTH)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Gate 1 & Visualização: Durability & Unavailable Historical Records Truth', () => {
    let uploadedDocId: string;
    let uploadedVerId: string;
    let uploadedBytes: Buffer;
    let uploadedHash: string;

    it('3.1 Full upload lifecycle: create session, transfer stream, complete, and download with SHA-256 match', async () => {
      uploadedBytes = Buffer.from('%PDF-1.7 Master Closure Synthetic Document Proof for UAT Durability\n' + 'X'.repeat(5000));
      uploadedHash = createHash('sha256').update(uploadedBytes).digest('hex');

      // 1. Create upload session
      const sessRes = await apiRequest(
        'POST',
        '/api/documents/upload-sessions',
        {
          category: 'academic',
          classification: 'confidential',
          declaredFilename: 'master-durability-proof.pdf',
          declaredMimeType: 'application/pdf',
          declaredByteSize: uploadedBytes.length,
          expectedSha256: uploadedHash,
        },
        { 'Idempotency-Key': `idem-sess-${randomUUID()}` },
      );
      assert.equal(sessRes.status, 201);
      const sessionId = sessRes.data.session.id;
      const uploadToken = sessRes.data.rawToken || sessRes.data.uploadToken;

      // 2. Transfer bytes
      const transferRes = await fetch(`${baseUrl}/api/documents/upload-sessions/${sessionId}/transfer`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': String(uploadedBytes.length),
          'X-Upload-Token': uploadToken,
          Authorization: 'Bearer tenant-a-token',
        },
        body: uploadedBytes,
      });
      assert.equal(transferRes.status, 200);

      // 3. Complete session passing rawToken
      const completeRes = await apiRequest(
        'POST',
        `/api/documents/upload-sessions/${sessionId}/complete`,
        { rawToken: uploadToken },
        { 'Idempotency-Key': `idem-comp-${randomUUID()}` },
      );
      assert.equal(completeRes.status, 200);
      uploadedDocId = completeRes.data.session.documentId;
      uploadedVerId = completeRes.data.versionId || completeRes.data.version.id;
      assert.ok(uploadedDocId);
      assert.ok(uploadedVerId);

      // Wait for verification worker to transition version to 'available'
      for (let i = 0; i < 25; i++) {
        const detailRes = await apiRequest('GET', `/api/documents/${uploadedDocId}`);
        if (detailRes.status === 200 && detailRes.data.currentVersion?.status === 'available') {
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }

      // 4. Request access authorization (open & download)
      const grantRes = await apiRequest(
        'POST',
        `/api/documents/${uploadedDocId}/access`,
        {
          action: 'download',
          versionId: uploadedVerId,
        },
        { 'Idempotency-Key': `idem-grant-${randomUUID()}` },
      );
      assert.equal(grantRes.status, 201);
      const grantToken = grantRes.data.rawAccessToken;
      assert.ok(grantToken);

      // 5. Exchange grant for content stream
      const streamRes = await fetch(`${baseUrl}/api/documents/access/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer tenant-a-token',
        },
        body: JSON.stringify({ rawAccessToken: grantToken }),
      });
      assert.equal(streamRes.status, 200);
      const downloadedBuffer = Buffer.from(await streamRes.arrayBuffer());
      assert.equal(downloadedBuffer.length, uploadedBytes.length);
      const downloadedHash = createHash('sha256').update(downloadedBuffer).digest('hex');
      assert.equal(downloadedHash, uploadedHash, 'SHA-256 roundtrip must match exactly');
    });

    it('3.2 Durability across restart: fresh provider instance with empty cache reads from disk streams', async () => {
      // Create fresh provider pointing to the SAME storage directory
      const freshProvider = new LocalUatObjectStorageProvider(storageDir);
      assert.equal(freshProvider.providerName, 'local_uat');

      // Pick the document uploaded in 3.1
      const client = await pool.connect();
      try {
        const ref = await client.query(
          `SELECT r.storage_bucket, r.storage_key, v.sha256_hash, v.byte_size
           FROM document_storage_references r
           JOIN document_versions v ON v.id = r.version_id
           WHERE v.id = $1`,
          [uploadedVerId],
        );
        assert.equal(ref.rows.length, 1);
        const { storage_bucket, storage_key, sha256_hash, byte_size } = ref.rows[0];

        // Read stream with zero cache directly from disk
        const readStream = await freshProvider.openReadStream({
          storageBucket: storage_bucket,
          storageKey: storage_key,
        });

        const chunks: Buffer[] = [];
        for await (const chunk of readStream) {
          chunks.push(Buffer.from(chunk));
        }
        const fullContent = Buffer.concat(chunks);
        assert.equal(fullContent.length, Number(byte_size));
        const hash = createHash('sha256').update(fullContent).digest('hex');
        assert.equal(hash, sha256_hash);
      } finally {
        client.release();
      }
    });

    it('3.3 Historical records without physical object: correctly marked unavailable, actions disabled, history intact', async () => {
      const docGhostId = randomUUID();
      const verGhostId = randomUUID();

      // Seed ghost record (metadata in DB, absent from storage)
      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO documents (id, institution_id, category, classification, status, created_by_person_id)
           VALUES ($1, $2, 'academic', 'internal', 'active', $3)`,
          [docGhostId, instA, adminA],
        );
        await client.query(
          `INSERT INTO document_versions (id, institution_id, document_id, version_number, mime_type, byte_size, sha256_hash, status, created_by_person_id)
           VALUES ($1, $2, $3, 1, 'application/pdf', 50000, $4, 'available', $5)`,
          [verGhostId, instA, docGhostId, 'd'.repeat(64), adminA],
        );
        await client.query(
          `INSERT INTO document_storage_references (institution_id, version_id, storage_provider, storage_bucket, storage_key, content_availability, unavailable_reason)
           VALUES ($1, $2, 'local_uat', $3, 'ghost-nonexistent-key.pdf', 'unavailable', 'PHYSICAL_OBJECT_ABSENT_ON_STORAGE')`,
          [instA, verGhostId, storageBucket],
        );
      } finally {
        client.release();
      }

      // Query Detail API
      const detail = await apiRequest('GET', `/api/documents/${docGhostId}`);
      assert.equal(detail.status, 200);
      assert.equal(detail.data.contentAvailability, 'unavailable');
      assert.equal(detail.data.currentVersion.contentAvailability, 'unavailable');

      // Verify UI capabilities: open and download MUST be false
      assert.equal(detail.data.capabilities.canOpen, false);
      assert.equal(detail.data.capabilities.canDownload, false);

      // Verify direct access API is blocked with 409 CONFLICT (CONTENT_UNAVAILABLE)
      const accessAttempt = await apiRequest(
        'POST',
        `/api/documents/${docGhostId}/access`,
        { action: 'open' },
        { 'Idempotency-Key': `idem-acc-fail-${randomUUID()}` },
      );
      assert.equal(accessAttempt.status, 409);
      assert.match(accessAttempt.data.error, /indisponível|STORAGE_OBJECT_UNAVAILABLE|CONTENT_UNAVAILABLE/i);

      // Verify that historical metadata and version count remain fully preserved
      assert.equal(detail.data.versionCount, 1);
      assert.equal(detail.data.currentVersion.versionNumber, 1);
      assert.equal(detail.data.currentVersion.sha256Hash, 'd'.repeat(64));
    });
  });
});
