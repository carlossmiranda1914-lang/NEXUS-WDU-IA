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

export class IamMembershipReadError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'IamMembershipReadError';
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
