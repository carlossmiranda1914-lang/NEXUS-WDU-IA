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
import { createDocumentCommand } from '../src/modules/documents/document-command.ts';
import { createUploadSessionCommand } from '../src/modules/documents/document-upload-command.ts';
import { registerDocumentRoutes } from '../src/modules/documents/document.controller.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { DeterministicTestMalwareScanner } from './support/deterministic-test-malware-scanner.ts';

await verifyApprovedTestConnection();

const schema = `doc_create_upload_auth_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const instA = '00000000-0000-0000-0000-000000000001';
const instB = '00000000-0000-0000-0000-000000000002';

const adminAId = '00000000-0000-0000-0000-000000000010';
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

const unknownRoleContext: InstitutionalContext = {
  institutionId: instA,
  institutionName: 'Inst A',
  institutionSlug: 'inst-a',
  personId: '00000000-0000-0000-0000-000000000099',
  personName: 'Unknown Role',
  identityEmail: 'unknown@inst-a.edu',
  membershipId: '00000000-0000-0000-0000-000000000199',
  role: 'auditor' as any,
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
     ($5, 'Admin B')`,
    [adminAId, studentAId, teacherAId, parentAId, adminBId],
  );

  await client.query(
    `INSERT INTO memberships (id, institution_id, person_id, role, status) VALUES
     ($1, $2, $3, 'institution_admin', 'active'),
     ($4, $2, $5, 'student', 'active'),
     ($6, $2, $7, 'teacher', 'active'),
     ($8, $2, $9, 'parent', 'active'),
     ($10, $11, $12, 'institution_admin', 'active')`,
    [
      adminContext.membershipId, instA, adminAId,
      studentContext.membershipId, studentAId,
      teacherContext.membershipId, teacherAId,
      parentContext.membershipId, parentAId,
      adminBContext.membershipId, instB, adminBId,
    ],
  );
} finally {
  client.release();
}

const policyConfig = {
  globalMaxByteSize: 10 * 1024 * 1024, // 10MB
};

// Setup express app for HTTP route tests
const app = express();
app.use(express.json());

let currentAuthContext: InstitutionalContext | null = adminContext;
const testAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  (req as any).institutionalContext = currentAuthContext;
  next();
};

registerDocumentRoutes(app, {
  pool,
  requireAuth: testAuthMiddleware,
  storageProvider,
  storageBucket: 'test-bucket',
  uploadPolicyConfig: policyConfig,
  malwareScanner,
});

const server = app.listen(0);
const address = server.address() as any;
const baseUrl = `http://127.0.0.1:${address.port}`;

async function request(path: string, options: { method?: string; body?: any } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, body: json, text };
}

let passCount = 0;
let failCount = 0;

async function runCheck(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passCount++;
    console.log(`✔ ${name}`);
  } catch (err: any) {
    failCount++;
    console.error(`✖ ${name}:`, err.message);
    throw err;
  }
}

