import crypto from 'node:crypto';
import { INSTITUTIONAL_ROLES, type InstitutionalRole } from '../../auth/institutional-context.ts';
import { IamCommandError, type IamCommandResult, type IamResultCode } from './iam-command-types.ts';

type JsonRecord = Record<string, unknown>;
export type IamPublicError = { status: number; error: string };
export type IamRequestMetadata = { requestId: string; correlationId?: string };

export class IamHttpAdapterError extends Error {
  constructor(message = 'Pedido IAM inválido.') { super(message); this.name = 'IamHttpAdapterError'; }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const opaque = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/;
const forbiddenAuthorityFields = new Set([
  'institutionId', 'institution_id', 'actorPersonId', 'actor_person_id', 'dbRole', 'usersRole', 'users_role',
  'firebaseUid', 'firebase_uid', 'uid', 'status', 'approved', 'approvedAt', 'approved_at', 'approval',
]);

function record(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new IamHttpAdapterError();
  return value as JsonRecord;
}
function exactKeys(value: JsonRecord, allowed: readonly string[]): void {
  for (const key of Object.keys(value)) {
    if (forbiddenAuthorityFields.has(key) || !allowed.includes(key)) throw new IamHttpAdapterError();
  }
}
function requiredUuid(value: unknown): string {
  if (typeof value !== 'string' || !uuid.test(value)) throw new IamHttpAdapterError();
  return value;
}
function optionalUuid(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return requiredUuid(value);
}
function role(value: unknown): InstitutionalRole {
  if (typeof value !== 'string' || !(INSTITUTIONAL_ROLES as readonly string[]).includes(value)) throw new IamHttpAdapterError();
  return value as InstitutionalRole;
}
function idempotencyKey(value: unknown): string {
  if (typeof value !== 'string') throw new IamHttpAdapterError();
  const key = value.trim();
  if (!opaque.test(key)) throw new IamHttpAdapterError();
  return key;
}
function expectedVersion(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1) throw new IamHttpAdapterError();
  return value as number;
}
function target(value: unknown): { personId?: string; identityId?: string } {
  const input = record(value); exactKeys(input, ['personId', 'identityId']);
  const personId = optionalUuid(input.personId); const identityId = optionalUuid(input.identityId);
  if (Number(Boolean(personId)) + Number(Boolean(identityId)) !== 1) throw new IamHttpAdapterError();
  return { personId, identityId };
}

export function parseGrantBody(value: unknown) {
  const input = record(value); exactKeys(input, ['target', 'role', 'idempotencyKey', 'accessIntentId', 'membershipId', 'expectedVersion']);
  const membershipId = optionalUuid(input.membershipId);
  const version = input.expectedVersion === undefined ? undefined : expectedVersion(input.expectedVersion);
  if (membershipId && version === undefined) throw new IamHttpAdapterError();
  if (!membershipId && version !== undefined) throw new IamHttpAdapterError();
  return { target: target(input.target), role: role(input.role), idempotencyKey: idempotencyKey(input.idempotencyKey), accessIntentId: optionalUuid(input.accessIntentId), membershipId, expectedVersion: version };
}
export function parseChangeRoleBody(value: unknown) {
  const input = record(value); exactKeys(input, ['role', 'expectedVersion', 'idempotencyKey']);
  return { role: role(input.role), expectedVersion: expectedVersion(input.expectedVersion), idempotencyKey: idempotencyKey(input.idempotencyKey) };
}
export function parseRevokeBody(value: unknown) {
  const input = record(value); exactKeys(input, ['expectedVersion', 'idempotencyKey']);
  return { expectedVersion: expectedVersion(input.expectedVersion), idempotencyKey: idempotencyKey(input.idempotencyKey) };
}
export function parseMembershipId(value: unknown): string { return requiredUuid(value); }
function opaqueHeader(value: string | string[] | undefined, required: boolean): string | undefined {
  if (value === undefined) return required ? crypto.randomUUID() : undefined;
  if (typeof value !== 'string' || !opaque.test(value)) throw new IamHttpAdapterError();
  return value;
}
export function parseRequestMetadata(headers: Record<string, string | string[] | undefined>): IamRequestMetadata {
  return { requestId: opaqueHeader(headers['x-request-id'], true)!, correlationId: opaqueHeader(headers['x-correlation-id'], false) };
}

export function publicResult(result: IamCommandResult) {
  if (!result.membershipId || !result.status || !result.role || result.version === null) throw new Error('IAM result has no public membership representation.');
  return { membership: { id: result.membershipId, status: result.status, role: result.role, version: result.version }, replayed: result.replayed };
}

const conflictCodes = new Set<IamResultCode>([
  'VERSION_CONFLICT', 'LAST_ADMIN_PROTECTED', 'INTENT_INVALID', 'MEMBERSHIP_REVOKED', 'MEMBERSHIP_SUSPENDED',
  'MEMBERSHIP_STATE_INVALID', 'HISTORICAL_ROLE_CONFLICT', 'IDEMPOTENCY_KEY_REUSED', 'IDENTITY_PERSON_AMBIGUOUS',
  'INSTITUTION_INACTIVE', 'BOOTSTRAP_ALREADY_INITIALIZED',
]);
export function publicError(error: unknown): IamPublicError {
  if (error instanceof IamHttpAdapterError) return { status: 400, error: 'Pedido IAM inválido.' };
  if (error instanceof IamCommandError) {
    if (error.code === 'UNAUTHORIZED') return { status: 403, error: 'Operação institucional não autorizada.' };
    if (error.code === 'MEMBERSHIP_NOT_FOUND' || error.code === 'IDENTITY_PERSON_UNRESOLVED') return { status: 404, error: 'Recurso institucional não encontrado.' };
    if (conflictCodes.has(error.code)) return { status: 409, error: 'Conflito de estado do acesso institucional.' };
  }
  return { status: 500, error: 'Não foi possível concluir a operação IAM.' };
}
