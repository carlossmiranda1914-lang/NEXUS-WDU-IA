import crypto from 'node:crypto';
import { INSTITUTIONAL_ROLES, type InstitutionalRole } from '../../auth/institutional-context.ts';
import type { IamOperation, IamResultCode, MembershipStatus } from './iam-command-types.ts';

export const IAM_ADMIN_ROLE: InstitutionalRole = 'institution_admin';
export const IAM_ACTIVATABLE_PENDING_INTENT_STATES = new Set(['approved', 'accepted']);

export function requireInstitutionAdmin(role: InstitutionalRole): void {
  if (role !== IAM_ADMIN_ROLE) throw new Error('UNAUTHORIZED');
}
export function validateIdempotencyKey(value: string): string {
  const key = value.trim();
  if (key.length < 8 || key.length > 160) throw new Error('INVALID_IDEMPOTENCY_KEY');
  return key;
}
export function validateExpectedVersion(value: number): number {
  if (!Number.isInteger(value) || value < 1) throw new Error('VERSION_CONFLICT');
  return value;
}
export function validateRole(value: string): InstitutionalRole {
  if (!(INSTITUTIONAL_ROLES as readonly string[]).includes(value)) throw new Error('INVALID_ROLE');
  return value as InstitutionalRole;
}
export function validateExactlyOneTarget(target: { personId?: string; identityId?: string }): void {
  if (Number(Boolean(target.personId)) + Number(Boolean(target.identityId)) !== 1) throw new Error('IDENTITY_PERSON_UNRESOLVED');
}
export function commandFingerprint(operation: IamOperation, body: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify({ operation, body })).digest('hex');
}
export function grantDecision(status: MembershipStatus | null): IamResultCode {
  if (status === null) return 'SUCCEEDED';
  if (status === 'pending') return 'SUCCEEDED';
  if (status === 'active') return 'ALREADY_ACTIVE';
  if (status === 'revoked') return 'MEMBERSHIP_REVOKED';
  return 'MEMBERSHIP_SUSPENDED';
}
export function safeRejectionCode(error: unknown): IamResultCode {
  if (error instanceof Error && error.message === 'UNAUTHORIZED') return 'UNAUTHORIZED';
  if (error instanceof Error && error.message === 'VERSION_CONFLICT') return 'VERSION_CONFLICT';
  if (error instanceof Error && error.message === 'INVALID_IDEMPOTENCY_KEY') return 'IDEMPOTENCY_KEY_REUSED';
  if (error instanceof Error && error.message === 'INVALID_ROLE') return 'MEMBERSHIP_STATE_INVALID';
  if (error instanceof Error && error.message === 'IDENTITY_PERSON_UNRESOLVED') return 'IDENTITY_PERSON_UNRESOLVED';
  if (error instanceof Error && error.message === 'IDENTITY_PERSON_AMBIGUOUS') return 'IDENTITY_PERSON_AMBIGUOUS';
  if (error instanceof Error && error.message === 'LAST_ADMIN_PROTECTED') return 'LAST_ADMIN_PROTECTED';
  if (error instanceof Error && error.message === 'HISTORICAL_ROLE_CONFLICT') return 'HISTORICAL_ROLE_CONFLICT';
  if (error instanceof Error && error.message === 'INTENT_INVALID') return 'INTENT_INVALID';
  if (error instanceof Error && error.message === 'INSTITUTION_INACTIVE') return 'INSTITUTION_INACTIVE';
  return 'MEMBERSHIP_STATE_INVALID';
}
