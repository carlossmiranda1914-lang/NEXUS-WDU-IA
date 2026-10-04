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
import {
  createUploadSessionCommand,
  resumeUploadSessionCommand,
  cancelUploadSessionCommand,
  completeUploadSessionCommand,
} from '../src/modules/documents/document-upload-command.ts';
import { registerDocumentRoutes } from '../src/modules/documents/document.controller.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { DeterministicTestMalwareScanner } from './support/deterministic-test-malware-scanner.ts';

await verifyApprovedTestConnection();

const schema = `doc_upload_session_auth_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const instA = '00000000-0000-0000-0000-000000000001';
const instB = '00000000-0000-0000-0000-000000000002';

const managerA1Id = '00000000-0000-0000-0000-000000000010';
const managerA2Id = '00000000-0000-0000-0000-000000000011';
const studentAId = '00000000-0000-0000-0000-000000000012';
const teacherAId = '00000000-0000-0000-0000-000000000013';
const parentAId = '00000000-0000-0000-0000-000000000014';
const managerBId = '00000000-0000-0000-0000-000000000020';

const managerA1Context: InstitutionalContext = {
  institutionId: instA,
  institutionName: 'Inst A',
  institutionSlug: 'inst-a',
  personId: managerA1Id,
  personName: 'Manager A1',
  identityEmail: 'manager1@inst-a.edu',
  membershipId: '00000000-0000-0000-0000-000000000100',
  role: 'institution_admin',
};

const managerA2Context: InstitutionalContext = {
  institutionId: instA,
  institutionName: 'Inst A',
  institutionSlug: 'inst-a',
  personId: managerA2Id,
  personName: 'Manager A2',
  identityEmail: 'manager2@inst-a.edu',
  membershipId: '00000000-0000-0000-0000-000000000101',
  role: 'institution_admin',
};

const studentContext: InstitutionalContext = {
  institutionId: instA,
  institutionName: 'Inst A',
  institutionSlug: 'inst-a',
  personId: studentAId,
  personName: 'Student A',
  identityEmail: 'student@inst-a.edu',
  membershipId: '00000000-0000-0000-0000-000000000102',
  role: 'student',
};

const teacherContext: InstitutionalContext = {
  institutionId: instA,
  institutionName: 'Inst A',
  institutionSlug: 'inst-a',
  personId: teacherAId,
  personName: 'Teacher A',
  identityEmail: 'teacher@inst-a.edu',
  membershipId: '00000000-0000-0000-0000-000000000103',
  role: 'teacher',
};

const parentContext: InstitutionalContext = {
  institutionId: instA,
  institutionName: 'Inst A',
  institutionSlug: 'inst-a',
  personId: parentAId,
  personName: 'Parent A',
  identityEmail: 'parent@inst-a.edu',
  membershipId: '00000000-0000-0000-0000-000000000104',
  role: 'parent',
};

const managerBContext: InstitutionalContext = {
  institutionId: instB,
  institutionName: 'Inst B',
  institutionSlug: 'inst-b',
  personId: managerBId,
  personName: 'Manager B',
  identityEmail: 'manager@inst-b.edu',
  membershipId: '00000000-0000-0000-0000-000000000200',
  role: 'institution_admin',
};

// Storage tracking wrapper to verify storage HEAD calls
class TrackingStorageProvider extends MemoryObjectStorageProvider {
  public headCallCount = 0;

  override async headObject(input: { storageBucket: string; storageKey: string }) {
    this.headCallCount++;
    return super.headObject(input);
  }
}

const storageProvider = new TrackingStorageProvider();
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
     ($1, 'Manager A1'),
     ($2, 'Manager A2'),
     ($3, 'Student A'),
     ($4, 'Teacher A'),
     ($5, 'Parent A'),
     ($6, 'Manager B')`,
    [managerA1Id, managerA2Id, studentAId, teacherAId, parentAId, managerBId],
  );

  const memberships = [
    [managerA1Context.membershipId, instA, managerA1Id, 'institution_admin'],
    [managerA2Context.membershipId, instA, managerA2Id, 'institution_admin'],
    [studentContext.membershipId, instA, studentAId, 'student'],
    [teacherContext.membershipId, instA, teacherAId, 'teacher'],
    [parentContext.membershipId, instA, parentAId, 'parent'],
    [managerBContext.membershipId, instB, managerBId, 'institution_admin'],
  ];
  for (const [mid, iid, pid, role] of memberships) {
    await client.query(
      `INSERT INTO memberships (id, institution_id, person_id, role, status) VALUES ($1, $2, $3, $4, 'active')`,
      [mid, iid, pid, role],
    );
  }
} finally {
  client.release();
}

