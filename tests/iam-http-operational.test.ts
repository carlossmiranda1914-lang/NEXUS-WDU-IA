import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import http from 'node:http';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pg from 'pg';
import { readApprovedTestTarget } from '../scripts/nexus-test-db-safety.mjs';
import { resolveInstitutionalContext } from '../src/auth/institutional-context.ts';
import { createRequireAuth } from '../src/middleware/auth.ts';
import { registerIamRoutes } from '../src/modules/iam/iam.controller.ts';
import { changeMembershipRole, grantInstitutionAccess, revokeInstitutionAccess } from '../src/modules/iam/iam-command-service.ts';
import type { IamCommandPool, IamTransactionClient } from '../src/modules/iam/iam-command-types.ts';

const { connectionString } = readApprovedTestTarget();
const schemaName = `nexus_iamhttp_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 10)}`;
if (!/^[a-z0-9_]+$/.test(schemaName)) throw new Error('Unsafe schema name.');
const schemaIdentifier = `"${schemaName}"`;
const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
const setupPool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
let servicePool: pg.Pool | undefined;
let server: http.Server | undefined;
let setupClient: pg.PoolClient | undefined;

function iamPool(value: pg.Pool): IamCommandPool { return { connect: async () => (await value.connect()) as unknown as IamTransactionClient }; }
function body(role: string, extra: Record<string, unknown> = {}) { return { headers: { Authorization: `Bearer ${role}`, 'Content-Type': 'application/json' }, ...extra }; }
async function request(base: string, pathName: string, init: RequestInit) {
  const response = await fetch(`${base}${pathName}`, init);
  return { response, payload: await response.json() as Record<string, unknown> };
}
function assertPublic(value: unknown) {
  const encoded = JSON.stringify(value).toLowerCase();
  assert.doesNotMatch(encoded, /email|firebase|identity|uid|code_hash|intent.?code|select |stack|password/);
}