try {
  // ───────────────────────────────────────────────────────────────────────────
  // PART 1: Direct Command Boundary — createDocumentCommand
  // ───────────────────────────────────────────────────────────────────────────

  await runCheck('DIRECT_COMMAND: student createDocumentCommand is denied', async () => {
    await assert.rejects(
      () =>
        createDocumentCommand({
          pool,
          context: studentContext,
          idempotencyKey: 'idem-cmd-create-student',
          input: {
            category: 'academic',
            classification: 'internal',
          },
        }),
      (err: any) => {
        assert.match(err.message, /AUTHORIZATION_DENIED/);
        assert.match(err.message, /create_document/);
        return true;
      },
    );

    // Verify zero documents created
    const countRes = await pool.query(
      `SELECT count(*) FROM documents WHERE created_by_person_id = $1`,
      [studentContext.personId],
    );
    assert.equal(Number(countRes.rows[0].count), 0, 'No document persisted for student');

    // Verify zero audit success events
    const auditRes = await pool.query(
      `SELECT count(*) FROM document_audit_events WHERE actor_person_id = $1 AND action = 'document.created'`,
      [studentContext.personId],
    );
    assert.equal(Number(auditRes.rows[0].count), 0, 'No audit success recorded for student');
  });

  await runCheck('DIRECT_COMMAND: parent createDocumentCommand is denied', async () => {
    await assert.rejects(
      () =>
        createDocumentCommand({
          pool,
          context: parentContext,
          idempotencyKey: 'idem-cmd-create-parent',
          input: {
            category: 'academic',
          },
        }),
      /AUTHORIZATION_DENIED/,
    );
  });

  await runCheck('DIRECT_COMMAND: teacher createDocumentCommand is denied', async () => {
    await assert.rejects(
      () =>
        createDocumentCommand({
          pool,
          context: teacherContext,
          idempotencyKey: 'idem-cmd-create-teacher',
          input: {
            category: 'academic',
          },
        }),
      /AUTHORIZATION_DENIED/,
    );
  });

  await runCheck('DIRECT_COMMAND: unknown role createDocumentCommand is denied', async () => {
    await assert.rejects(
      () =>
        createDocumentCommand({
          pool,
          context: unknownRoleContext,
          idempotencyKey: 'idem-cmd-create-unknown',
          input: {
            category: 'academic',
          },
        }),
      /AUTHORIZATION_DENIED/,
    );
  });

  await runCheck('DIRECT_COMMAND: invalid category createDocumentCommand is rejected', async () => {
    await assert.rejects(
      () =>
        createDocumentCommand({
          pool,
          context: adminContext,
          idempotencyKey: 'idem-cmd-create-invalid-cat',
          input: {
            category: 'completely_invalid_non_canonical_category',
          },
        }),
      /INVALID_CATEGORY/,
    );
  });

  let adminCreatedDocId: string = '';

  await runCheck('DIRECT_COMMAND: management createDocumentCommand is allowed', async () => {
    const res = await createDocumentCommand({
      pool,
      context: adminContext,
      idempotencyKey: 'idem-cmd-create-admin-1',
      input: {
        category: 'academic',
        classification: 'standard',
        provenance: {
          correlationId: 'corr-create-admin-1',
        },
      },
    });

    assert.equal(res.replayed, false);
    assert.ok(res.result.id);
    assert.equal(res.result.category, 'academic');
    assert.equal(res.result.institutionId, instA);
    adminCreatedDocId = res.result.id;

    // Verify audit event persisted
    const auditRes = await pool.query(
      `SELECT * FROM document_audit_events WHERE document_id = $1 AND action = 'document.created'`,
      [adminCreatedDocId],
    );
    assert.equal(auditRes.rows.length, 1);
    assert.equal(auditRes.rows[0].outcome, 'success');

    // Verify outbox event intent persisted
    const outboxRes = await pool.query(
      `SELECT * FROM document_outbox_events WHERE aggregate_id = $1 AND event_type = 'document.created'`,
      [adminCreatedDocId],
    );
    assert.equal(outboxRes.rows.length, 1);

    // Verify idempotency replay
    const replayRes = await createDocumentCommand({
      pool,
      context: adminContext,
      idempotencyKey: 'idem-cmd-create-admin-1',
      input: {
        category: 'academic',
        classification: 'standard',
        provenance: {
          correlationId: 'corr-create-admin-1',
        },
      },
    });
    assert.equal(replayRes.replayed, true);
    assert.equal(replayRes.result.id, adminCreatedDocId);

    // Verify idempotency conflict
    await assert.rejects(
      () =>
        createDocumentCommand({
          pool,
          context: adminContext,
          idempotencyKey: 'idem-cmd-create-admin-1',
          input: {
            category: 'general', // different category -> different fingerprint
          },
        }),
      /IDEMPOTENCY_CONFLICT/,
    );
  });

  // Create Tenant B document for cross-tenant tests
  const docBRes = await createDocumentCommand({
    pool,
    context: adminBContext,
    idempotencyKey: 'idem-cmd-create-admin-b',
    input: {
      category: 'general',
    },
  });
  const tenantBDocId = docBRes.result.id;

  // ───────────────────────────────────────────────────────────────────────────
  // PART 2: Direct Command Boundary — createUploadSessionCommand
  // ───────────────────────────────────────────────────────────────────────────

  await runCheck('DIRECT_COMMAND: student createUploadSessionCommand is denied', async () => {
    await assert.rejects(
      () =>
        createUploadSessionCommand({
          pool,
          context: studentContext,
          idempotencyKey: 'idem-cmd-upload-student',
          input: {
            documentId: adminCreatedDocId,
            declaredFilename: 'assignment.pdf',
            declaredMimeType: 'application/pdf',
            declaredByteSize: 2048,
            policyConfig,
            storageProvider: 'memory',
            storageBucket: 'test-bucket',
          },
        }),
      /AUTHORIZATION_DENIED/,
    );

    // Verify zero upload sessions created for student
    const sessRes = await pool.query(
      `SELECT count(*) FROM document_upload_sessions WHERE created_by_person_id = $1`,
      [studentContext.personId],
    );
    assert.equal(Number(sessRes.rows[0].count), 0, 'No upload session created for student');
  });

  await runCheck('DIRECT_COMMAND: parent createUploadSessionCommand is denied', async () => {
    await assert.rejects(
      () =>
        createUploadSessionCommand({
          pool,
          context: parentContext,
          idempotencyKey: 'idem-cmd-upload-parent',
          input: {
            documentId: adminCreatedDocId,
            declaredFilename: 'note.pdf',
            declaredMimeType: 'application/pdf',
            declaredByteSize: 1024,
            policyConfig,
            storageProvider: 'memory',
            storageBucket: 'test-bucket',
          },
        }),
      /AUTHORIZATION_DENIED/,
    );
  });

  await runCheck('DIRECT_COMMAND: teacher createUploadSessionCommand is denied', async () => {
    await assert.rejects(
      () =>
        createUploadSessionCommand({
          pool,
          context: teacherContext,
          idempotencyKey: 'idem-cmd-upload-teacher',
          input: {
            documentId: adminCreatedDocId,
            declaredFilename: 'grade.pdf',
            declaredMimeType: 'application/pdf',
            declaredByteSize: 1024,
            policyConfig,
            storageProvider: 'memory',
            storageBucket: 'test-bucket',
          },
        }),
      /AUTHORIZATION_DENIED/,
    );
  });

  await runCheck('DIRECT_COMMAND: cross-tenant createUploadSessionCommand is denied fail-closed', async () => {
    await assert.rejects(
      () =>
        createUploadSessionCommand({
          pool,
          context: adminContext, // Tenant A admin
          idempotencyKey: 'idem-cmd-upload-cross-tenant',
          input: {
            documentId: tenantBDocId, // Tenant B document!
            declaredFilename: 'leak.pdf',
            declaredMimeType: 'application/pdf',
            declaredByteSize: 1024,
            policyConfig,
            storageProvider: 'memory',
            storageBucket: 'test-bucket',
          },
        }),
      (err: any) => {
        // Must fail closed without revealing foreign document existence
        assert.match(err.message, /not found in institution/i);
        return true;
      },
    );
  });

  await runCheck('DIRECT_COMMAND: size policy violations in createUploadSessionCommand fail closed', async () => {
    // 0 byte size
    await assert.rejects(
      () =>
        createUploadSessionCommand({
          pool,
          context: adminContext,
          idempotencyKey: 'idem-cmd-upload-zero-bytes',
          input: {
            documentId: adminCreatedDocId,
            declaredFilename: 'zero.pdf',
            declaredMimeType: 'application/pdf',
            declaredByteSize: 0,
            policyConfig,
            storageProvider: 'memory',
            storageBucket: 'test-bucket',
          },
        }),
      /declaredByteSize must be greater than 0/,
    );

    // Exceeds policy limit
    await assert.rejects(
      () =>
        createUploadSessionCommand({
          pool,
          context: adminContext,
          idempotencyKey: 'idem-cmd-upload-too-large',
          input: {
            documentId: adminCreatedDocId,
            declaredFilename: 'huge.pdf',
            declaredMimeType: 'application/pdf',
            declaredByteSize: 100 * 1024 * 1024, // 100MB > 10MB limit
            policyConfig,
            storageProvider: 'memory',
            storageBucket: 'test-bucket',
          },
        }),
      /DECLARED_SIZE_EXCEEDS_POLICY/,
    );
  });

  let createdSessionId: string = '';
  let createdRawToken: string = '';

  await runCheck('DIRECT_COMMAND: management createUploadSessionCommand is allowed and secure', async () => {
    const res = await createUploadSessionCommand({
      pool,
      context: adminContext,
      idempotencyKey: 'idem-cmd-upload-admin-1',
      input: {
        documentId: adminCreatedDocId,
        declaredFilename: 'report_v1.pdf',
        declaredMimeType: 'application/pdf',
        declaredByteSize: 4096,
        policyConfig,
        storageProvider: 'memory',
        storageBucket: 'test-bucket',
      },
    });

    assert.equal(res.replayed, false);
    assert.ok(res.result.session.id);
    assert.ok(res.result.rawToken);
    assert.equal(res.result.session.declaredFilename, 'report_v1.pdf');
    assert.equal(res.result.session.status, 'authorized');
    createdSessionId = res.result.session.id;
    createdRawToken = res.result.rawToken;

    // Check token security at rest: raw token is NEVER persisted in DB
    const dbRow = await pool.query(
      `SELECT upload_token_hash, authorized_until, expires_at FROM document_upload_sessions WHERE id = $1`,
      [createdSessionId],
    );
    assert.equal(dbRow.rows.length, 1);
    assert.ok(dbRow.rows[0].upload_token_hash);
    assert.notEqual(dbRow.rows[0].upload_token_hash, createdRawToken, 'Raw token must NEVER be stored at rest');

    // Verify time windows: authorizedUntil ~ 15min, expiresAt ~ 24h
    const now = Date.now();
    const authorizedUntil = new Date(dbRow.rows[0].authorized_until).getTime();
    const expiresAt = new Date(dbRow.rows[0].expires_at).getTime();
    assert.ok(authorizedUntil > now + 14 * 60 * 1000 && authorizedUntil <= now + 16 * 60 * 1000, 'authorizedUntil ~ 15m');
    assert.ok(expiresAt > now + 23 * 60 * 60 * 1000 && expiresAt <= now + 25 * 60 * 60 * 1000, 'expiresAt ~ 24h');

    // Verify audit record does not leak raw token
    const auditRes = await pool.query(
      `SELECT * FROM document_audit_events WHERE document_id = $1 AND action = 'document.upload_session_created'`,
      [adminCreatedDocId],
    );
    assert.equal(auditRes.rows.length, 1);
    const auditJson = JSON.stringify(auditRes.rows[0].details);
    assert.ok(!auditJson.includes(createdRawToken), 'Audit details must NEVER contain raw upload token');

    // Verify idempotency replay
    const replayRes = await createUploadSessionCommand({
      pool,
      context: adminContext,
      idempotencyKey: 'idem-cmd-upload-admin-1',
      input: {
        documentId: adminCreatedDocId,
        declaredFilename: 'report_v1.pdf',
        declaredMimeType: 'application/pdf',
        declaredByteSize: 4096,
        policyConfig,
        storageProvider: 'memory',
        storageBucket: 'test-bucket',
      },
    });
    assert.equal(replayRes.replayed, true);
    assert.equal(replayRes.result.session.id, createdSessionId);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PART 3: HTTP Route Boundary — POST /api/documents
  // ───────────────────────────────────────────────────────────────────────────

  await runCheck('HTTP: student POST /api/documents is denied (403)', async () => {
    currentAuthContext = studentContext;
    const res = await request('/api/documents', {
      method: 'POST',
      body: {
        idempotencyKey: 'http-idem-doc-student',
        category: 'academic',
      },
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'AUTHORIZATION_DENIED');
  });

  await runCheck('HTTP: parent and teacher POST /api/documents are denied (403)', async () => {
    currentAuthContext = parentContext;
    const resParent = await request('/api/documents', {
      method: 'POST',
      body: {
        idempotencyKey: 'http-idem-doc-parent',
        category: 'academic',
      },
    });
    assert.equal(resParent.status, 403);

    currentAuthContext = teacherContext;
    const resTeacher = await request('/api/documents', {
      method: 'POST',
      body: {
        idempotencyKey: 'http-idem-doc-teacher',
        category: 'academic',
      },
    });
    assert.equal(resTeacher.status, 403);
  });

  await runCheck('HTTP: invalid category POST /api/documents is rejected (400)', async () => {
    currentAuthContext = adminContext;
    const res = await request('/api/documents', {
      method: 'POST',
      body: {
        idempotencyKey: 'http-idem-doc-bad-cat',
        category: 'not_a_real_category',
      },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'INVALID_CATEGORY');
  });

  await runCheck('HTTP: management POST /api/documents succeeds (201)', async () => {
    currentAuthContext = adminContext;
    const res = await request('/api/documents', {
      method: 'POST',
      body: {
        idempotencyKey: 'http-idem-doc-admin',
        category: 'academic',
        classification: 'confidential',
      },
    });
    assert.equal(res.status, 201);
    assert.ok(res.body.document);
    assert.ok(res.body.document.id);
    assert.equal(res.body.document.category, 'academic');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PART 4: HTTP Route Boundary — POST /api/documents/upload-sessions
  // ───────────────────────────────────────────────────────────────────────────

  await runCheck('HTTP: student POST /api/documents/upload-sessions (new doc) is denied (403)', async () => {
    currentAuthContext = studentContext;
    const res = await request('/api/documents/upload-sessions', {
      method: 'POST',
      body: {
        idempotencyKey: 'http-idem-upload-student-new',
        category: 'academic',
        declaredFilename: 'work.pdf',
        declaredMimeType: 'application/pdf',
        declaredByteSize: 1024,
      },
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'AUTHORIZATION_DENIED');
  });

  await runCheck('HTTP: teacher POST /api/documents/upload-sessions is denied (403)', async () => {
    currentAuthContext = teacherContext;
    const res = await request('/api/documents/upload-sessions', {
      method: 'POST',
      body: {
        idempotencyKey: 'http-idem-upload-teacher-new',
        category: 'academic',
        declaredFilename: 'eval.pdf',
        declaredMimeType: 'application/pdf',
        declaredByteSize: 1024,
      },
    });
    assert.equal(res.status, 403);
  });

  await runCheck('HTTP: parent POST /api/documents/upload-sessions is denied (403)', async () => {
    currentAuthContext = parentContext;
    const res = await request('/api/documents/upload-sessions', {
      method: 'POST',
      body: {
        idempotencyKey: 'http-idem-upload-parent-new',
        category: 'academic',
        declaredFilename: 'justification.pdf',
        declaredMimeType: 'application/pdf',
        declaredByteSize: 1024,
      },
    });
    assert.equal(res.status, 403);
  });

  await runCheck('HTTP: cross-tenant POST /api/documents/upload-sessions is 404 (leak = 0)', async () => {
    currentAuthContext = adminContext; // Tenant A admin
    const res = await request('/api/documents/upload-sessions', {
      method: 'POST',
      body: {
        idempotencyKey: 'http-idem-upload-cross-doc',
        documentId: tenantBDocId, // Tenant B doc
        declaredFilename: 'cross.pdf',
        declaredMimeType: 'application/pdf',
        declaredByteSize: 1024,
      },
    });
    assert.equal(res.status, 404);
  });

  await runCheck('HTTP: cross-tenant POST /api/documents/:id/versions/upload-sessions is 404', async () => {
    currentAuthContext = adminContext;
    const res = await request(`/api/documents/${tenantBDocId}/versions/upload-sessions`, {
      method: 'POST',
      body: {
        idempotencyKey: 'http-idem-version-cross-doc',
        declaredFilename: 'cross.pdf',
        declaredMimeType: 'application/pdf',
        declaredByteSize: 1024,
      },
    });
    assert.equal(res.status, 404);
  });

  await runCheck('HTTP: student POST /api/documents/:id/versions/upload-sessions is denied (403)', async () => {
    currentAuthContext = studentContext;
    const res = await request(`/api/documents/${adminCreatedDocId}/versions/upload-sessions`, {
      method: 'POST',
      body: {
        idempotencyKey: 'http-idem-version-student',
        declaredFilename: 'hack.pdf',
        declaredMimeType: 'application/pdf',
        declaredByteSize: 1024,
      },
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'AUTHORIZATION_DENIED');
  });

  await runCheck('HTTP: management POST /api/documents/upload-sessions succeeds (201)', async () => {
    currentAuthContext = adminContext;
    const res = await request('/api/documents/upload-sessions', {
      method: 'POST',
      body: {
        idempotencyKey: 'http-idem-upload-admin-new',
        category: 'academic',
        declaredFilename: 'curriculum.pdf',
        declaredMimeType: 'application/pdf',
        declaredByteSize: 2048,
      },
    });
    assert.equal(res.status, 201);
    assert.ok(res.body.documentId);
    assert.ok(res.body.sessionId);
    assert.ok(res.body.rawToken);
    assert.equal(res.body.session.status, 'authorized');
  });

  await runCheck('HTTP: management POST /api/documents/:id/versions/upload-sessions succeeds (201)', async () => {
    currentAuthContext = adminContext;
    const res = await request(`/api/documents/${adminCreatedDocId}/versions/upload-sessions`, {
      method: 'POST',
      body: {
        idempotencyKey: 'http-idem-version-admin-new',
        declaredFilename: 'report_v2.pdf',
        declaredMimeType: 'application/pdf',
        declaredByteSize: 4096,
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.documentId, adminCreatedDocId);
    assert.ok(res.body.sessionId);
    assert.ok(res.body.rawToken);
  });

  console.log(`\n[DOCUMENTS-CREATE-UPLOAD-AUTH] ALL ${passCount} CHECKS PASSED (FAIL: ${failCount})`);
} finally {
  server.close();
  const cleanupClient = await pool.connect();
  try {
    await cleanupClient.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } finally {
    cleanupClient.release();
    await pool.end();
  }
}