console.log('=== TEST 1: Direct Command Lifecycle Authorization & Ownership ===');

// Create test document in Inst A by Manager A1 (using canonical category 'academic')
const createdDocRes = await createDocumentCommand({
  pool,
  context: managerA1Context,
  idempotencyKey: 'idemp-create-doc-1',
  input: {
    category: 'academic',
    classification: 'standard',
  },
});
const docA = createdDocRes.result;

// Manager A1 creates upload session
const sessionRes1 = await createUploadSessionCommand({
  pool,
  context: managerA1Context,
  idempotencyKey: 'idemp-create-sess-1',
  input: {
    documentId: docA.id,
    declaredFilename: 'policy.pdf',
    declaredMimeType: 'application/pdf',
    declaredByteSize: 1024,
    policyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
    storageProvider: 'test-memory',
    storageBucket: 'nexus-vault',
  },
});
const session1 = sessionRes1.result.session;
let token1 = sessionRes1.result.rawToken;

// 1.1 Other manager in same tenant attempts to resume => DENY
await assert.rejects(
  async () => {
    await resumeUploadSessionCommand({
      pool,
      context: managerA2Context,
      idempotencyKey: 'idemp-resume-a2',
      input: { sessionId: session1.id, rawToken: token1 },
    });
  },
  /AUTHORIZATION_DENIED/,
  'Other manager in same institution must be denied resume (session hijack protection)',
);

// 1.2 Student, Parent, Teacher attempt to resume => DENY
for (const nonManagerCtx of [studentContext, parentContext, teacherContext]) {
  await assert.rejects(
    async () => {
      await resumeUploadSessionCommand({
        pool,
        context: nonManagerCtx,
        idempotencyKey: `idemp-resume-${nonManagerCtx.role}`,
        input: { sessionId: session1.id, rawToken: token1 },
      });
    },
    /AUTHORIZATION_DENIED/,
    `${nonManagerCtx.role} must be denied resume`,
  );
}

// 1.3 Cross-tenant manager attempts resume => NOT FOUND
await assert.rejects(
  async () => {
    await resumeUploadSessionCommand({
      pool,
      context: managerBContext,
      idempotencyKey: 'idemp-resume-b',
      input: { sessionId: session1.id, rawToken: token1 },
    });
  },
  /not found in institution/,
  'Cross-tenant manager must receive not found on resume',
);

// 1.4 Invalid token on resume => INVALID_UPLOAD_TOKEN
await assert.rejects(
  async () => {
    await resumeUploadSessionCommand({
      pool,
      context: managerA1Context,
      idempotencyKey: 'idemp-resume-bad-tok',
      input: { sessionId: session1.id, rawToken: 'completely-wrong-token-abc' },
    });
  },
  /INVALID_UPLOAD_TOKEN/,
  'Resume with invalid token must fail with INVALID_UPLOAD_TOKEN',
);

// 1.5 Owner manager successfully resumes => rotates token
const resumeRes = await resumeUploadSessionCommand({
  pool,
  context: managerA1Context,
  idempotencyKey: 'idemp-resume-owner-ok',
  input: { sessionId: session1.id, rawToken: token1 },
});
assert.strictEqual(resumeRes.result.session.id, session1.id);
const token2 = resumeRes.result.rawToken;
assert.notStrictEqual(token1, token2, 'Resume must rotate to a fresh token');

