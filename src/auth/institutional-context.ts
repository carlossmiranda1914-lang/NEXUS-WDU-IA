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

export interface QueryExecutor {
  query: (sql: string, parameters: unknown[]) => Promise<{ rows: unknown[] }>;
}

export interface InstitutionalContext {
  personId: string;
  personName: string;
  identityEmail: string | null;
  membershipId: string;
  institutionId: string;
  institutionName: string;
  institutionSlug: string;
  role: InstitutionalRole;
}

export type InstitutionalContextResolution =
  | { kind: 'resolved'; context: InstitutionalContext }
  | { kind: 'missing_membership' }
  | { kind: 'institution_selection_required'; institutions: Array<Pick<InstitutionalContext, 'institutionId' | 'institutionName' | 'institutionSlug'>> }
  | { kind: 'institution_not_authorized' };

interface ContextRow {
  person_id: string;
  person_name: string;
  identity_email: string | null;
  membership_id: string;
  institution_id: string;
  institution_name: string;
  institution_slug: string;
  role: InstitutionalRole;
}

const CONTEXT_QUERY = `
  SELECT
    people.id AS person_id,
    people.name AS person_name,
    identities.email AS identity_email,
    memberships.id AS membership_id,
    institutions.id AS institution_id,
    institutions.name AS institution_name,
    institutions.slug AS institution_slug,
    memberships.role
  FROM identities
  INNER JOIN people ON people.id = identities.person_id
  INNER JOIN memberships ON memberships.person_id = people.id
  INNER JOIN institutions ON institutions.id = memberships.institution_id
  WHERE identities.provider = $1
    AND identities.provider_subject = $2
    AND memberships.status = 'active'
    AND institutions.status = 'active'
  ORDER BY institutions.name ASC, memberships.role ASC
`;

function toContext(row: ContextRow): InstitutionalContext {
  return {
    personId: row.person_id,
    personName: row.person_name,
    identityEmail: row.identity_email,
    membershipId: row.membership_id,
    institutionId: row.institution_id,
    institutionName: row.institution_name,
    institutionSlug: row.institution_slug,
    role: row.role,
  };
}

/** Resolves permissions only; it never creates a person, identity, membership, or role. */
export async function resolveInstitutionalContext(
  executor: QueryExecutor,
  firebaseUid: string,
  requestedInstitutionId?: string,
): Promise<InstitutionalContextResolution> {
  const result = await executor.query(CONTEXT_QUERY, ['firebase', firebaseUid]);
  const contexts = (result.rows as ContextRow[]).map(toContext);

  if (contexts.length === 0) return { kind: 'missing_membership' };

  if (requestedInstitutionId) {
    const matchingContext = contexts.find((context) => context.institutionId === requestedInstitutionId);
    return matchingContext
      ? { kind: 'resolved', context: matchingContext }
      : { kind: 'institution_not_authorized' };
  }

  const institutionIds = new Set(contexts.map((context) => context.institutionId));
  if (institutionIds.size > 1) {
    const institutions = Array.from(new Map(contexts.map((context) => [context.institutionId, {
      institutionId: context.institutionId,
      institutionName: context.institutionName,
      institutionSlug: context.institutionSlug,
    }])).values());
    return { kind: 'institution_selection_required', institutions };
  }

  return { kind: 'resolved', context: contexts[0] };
}
