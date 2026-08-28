import type { IamEventAction, IamTransactionClient, MembershipStatus } from './iam-command-types.ts';

export interface IamAuditEvent {
  institutionId: string; membershipId?: string | null; accessIntentId?: string | null;
  actor: { type: 'person'; personId: string } | { type: 'system' };
  action: IamEventAction; previousStatus?: MembershipStatus | null; newStatus?: MembershipStatus | null;
  result: 'succeeded' | 'rejected' | 'conflict'; reasonCode?: string | null; requestId?: string; correlationId?: string;
}

/** Only factual identifiers and allowlisted reason codes are persisted; callers must never pass codes, hashes or PII. */
export async function recordIamEvent(client: IamTransactionClient, event: IamAuditEvent): Promise<void> {
  await client.query(
    `INSERT INTO iam_membership_events (
       institution_id, membership_id, access_intent_id, actor_type, actor_person_id, action,
       previous_status, new_status, result, reason_code, request_id, correlation_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [event.institutionId, event.membershipId ?? null, event.accessIntentId ?? null, event.actor.type,
      event.actor.type === 'person' ? event.actor.personId : null, event.action, event.previousStatus ?? null,
      event.newStatus ?? null, event.result, event.reasonCode ?? null, event.requestId ?? null, event.correlationId ?? null],
  );
}
