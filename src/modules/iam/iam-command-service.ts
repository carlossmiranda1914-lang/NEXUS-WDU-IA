import type { InstitutionalRole } from '../../auth/institutional-context.ts';
import { recordIamEvent } from './iam-audit.ts';
import { commandFingerprint, grantDecision, IAM_ACTIVATABLE_PENDING_INTENT_STATES, requireInstitutionAdmin, safeRejectionCode, validateExactlyOneTarget, validateExpectedVersion, validateIdempotencyKey, validateRole } from './iam-policy.ts';
import { lockActiveAdmins, lockActiveInstitution, lockIntent, lockMembership, lockMembershipForPerson, resolvePendingGrantContext, resolveTargetPerson, type MembershipRow } from './iam-command-repository.ts';
import type { BootstrapInstitutionAdminInput, ChangeMembershipRoleInput, GrantInstitutionAccessInput, IamCommandError, IamCommandPool, IamCommandResult, IamEventAction, IamOperation, IamResultCode, IamTransactionClient, RevokeInstitutionAccessInput } from './iam-command-types.ts';
import { IamCommandError as CommandError } from './iam-command-types.ts';

type Base = { institutionId: string; actorScope: string; actorPersonId: string | null; actorMembershipId: string | null; idempotencyKey: string; requestId?: string; correlationId?: string };
type LedgerRow = { request_fingerprint: string; result_code: IamResultCode; membership_id: string | null; };
type RejectionFacts = { actorValidated: boolean; membershipId?: string; accessIntentId?: string };
type WorkResult = IamCommandResult & { accessIntentId?: string };