// 1.6 Old token is now invalid on resume
await assert.rejects(
  async () => {
    await resumeUploadSessionCommand({
      pool,
      context: managerA1Context,
      idempotencyKey: 'idemp-resume-old-tok',
      input: { sessionId: session1.id, rawToken: token1 },
    });
  },
  /INVALID_UPLOAD_TOKEN/,
  'Previous token must be invalidated after successful resume',
);

console.log('=== TEST 2: Cancel Upload Session Authority & Security ===');

// Create second upload session for cancellation testing
const sessionRes2 = await createUploadSessionCommand({
  pool,
  context: managerA1Context,
  idempotencyKey: 'idemp-create-sess-2',
  input: {
    documentId: docA.id,
    declaredFilename: 'cancel-test.pdf',
    declaredMimeType: 'application/pdf',
    declaredByteSize: 2048,
    policyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
    storageProvider: 'test-memory',
    storageBucket: 'nexus-vault',
  },
});
const session2 = sessionRes2.result.session;
const tokenSess2 = sessionRes2.result.rawToken;

// 2.1 Other manager in same tenant attempts cancel => DENY
await assert.rejects(
  async () => {
    await cancelUploadSessionCommand({
      pool,
      context: managerA2Context,
      idempotencyKey: 'idemp-cancel-a2',
      input: { sessionId: session2.id, rawToken: tokenSess2 },
    });
  },
  /AUTHORIZATION_DENIED/,
  'Other manager in same institution must be denied cancel',
);

// 2.2 Student, Parent, Teacher attempt cancel => DENY
for (const nonManagerCtx of [studentContext, parentContext, teacherContext]) {
  await assert.rejects(
    async () => {
      await cancelUploadSessionCommand({
        pool,
        context: nonManagerCtx,
        idempotencyKey: `idemp-cancel-${nonManagerCtx.role}`,
        input: { sessionId: session2.id, rawToken: tokenSess2 },
      });
    },
    /AUTHORIZATION_DENIED/,
    `${nonManagerCtx.role} must be denied cancel`,
  );
}

// 2.3 Wrong token on cancel => INVALID_UPLOAD_TOKEN
await assert.rejects(
  async () => {
    await cancelUploadSessionCommand({
      pool,
      context: managerA1Context,
      idempotencyKey: 'idemp-cancel-bad-tok',
      input: { sessionId: session2.id, rawToken: 'wrong-cancel-token' },
    });
  },
  /INVALID_UPLOAD_TOKEN/,
  'Cancel with invalid token must fail with INVALID_UPLOAD_TOKEN',
);

// 2.4 Owner manager successfully cancels with valid token
const cancelRes = await cancelUploadSessionCommand({
  pool,
  context: managerA1Context,
  idempotencyKey: 'idemp-cancel-owner-ok',
  input: { sessionId: session2.id, rawToken: tokenSess2, reason: 'No longer needed' },
});
assert.strictEqual(cancelRes.result.status, 'cancelled');

// 2.5 Cancelled session cannot be resumed
await assert.rejects(
  async () => {
    await resumeUploadSessionCommand({
      pool,
      context: managerA1Context,
      idempotencyKey: 'idemp-resume-cancelled',
      input: { sessionId: session2.id, rawToken: tokenSess2 },
    });
  },
  /RESUME_CANCELLED_DENIED/,
  'Cancelled session cannot be resumed',
);

// 2.6 Cancelled session cannot be completed
await assert.rejects(
  async () => {
    await completeUploadSessionCommand({
      pool,
      context: managerA1Context,
      storageProvider,
      idempotencyKey: 'idemp-complete-cancelled',
      input: {
        sessionId: session2.id,
        rawToken: tokenSess2,
        provenance: {
          originType: 'user_upload',
          sourceDomain: 'portal.documents',
          method: 'test_complete',
        },
      },
    });
  },
  /UPLOAD_SESSION_CANCELLED/,
  'Cancelled session cannot be completed',
);

