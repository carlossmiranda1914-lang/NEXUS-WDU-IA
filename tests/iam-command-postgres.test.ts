import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { readApprovedTestTarget } from '../scripts/nexus-test-db-safety.mjs';
import { bootstrapInstitutionAdmin, changeMembershipRole, grantInstitutionAccess, revokeInstitutionAccess } from '../src/modules/iam/iam-command-service.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import type { IamCommandPool, IamTransactionClient } from '../src/modules/iam/iam-command-types.ts';

const { connectionString } = readApprovedTestTarget();
const schemaName = `nexus_iamcp3_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 10)}`;
if (!/^[a-z0-9_]+$/.test(schemaName)) throw new Error('Unsafe schema name.');
const schemaIdentifier = `"${schemaName}"`;
const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
const setupPool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
let servicePool: pg.Pool | undefined;
let setupClient: pg.PoolClient | undefined;
function context(institutionId: string, personId: string, membershipId: string): InstitutionalContext {
  return { institutionId, personId, membershipId, personName: 'IAM Admin', identityEmail: null, institutionName: 'IAM', institutionSlug: 'iam', role: 'institution_admin' };
}
function iamPool(pool: pg.Pool): IamCommandPool { return { connect: async () => (await pool.connect()) as unknown as IamTransactionClient }; }
async function expectCode(action: () => Promise<unknown>, code: string) {
  await assert.rejects(action, (error: unknown) => typeof error === 'object' && error !== null && (error as { code?: string }).code === code);
}

