import type { InstitutionalRole } from '../../auth/institutional-context.ts';
import type { IamTransactionClient, MembershipStatus } from './iam-command-types.ts';

export interface MembershipRow { id: string; person_id: string; institution_id: string; role: InstitutionalRole; status: MembershipStatus; version: number; }
export interface IntentRow { id: string; authorized_person_id: string | null; authorized_identity_id: string | null; status: string; code_expires_at: string; consumed_at: string | null; }

/** First lock for every IAM command: serializes lifecycle decisions per active institution. */
export async function lockActiveInstitution(client: IamTransactionClient, institutionId: string): Promise<void> {
  const result = await client.query<{ id: string }>(`SELECT id FROM institutions WHERE id = $1 AND status = 'active' FOR UPDATE`, [institutionId]);
  if (!result.rows[0]) throw new Error('INSTITUTION_INACTIVE');
}

export async function lockMembership(client: IamTransactionClient, institutionId: string, membershipId: string): Promise<MembershipRow | null> {
  const result = await client.query<MembershipRow>(`SELECT id, person_id, institution_id, role, status, version FROM memberships WHERE id = $1 AND institution_id = $2 FOR UPDATE`, [membershipId, institutionId]);
  return result.rows[0] ?? null;
}
export async function resolveTargetPerson(client: IamTransactionClient, target: { personId?: string; identityId?: string }): Promise<string> {
  if (target.personId) {
    const result = await client.query<{ id: string }>('SELECT id FROM people WHERE id = $1 FOR UPDATE', [target.personId]);
    if (result.rows.length !== 1) throw new Error('IDENTITY_PERSON_UNRESOLVED');
    return result.rows[0].id;
  }
  const result = await client.query<{ person_id: string }>('SELECT person_id FROM identities WHERE id = $1 FOR UPDATE', [target.identityId]);
  if (result.rows.length !== 1) throw new Error('IDENTITY_PERSON_UNRESOLVED');
  return result.rows[0].person_id;
}
export async function lockMembershipForPerson(client: IamTransactionClient, institutionId: string, personId: string): Promise<MembershipRow | null> {
  const result = await client.query<MembershipRow>(`SELECT id, person_id, institution_id, role, status, version FROM memberships WHERE institution_id = $1 AND person_id = $2 ORDER BY created_at DESC FOR UPDATE`, [institutionId, personId]);
  // Historical revocations are deliberately preserved. More than one row is only
  // ambiguous if one remains non-terminal; a fully revoked history cannot grant access.
  if (result.rows.length > 1 && result.rows.some((membership) => membership.status !== 'revoked')) throw new Error('IDENTITY_PERSON_AMBIGUOUS');
  return result.rows[0] ?? null;
}
export async function lockIntent(client: IamTransactionClient, institutionId: string, intentId: string): Promise<IntentRow | null> {
  const result = await client.query<IntentRow>(`SELECT id, authorized_person_id, authorized_identity_id, status, code_expires_at, consumed_at FROM iam_access_intents WHERE id = $1 AND institution_id = $2 FOR UPDATE`, [intentId, institutionId]);
  return result.rows[0] ?? null;
}
export async function lockActiveAdmins(client: IamTransactionClient, institutionId: string): Promise<MembershipRow[]> {
  const result = await client.query<MembershipRow>(`SELECT id, person_id, institution_id, role, status, version FROM memberships WHERE institution_id = $1 AND status = 'active' AND role = 'institution_admin' ORDER BY id FOR UPDATE`, [institutionId]);
  return result.rows;
}