console.log('=== TEST 3: Complete Upload Session Authority, Storage HEAD, & Minimization ===');

// Session 1 is active with token2
const initialHeadCalls = storageProvider.headCallCount;

// 3.1 Non-owner and unauthorized callers attempt complete => DENY before storage HEAD
for (const nonAuthCtx of [managerA2Context, studentContext, parentContext, teacherContext]) {
  await assert.rejects(
    async () => {
      await completeUploadSessionCommand({
        pool,
        context: nonAuthCtx,
        storageProvider,
        idempotencyKey: `idemp-complete-${nonAuthCtx.role}-${nonAuthCtx.personId}`,
        input: {
          sessionId: session1.id,
          rawToken: token2,
          provenance: {
            originType: 'user_upload',
            sourceDomain: 'portal.documents',
            method: 'test_complete',
          },
        },
      });
    },
    /AUTHORIZATION_DENIED/,
    `Unauthorized actor ${nonAuthCtx.role} must be denied complete`,
  );
}

// Assert storageProvider.headObject was NEVER called during unauthorized attempts
assert.strictEqual(
  storageProvider.headCallCount,
  initialHeadCalls,
  'Storage HEAD must NEVER be called if caller authorization fails',
);

// 3.2 Owner manager with missing storage object => STORAGE_OBJECT_NOT_FOUND
await assert.rejects(
  async () => {
    await completeUploadSessionCommand({
      pool,
      context: managerA1Context,
      storageProvider,
      idempotencyKey: 'idemp-complete-missing-storage',
      input: {
        sessionId: session1.id,
        rawToken: token2,
        provenance: {
          originType: 'user_upload',
          sourceDomain: 'portal.documents',
          method: 'test_complete',
        },
      },
    });
  },
  /STORAGE_OBJECT_NOT_FOUND/,
  'Must reject with STORAGE_OBJECT_NOT_FOUND if storage object does not exist',
);

// Now simulate valid upload in storageProvider
await storageProvider.simulateDirectUpload({
  storageBucket: session1.storageBucket,
  storageKey: session1.storageKey,
  content: Buffer.from('%PDF-1.4 test valid document bytes for completion'),
  mimeType: 'application/pdf',
});

// 3.3 Provenance Actor Spoofing: Client attempts to pass different actorPersonId
const completeRes = await completeUploadSessionCommand({
  pool,
  context: managerA1Context,
  storageProvider,
  idempotencyKey: 'idemp-complete-owner-ok',
  input: {
    sessionId: session1.id,
    rawToken: token2,
    provenance: {
      originType: 'user_upload',
      actorPersonId: studentAId, // ATTEMPTED SPOOFING: passing student personId
      sourceDomain: 'portal.documents',
      method: 'test_complete',
    },
  },
});

// B12: Version status must be strictly content_received, NOT available
assert.strictEqual(
  completeRes.result.version.status,
  'content_received',
  'Created DocumentVersion status must strictly be content_received, never available',
);

// B14: ActorPersonId in provenance must strictly match authenticated context.personId
assert.strictEqual(
  completeRes.result.provenance.actorPersonId,
  managerA1Context.personId,
  'Provenance actorPersonId must strictly bind to authenticated actor, ignoring client spoofing',
);

// 3.4 B15: Completion Audit Minimization Check
const auditClient = await pool.connect();
try {
  const auditRow = await auditClient.query<{ details: Record<string, any> }>(
    `SELECT details FROM document_audit_events
      WHERE institution_id = $1 AND action = 'document.upload_completed'
      ORDER BY occurred_at DESC LIMIT 1`,
    [instA],
  );
  assert.ok(auditRow.rows.length > 0, 'Audit event must exist');
  const details = auditRow.rows[0].details;
  assert.strictEqual(details.storageProvider, undefined, 'storageProvider must NOT be in audit details');
  assert.strictEqual(details.storageBucket, undefined, 'storageBucket must NOT be in audit details');
  assert.strictEqual(details.storageKey, undefined, 'storageKey must NOT be in audit details');
  assert.ok(details.sessionId, 'sessionId must be in audit details');
  assert.ok(details.versionId, 'versionId must be in audit details');
  assert.strictEqual(details.versionStatus, 'content_received', 'versionStatus must be in audit details');
} finally {
  auditClient.release();
}