try {
  setupClient = await setupPool.connect();
  await setupClient.query(`CREATE SCHEMA ${schemaIdentifier}`);
  await setupClient.query(`SET search_path TO ${schemaIdentifier}`);
  const files = (await readdir(migrationsDirectory)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  for (const file of files) await setupClient.query(await readFile(path.join(migrationsDirectory, file), 'utf8'));
  servicePool = new pg.Pool({ connectionString, options: `-c search_path=${schemaName}`, connectionTimeoutMillis: 5000 });
  const institutionA = randomUUID(), institutionB = randomUUID(), institutionC = randomUUID(), institutionD = randomUUID(), institutionE = randomUUID(), inactiveInstitution = randomUUID();
  const adminPerson = randomUUID(), targetPerson = randomUUID(), historicalPerson = randomUUID(), bootstrapPerson = randomUUID(), pendingPerson = randomUUID(), pendingIntentPerson = randomUUID(), intentPerson = randomUUID(), expiredIntentPerson = randomUUID(), consumedIntentPerson = randomUUID(), identityIntentPerson = randomUUID(), adminCPersonA = randomUUID(), adminCPersonB = randomUUID(), adminDPersonA = randomUUID(), adminDPersonB = randomUUID(), replayActorPerson = randomUUID(), replayBackupPerson = randomUUID(), replayTargetPerson = randomUUID();
  const adminMembership = randomUUID();
  await setupClient.query(`INSERT INTO institutions (id, name, slug, status) VALUES ($1, 'IAM A', 'iam-a', 'active'), ($2, 'IAM B', 'iam-b', 'active'), ($3, 'IAM C', 'iam-c', 'active'), ($4, 'IAM D', 'iam-d', 'active'), ($5, 'IAM E', 'iam-e', 'active'), ($6, 'IAM Suspended', 'iam-suspended', 'suspended')`, [institutionA, institutionB, institutionC, institutionD, institutionE, inactiveInstitution]);
  await setupClient.query(`INSERT INTO people (id, name) VALUES ($1, 'Admin'), ($2, 'Target'), ($3, 'History'), ($4, 'Bootstrap'), ($5, 'Pending'), ($6, 'Pending Intent'), ($7, 'Intent'), ($8, 'Expired'), ($9, 'Consumed'), ($10, 'Identity Intent'), ($11, 'Admin C A'), ($12, 'Admin C B'), ($13, 'Admin D A'), ($14, 'Admin D B'), ($15, 'Replay Actor'), ($16, 'Replay Backup'), ($17, 'Replay Target')`, [adminPerson, targetPerson, historicalPerson, bootstrapPerson, pendingPerson, pendingIntentPerson, intentPerson, expiredIntentPerson, consumedIntentPerson, identityIntentPerson, adminCPersonA, adminCPersonB, adminDPersonA, adminDPersonB, replayActorPerson, replayBackupPerson, replayTargetPerson]);
  await setupClient.query(`INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at) VALUES ($1, $2, $3, 'institution_admin', 'active', now())`, [adminMembership, adminPerson, institutionA]);
  const commands = iamPool(servicePool);
  const adminContext = context(institutionA, adminPerson, adminMembership);

  const grant = await grantInstitutionAccess(commands, { context: adminContext, target: { personId: targetPerson }, role: 'teacher', idempotencyKey: 'cp3-grant-0001' });
  assert.equal(grant.resultCode, 'SUCCEEDED'); assert.equal(grant.status, 'active');
  const replay = await grantInstitutionAccess(commands, { context: adminContext, target: { personId: targetPerson }, role: 'teacher', idempotencyKey: 'cp3-grant-0001' });
  assert.equal(replay.replayed, true); assert.equal(replay.membershipId, grant.membershipId);
  const stale = changeMembershipRole(commands, { context: adminContext, membershipId: grant.membershipId!, role: 'director', expectedVersion: 9, idempotencyKey: 'cp3-role-stale' });
  await expectCode(() => stale, 'VERSION_CONFLICT');
  const changed = await changeMembershipRole(commands, { context: adminContext, membershipId: grant.membershipId!, role: 'director', expectedVersion: 1, idempotencyKey: 'cp3-role-0001' });
  assert.equal(changed.role, 'director'); assert.equal(changed.version, 2);
  await expectCode(() => revokeInstitutionAccess(commands, { context: adminContext, membershipId: adminMembership, expectedVersion: 1, idempotencyKey: 'cp3-last-admin' }), 'LAST_ADMIN_PROTECTED');
  await expectCode(() => revokeInstitutionAccess(commands, { context: adminContext, membershipId: grant.membershipId!, expectedVersion: 1, idempotencyKey: 'cp3-tenant-a' }), 'VERSION_CONFLICT');
  const rejectedReplay = await revokeInstitutionAccess(commands, { context: adminContext, membershipId: grant.membershipId!, expectedVersion: 1, idempotencyKey: 'cp3-tenant-a' });
  assert.equal(rejectedReplay.replayed, true); assert.equal(rejectedReplay.resultCode, 'VERSION_CONFLICT');
  const rejectionCount = await setupClient.query<{ count: string }>(`SELECT count(*)::text AS count FROM iam_membership_events WHERE institution_id = $1 AND reason_code = 'VERSION_CONFLICT'`, [institutionA]);
  await expectCode(() => revokeInstitutionAccess(commands, { context: adminContext, membershipId: grant.membershipId!, expectedVersion: 999, idempotencyKey: 'cp3-tenant-a' }), 'IDEMPOTENCY_KEY_REUSED');
  const rejectionCountAfterMismatch = await setupClient.query<{ count: string }>(`SELECT count(*)::text AS count FROM iam_membership_events WHERE institution_id = $1 AND reason_code = 'VERSION_CONFLICT'`, [institutionA]);
  assert.equal(rejectionCountAfterMismatch.rows[0].count, rejectionCount.rows[0].count, 'Fingerprint mismatch must not multiply rejection events.');
  await expectCode(() => revokeInstitutionAccess(commands, { context: { ...adminContext, institutionId: institutionB }, membershipId: grant.membershipId!, expectedVersion: 2, idempotencyKey: 'cp3-cross-tenant' }), 'UNAUTHORIZED');

  const replayActorMembership = randomUUID(), replayBackupMembership = randomUUID();
  await setupClient.query(`INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at) VALUES ($1, $2, $3, 'institution_admin', 'active', now()), ($4, $5, $3, 'institution_admin', 'active', now())`, [replayActorMembership, replayActorPerson, institutionE, replayBackupMembership, replayBackupPerson]);
  const replayActorContext = context(institutionE, replayActorPerson, replayActorMembership);
  const replayGrant = await grantInstitutionAccess(commands, { context: replayActorContext, target: { personId: replayTargetPerson }, role: 'teacher', idempotencyKey: 'cp3-replay-authority' });
  const authorizedReplay = await grantInstitutionAccess(commands, { context: replayActorContext, target: { personId: replayTargetPerson }, role: 'teacher', idempotencyKey: 'cp3-replay-authority' });
  assert.equal(authorizedReplay.replayed, true, 'An active actor must receive the original idempotent replay.');
  await setupClient.query(`UPDATE memberships SET status = 'revoked', revoked_at = now(), version = version + 1 WHERE id = $1`, [replayActorMembership]);
  await expectCode(() => grantInstitutionAccess(commands, { context: replayActorContext, target: { personId: replayTargetPerson }, role: 'teacher', idempotencyKey: 'cp3-replay-authority' }), 'UNAUTHORIZED');
  const replayTargetAfterRevocation = await setupClient.query<{ status: string; version: number }>(`SELECT status, version FROM memberships WHERE id = $1 AND institution_id = $2`, [replayGrant.membershipId, institutionE]);
  assert.equal(replayTargetAfterRevocation.rows[0].status, 'active', 'Unauthorized replay must not mutate the prior target Membership.');
  assert.equal(replayTargetAfterRevocation.rows[0].version, 1, 'Unauthorized replay must not increment the prior target Membership version.');

  const historyActive = randomUUID(), historyRevoked = randomUUID();
  await setupClient.query(`INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at) VALUES ($1, $2, $3, 'teacher', 'active', now()), ($4, $2, $3, 'director', 'revoked', now())`, [historyActive, historicalPerson, institutionA, historyRevoked]);
  await expectCode(() => changeMembershipRole(commands, { context: adminContext, membershipId: historyActive, role: 'director', expectedVersion: 1, idempotencyKey: 'cp3-history-role' }), 'HISTORICAL_ROLE_CONFLICT');
  const revoked = await revokeInstitutionAccess(commands, { context: adminContext, membershipId: historyActive, expectedVersion: 1, idempotencyKey: 'cp3-revoke-history' });
  assert.equal(revoked.status, 'revoked');
  await expectCode(() => grantInstitutionAccess(commands, { context: adminContext, target: { personId: historicalPerson }, role: 'teacher', idempotencyKey: 'cp3-regrant-revoked' }), 'MEMBERSHIP_REVOKED');

  const pendingMembership = randomUUID();
  await setupClient.query(`INSERT INTO memberships (id, person_id, institution_id, role, status) VALUES ($1, $2, $3, 'student', 'pending')`, [pendingMembership, pendingPerson, institutionA]);
  await expectCode(() => grantInstitutionAccess(commands, { context: adminContext, target: { personId: pendingPerson }, membershipId: pendingMembership, expectedVersion: 1, role: 'teacher', idempotencyKey: 'cp3-pending-no-intent' }), 'INTENT_INVALID');
  const pendingRejection = await setupClient.query<{ membership_id: string; actor_person_id: string | null }>(`SELECT membership_id, actor_person_id FROM iam_membership_events WHERE institution_id = $1 AND reason_code = 'INTENT_INVALID' ORDER BY created_at DESC LIMIT 1`, [institutionA]);
  assert.equal(pendingRejection.rows[0].membership_id, pendingMembership, 'Confirmed tenant Membership must be retained in the factual rejection event.');
  assert.equal(pendingRejection.rows[0].actor_person_id, adminPerson, 'A revalidated actor must be attributed in the factual rejection event.');

  const pendingIntentMembership = randomUUID(), pendingIntent = randomUUID();
  await setupClient.query(`INSERT INTO memberships (id, person_id, institution_id, role, status) VALUES ($1, $2, $3, 'student', 'pending')`, [pendingIntentMembership, pendingIntentPerson, institutionA]);
  await setupClient.query(`INSERT INTO iam_access_intents (id, institution_id, kind, status, authorized_person_id, code_hash, code_issued_at, code_expires_at, idempotency_scope, idempotency_key, request_fingerprint) VALUES ($1, $2, 'access_request', 'approved', $3, $4, now(), now() + interval '72 hours', 'intent-scope-pending', 'intent-key-pending', $5)`, [pendingIntent, institutionA, pendingIntentPerson, 'e'.repeat(64), 'f'.repeat(64)]);
  const pendingActivated = await grantInstitutionAccess(commands, { context: adminContext, target: { personId: pendingIntentPerson }, membershipId: pendingIntentMembership, expectedVersion: 1, role: 'teacher', accessIntentId: pendingIntent, idempotencyKey: 'cp3-pending-intent-ok' });
  assert.equal(pendingActivated.status, 'active', 'Pending Membership must activate only with a compatible locked Intent.');

  const invalidIntent = randomUUID();
  await setupClient.query(`INSERT INTO iam_access_intents (id, institution_id, kind, status, authorized_person_id, code_hash, code_issued_at, code_expires_at, idempotency_scope, idempotency_key, request_fingerprint) VALUES ($1, $2, 'institution_invitation', 'pending', $3, $4, now(), now() + interval '72 hours', 'intent-scope-0001', 'intent-key-0001', $5)`, [invalidIntent, institutionA, bootstrapPerson, 'a'.repeat(64), 'b'.repeat(64)]);
  await expectCode(() => grantInstitutionAccess(commands, { context: adminContext, target: { personId: bootstrapPerson }, role: 'teacher', accessIntentId: invalidIntent, idempotencyKey: 'cp3-invalid-intent' }), 'INTENT_INVALID');
  const approvedIntent = randomUUID();
  await setupClient.query(`INSERT INTO iam_access_intents (id, institution_id, kind, status, authorized_person_id, code_hash, code_issued_at, code_expires_at, idempotency_scope, idempotency_key, request_fingerprint) VALUES ($1, $2, 'institution_invitation', 'approved', $3, $4, now(), now() + interval '72 hours', 'intent-scope-0002', 'intent-key-0002', $5)`, [approvedIntent, institutionA, intentPerson, 'c'.repeat(64), 'd'.repeat(64)]);
  const intentGrant = await grantInstitutionAccess(commands, { context: adminContext, target: { personId: intentPerson }, role: 'teacher', accessIntentId: approvedIntent, idempotencyKey: 'cp3-intent-grant' });
  const intentLedger = await setupClient.query<{ access_intent_id: string }>(`SELECT access_intent_id FROM iam_command_ledger WHERE institution_id = $1 AND operation = 'GrantInstitutionAccess' AND idempotency_key = 'cp3-intent-grant'`, [institutionA]);
  assert.equal(intentGrant.resultCode, 'SUCCEEDED'); assert.equal(intentLedger.rows[0].access_intent_id, approvedIntent, 'Successful intent grant must persist the intent in the command ledger.');

  const expiredIntent = randomUUID();
  await setupClient.query(`INSERT INTO iam_access_intents (id, institution_id, kind, status, authorized_person_id, code_hash, code_issued_at, code_expires_at, idempotency_scope, idempotency_key, request_fingerprint) VALUES ($1, $2, 'institution_invitation', 'approved', $3, $4, now() - interval '73 hours', now() - interval '1 hour', 'intent-scope-expired', 'intent-key-expired', $5)`, [expiredIntent, institutionA, expiredIntentPerson, '1'.repeat(64), '2'.repeat(64)]);
  await expectCode(() => grantInstitutionAccess(commands, { context: adminContext, target: { personId: expiredIntentPerson }, role: 'teacher', accessIntentId: expiredIntent, idempotencyKey: 'cp3-expired-intent' }), 'INTENT_INVALID');
  const expiredRejection = await setupClient.query<{ access_intent_id: string }>(`SELECT access_intent_id FROM iam_membership_events WHERE institution_id = $1 AND reason_code = 'INTENT_INVALID' AND access_intent_id = $2`, [institutionA, expiredIntent]);
  assert.equal(expiredRejection.rows[0].access_intent_id, expiredIntent, 'A confirmed but expired Intent must remain factually linked to its rejection event.');

  const consumedIntent = randomUUID();
  await setupClient.query(`INSERT INTO iam_access_intents (id, institution_id, kind, status, authorized_person_id, code_hash, code_issued_at, code_expires_at, consumed_at, idempotency_scope, idempotency_key, request_fingerprint) VALUES ($1, $2, 'institution_invitation', 'consumed', $3, $4, now(), now() + interval '72 hours', now(), 'intent-scope-consumed', 'intent-key-consumed', $5)`, [consumedIntent, institutionA, consumedIntentPerson, '3'.repeat(64), '4'.repeat(64)]);
  await expectCode(() => grantInstitutionAccess(commands, { context: adminContext, target: { personId: consumedIntentPerson }, role: 'teacher', accessIntentId: consumedIntent, idempotencyKey: 'cp3-consumed-intent' }), 'INTENT_INVALID');

  const targetIdentity = randomUUID(), authorizedIdentity = randomUUID(), identityIntent = randomUUID();
  await setupClient.query(`INSERT INTO identities (id, person_id, provider, provider_subject) VALUES ($1, $2, 'firebase', 'identity-target'), ($3, $2, 'legacy', 'identity-authorized')`, [targetIdentity, identityIntentPerson, authorizedIdentity]);
  await setupClient.query(`INSERT INTO iam_access_intents (id, institution_id, kind, status, authorized_identity_id, code_hash, code_issued_at, code_expires_at, idempotency_scope, idempotency_key, request_fingerprint) VALUES ($1, $2, 'institution_invitation', 'approved', $3, $4, now(), now() + interval '72 hours', 'intent-scope-identity', 'intent-key-identity', $5)`, [identityIntent, institutionA, authorizedIdentity, '5'.repeat(64), '6'.repeat(64)]);
  await expectCode(() => grantInstitutionAccess(commands, { context: adminContext, target: { identityId: targetIdentity }, role: 'teacher', accessIntentId: identityIntent, idempotencyKey: 'cp3-identity-intent' }), 'INTENT_INVALID');
  const bootstrapped = await bootstrapInstitutionAdmin(commands, { institutionId: institutionB, target: { personId: bootstrapPerson }, systemScope: 'system:bootstrap:iam-b', idempotencyKey: 'cp3-bootstrap-0001' });
  assert.equal(bootstrapped.role, 'institution_admin');
  await expectCode(() => bootstrapInstitutionAdmin(commands, { institutionId: institutionB, target: { personId: targetPerson }, systemScope: 'system:bootstrap:iam-b', idempotencyKey: 'cp3-bootstrap-0002' }), 'BOOTSTRAP_ALREADY_INITIALIZED');
  await expectCode(() => bootstrapInstitutionAdmin(commands, { institutionId: inactiveInstitution, target: { personId: targetPerson }, systemScope: 'system:bootstrap:inactive', idempotencyKey: 'cp3-bootstrap-inactive' }), 'INSTITUTION_INACTIVE');
  const inactiveRejection = await setupClient.query<{ actor_person_id: string | null }>(`SELECT actor_person_id FROM iam_membership_events WHERE institution_id = $1 AND reason_code = 'INSTITUTION_INACTIVE' ORDER BY created_at DESC LIMIT 1`, [inactiveInstitution]);
  assert.equal(inactiveRejection.rows[0].actor_person_id, null, 'Unverified/system rejection must not attribute a personal actor.');
  await expectCode(() => revokeInstitutionAccess(commands, { context: context(institutionA, adminPerson, randomUUID()), membershipId: grant.membershipId!, expectedVersion: 2, idempotencyKey: 'cp3-unverified-actor' }), 'UNAUTHORIZED');
  const unverifiedActorEvent = await setupClient.query<{ actor_person_id: string | null; reason_code: string }>(`SELECT actor_person_id, reason_code FROM iam_membership_events WHERE institution_id = $1 AND reason_code = 'UNVERIFIED_ACTOR_CONTEXT' ORDER BY created_at DESC LIMIT 1`, [institutionA]);
  assert.equal(unverifiedActorEvent.rows[0].actor_person_id, null, 'Failed actor revalidation must not attribute an unverified person.');
  assert.equal(unverifiedActorEvent.rows[0].reason_code, 'UNVERIFIED_ACTOR_CONTEXT', 'Unverified context rejection must not be indistinguishable from a system action.');

  const adminCMembershipA = randomUUID(), adminCMembershipB = randomUUID();
  await setupClient.query(`INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at) VALUES ($1, $2, $3, 'institution_admin', 'active', now()), ($4, $5, $3, 'institution_admin', 'active', now())`, [adminCMembershipA, adminCPersonA, institutionC, adminCMembershipB, adminCPersonB]);
  const concurrentConnectionIds = new Set<string>();
  const concurrentCommands: IamCommandPool = { connect: async () => { const connection = await servicePool!.connect(); const identity = await connection.query<{ pid: string }>('SELECT pg_backend_pid()::text AS pid'); concurrentConnectionIds.add(identity.rows[0].pid); return connection as unknown as IamTransactionClient; } };
  const concurrent = await Promise.allSettled([
    revokeInstitutionAccess(concurrentCommands, { context: context(institutionC, adminCPersonA, adminCMembershipA), membershipId: adminCMembershipB, expectedVersion: 1, idempotencyKey: 'cp3-concurrent-a' }),
    revokeInstitutionAccess(concurrentCommands, { context: context(institutionC, adminCPersonB, adminCMembershipB), membershipId: adminCMembershipA, expectedVersion: 1, idempotencyKey: 'cp3-concurrent-b' }),
  ]);
  const adminsRemaining = await setupClient.query<{ count: string }>(`SELECT count(*)::text AS count FROM memberships WHERE institution_id = $1 AND role = 'institution_admin' AND status = 'active'`, [institutionC]);
  assert.equal(adminsRemaining.rows[0].count, '1', 'Concurrent lifecycle commands must preserve at least one active institution admin.');
  assert.ok(concurrent.some((result) => result.status === 'fulfilled') && concurrent.some((result) => result.status === 'rejected'), 'One concurrent removal must be rejected after the fixed institution lock serializes lifecycle changes.');
  assert.ok(concurrentConnectionIds.size >= 2, 'Concurrent revocation test must use at least two distinct PostgreSQL connections.');

  const adminDMembershipA = randomUUID(), adminDMembershipB = randomUUID();
  await setupClient.query(`INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at) VALUES ($1, $2, $3, 'institution_admin', 'active', now()), ($4, $5, $3, 'institution_admin', 'active', now())`, [adminDMembershipA, adminDPersonA, institutionD, adminDMembershipB, adminDPersonB]);
  const roleConnections = new Set<string>();
  const roleCommands: IamCommandPool = { connect: async () => { const connection = await servicePool!.connect(); const identity = await connection.query<{ pid: string }>('SELECT pg_backend_pid()::text AS pid'); roleConnections.add(identity.rows[0].pid); return connection as unknown as IamTransactionClient; } };
  const concurrentRoleChanges = await Promise.allSettled([
    changeMembershipRole(roleCommands, { context: context(institutionD, adminDPersonA, adminDMembershipA), membershipId: adminDMembershipB, role: 'director', expectedVersion: 1, idempotencyKey: 'cp3-role-concurrent-a' }),
    changeMembershipRole(roleCommands, { context: context(institutionD, adminDPersonB, adminDMembershipB), membershipId: adminDMembershipA, role: 'director', expectedVersion: 1, idempotencyKey: 'cp3-role-concurrent-b' }),
  ]);
  const roleAdminsRemaining = await setupClient.query<{ count: string }>(`SELECT count(*)::text AS count FROM memberships WHERE institution_id = $1 AND role = 'institution_admin' AND status = 'active'`, [institutionD]);
  assert.equal(roleAdminsRemaining.rows[0].count, '1', 'Concurrent role changes must preserve at least one active institution admin.');
  assert.ok(concurrentRoleChanges.some((result) => result.status === 'fulfilled') && concurrentRoleChanges.some((result) => result.status === 'rejected'), 'One concurrent admin role change must be rejected.');
  assert.ok(roleConnections.size >= 2, 'Concurrent role-change test must use at least two distinct PostgreSQL connections.');
  const events = await setupClient.query<{ result: string }>(`SELECT result FROM iam_membership_events WHERE institution_id = $1` , [institutionA]);
  assert.ok(events.rows.some((row) => row.result === 'succeeded')); assert.ok(events.rows.some((row) => row.result === 'rejected' || row.result === 'conflict'));
  console.log('IAM command PostgreSQL tests passed.');
} finally {
  if (servicePool) await servicePool.end();
  if (setupClient) { await setupClient.query('RESET search_path').catch(() => undefined); await setupClient.query(`DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE`).catch(() => undefined); setupClient.release(); }
  await setupPool.end();
}