function asResult(row: MembershipRow | null, resultCode: IamResultCode, replayed: boolean): IamCommandResult {
  return { membershipId: row?.id ?? null, status: row?.status ?? null, role: row?.role ?? null, version: row?.version ?? null, resultCode, replayed };
}
function normalizeError(error: unknown): CommandError {
  if (error instanceof CommandError) return error;
  const anyError = error as { code?: string };
  if (anyError?.code === '23505') return new CommandError('HISTORICAL_ROLE_CONFLICT');
  return new CommandError(safeRejectionCode(error));
}
async function replayOrReserve(client: IamTransactionClient, base: Base, operation: IamOperation, fingerprint: string): Promise<IamCommandResult | null> {
  const existing = await client.query<LedgerRow>(`SELECT request_fingerprint, result_code, membership_id FROM iam_command_ledger WHERE institution_id = $1 AND operation = $2 AND actor_scope = $3 AND idempotency_key = $4 FOR UPDATE`, [base.institutionId, operation, base.actorScope, base.idempotencyKey]);
  if (existing.rows[0]) {
    if (existing.rows[0].request_fingerprint !== fingerprint) throw new CommandError('IDEMPOTENCY_KEY_REUSED');
    const membership = existing.rows[0].membership_id ? await lockMembership(client, base.institutionId, existing.rows[0].membership_id) : null;
    return asResult(membership, existing.rows[0].result_code, true);
  }
  await client.query(`INSERT INTO iam_command_ledger (institution_id, operation, actor_scope, actor_person_id, idempotency_key, request_fingerprint, status) VALUES ($1, $2, $3, $4, $5, $6, 'pending')`, [base.institutionId, operation, base.actorScope, base.actorPersonId, base.idempotencyKey, fingerprint]);
  return null;
}
async function complete(client: IamTransactionClient, base: Base, operation: IamOperation, membership: MembershipRow | null, intentId: string | undefined, result: IamResultCode): Promise<void> {
  await client.query(`UPDATE iam_command_ledger SET status = 'completed', result_code = $1, membership_id = $2, access_intent_id = $3, updated_at = now() WHERE institution_id = $4 AND operation = $5 AND actor_scope = $6 AND idempotency_key = $7`, [result, membership?.id ?? null, intentId ?? null, base.institutionId, operation, base.actorScope, base.idempotencyKey]);
}
async function revalidateActor(client: IamTransactionClient, base: Base): Promise<void> {
  if (!base.actorPersonId) return;
  const actor = await client.query(
    `SELECT m.id
       FROM memberships m
       INNER JOIN institutions i ON i.id = m.institution_id
      WHERE m.id = $1 AND m.person_id = $2 AND m.institution_id = $3
        AND m.status = 'active' AND m.role = 'institution_admin' AND i.status = 'active'
      FOR UPDATE OF m, i`,
    [base.actorMembershipId, base.actorPersonId, base.institutionId],
  );
  if (!actor.rows[0]) throw new CommandError('UNAUTHORIZED');
}
async function recordRejected(pool: IamCommandPool, base: Base, operation: IamOperation, fingerprint: string, action: IamEventAction, error: CommandError, facts: RejectionFacts): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reserved = await client.query<{ id: string }>(
      `INSERT INTO iam_command_ledger (institution_id, operation, actor_scope, actor_person_id, idempotency_key, request_fingerprint, status, result_code, membership_id, access_intent_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, $8, $9)
       ON CONFLICT (institution_id, operation, actor_scope, idempotency_key) DO NOTHING
       RETURNING id`,
      [base.institutionId, operation, base.actorScope, facts.actorValidated ? base.actorPersonId : null, base.idempotencyKey, fingerprint, error.code, facts.membershipId ?? null, facts.accessIntentId ?? null],
    );
    // A duplicate/mismatched idempotency key must not multiply factual rejection events.
    if (reserved.rows[0]) {
      await recordIamEvent(client, {
        institutionId: base.institutionId,
        membershipId: facts.membershipId,
        accessIntentId: facts.accessIntentId,
        actor: facts.actorValidated && base.actorPersonId ? { type: 'person', personId: base.actorPersonId } : { type: 'system' },
        action, result: error.code === 'VERSION_CONFLICT' ? 'conflict' : 'rejected',
        // The schema has only person/system actor types. This reason explicitly
        // distinguishes an unverified context rejection from an automated action.
        reasonCode: !facts.actorValidated && error.code === 'UNAUTHORIZED' ? 'UNVERIFIED_ACTOR_CONTEXT' : error.code,
        requestId: base.requestId, correlationId: base.correlationId,
      });
    }
    await client.query('COMMIT');
  }
  catch { await client.query('ROLLBACK'); }
  finally { client.release(); }
}
async function execute(pool: IamCommandPool, base: Base, operation: IamOperation, action: IamEventAction, fingerprintBody: unknown, work: (client: IamTransactionClient, facts: RejectionFacts) => Promise<WorkResult>): Promise<IamCommandResult> {
  const client = await pool.connect(); const fingerprint = commandFingerprint(operation, fingerprintBody);
  const facts: RejectionFacts = { actorValidated: false };
  try {
    await client.query('BEGIN');
    // This fixed per-institution lock is deliberately acquired before ledger, actor,
    // target and administrator locks, preventing divergent lifecycle lock orders.
    await lockActiveInstitution(client, base.institutionId);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [base.institutionId, `${operation}:${base.actorScope}:${base.idempotencyKey}`]);
    // Human authority is current-state authority, including idempotent retries.
    // Bootstrap has no human actor and therefore intentionally bypasses this check.
    await revalidateActor(client, base); facts.actorValidated = Boolean(base.actorPersonId);
    const replay = await replayOrReserve(client, base, operation, fingerprint);
    if (replay) { await client.query('COMMIT'); return replay; }
    const result = await work(client, facts);
    await complete(client, base, operation, result.membershipId ? { id: result.membershipId, person_id: '', institution_id: base.institutionId, role: result.role!, status: result.status!, version: result.version! } : null, result.accessIntentId, result.resultCode);
    await client.query('COMMIT'); return result;
  } catch (error) {
    await client.query('ROLLBACK'); const normalized = normalizeError(error); await recordRejected(pool, base, operation, fingerprint, action, normalized, facts); throw normalized;
  } finally { client.release(); }
}
function adminBase(input: { context: { institutionId: string; personId: string; membershipId: string; role: InstitutionalRole }; idempotencyKey: string; requestId?: string; correlationId?: string }): Base {
  try {
    requireInstitutionAdmin(input.context.role);
    return { institutionId: input.context.institutionId, actorScope: `person:${input.context.personId}`, actorPersonId: input.context.personId, actorMembershipId: input.context.membershipId, idempotencyKey: validateIdempotencyKey(input.idempotencyKey), requestId: input.requestId, correlationId: input.correlationId };
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function grantInstitutionAccess(pool: IamCommandPool, input: GrantInstitutionAccessInput): Promise<IamCommandResult> {
  validateExactlyOneTarget(input.target); validateRole(input.role); if (input.membershipId && input.expectedVersion === undefined) throw new CommandError('VERSION_CONFLICT');
  const base = adminBase(input);
  return execute(pool, base, 'GrantInstitutionAccess', 'IAM_MEMBERSHIP_ACTIVATED', { target: input.target, role: input.role, membershipId: input.membershipId ?? null, expectedVersion: input.expectedVersion ?? null, accessIntentId: input.accessIntentId ?? null }, async (client, facts) => {
    const personId = await resolveTargetPerson(client, input.target);
    let membership = await lockMembershipForPerson(client, base.institutionId, personId);
    if (membership) facts.membershipId = membership.id;
    if (input.membershipId && (!membership || membership.id !== input.membershipId)) throw new CommandError('MEMBERSHIP_NOT_FOUND');
    const decision = grantDecision(membership?.status ?? null);
    if (decision === 'ALREADY_ACTIVE') { if (membership!.role !== input.role) throw new CommandError('MEMBERSHIP_STATE_INVALID'); return asResult(membership, 'ALREADY_ACTIVE', false); }
    if (decision !== 'SUCCEEDED') throw new CommandError(decision);
    if (membership?.status === 'pending' && !input.accessIntentId) throw new CommandError('INTENT_INVALID');
    if (input.accessIntentId) {
      const intent = await lockIntent(client, base.institutionId, input.accessIntentId);
      if (intent) facts.accessIntentId = intent.id;
      if (!intent || !IAM_ACTIVATABLE_PENDING_INTENT_STATES.has(intent.status)
        || (intent.authorized_person_id && intent.authorized_person_id !== personId)
        || (intent.authorized_identity_id && input.target.identityId !== intent.authorized_identity_id)
        || intent.consumed_at !== null || new Date(intent.code_expires_at).getTime() <= Date.now()) throw new CommandError('INTENT_INVALID');
    }
    if (membership) {
      if (membership.status !== 'pending' || membership.version !== validateExpectedVersion(input.expectedVersion!)) throw new CommandError('VERSION_CONFLICT');
      const updated = await client.query<MembershipRow>(`UPDATE memberships SET role = $1, status = 'active', approved_by = $2, approved_at = now(), version = version + 1, updated_at = now() WHERE id = $3 AND institution_id = $4 AND status = 'pending' AND version = $5 RETURNING id, person_id, institution_id, role, status, version`, [input.role, base.actorPersonId, membership.id, base.institutionId, input.expectedVersion]);
      if (!updated.rows[0]) throw new CommandError('VERSION_CONFLICT'); membership = updated.rows[0];
    } else {
      const created = await client.query<MembershipRow>(`INSERT INTO memberships (person_id, institution_id, role, status, approved_by, approved_at) VALUES ($1, $2, $3, 'active', $4, now()) RETURNING id, person_id, institution_id, role, status, version`, [personId, base.institutionId, input.role, base.actorPersonId]); membership = created.rows[0];
    }
    if (input.accessIntentId) await client.query(`UPDATE iam_access_intents SET status = 'consumed', consumed_at = now(), updated_at = now(), version = version + 1 WHERE id = $1 AND institution_id = $2`, [input.accessIntentId, base.institutionId]);
    await recordIamEvent(client, { institutionId: base.institutionId, membershipId: membership.id, accessIntentId: input.accessIntentId, actor: { type: 'person', personId: base.actorPersonId! }, action: 'IAM_MEMBERSHIP_ACTIVATED', previousStatus: membership.status === 'active' ? (input.membershipId ? 'pending' : null) : membership.status, newStatus: 'active', result: 'succeeded', requestId: input.requestId, correlationId: input.correlationId });
    return { ...asResult(membership, 'SUCCEEDED', false), accessIntentId: input.accessIntentId };
  });
}

export type ActivatePendingInstitutionAccessInput = Pick<GrantInstitutionAccessInput, 'context' | 'role' | 'expectedVersion' | 'idempotencyKey' | 'requestId' | 'correlationId'> & { pendingMembershipId: string };
export async function activatePendingInstitutionAccess(pool: IamCommandPool, input: ActivatePendingInstitutionAccessInput): Promise<IamCommandResult> {
  try { requireInstitutionAdmin(input.context.role); validateExpectedVersion(input.expectedVersion); }
  catch (error) { throw normalizeError(error); }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockActiveInstitution(client, input.context.institutionId);
    const resolved = await resolvePendingGrantContext(client, input.context.institutionId, input.pendingMembershipId, input.expectedVersion);
    await client.query('COMMIT');
    return await grantInstitutionAccess(pool, {
      context: input.context,
      target: resolved.target,
      membershipId: resolved.membershipId,
      accessIntentId: resolved.accessIntentId,
      role: input.role,
      expectedVersion: input.expectedVersion,
      idempotencyKey: input.idempotencyKey,
      requestId: input.requestId,
      correlationId: input.correlationId,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw normalizeError(error);
  } finally { client.release(); }
}

export async function changeMembershipRole(pool: IamCommandPool, input: ChangeMembershipRoleInput): Promise<IamCommandResult> {
  const base = adminBase(input); validateRole(input.role); validateExpectedVersion(input.expectedVersion);
  return execute(pool, base, 'ChangeMembershipRole', 'IAM_MEMBERSHIP_ROLE_CHANGED', { membershipId: input.membershipId, role: input.role, expectedVersion: input.expectedVersion }, async (client, facts) => {
    const membership = await lockMembership(client, base.institutionId, input.membershipId); if (!membership) throw new CommandError('MEMBERSHIP_NOT_FOUND'); facts.membershipId = membership.id; if (membership.status !== 'active') throw new CommandError('MEMBERSHIP_STATE_INVALID'); if (membership.version !== input.expectedVersion) throw new CommandError('VERSION_CONFLICT');
    const admins = await lockActiveAdmins(client, base.institutionId); if (membership.role === 'institution_admin' && input.role !== 'institution_admin' && admins.length <= 1) throw new CommandError('LAST_ADMIN_PROTECTED');
    const updated = await client.query<MembershipRow>(`UPDATE memberships SET role = $1, version = version + 1, updated_at = now() WHERE id = $2 AND institution_id = $3 AND status = 'active' AND version = $4 RETURNING id, person_id, institution_id, role, status, version`, [input.role, membership.id, base.institutionId, input.expectedVersion]); if (!updated.rows[0]) throw new CommandError('VERSION_CONFLICT');
    await recordIamEvent(client, { institutionId: base.institutionId, membershipId: membership.id, actor: { type: 'person', personId: base.actorPersonId! }, action: 'IAM_MEMBERSHIP_ROLE_CHANGED', previousStatus: 'active', newStatus: 'active', result: 'succeeded', requestId: input.requestId, correlationId: input.correlationId }); return asResult(updated.rows[0], 'SUCCEEDED', false);
  });
}

export async function revokeInstitutionAccess(pool: IamCommandPool, input: RevokeInstitutionAccessInput): Promise<IamCommandResult> {
  const base = adminBase(input); validateExpectedVersion(input.expectedVersion);
  return execute(pool, base, 'RevokeInstitutionAccess', 'IAM_MEMBERSHIP_REVOKED', { membershipId: input.membershipId, expectedVersion: input.expectedVersion }, async (client, facts) => {
    const membership = await lockMembership(client, base.institutionId, input.membershipId); if (!membership) throw new CommandError('MEMBERSHIP_NOT_FOUND'); facts.membershipId = membership.id; if (membership.status === 'revoked') return asResult(membership, 'SUCCEEDED', false); if (membership.version !== input.expectedVersion) throw new CommandError('VERSION_CONFLICT');
    const admins = membership.status === 'active' && membership.role === 'institution_admin' ? await lockActiveAdmins(client, base.institutionId) : []; if (admins.length === 1 && admins[0].id === membership.id) throw new CommandError('LAST_ADMIN_PROTECTED');
    const updated = await client.query<MembershipRow>(`UPDATE memberships SET status = 'revoked', revoked_at = now(), version = version + 1, updated_at = now() WHERE id = $1 AND institution_id = $2 AND version = $3 RETURNING id, person_id, institution_id, role, status, version`, [membership.id, base.institutionId, input.expectedVersion]); if (!updated.rows[0]) throw new CommandError('VERSION_CONFLICT');
    await recordIamEvent(client, { institutionId: base.institutionId, membershipId: membership.id, actor: { type: 'person', personId: base.actorPersonId! }, action: 'IAM_MEMBERSHIP_REVOKED', previousStatus: membership.status, newStatus: 'revoked', result: 'succeeded', requestId: input.requestId, correlationId: input.correlationId }); return asResult(updated.rows[0], 'SUCCEEDED', false);
  });
}

export async function bootstrapInstitutionAdmin(pool: IamCommandPool, input: BootstrapInstitutionAdminInput): Promise<IamCommandResult> {
  validateExactlyOneTarget(input.target); const base: Base = { institutionId: input.institutionId, actorScope: input.systemScope, actorPersonId: null, actorMembershipId: null, idempotencyKey: validateIdempotencyKey(input.idempotencyKey), requestId: input.requestId, correlationId: input.correlationId };
  return execute(pool, base, 'BootstrapInstitutionAdmin', 'IAM_INSTITUTION_ADMIN_BOOTSTRAPPED', { target: input.target }, async (client, facts) => {
    const personId = await resolveTargetPerson(client, input.target); const admins = await lockActiveAdmins(client, base.institutionId); if (admins.length) throw new CommandError('BOOTSTRAP_ALREADY_INITIALIZED'); const existing = await lockMembershipForPerson(client, base.institutionId, personId); if (existing) { facts.membershipId = existing.id; throw new CommandError(existing.status === 'revoked' ? 'MEMBERSHIP_REVOKED' : 'MEMBERSHIP_STATE_INVALID'); }
    const created = await client.query<MembershipRow>(`INSERT INTO memberships (person_id, institution_id, role, status, approved_at) VALUES ($1, $2, 'institution_admin', 'active', now()) RETURNING id, person_id, institution_id, role, status, version`, [personId, base.institutionId]); const membership = created.rows[0];
    await recordIamEvent(client, { institutionId: base.institutionId, membershipId: membership.id, actor: { type: 'system' }, action: 'IAM_INSTITUTION_ADMIN_BOOTSTRAPPED', newStatus: 'active', result: 'succeeded', requestId: input.requestId, correlationId: input.correlationId }); return asResult(membership, 'SUCCEEDED', false);
  });
}