// 3.5 B16: Outbox Event Minimization Check
const outboxClient = await pool.connect();
try {
  const outboxRow = await outboxClient.query<{ payload: Record<string, any> }>(
    `SELECT payload FROM document_outbox_events
      WHERE institution_id = $1 AND event_type = 'document.upload_completed'
      ORDER BY created_at DESC LIMIT 1`,
    [instA],
  );
  assert.ok(outboxRow.rows.length > 0, 'Outbox event must exist');
  const payload = outboxRow.rows[0].payload;
  assert.strictEqual(payload.storageProvider, undefined, 'storageProvider must NOT be in outbox payload');
  assert.strictEqual(payload.storageBucket, undefined, 'storageBucket must NOT be in outbox payload');
  assert.strictEqual(payload.storageKey, undefined, 'storageKey must NOT be in outbox payload');
  assert.ok(payload.documentId, 'documentId must be in outbox payload');
  assert.ok(payload.versionId, 'versionId must be in outbox payload');
  assert.ok(payload.sessionId, 'sessionId must be in outbox payload');
} finally {
  outboxClient.release();
}

// 3.6 Completed session cannot be completed again by a different actor
await assert.rejects(
  async () => {
    await completeUploadSessionCommand({
      pool,
      context: managerA2Context,
      storageProvider,
      idempotencyKey: 'idemp-complete-hijack-double',
      input: {
        sessionId: session1.id,
        rawToken: token2,
        provenance: {
          originType: 'user_upload',
          sourceDomain: 'portal.documents',
          method: 'test_complete',
        },
      },
    });
  },
  /AUTHORIZATION_DENIED/,
  'Different manager cannot hijack double-completion replay',
);

// 3.7 Completed session cannot be cancelled
await assert.rejects(
  async () => {
    await cancelUploadSessionCommand({
      pool,
      context: managerA1Context,
      idempotencyKey: 'idemp-cancel-completed',
      input: { sessionId: session1.id, rawToken: token2 },
    });
  },
  /CANCEL_COMPLETED_DENIED/,
  'Completed session cannot be cancelled',
);

console.log('=== TEST 4: HTTP Routes Controller Defense Matrix ===');

const app = express();
app.use(express.json());

let currentAuthContext: InstitutionalContext | null = managerA1Context;
const testAuthMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  (req as any).institutionalContext = currentAuthContext;
  next();
};

registerDocumentRoutes(app, {
  pool,
  requireAuth: testAuthMiddleware,
  uploadPolicyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
  storageProvider,
  storageBucket: 'nexus-vault',
  malwareScanner,
});

const server = app.listen(0);
const addr = server.address() as any;
const baseUrl = `http://127.0.0.1:${addr.port}`;

async function request(
  method: 'POST' | 'PUT',
  pathStr: string,
  body?: any,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${pathStr}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-idempotency-key': randomUUID(),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const resBody = await res.json().catch(() => ({}));
  return { status: res.status, body: resBody };
}

// Create a new session for HTTP testing
const httpSessRes = await createUploadSessionCommand({
  pool,
  context: managerA1Context,
  idempotencyKey: 'idemp-http-sess-create',
  input: {
    documentId: docA.id,
    declaredFilename: 'http-test.pdf',
    declaredMimeType: 'application/pdf',
    declaredByteSize: 512,
    policyConfig: { globalMaxByteSize: 10 * 1024 * 1024 },
    storageProvider: 'test-memory',
    storageBucket: 'nexus-vault',
  },
});
const httpSession = httpSessRes.result.session;
const httpToken = httpSessRes.result.rawToken;

