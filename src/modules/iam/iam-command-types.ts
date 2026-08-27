import type { InstitutionalContext, InstitutionalRole } from '../../auth/institutional-context.ts';

export type MembershipStatus = 'pending' | 'active' | 'suspended' | 'revoked';
export type IamOperation = 'GrantInstitutionAccess' | 'ChangeMembershipRole' | 'RevokeInstitutionAccess' | 'BootstrapInstitutionAdmin';
export type IamResultCode = 'SUCCEEDED' | 'ALREADY_ACTIVE' | 'MEMBERSHIP_NOT_FOUND' | 'MEMBERSHIP_REVOKED' | 'MEMBERSHIP_SUSPENDED' | 'MEMBERSHIP_STATE_INVALID' | 'IDENTITY_PERSON_UNRESOLVED' | 'IDENTITY_PERSON_AMBIGUOUS' | 'INTENT_INVALID' | 'VERSION_CONFLICT' | 'LAST_ADMIN_PROTECTED' | 'HISTORICAL_ROLE_CONFLICT' | 'UNAUTHORIZED' | 'IDEMPOTENCY_KEY_REUSED' | 'BOOTSTRAP_ALREADY_INITIALIZED' | 'INSTITUTION_INACTIVE';
export type IamEventAction = 'IAM_MEMBERSHIP_ACTIVATED' | 'IAM_MEMBERSHIP_ROLE_CHANGED' | 'IAM_MEMBERSHIP_REVOKED' | 'IAM_INSTITUTION_ADMIN_BOOTSTRAPPED';

export interface IamTransactionClient {
  query<T = any>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
  release(): void;
}

export interface IamCommandPool { connect(): Promise<IamTransactionClient>; }

export interface IamRequestMetadata { requestId?: string; correlationId?: string; }
export interface IamActorContext { context: InstitutionalContext; }
export interface IamTarget { personId?: string; identityId?: string; }
export interface IamCommandResult {
  membershipId: string | null;
  status: MembershipStatus | null;
  role: InstitutionalRole | null;
  version: number | null;
  resultCode: IamResultCode;
  replayed: boolean;
}

export interface GrantInstitutionAccessInput extends IamActorContext, IamRequestMetadata {
  target: IamTarget;
  role: InstitutionalRole;
  idempotencyKey: string;
  accessIntentId?: string;
  membershipId?: string;
  expectedVersion?: number;
}
export interface ChangeMembershipRoleInput extends IamActorContext, IamRequestMetadata {
  membershipId: string; role: InstitutionalRole; expectedVersion: number; idempotencyKey: string;
}
export interface RevokeInstitutionAccessInput extends IamActorContext, IamRequestMetadata {
  membershipId: string; expectedVersion: number; idempotencyKey: string;
}
export interface BootstrapInstitutionAdminInput extends IamRequestMetadata {
  institutionId: string; target: IamTarget; idempotencyKey: string; systemScope: string;
}

export class IamCommandError extends Error {
  constructor(public readonly code: IamResultCode, message = 'IAM command was rejected.') { super(message); this.name = 'IamCommandError'; }
}
