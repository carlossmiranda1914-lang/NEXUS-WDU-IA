import {
  normalizeIdentifier,
  normalizePersonName,
  normalizePhone,
  resolvePersonCandidates,
  type PersonResolutionCandidate,
  type PersonResolutionInput,
  type PersonResolutionResult,
} from './person-resolution.ts';

export interface ReadOnlyQueryClient {
  query<T = any>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
}

interface CandidateRow {
  person_id: string;
  name: string;
  birth_date: string | null;
  phone: string | null;
  student_number: string | null;
  legacy_student_id: string | null;
  is_local: boolean;
}

export const PERSON_RESOLUTION_CANDIDATE_LIMIT = 8;

export function hasResolutionSupportingSignal(input: PersonResolutionInput): boolean {
  return Boolean(
    input.birthDate?.trim()
      || normalizePhone(input.phone)
      || normalizeIdentifier(input.studentNumber)
      || normalizeIdentifier(input.legacyStudentId),
  );
}

function rowToCandidate(row: CandidateRow): PersonResolutionCandidate {
  const relationship = row.is_local ? 'local' : 'external';
  return {
    personId: row.person_id,
    name: row.name,
    birthDate: row.birth_date,
    // Sensitive values may be used internally by the deterministic resolver,
    // but disclosure policy below prevents them from leaving this boundary.
    phone: row.phone,
    studentNumber: row.is_local ? row.student_number : null,
    legacyStudentId: row.is_local ? row.legacy_student_id : null,
    relationship,
    // Cross-institution disclosure is deliberately closed in T3. A later
    // authority workflow may permit reuse, but this provider never does.
    disclosure: row.is_local ? 'allowed' : 'restricted',
  };
}

export async function loadPersonResolutionCandidates(
  client: ReadOnlyQueryClient,
  institutionId: string,
  input: PersonResolutionInput,
): Promise<PersonResolutionCandidate[]> {
  const normalizedName = normalizePersonName(input.name);
  if (!normalizedName || !hasResolutionSupportingSignal(input)) return [];

  const studentNumber = normalizeIdentifier(input.studentNumber);
  const legacyStudentId = normalizeIdentifier(input.legacyStudentId);
  const phone = normalizePhone(input.phone);
  const birthDate = input.birthDate?.trim() || null;

  const result = await client.query<CandidateRow>(
    `WITH candidate_people AS (
       SELECT p.id
         FROM people p
        WHERE ($2::date IS NOT NULL AND p.birth_date = $2::date AND lower(p.name) = lower($1))
           OR ($3::text IS NOT NULL AND regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g') = $3)
       UNION
       SELECT sp.person_id
         FROM student_profiles sp
        WHERE sp.institution_id = $4
          AND (($5::text IS NOT NULL AND upper(replace(coalesce(sp.student_number, ''), ' ', '')) = $5)
            OR ($6::text IS NOT NULL AND upper(replace(coalesce(sp.legacy_student_id, ''), ' ', '')) = $6))
     )
     SELECT p.id AS person_id,
            p.name,
            p.birth_date::text AS birth_date,
            p.phone,
            local_profile.student_number,
            local_profile.legacy_student_id,
            (local_profile.person_id IS NOT NULL) AS is_local
       FROM candidate_people cp
       JOIN people p ON p.id = cp.id
       LEFT JOIN student_profiles local_profile
         ON local_profile.person_id = p.id
        AND local_profile.institution_id = $4
      ORDER BY (local_profile.person_id IS NOT NULL) DESC, p.id
      LIMIT $7`,
    [
      input.name.trim(),
      birthDate,
      phone,
      institutionId,
      studentNumber,
      legacyStudentId,
      PERSON_RESOLUTION_CANDIDATE_LIMIT,
    ],
  );

  return result.rows.map(rowToCandidate);
}

export async function resolvePersonForInstitution(
  client: ReadOnlyQueryClient,
  institutionId: string,
  input: PersonResolutionInput,
): Promise<PersonResolutionResult> {
  if (!normalizePersonName(input.name) || !hasResolutionSupportingSignal(input)) {
    return { status: 'REVIEW_REQUIRED', matchReasons: [], candidateCount: 0 };
  }

  const candidates = await loadPersonResolutionCandidates(client, institutionId, input);
  const result = resolvePersonCandidates(input, candidates);

  // Any plausible candidate outside the current institution becomes a single
  // opaque signal. Do not leak the number of external records, match reasons,
  // Person IDs, institution names, or other cross-tenant details.
  const hasRestrictedCandidate = candidates.some((candidate) => candidate.disclosure === 'restricted');
  if (hasRestrictedCandidate && result.status !== 'NO_MATCH') {
    return {
      status: 'RESTRICTED_POSSIBLE_MATCH',
      matchReasons: [],
      candidateCount: 1,
    };
  }

  return result;
}