try {
  setupClient = await setupPool.connect();
  await setupClient.query(`CREATE SCHEMA ${schemaIdentifier}`);
  await setupClient.query(`SET search_path TO ${schemaIdentifier}`);
  for (const file of (await readdir(migrationsDirectory)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort()) {
    await setupClient.query(await readFile(path.join(migrationsDirectory, file), 'utf8'));
  }
  servicePool = new pg.Pool({ connectionString, options: `-c search_path=${schemaName}`, connectionTimeoutMillis: 5000 });

  const institutionA = randomUUID(), institutionB = randomUUID();
  const adminA = randomUUID(), backupA = randomUUID(), teacherA = randomUUID(), targetA = randomUUID(), targetB = randomUUID(), noMembership = randomUUID(), multi = randomUUID(), replayTarget = randomUUID(), revokedReplayTarget = randomUUID();
  const adminAMembership = randomUUID(), backupAMembership = randomUUID(), teacherAMembership = randomUUID(), targetBMembership = randomUUID();
  await setupClient.query(`INSERT INTO institutions (id, name, slug, status) VALUES ($1, 'A', 'a', 'active'), ($2, 'B', 'b', 'active')`, [institutionA, institutionB]);
  await setupClient.query(`INSERT INTO people (id, name) VALUES ($1, 'Admin A'), ($2, 'Backup A'), ($3, 'Teacher A'), ($4, 'Target A'), ($5, 'Target B'), ($6, 'No Membership'), ($7, 'Multi'), ($8, 'Replay Target'), ($9, 'Revoked Replay Target')`, [adminA, backupA, teacherA, targetA, targetB, noMembership, multi, replayTarget, revokedReplayTarget]);
  const identities = [[adminA, 'admin-a'], [backupA, 'backup-a'], [teacherA, 'teacher-a'], [noMembership, 'no-membership'], [multi, 'multi']];
  for (const [personId, uid] of identities) await setupClient.query(`INSERT INTO identities (person_id, provider, provider_subject) VALUES ($1, 'firebase', $2)`, [personId, uid]);
  await setupClient.query(`INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at) VALUES ($1, $2, $3, 'institution_admin', 'active', now()), ($4, $5, $3, 'institution_admin', 'active', now()), ($6, $7, $3, 'teacher', 'active', now()), ($8, $9, $10, 'teacher', 'active', now()), (gen_random_uuid(), $11, $3, 'teacher', 'active', now()), (gen_random_uuid(), $11, $10, 'teacher', 'active', now())`, [adminAMembership, adminA, institutionA, backupAMembership, backupA, teacherAMembership, teacherA, targetBMembership, targetB, institutionB, multi]);

  const app = express(); app.use(express.json());
  const fakeVerifier = async (token: string) => {
    if (!['admin-a', 'teacher-a', 'no-membership', 'multi'].includes(token)) throw new Error('invalid test token');
    return { uid: token };
  };
  // The real resolver reads Identity -> Person -> Membership from the isolated CP4 schema.
  const localRequireAuth = createRequireAuth({ verifyIdToken: fakeVerifier, pool: servicePool as any, resolveInstitutionalContext });
  registerIamRoutes(app, { pool: iamPool(servicePool), requireAuth: localRequireAuth, commands: { grant: grantInstitutionAccess, changeRole: changeMembershipRole, revoke: revokeInstitutionAccess } });
  server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string' && address.address === '127.0.0.1' && address.port > 0, 'HTTP listener must be ephemeral loopback only.');
  const base = `http://127.0.0.1:${address.port}`;

  let result = await request(base, '/api/iam/memberships/grants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
  assert.equal(result.response.status, 401);
  result = await request(base, '/api/iam/memberships/grants', { method: 'POST', ...body('no-membership'), body: JSON.stringify({ target: { personId: targetA }, role: 'teacher', idempotencyKey: 'http-no-membership-001' }) });
  assert.equal(result.response.status, 403);
  result = await request(base, '/api/iam/memberships/grants', { method: 'POST', ...body('multi'), body: JSON.stringify({ target: { personId: targetA }, role: 'teacher', idempotencyKey: 'http-multi-context-001' }) });
  assert.equal(result.response.status, 409);
  result = await request(base, '/api/iam/memberships/grants', { method: 'POST', ...body('teacher-a', { 'x-institution-id': institutionA }), body: JSON.stringify({ target: { personId: targetA }, role: 'teacher', idempotencyKey: 'http-not-admin-001' }) });
  assert.equal(result.response.status, 403); const beforeUnauthorized = await setupClient.query(`SELECT count(*)::int AS count FROM memberships WHERE person_id = $1 AND institution_id = $2`, [targetA, institutionA]); assert.equal(beforeUnauthorized.rows[0].count, 0);

  result = await request(base, '/api/iam/memberships/grants', { method: 'POST', ...body('admin-a'), body: JSON.stringify({ target: { personId: targetA }, role: 'teacher', idempotencyKey: 'http-grant-001' }) });
  assert.equal(result.response.status, 201); assertPublic(result.payload); const membership = (result.payload.membership as Record<string, unknown>); const membershipId = membership.id as string; assert.equal(membership.version, 1);
  result = await request(base, `/api/iam/memberships/${membershipId}/role`, { method: 'PATCH', ...body('admin-a'), body: JSON.stringify({ role: 'director', expectedVersion: 1, idempotencyKey: 'http-role-001' }) });
  assert.equal(result.response.status, 200); assert.equal((result.payload.membership as Record<string, unknown>).version, 2); assertPublic(result.payload);
  result = await request(base, `/api/iam/memberships/${membershipId}/revoke`, { method: 'POST', ...body('admin-a'), body: JSON.stringify({ expectedVersion: 2, idempotencyKey: 'http-revoke-001' }) });
  assert.equal(result.response.status, 200); assert.equal((result.payload.membership as Record<string, unknown>).status, 'revoked'); assertPublic(result.payload);
  result = await request(base, `/api/iam/memberships/${targetBMembership}/role`, { method: 'PATCH', ...body('admin-a'), body: JSON.stringify({ role: 'director', expectedVersion: 1, idempotencyKey: 'http-tenant-b-001' }) });
  assert.equal(result.response.status, 404);

  const replayPayload = { target: { personId: replayTarget }, role: 'teacher', idempotencyKey: 'http-replay-001' };
  result = await request(base, '/api/iam/memberships/grants', { method: 'POST', ...body('admin-a'), body: JSON.stringify(replayPayload) }); assert.equal(result.response.status, 201);
  result = await request(base, '/api/iam/memberships/grants', { method: 'POST', ...body('admin-a'), body: JSON.stringify(replayPayload) }); assert.equal(result.response.status, 200); assert.equal(result.payload.replayed, true);
  result = await request(base, '/api/iam/memberships/grants', { method: 'POST', ...body('admin-a'), body: JSON.stringify({ ...replayPayload, role: 'director' }) }); assert.equal(result.response.status, 409);

  const revokedReplayPayload = { target: { personId: revokedReplayTarget }, role: 'teacher', idempotencyKey: 'http-revoked-actor-001' };
  result = await request(base, '/api/iam/memberships/grants', { method: 'POST', ...body('admin-a'), body: JSON.stringify(revokedReplayPayload) }); assert.equal(result.response.status, 201); const revokedTargetId = (result.payload.membership as Record<string, unknown>).id;
  await setupClient.query(`UPDATE memberships SET status = 'revoked', revoked_at = now(), version = version + 1 WHERE id = $1`, [adminAMembership]);
  result = await request(base, '/api/iam/memberships/grants', { method: 'POST', ...body('admin-a'), body: JSON.stringify(revokedReplayPayload) }); assert.equal(result.response.status, 403); assertPublic(result.payload);
  const unchanged = await setupClient.query<{ status: string; version: number }>(`SELECT status, version FROM memberships WHERE id = $1`, [revokedTargetId]); assert.deepEqual(unchanged.rows[0], { status: 'active', version: 1 });
  for (const method of ['GET', 'POST']) { const bootstrap = await fetch(`${base}/api/iam/bootstrap`, { method, headers: { Authorization: 'Bearer backup-a' } }); assert.equal(bootstrap.status, 404); }

  const authSource = await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/middleware/auth.ts'), 'utf8');
  assert.match(authSource, /export const requireAuth = createRequireAuth\(\{[\s\S]*adminAuth\.verifyIdToken\(token\)[\s\S]*pool,[\s\S]*resolveInstitutionalContext,/);
  console.log('IAM HTTP operational tests passed: loopback listener, real context resolution and CP4 isolated schema.');
} finally {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  if (servicePool) await servicePool.end();
  if (setupClient) { await setupClient.query(`DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE`).catch(() => undefined); setupClient.release(); }
  await setupPool.end();
}
