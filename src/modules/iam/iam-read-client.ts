export const INSTITUTIONAL_ROLES = [
  'institution_admin',
  'director',
  'secretariat',
  'financial',
  'teacher',
  'student',
  'parent',
] as const;

export type InstitutionalRole = (typeof INSTITUTIONAL_ROLES)[number];
export type MembershipReadStatus = 'pending' | 'active' | 'suspended' | 'revoked';
export type MembershipListQuery = {
  status?: MembershipReadStatus;
  role?: InstitutionalRole;
  cursor?: string;
  limit?: number;
};
export type IamMembership = {
  id: string;
  person: { displayName: string };
  role: InstitutionalRole;
  status: MembershipReadStatus;
  version: number;
};
export type IamMembershipListResponse = {
  memberships: IamMembership[];
  page: { nextCursor: string | null };
  summary: { activeInstitutionAdminCount: number };
};
export type IamMembershipMutationInput = { expectedVersion: number; idempotencyKey: string };
export type IamMembershipRoleChangeInput = IamMembershipMutationInput & { role: InstitutionalRole };
export type IamMembershipMutationResponse = { membership: Pick<IamMembership, 'id' | 'role' | 'status' | 'version'>; replayed: boolean };
export type IamMembershipMutationErrorCode = 'UNAUTHORIZED' | 'MEMBERSHIP_NOT_FOUND' | 'MEMBERSHIP_STATE_INVALID' | 'VERSION_CONFLICT' | 'LAST_ADMIN_PROTECTED' | 'INTENT_INVALID';

export class IamMembershipReadError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'IamMembershipReadError';
  }
}
export class IamMembershipMutationError extends Error {
  constructor(public readonly status: number, public readonly code: IamMembershipMutationErrorCode | undefined) {
    super('Não foi possível concluir a alteração do acesso institucional.');
    this.name = 'IamMembershipMutationError';
  }
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function buildMembershipsUrl(query: MembershipListQuery): string {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.role) params.set('role', query.role);
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.limit && query.limit > 0) params.set('limit', String(query.limit));
  const search = params.toString();
  return `/api/iam/memberships${search ? `?${search}` : ''}`;
}

export async function listInstitutionMemberships(
  token: string,
  query: MembershipListQuery = {},
  request: FetchLike = fetch,
): Promise<IamMembershipListResponse> {
  const response = await request(buildMembershipsUrl(query), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new IamMembershipReadError(
      response.status,
      typeof body.error === 'string' ? body.error : 'Não foi possível obter os acessos institucionais.',
    );
  }
  return body as IamMembershipListResponse;
}

async function mutateInstitutionMembership(
  token: string,
  membershipId: string,
  suffix: 'role' | 'revoke',
  method: 'PATCH' | 'POST',
  body: IamMembershipRoleChangeInput | IamMembershipMutationInput,
  request: FetchLike = fetch,
): Promise<IamMembershipMutationResponse> {
  const response = await request(`/api/iam/memberships/${encodeURIComponent(membershipId)}/${suffix}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = typeof payload.code === 'string' ? payload.code : undefined;
    throw new IamMembershipMutationError(response.status, code as IamMembershipMutationErrorCode | undefined);
  }
  return payload as IamMembershipMutationResponse;
}

export function changeInstitutionMembershipRole(
  token: string,
  membershipId: string,
  input: IamMembershipRoleChangeInput,
  request: FetchLike = fetch,
): Promise<IamMembershipMutationResponse> {
  return mutateInstitutionMembership(token, membershipId, 'role', 'PATCH', input, request);
}

export function revokeInstitutionMembership(
  token: string,
  membershipId: string,
  input: IamMembershipMutationInput,
  request: FetchLike = fetch,
): Promise<IamMembershipMutationResponse> {
  return mutateInstitutionMembership(token, membershipId, 'revoke', 'POST', input, request);
}

export function activatePendingInstitutionMembership(
  token: string,
  pendingMembershipId: string,
  input: IamMembershipRoleChangeInput,
  request: FetchLike = fetch,
): Promise<IamMembershipMutationResponse> {
  return request('/api/iam/memberships/grants', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pendingMembershipId, ...input }),
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new IamMembershipMutationError(response.status, typeof payload.code === 'string' ? payload.code as IamMembershipMutationErrorCode : undefined);
    return payload as IamMembershipMutationResponse;
  });
}
