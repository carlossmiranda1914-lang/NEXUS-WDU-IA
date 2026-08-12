export type PersonResolutionStatus =
  | 'NO_MATCH'
  | 'LOCAL_MATCH'
  | 'REUSABLE_MATCH'
  | 'MULTIPLE_MATCHES'
  | 'REVIEW_REQUIRED'
  | 'RESTRICTED_POSSIBLE_MATCH';

export type PersonMatchReason =
  | 'student_number'
  | 'legacy_student_id'
  | 'name'
  | 'birth_date'
  | 'phone';

export interface PersonResolutionInput {
  name: string;
  birthDate?: string | null;
  phone?: string | null;
  studentNumber?: string | null;
  legacyStudentId?: string | null;
}

export interface PersonResolutionCandidate {
  personId: string;
  name: string;
  birthDate?: string | null;
  phone?: string | null;
  studentNumber?: string | null;
  legacyStudentId?: string | null;
  relationship: 'local' | 'external';
  disclosure: 'allowed' | 'restricted';
}

export interface PersonResolutionResult {
  status: PersonResolutionStatus;
  candidatePersonId?: string;
  matchReasons: PersonMatchReason[];
  candidateCount: number;
}

interface EvaluatedCandidate {
  candidate: PersonResolutionCandidate;
  reasons: PersonMatchReason[];
  strongInstitutionalMatch: boolean;
  compositeMatch: boolean;
  contradiction: boolean;
}

export function normalizePersonName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt');
}

export function normalizePhone(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits || null;
}

export function normalizeIdentifier(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/\s+/g, '').toUpperCase();
  return normalized || null;
}

export function normalizeBirthDate(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function evaluateCandidate(
  input: PersonResolutionInput,
  candidate: PersonResolutionCandidate,
): EvaluatedCandidate {
  const inputName = normalizePersonName(input.name);
  const candidateName = normalizePersonName(candidate.name);
  const inputBirthDate = normalizeBirthDate(input.birthDate);
  const candidateBirthDate = normalizeBirthDate(candidate.birthDate);
  const inputPhone = normalizePhone(input.phone);
  const candidatePhone = normalizePhone(candidate.phone);
  const inputStudentNumber = normalizeIdentifier(input.studentNumber);
  const candidateStudentNumber = normalizeIdentifier(candidate.studentNumber);
  const inputLegacyStudentId = normalizeIdentifier(input.legacyStudentId);
  const candidateLegacyStudentId = normalizeIdentifier(candidate.legacyStudentId);

  const reasons: PersonMatchReason[] = [];

  const nameMatches = inputName.length > 0 && inputName === candidateName;
  const birthDateMatches = Boolean(inputBirthDate && candidateBirthDate && inputBirthDate === candidateBirthDate);
  const phoneMatches = Boolean(inputPhone && candidatePhone && inputPhone === candidatePhone);
  const studentNumberMatches = Boolean(
    inputStudentNumber && candidateStudentNumber && inputStudentNumber === candidateStudentNumber,
  );
  const legacyStudentIdMatches = Boolean(
    inputLegacyStudentId && candidateLegacyStudentId && inputLegacyStudentId === candidateLegacyStudentId,
  );

  if (studentNumberMatches) reasons.push('student_number');
  if (legacyStudentIdMatches) reasons.push('legacy_student_id');
  if (nameMatches) reasons.push('name');
  if (birthDateMatches) reasons.push('birth_date');
  if (phoneMatches) reasons.push('phone');

  const strongInstitutionalMatch = studentNumberMatches || legacyStudentIdMatches;
  const compositeMatch = nameMatches && (birthDateMatches || phoneMatches);

  const nameContradiction = Boolean(inputName && candidateName && inputName !== candidateName);
  const birthDateContradiction = Boolean(
    inputBirthDate && candidateBirthDate && inputBirthDate !== candidateBirthDate,
  );
  const contradiction = strongInstitutionalMatch && (nameContradiction || birthDateContradiction);

  return {
    candidate,
    reasons,
    strongInstitutionalMatch,
    compositeMatch,
    contradiction,
  };
}

export function resolvePersonCandidates(
  input: PersonResolutionInput,
  candidates: readonly PersonResolutionCandidate[],
): PersonResolutionResult {
  if (!normalizePersonName(input.name)) {
    return { status: 'REVIEW_REQUIRED', matchReasons: [], candidateCount: 0 };
  }

  const evaluated = candidates
    .map((candidate) => evaluateCandidate(input, candidate))
    .filter((candidate) => candidate.strongInstitutionalMatch || candidate.compositeMatch);

  if (evaluated.length === 0) {
    return { status: 'NO_MATCH', matchReasons: [], candidateCount: 0 };
  }

  if (evaluated.length > 1) {
    const reasons = Array.from(new Set(evaluated.flatMap((candidate) => candidate.reasons)));
    return {
      status: 'MULTIPLE_MATCHES',
      matchReasons: reasons,
      candidateCount: evaluated.length,
    };
  }

  const match = evaluated[0];

  if (match.contradiction) {
    return {
      status: 'REVIEW_REQUIRED',
      matchReasons: match.reasons,
      candidateCount: 1,
    };
  }

  if (match.candidate.disclosure === 'restricted') {
    return {
      status: 'RESTRICTED_POSSIBLE_MATCH',
      matchReasons: [],
      candidateCount: 1,
    };
  }

  if (match.strongInstitutionalMatch && match.candidate.relationship === 'local') {
    return {
      status: 'LOCAL_MATCH',
      candidatePersonId: match.candidate.personId,
      matchReasons: match.reasons,
      candidateCount: 1,
    };
  }

  if (match.strongInstitutionalMatch && match.candidate.relationship === 'external') {
    return {
      status: 'REUSABLE_MATCH',
      candidatePersonId: match.candidate.personId,
      matchReasons: match.reasons,
      candidateCount: 1,
    };
  }

  return {
    status: 'REVIEW_REQUIRED',
    candidatePersonId: match.candidate.relationship === 'local' ? match.candidate.personId : undefined,
    matchReasons: match.reasons,
    candidateCount: 1,
  };
}
