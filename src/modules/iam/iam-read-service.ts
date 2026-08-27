import { INSTITUTIONAL_ROLES, type InstitutionalContext, type InstitutionalRole } from '../../auth/institutional-context.ts';

export type IamReadPool = { query<T = unknown>(text: string, values: readonly unknown[]): Promise<{ rows: T[] }> };
export type MembershipReadStatus = 'pending' | 'active' | 'suspended' | 'revoked';
export type MembershipListInput = { status?: MembershipReadStatus; role?: InstitutionalRole; cursor?: string; limit?: number };
export type MembershipListResult = {
  memberships: Array<{ id: string; person: { displayName: string }; role: InstitutionalRole; status: MembershipReadStatus; version: number }>;
  page: { nextCursor: string | null };
  summary: { activeInstitutionAdminCount: number };
};
export class IamReadError extends Error { constructor(public readonly code: 'UNAUTHORIZED' | 'INVALID_QUERY' | 'INVALID_CURSOR') { super('IAM membership read was rejected.'); this.name = 'IamReadError'; } }

const statuses = new Set<MembershipReadStatus>(['pending', 'active', 'suspended', 'revoked']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxLimit = 100;
type Row = { id: string; person_id: string; display_name: string; role: InstitutionalRole; status: MembershipReadStatus; version: number };

function decodeCursor(cursor: string | undefined): string | null {
  if (cursor === undefined) return null;
  if (!/^[A-Za-z0-9_-]{8,160}$/.test(cursor)) throw new IamReadError('INVALID_CURSOR');
  try {
    const id = Buffer.from(cursor, 'base64url').toString('utf8');
    if (!uuid.test(id)) throw new Error('invalid');
    return id;
  } catch { throw new IamReadError('INVALID_CURSOR'); }
}
function encodeCursor(id: string): string { return Buffer.from(id, 'utf8').toString('base64url'); }
export function parseMembershipListQuery(query: Record<string, unknown>): MembershipListInput {
  const permitted = new Set(['status', 'role', 'cursor', 'limit']);
  if (Object.keys(query).some((key) => !permitted.has(key))) throw new IamReadError('INVALID_QUERY');
  const status = query.status; const role = query.role; const cursor = query.cursor; const limit = query.limit;
  if (status !== undefined && (typeof status !== 'string' || !statuses.has(status as MembershipReadStatus))) throw new IamReadError('INVALID_QUERY');
  if (role !== undefined && (typeof role !== 'string' || !(INSTITUTIONAL_ROLES as readonly string[]).includes(role))) throw new IamReadError('INVALID_QUERY');
  if (cursor !== undefined && typeof cursor !== 'string') throw new IamReadError('INVALID_CURSOR');
  if (limit !== undefined && (typeof limit !== 'string' || !/^[1-9]\d*$/.test(limit) || Number(limit) > maxLimit)) throw new IamReadError('INVALID_QUERY');
  return { status: status as MembershipReadStatus | undefined, role: role as InstitutionalRole | undefined, cursor: cursor as string | undefined, limit: limit === undefined ? 25 : Number(limit) };
}

export async function listInstitutionMemberships(pool: IamReadPool, context: InstitutionalContext, input: MembershipListInput): Promise<MembershipListResult> {
  if (context.role !== 'institution_admin') throw new IamReadError('UNAUTHORIZED');
  const cursorMembershipId = decodeCursor(input.cursor);
  const limit = input.limit ?? 25;
  const rows = await pool.query<Row>(`
    WITH cursor_row AS (
      SELECT CASE WHEN m.status = 'pending' THEN 0 ELSE 1 END AS status_priority, lower(p.name) AS sort_name, p.id AS person_id, m.id AS membership_id
        FROM memberships m INNER JOIN people p ON p.id = m.person_id
       WHERE m.institution_id = $1 AND m.id = $2
    )
    SELECT m.id, p.id AS person_id, p.name AS display_name, m.role, m.status, m.version
      FROM memberships m INNER JOIN people p ON p.id = m.person_id
     WHERE m.institution_id = $1
       AND ($3::text IS NULL OR m.status = $3)
       AND ($4::text IS NULL OR m.role = $4)
       AND ($2::uuid IS NULL OR EXISTS (SELECT 1 FROM cursor_row)
         AND (CASE WHEN m.status = 'pending' THEN 0 ELSE 1 END, lower(p.name), p.id, m.id) > (SELECT status_priority, sort_name, person_id, membership_id FROM cursor_row))
     ORDER BY CASE WHEN m.status = 'pending' THEN 0 ELSE 1 END ASC, lower(p.name) ASC, p.id ASC, m.id ASC
     LIMIT $5`, [context.institutionId, cursorMembershipId, input.status ?? null, input.role ?? null, limit + 1]);
  if (cursorMembershipId && rows.rows.length === 0) {
    const cursorExists = await pool.query<{ id: string }>('SELECT m.id FROM memberships m WHERE m.institution_id = $1 AND m.id = $2', [context.institutionId, cursorMembershipId]);
    if (!cursorExists.rows[0]) throw new IamReadError('INVALID_CURSOR');
  }
  const hasMore = rows.rows.length > limit; const pageRows = hasMore ? rows.rows.slice(0, limit) : rows.rows;
  const summary = await pool.query<{ count: string | number }>(`SELECT count(*) AS count FROM memberships WHERE institution_id = $1 AND status = 'active' AND role = 'institution_admin'`, [context.institutionId]);
  return {
    memberships: pageRows.map((row) => ({ id: row.id, person: { displayName: row.display_name }, role: row.role, status: row.status, version: row.version })),
    page: { nextCursor: hasMore && pageRows.length ? encodeCursor(pageRows[pageRows.length - 1].id) : null },
    summary: { activeInstitutionAdminCount: Number(summary.rows[0]?.count ?? 0) },
  };
}
