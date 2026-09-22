import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import express, { type Request, type Response, type NextFunction } from 'express';
import pg from 'pg';
import { registerDocumentRoutes } from '../src/modules/documents/document.controller.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { DeterministicTestMalwareScanner } from './support/deterministic-test-malware-scanner.ts';
import {
  ConfigurableRetentionPolicyEngine,
} from '../src/modules/documents/document-retention-policy.ts';
import type { RetentionPolicyRecord } from '../src/modules/documents/document-retention-model.ts';
import {
  ConfigurableDocumentAccessPolicyEngine,
  type AccessPolicyRule,
} from '../src/modules/documents/document-access-policy.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();

const schema = `test_ret_err_${randomUUID().replaceAll('-', '')}`;
const quote = (ident: string): string => `"${ident.replace(/"/g, '""')}"`;

const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});

let server: Server | null = null;
const client = await pool.connect();

try {
  await client.query(`CREATE SCHEMA ${quote(schema)}`);
  await client.query(`SET search_path TO ${quote(schema)}, public`);

  const { discoverMigrations, runMigrations } = await import('../src/db/migration-runner.ts');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

  const migrations = await discoverMigrations(migrationsDir);
  await runMigrations(client, migrations);

  // Seed two institutions and persons
  const institutionAId = randomUUID();
  const institutionBId = randomUUID();
  const adminAPersonId = randomUUID();
  const viewerAPersonId = randomUUID();
  const adminBPersonId = randomUUID();

  await client.query(
    `INSERT INTO institutions (id, name, slug, status) VALUES ($1, $2, $3, 'active'), ($4, $5, $6, 'active')`,
    [institutionAId, 'Colégio Nexus Luanda', 'inst-a', institutionBId, 'Colégio Nexus Benguela', 'inst-b'],
  );
  await client.query(
    `INSERT INTO people (id, name) VALUES ($1, $2), ($3, $4), ($5, $6)`,
    [
      adminAPersonId, 'Admin A',
      viewerAPersonId, 'Viewer A',
      adminBPersonId, 'Admin B',
    ],
  );

  const app = express();
  app.use(express.json());

  // Multi-tenant auth mock
  app.use((req: any, _res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    if (authHeader === 'Bearer token-admin-a') {
      req.institutionalContext = {
        institutionId: institutionAId,
        institutionName: 'Colégio Nexus Luanda',
        institutionSlug: 'inst-a',
        personId: adminAPersonId,
        personName: 'Admin A',
        identityEmail: 'admin.a@nexus.test',
        membershipId: randomUUID(),
        role: 'institution_admin',
      } as InstitutionalContext;
    } else if (authHeader === 'Bearer token-viewer-a') {
      req.institutionalContext = {
        institutionId: institutionAId,
        institutionName: 'Colégio Nexus Luanda',
        institutionSlug: 'inst-a',
        personId: viewerAPersonId,
        personName: 'Viewer A',
        identityEmail: 'viewer.a@nexus.test',
        membershipId: randomUUID(),
        role: 'institution_viewer',
      } as InstitutionalContext;
    } else if (authHeader === 'Bearer token-admin-b') {
      req.institutionalContext = {
        institutionId: institutionBId,
        institutionName: 'Colégio Nexus Benguela',
        institutionSlug: 'inst-b',
        personId: adminBPersonId,
        personName: 'Admin B',
        identityEmail: 'admin.b@nexus.test',
        membershipId: randomUUID(),
        role: 'institution_admin',
      } as InstitutionalContext;
    }
    next();
  });

  const authMiddleware = (req: any, res: any, next: any) => {
    if (!req.institutionalContext) {
      return res.status(401).json({ error: 'UNAUTHENTICATED' });
    }
    next();
  };

  const sampleRetentionPolicy: RetentionPolicyRecord = {
    id: 'pol-student-record-5y',
    institutionId: institutionAId,
    category: 'identification',
    jurisdictionProfileId: 'ao-rgpd-std',
    legalBasis: 'regulatory_compliance',
    retentionDurationMonths: 60,
    actionOnExpiry: 'destroy_file_preserve_metadata',
    authorizedRolesForDeletion: ['institution_admin'],
    isImmutable: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleAccessPolicy: AccessPolicyRule = {
    category: 'identification',
    allowedRoles: ['institution_admin', 'institution_viewer'],
  };

  const retentionPolicyEngine = new ConfigurableRetentionPolicyEngine([sampleRetentionPolicy]);
  const accessPolicyEngine = new ConfigurableDocumentAccessPolicyEngine([sampleAccessPolicy]);

  registerDocumentRoutes(app, {
    pool,
    requireAuth: authMiddleware,
    storageProvider: new MemoryObjectStorageProvider(),
    storageBucket: 'test-bucket',
    malwareScanner: new DeterministicTestMalwareScanner(),
    retentionPolicyEngine,
    policyEngine: accessPolicyEngine,
    deletionPseudonymizationKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  });

  await new Promise<void>((resolve) => {
    server = createServer(app).listen(0, '127.0.0.1', () => resolve());
  });

  const address = server!.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const requestAs = async (token: string, path: string, options: any = {}) => {
    return fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  };

  // Seed a real document and version in Inst A without retention assignment
  const docAId = randomUUID();
  const verAId = randomUUID();
  await client.query(
    `INSERT INTO documents (id, institution_id, category, classification, created_by_person_id, created_at, updated_at)
     VALUES ($1, $2, 'identification', 'internal', $3, now(), now())`,
    [docAId, institutionAId, adminAPersonId],
  );
  await client.query(
    `INSERT INTO document_versions (id, institution_id, document_id, version_number, byte_size, mime_type, sha256_hash, status, created_by_person_id, created_at)
     VALUES ($1, $2, $3, 1, 1024, 'application/pdf', $4, 'available', $5, now())`,
    [verAId, institutionAId, docAId, 'a'.repeat(64), adminAPersonId],
  );

  console.log('[TEST 1] Existing document with no retention assignment returns 422 with truthful domain message');
  const resNoRetention = await requestAs('token-admin-a', `/api/documents/${docAId}/deletion/authorize`, {
    method: 'POST',
    headers: { 'Idempotency-Key': `idem-del-${randomUUID()}` },
    body: { versionId: verAId },
  });
  assert.equal(resNoRetention.status, 422, 'Missing retention assignment must return 422 Unprocessable Entity');
  const bodyNoRetention = (await resNoRetention.json()) as any;
  assert.equal(bodyNoRetention.code, 'RETENTION_ASSIGNMENT_MISSING');
  assert.equal(
    bodyNoRetention.error,
    'Este documento ainda não possui uma política de retenção atribuída e, por isso, não pode ser eliminado.',
  );

  console.log('[TEST 2] Document with active unexpired retention returns 422 RETENTION_ACTIVE');
  // Assign active retention (in the future)
  const assignId = randomUUID();
  await client.query(
    `INSERT INTO document_retention_assignments (id, institution_id, document_id, version_id, policy_id, policy_version, jurisdiction_profile_id, jurisdiction_profile_version, category, clock_trigger_type, clock_trigger_event_at, retain_until, retention_status, assigned_by_person_id, assigned_at)
     VALUES ($1, $2, $3, $4, 'pol-student-record-5y', 'v1.0', 'ao-rgpd-std', 'v1.0', 'identification', 'uploaded_at', now(), now() + interval '5 years', 'retention_active', $5, now())`,
    [assignId, institutionAId, docAId, verAId, adminAPersonId],
  );

  const resRetentionActive = await requestAs('token-admin-a', `/api/documents/${docAId}/deletion/authorize`, {
    method: 'POST',
    headers: { 'Idempotency-Key': `idem-del-${randomUUID()}` },
    body: { versionId: verAId },
  });
  assert.equal(resRetentionActive.status, 422, 'Active retention must return 422 Unprocessable Entity');
  const bodyRetentionActive = (await resRetentionActive.json()) as any;
  assert.equal(bodyRetentionActive.code, 'RETENTION_ACTIVE');
  assert.equal(
    bodyRetentionActive.error,
    'O documento encontra-se sob prazo de retenção ativo e não pode ser eliminado.',
  );

  console.log('[TEST 3] Document with expired retention but active legal hold returns 409 CONFLICT');
  // Update retention to expired
  await client.query(
    `UPDATE document_retention_assignments SET retain_until = now() - interval '1 day', retention_status = 'retention_expired' WHERE id = $1`,
    [assignId],
  );
  // Add active hold
  const holdId = randomUUID();
  await client.query(
    `INSERT INTO document_retention_holds (id, institution_id, document_id, version_id, hold_type, authority, reason, hold_status, created_by_person_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'legal', 'Tribunal Provincial', 'Auditoria externa', 'active', $5, now(), now())`,
    [holdId, institutionAId, docAId, verAId, adminAPersonId],
  );

  const resActiveHold = await requestAs('token-admin-a', `/api/documents/${docAId}/deletion/authorize`, {
    method: 'POST',
    headers: { 'Idempotency-Key': `idem-del-${randomUUID()}` },
    body: { versionId: verAId },
  });
  assert.equal(resActiveHold.status, 409, 'Active legal hold must return 409 Conflict');
  const bodyActiveHold = (await resActiveHold.json()) as any;
  assert.equal(bodyActiveHold.code, 'CONFLICT');

  console.log('[TEST 4] Unauthorized actor role attempting deletion authorization returns 403');
  // Release hold
  await client.query(`UPDATE document_retention_holds SET hold_status = 'released', released_at = now(), released_by_person_id = $1 WHERE id = $2`, [adminAPersonId, holdId]);

  const resUnauthorized = await requestAs('token-viewer-a', `/api/documents/${docAId}/deletion/authorize`, {
    method: 'POST',
    headers: { 'Idempotency-Key': `idem-del-${randomUUID()}` },
    body: { versionId: verAId },
  });
  assert.equal(resUnauthorized.status, 403, 'Unauthorized actor must return 403 Forbidden');
  const bodyUnauthorized = (await resUnauthorized.json()) as any;
  assert.equal(bodyUnauthorized.code, 'AUTHORIZATION_DENIED');

  console.log('[TEST 5] Cross-tenant deletion authorization fails closed with 404 and preserves tenant privacy');
  const resCrossTenant = await requestAs('token-admin-b', `/api/documents/${docAId}/deletion/authorize`, {
    method: 'POST',
    headers: { 'Idempotency-Key': `idem-del-${randomUUID()}` },
    body: { versionId: verAId },
  });
  assert.equal(resCrossTenant.status, 404, 'Cross-tenant request must fail closed with 404 Not Found');
  const bodyCrossTenant = (await resCrossTenant.json()) as any;
  assert.equal(bodyCrossTenant.code, 'NOT_FOUND');
  assert.equal(bodyCrossTenant.error, 'O recurso solicitado não foi encontrado no tenant.');

  console.log('[TEST 6] Completely nonexistent document returns 404 NOT_FOUND');
  const resNonExistent = await requestAs('token-admin-a', `/api/documents/${randomUUID()}/deletion/authorize`, {
    method: 'POST',
    headers: { 'Idempotency-Key': `idem-del-${randomUUID()}` },
    body: { versionId: randomUUID() },
  });
  assert.equal(resNonExistent.status, 404);
  const bodyNonExistent = (await resNonExistent.json()) as any;
  assert.equal(bodyNonExistent.code, 'NOT_FOUND');

  console.log('ALL_RETENTION_ERROR_CONTRACT_TESTS_PASS');
} finally {
  if (server) {
    (server as Server).close();
  }
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } catch {
    // Ignore schema cleanup errors
  }
  client.release();
  await pool.end();
}