// 4.1 HTTP Resume - Non-manager / non-owner denied
for (const nonAuthCtx of [managerA2Context, studentContext, teacherContext, parentContext]) {
  currentAuthContext = nonAuthCtx;
  const res = await request('POST', `/api/documents/upload-sessions/${httpSession.id}/resume`, {
    rawToken: httpToken,
  });
  assert.strictEqual(res.status, 403, `HTTP resume should return 403 for ${nonAuthCtx.role}`);
}

// 4.2 HTTP Resume - Cross-tenant denied with 404
currentAuthContext = managerBContext;
const crossResumeRes = await request('POST', `/api/documents/upload-sessions/${httpSession.id}/resume`, {
  rawToken: httpToken,
});
assert.strictEqual(crossResumeRes.status, 404, 'Cross-tenant resume must return 404');

// 4.3 HTTP Cancel - Missing token returns 400
currentAuthContext = managerA1Context;
const missingTokenCancelRes = await request('POST', `/api/documents/upload-sessions/${httpSession.id}/cancel`, {});
assert.strictEqual(missingTokenCancelRes.status, 400, 'Cancel without token must return 400');

// 4.4 HTTP Cancel - Non-manager / non-owner returns 403
for (const nonAuthCtx of [managerA2Context, studentContext, teacherContext, parentContext]) {
  currentAuthContext = nonAuthCtx;
  const res = await request('POST', `/api/documents/upload-sessions/${httpSession.id}/cancel`, {
    rawToken: httpToken,
  });
  assert.strictEqual(res.status, 403, `HTTP cancel should return 403 for ${nonAuthCtx.role}`);
}

// 4.5 HTTP Cancel - Cross-tenant returns 404
currentAuthContext = managerBContext;
const crossCancelRes = await request('POST', `/api/documents/upload-sessions/${httpSession.id}/cancel`, {
  rawToken: httpToken,
});
assert.strictEqual(crossCancelRes.status, 404, 'Cross-tenant cancel must return 404');

// 4.6 HTTP Transfer - Non-owner returns 403
currentAuthContext = managerA2Context;
const transferRes = await request(
  'PUT',
  `/api/documents/upload-sessions/${httpSession.id}/transfer`,
  { data: 'transfer payload' },
  { 'x-upload-token': httpToken },
);
assert.strictEqual(transferRes.status, 403, 'Transfer by another user must return 403');

// 4.7 HTTP Complete - Non-manager / non-owner returns 403
for (const nonAuthCtx of [managerA2Context, studentContext, teacherContext, parentContext]) {
  currentAuthContext = nonAuthCtx;
  const res = await request('POST', `/api/documents/upload-sessions/${httpSession.id}/complete`, {
    rawToken: httpToken,
  });
  assert.strictEqual(res.status, 403, `HTTP complete should return 403 for ${nonAuthCtx.role}`);
}

// 4.8 HTTP Complete - Cross-tenant returns 404
currentAuthContext = managerBContext;
const crossCompleteRes = await request('POST', `/api/documents/upload-sessions/${httpSession.id}/complete`, {
  rawToken: httpToken,
});
assert.strictEqual(crossCompleteRes.status, 404, 'Cross-tenant complete must return 404');

// 4.9 HTTP Resume - Owner succeeds
currentAuthContext = managerA1Context;
const ownerResumeRes = await request('POST', `/api/documents/upload-sessions/${httpSession.id}/resume`, {
  rawToken: httpToken,
});
assert.strictEqual(ownerResumeRes.status, 200, 'Owner resume must succeed with 200');
assert.ok(ownerResumeRes.body.rawToken, 'Owner resume must return fresh rawToken');
assert.strictEqual(ownerResumeRes.body.session.uploadTokenHash, undefined, 'uploadTokenHash must NOT be in DTO');

// Cleanup
server.close();
const cleanClient = await pool.connect();
try {
  await cleanClient.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
} finally {
  cleanClient.release();
}
await pool.end();

console.log('ALL H1-05B UPLOAD SESSION LIFECYCLE TESTS PASSED!');
