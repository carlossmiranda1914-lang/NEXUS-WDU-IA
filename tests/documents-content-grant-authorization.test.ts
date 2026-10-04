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
import {
  authorizeContentAccessCommand,
  revokeContentAccessGrantCommand,
} from '../src/modules/documents/document-access-command.ts';
import {
  ConfigurableDocumentAccessPolicyEngine,
} from '../src/modules/documents/document-access-policy.ts';
import { registerDocumentRoutes } from '../src/modules/documents/document.controller.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { DeterministicTestMalwareScanner } from './support/deterministic-test-malware-scanner.ts';

await verifyApprovedTestConnection();

const schema = `doc_grant_auth_${randomUUID().replaceAll('-', '')}`;
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
    allowedActions: ['view_metadata', 'open_content', 'download_content'],
  },
  {
    role: 'student',
    category: '*',
    allowedActions: ['view_metadata', 'open_content', 'download_content'],
  },
  {
    role: 'parent',
    category: '*',
    allowedActions: ['view_metadata', 'open_content', 'download_content'],
  },
]);

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

  const docRepo = new PostgresDocumentRepository();

  // Create documents and versions in Inst A
  const docA = await docRepo.createDocument(client, {
    institutionId: instA,
    category: 'identity_proof',
    createdByPersonId: adminAId,
  });

  const { version: verA } = await docRepo.createNextVersion(client, {
    institutionId: instA,
    documentId: docA.id,
    mimeType: 'application/pdf',
    byteSize: 2048,
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
     ) VALUES ($1, $2, $3, 'memory', 'bucket-a', 'key-a', 'available', NOW())`,
    [randomUUID(), instA, verA.id],
  );

  // Create document in Inst B
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

  console.log('[TEST 1] Direct command bypass defense: Non-management roles fail closed inside authorizeContentAccessCommand');
  for (const [ctx, roleName] of [
    [studentContext, 'student'],
    [parentContext, 'parent'],
    [teacherContext, 'teacher'],
  ] as const) {
    await assert.rejects(
      authorizeContentAccessCommand({
        pool,
        context: ctx,
        idempotencyKey: `idemp-direct-auth-${roleName}`,
        policyEngine,
        accessGrantTokenKey: TEST_KEY,
        input: {
          documentId: docA.id,
          versionId: verA.id,
          action: 'open',
        },
      }),
      (err: any) => {
        assert.match(err.message, /AUTHORIZATION_DENIED/);
        return true;
      },
      `${roleName} must be denied in authorizeContentAccessCommand`,
    );
  }

  // Management role succeeds in direct command
  const adminGrant = await authorizeContentAccessCommand({
    pool,
    context: adminContext,
    idempotencyKey: 'idemp-direct-auth-admin',
    policyEngine,
    accessGrantTokenKey: TEST_KEY,
    input: {
      documentId: docA.id,
      versionId: verA.id,
      action: 'open',
    },
  });
  assert.strictEqual(adminGrant.result.grant.status, 'active');
  const grantId = adminGrant.result.grant.id;

  console.log('[TEST 2] Direct command bypass defense: Non-management roles fail closed inside revokeContentAccessGrantCommand');
  for (const [ctx, roleName] of [
    [studentContext, 'student'],
    [parentContext, 'parent'],
    [teacherContext, 'teacher'],
  ] as const) {
    await assert.rejects(
      revokeContentAccessGrantCommand({
        pool,
        context: ctx,
        idempotencyKey: `idemp-direct-revoke-${roleName}`,
        input: {
          grantId,
          reason: 'Compromised',
        },
      }),
      (err: any) => {
        assert.match(err.message, /AUTHORIZATION_DENIED/);
        return true;
      },
      `${roleName} must be denied in revokeContentAccessGrantCommand`,
    );
  }

  // Management role succeeds in revokeContentAccessGrantCommand
  const adminRevoke = await revokeContentAccessGrantCommand({
    pool,
    context: adminContext,
    idempotencyKey: 'idemp-direct-revoke-admin',
    input: {
      grantId,
      reason: 'Revoked by administrator audit',
    },
  });
  assert.strictEqual(adminRevoke.result.status, 'revoked');

  console.log('[TEST 3] Controller HTTP routes enforce central authorization for access and revoke');
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
    storageProvider: new MemoryObjectStorageProvider(),
    malwareScanner: new DeterministicTestMalwareScanner(),
  });

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 3.1. Route POST /api/documents/:id/access
    // Student, parent, teacher -> 403
    for (const ctx of [studentContext, parentContext, teacherContext]) {
      currentContext = ctx;
      const res = await fetch(`${baseUrl}/api/documents/${docA.id}/access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `route-auth-denied-${ctx.role}`,
        },
        body: JSON.stringify({ action: 'open', versionId: verA.id }),
      });
      assert.strictEqual(res.status, 403, `Expected 403 for role ${ctx.role}`);
      const body = await res.json() as any;
      assert.strictEqual(body.code, 'AUTHORIZATION_DENIED');
    }

    // Management -> 201 Created
    currentContext = adminContext;
    const adminRes = await fetch(`${baseUrl}/api/documents/${docA.id}/access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'route-auth-allowed-admin',
      },
      body: JSON.stringify({ action: 'open', versionId: verA.id }),
    });
    assert.strictEqual(adminRes.status, 201);
    const adminBody = await adminRes.json() as any;
    assert.ok(adminBody.grantId);
    const httpGrantId = adminBody.grantId;

    // 3.2. Route POST /api/documents/access/:grantId/revoke
    // Student, parent, teacher -> 403
    for (const ctx of [studentContext, parentContext, teacherContext]) {
      currentContext = ctx;
      const res = await fetch(`${baseUrl}/api/documents/access/${httpGrantId}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `route-revoke-denied-${ctx.role}`,
        },
        body: JSON.stringify({ reason: 'Unauthorized revocation attempt' }),
      });
      assert.strictEqual(res.status, 403, `Expected 403 for role ${ctx.role} on revoke`);
      const body = await res.json() as any;
      assert.strictEqual(body.code, 'AUTHORIZATION_DENIED');
    }

    // Management -> 200 OK
    currentContext = adminContext;
    const adminRevokeRes = await fetch(`${baseUrl}/api/documents/access/${httpGrantId}/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'route-revoke-allowed-admin',
      },
      body: JSON.stringify({ reason: 'Valid admin revocation' }),
    });
    assert.strictEqual(adminRevokeRes.status, 200);
    const adminRevokeBody = await adminRevokeRes.json() as any;
    assert.strictEqual(adminRevokeBody.status, 'revoked');

    console.log('[TEST 4] Cross-tenant isolation: Tenant A cannot access or revoke Tenant B resources');
    currentContext = adminContext; // Actor from Tenant A
    // Access Tenant B document -> 404
    const crossAccess = await fetch(`${baseUrl}/api/documents/${docB.id}/access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'cross-tenant-access',
      },
      body: JSON.stringify({ action: 'open', versionId: verB.id }),
    });
    assert.strictEqual(crossAccess.status, 404, 'Cross-tenant document access must 404');

    // Create grant in Tenant B
    const grantBRes = await authorizeContentAccessCommand({
      pool,
      context: adminBContext,
      idempotencyKey: 'idemp-grant-b',
      policyEngine,
      accessGrantTokenKey: TEST_KEY,
      input: {
        documentId: docB.id,
        versionId: verB.id,
        action: 'open',
      },
    });
    const grantBId = grantBRes.result.grant.id;

    // Revoke Tenant B grant from Tenant A actor -> 404
    currentContext = adminContext;
    const crossRevoke = await fetch(`${baseUrl}/api/documents/access/${grantBId}/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'cross-tenant-revoke',
      },
      body: JSON.stringify({ reason: 'Cross-tenant attack' }),
    });
    assert.strictEqual(crossRevoke.status, 404, 'Cross-tenant grant revoke must 404');
  } finally {
    server.close();
  }

  console.log('[TEST 5] Token Security: Raw token never stored in DB, audit, or outbox');
  const dbGrant = await client.query<{ token_hash: string }>(
    `SELECT token_hash FROM document_content_access_grants WHERE id = $1`,
    [grantId],
  );
  assert.strictEqual(dbGrant.rows[0].token_hash.length, 64);

  // Check audit events for absence of raw token
  const auditRows = await client.query<{ details: any }>(
    `SELECT details FROM document_audit_events WHERE institution_id = $1`,
    [instA],
  );
  for (const row of auditRows.rows) {
    const jsonStr = JSON.stringify(row.details || {});
    assert.strictEqual(jsonStr.includes('rawAccessToken'), false, 'No raw token in audit');
  }

  // Check outbox events for absence of raw token
  const outboxRows = await client.query<{ payload: any }>(
    `SELECT payload FROM document_outbox_events WHERE institution_id = $1`,
    [instA],
  );
  for (const row of outboxRows.rows) {
    const jsonStr = JSON.stringify(row.payload || {});
    assert.strictEqual(jsonStr.includes('rawAccessToken'), false, 'No raw token in outbox');
  }

  console.log('ALL_CONTENT_GRANT_AUTHORIZATION_TESTS_PASS');
} finally {
  await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  client.release();
  await pool.end();
}
