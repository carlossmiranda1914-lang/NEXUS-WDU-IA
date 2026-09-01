import crypto from 'crypto';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import {
  loadPersonResolutionCandidates,
  resolvePersonForInstitution,
  type ReadOnlyQueryClient,
} from '../people/person-resolution-access.ts';
import {
  normalizeBirthDate,
  normalizeIdentifier,
  normalizePersonName,
  normalizePhone,
  resolvePersonCandidates,
  type PersonResolutionInput,
  type PersonResolutionResult,
} from '../people/person-resolution.ts';
import {
  decideIdentityDecision,
  getPublicIdentityDecision,
  isPublicIdentityDecisionRef,
  listPublicIdentityDecisions,
  proposeIdentityDecision,
  type IdentityDecisionPool,
} from '../people/identity-resolution-decision.ts';
import {
  executeEnrollmentIntake,
  type TransactionPool,
} from './enrollment-intake.ts';

export interface EnrollmentApiPool extends ReadOnlyQueryClient, TransactionPool, IdentityDecisionPool {}

export type EnrollmentStudentInput = PersonResolutionInput;

export class EnrollmentIntakeApiError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_INPUT'
      | 'CLIENT_AUTHORITY_FORBIDDEN'
      | 'IDENTITY_REVIEW_REQUIRED'
      | 'IDENTITY_DECISION_INVALID'
      | 'IDENTITY_DECISION_STALE',
    message: string,
  ) {
    super(message);
    this.name = 'EnrollmentIntakeApiError';
  }
}

const FORBIDDEN_AUTHORITY_KEYS = new Set([
  'institutionId',
  'institution_id',
  'role',
  'approved',
  'academicYearId',
  'academic_year_id',
  'studentPersonId',
  'student_person_id',
]);

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function assertNoClientAuthority(body: unknown): void {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new EnrollmentIntakeApiError('INVALID_INPUT', 'Pedido de matrícula inválido.');
  }
  for (const key of Object.keys(body as Record<string, unknown>)) {
    if (FORBIDDEN_AUTHORITY_KEYS.has(key)) {
      throw new EnrollmentIntakeApiError('CLIENT_AUTHORITY_FORBIDDEN', 'O pedido contém um campo de autoridade que só pode ser definido pelo servidor.');
    }
  }
  const student = (body as Record<string, any>).student;
  if (student && typeof student === 'object') {
    for (const key of ['personId', 'person_id', 'institutionId', 'institution_id', 'role']) {
      if (Object.prototype.hasOwnProperty.call(student, key)) {
        throw new EnrollmentIntakeApiError('CLIENT_AUTHORITY_FORBIDDEN', 'A identidade do aluno não pode ser autorizada por um UUID fornecido pelo browser.');
      }
    }
  }
}

export function parseEnrollmentStudentInput(value: unknown): EnrollmentStudentInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new EnrollmentIntakeApiError('INVALID_INPUT', 'Indique os dados mínimos do aluno.');
  }
  const raw = value as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (name.length < 3 || name.length > 160) {
    throw new EnrollmentIntakeApiError('INVALID_INPUT', 'Indique o nome completo do aluno.');
  }

  const optionalText = (field: string, max: number): string | null => {
    const current = raw[field];
    if (current === undefined || current === null || current === '') return null;
    if (typeof current !== 'string' || current.trim().length > max) {
      throw new EnrollmentIntakeApiError('INVALID_INPUT', `Campo ${field} inválido.`);
    }
    return current.trim() || null;
  };

  const birthDateRaw = optionalText('birthDate', 10);
  if (birthDateRaw && !normalizeBirthDate(birthDateRaw)) {
    throw new EnrollmentIntakeApiError('INVALID_INPUT', 'Data de nascimento inválida.');
  }

  return {
    name,
    birthDate: birthDateRaw,
    phone: optionalText('phone', 40),
    studentNumber: optionalText('studentNumber', 80),
    legacyStudentId: optionalText('legacyStudentId', 80),
  };
}

export function buildEnrollmentIdentityCaseKey(
  institutionId: string,
  offerId: string,
  student: EnrollmentStudentInput,
): string {
  const canonical = JSON.stringify({
    institutionId,
    offerId,
    name: normalizePersonName(student.name),
    birthDate: normalizeBirthDate(student.birthDate),
    phone: normalizePhone(student.phone),
    studentNumber: normalizeIdentifier(student.studentNumber),
    legacyStudentId: normalizeIdentifier(student.legacyStudentId),
  });
  const digest = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 48);
  return `enrollment:${digest}`;
}

function isPlausibleCandidate(student: EnrollmentStudentInput, candidate: any): boolean {
  const result = resolvePersonCandidates(student, [candidate]);
  return result.status !== 'NO_MATCH' && result.candidateCount > 0;
}

export async function resolveStudentForEnrollment(
  pool: EnrollmentApiPool,
  context: InstitutionalContext,
  student: EnrollmentStudentInput,
): Promise<PersonResolutionResult & { localCandidates?: Array<{ personId: string; name: string; birthDate: string | null }> }> {
  const result = await resolvePersonForInstitution(pool, context.institutionId, student);
  if (result.status !== 'MULTIPLE_MATCHES' && result.status !== 'REVIEW_REQUIRED') return result;

  const candidates = await loadPersonResolutionCandidates(pool, context.institutionId, student);
  const localCandidates = candidates
    .filter((candidate) => candidate.relationship === 'local' && candidate.disclosure === 'allowed' && isPlausibleCandidate(student, candidate))
    .slice(0, 8)
    .map((candidate) => ({
      personId: candidate.personId,
      name: candidate.name,
      birthDate: candidate.birthDate ?? null,
    }));

  return localCandidates.length ? { ...result, localCandidates } : result;
}

/** Browser resolution is deliberately status-only: candidate UUIDs are server authority. */
export function toPublicEnrollmentResolution(result: PersonResolutionResult): Pick<PersonResolutionResult, 'status' | 'candidateCount' | 'matchReasons'> {
  return { status: result.status, candidateCount: result.candidateCount, matchReasons: result.status === 'RESTRICTED_POSSIBLE_MATCH' ? [] : result.matchReasons };
}

export interface StartEnrollmentInput {
  offerId: string;
  student: EnrollmentStudentInput;
  idempotencyKey: string;
  decisionRef?: string | null;
  /** Internal-only compatibility for existing server callers; never accepted by HTTP. */
  decisionId?: string | null;
}

export async function startEnrollmentIntake(
  pool: EnrollmentApiPool,
  context: InstitutionalContext,
  input: StartEnrollmentInput,
) {
  if (!validUuid(input.offerId)) throw new EnrollmentIntakeApiError('INVALID_INPUT', 'Oferta de matrícula inválida.');
  if (input.decisionRef && !isPublicIdentityDecisionRef(input.decisionRef)) throw new EnrollmentIntakeApiError('INVALID_INPUT', 'Referência de decisão de identidade inválida.');
  if (input.decisionId && !validUuid(input.decisionId)) throw new EnrollmentIntakeApiError('INVALID_INPUT', 'Decisão de identidade inválida.');

  const resolution = await resolvePersonForInstitution(pool, context.institutionId, input.student);
  const caseKey = buildEnrollmentIdentityCaseKey(context.institutionId, input.offerId, input.student);

  if (!input.decisionRef && !input.decisionId) {
    if (resolution.status === 'NO_MATCH') {
      return executeEnrollmentIntake(pool, {
        institutionId: context.institutionId,
        actorPersonId: context.personId,
        offerId: input.offerId,
        idempotencyKey: input.idempotencyKey,
        person: {
          kind: 'new_person',
          name: input.student.name,
          birthDate: input.student.birthDate,
          phone: input.student.phone,
        },
      });
    }
    if (resolution.status === 'LOCAL_MATCH' && resolution.candidatePersonId) {
      return executeEnrollmentIntake(pool, {
        institutionId: context.institutionId,
        actorPersonId: context.personId,
        offerId: input.offerId,
        idempotencyKey: input.idempotencyKey,
        person: { kind: 'reuse_person', personId: resolution.candidatePersonId },
      });
    }
    throw new EnrollmentIntakeApiError('IDENTITY_REVIEW_REQUIRED', 'A identidade precisa de confirmação antes de iniciar a matrícula.');
  }

  const decision = await pool.query<{
    proposed_action: string;
    proposed_candidate_person_id: string | null;
  }>(
    `SELECT proposed_action, proposed_candidate_person_id
       FROM identity_resolution_decisions
      WHERE ${input.decisionRef ? 'public_ref' : 'id'} = $1
        AND institution_id = $2
        AND case_key = $3
        AND status = 'approved'`,
    [input.decisionRef ?? input.decisionId, context.institutionId, caseKey],
  );
  if (!decision.rowCount) {
    throw new EnrollmentIntakeApiError('IDENTITY_DECISION_INVALID', 'A decisão não está aprovada para este caso e instituição.');
  }

  const resolvedDecision = input.decisionId
    ? { rowCount: 1, rows: [{ id: input.decisionId }] }
    : await pool.query<{ id: string }>('SELECT id FROM identity_resolution_decisions WHERE public_ref = $1 AND institution_id = $2', [input.decisionRef, context.institutionId]);
  if (!resolvedDecision.rowCount) throw new EnrollmentIntakeApiError('IDENTITY_DECISION_INVALID', 'A decisão não está aprovada para este caso e instituição.');
  const authorization = { decisionId: resolvedDecision.rows[0].id, caseKey };
  if (decision.rows[0].proposed_action === 'CREATE_PERSON') {
    return executeEnrollmentIntake(pool, {
      institutionId: context.institutionId,
      actorPersonId: context.personId,
      offerId: input.offerId,
      idempotencyKey: input.idempotencyKey,
      person: {
        kind: 'new_person',
        name: input.student.name,
        birthDate: input.student.birthDate,
        phone: input.student.phone,
        authorization,
      },
    });
  }

  if (decision.rows[0].proposed_action === 'REUSE_PERSON' && decision.rows[0].proposed_candidate_person_id) {
    const candidates = await loadPersonResolutionCandidates(pool, context.institutionId, input.student);
    const selected = candidates.find((candidate) => candidate.personId === decision.rows[0].proposed_candidate_person_id);
    if (!selected || !isPlausibleCandidate(input.student, selected)) {
      throw new EnrollmentIntakeApiError('IDENTITY_DECISION_STALE', 'Os dados atuais já não sustentam a decisão de identidade aprovada.');
    }
    return executeEnrollmentIntake(pool, {
      institutionId: context.institutionId,
      actorPersonId: context.personId,
      offerId: input.offerId,
      idempotencyKey: input.idempotencyKey,
      person: {
        kind: 'reuse_person',
        personId: selected.personId,
        authorization,
      },
    });
  }

  throw new EnrollmentIntakeApiError('IDENTITY_DECISION_INVALID', 'A decisão aprovada não autoriza um intake executável.');
}

export interface ProposeEnrollmentIdentityDecisionInput {
  offerId: string;
  student: EnrollmentStudentInput;
  proposedAction: 'REUSE_PERSON' | 'CREATE_PERSON' | 'REVIEW_REQUIRED';
  candidatePersonId?: string | null;
  evidenceTypes?: readonly string[];
  requestId?: string | null;
  correlationId?: string | null;
}

export async function proposeEnrollmentIdentityDecision(
  pool: EnrollmentApiPool,
  context: InstitutionalContext,
  input: ProposeEnrollmentIdentityDecisionInput,
) {
  if (!validUuid(input.offerId)) throw new EnrollmentIntakeApiError('INVALID_INPUT', 'Oferta de matrícula inválida.');
  if (input.candidatePersonId && !validUuid(input.candidatePersonId)) {
    throw new EnrollmentIntakeApiError('INVALID_INPUT', 'Candidato de identidade inválido.');
  }

  const resolution = await resolvePersonForInstitution(pool, context.institutionId, input.student);
  if (resolution.status === 'NO_MATCH' || resolution.status === 'LOCAL_MATCH') {
    throw new EnrollmentIntakeApiError('INVALID_INPUT', 'Este caso não exige decisão superior de identidade.');
  }

  const candidates = await loadPersonResolutionCandidates(pool, context.institutionId, input.student);
  const plausible = candidates.filter((candidate) => isPlausibleCandidate(input.student, candidate));
  const caseKey = buildEnrollmentIdentityCaseKey(context.institutionId, input.offerId, input.student);

  // An ambiguous case always has a safe next action: create a server-owned
  // queue record. It intentionally carries no candidate selection and cannot
  // be approved into a Person reuse/create authorization.
  if (input.proposedAction === 'REVIEW_REQUIRED') {
    return proposeIdentityDecision(pool, {
      institutionId: context.institutionId,
      actorPersonId: context.personId,
      caseKey,
      proposedAction: 'REVIEW_REQUIRED',
      reasonCode: resolution.status === 'REVIEW_REQUIRED' ? 'CONFLICT_REQUIRES_REVIEW' : 'INSUFFICIENT_EVIDENCE',
      matchReasons: resolution.status === 'RESTRICTED_POSSIBLE_MATCH' ? [] : resolution.matchReasons,
      evidenceTypes: input.evidenceTypes,
      requestId: input.requestId,
      correlationId: input.correlationId,
    });
  }

  if (input.proposedAction === 'CREATE_PERSON') {
    return proposeIdentityDecision(pool, {
      institutionId: context.institutionId,
      actorPersonId: context.personId,
      caseKey,
      proposedAction: 'CREATE_PERSON',
      reasonCode: 'NEW_PERSON_APPROVED_DESPITE_CONFLICT',
      candidatePersonIds: plausible.map((candidate) => candidate.personId),
      matchReasons: resolution.matchReasons,
      evidenceTypes: input.evidenceTypes,
      requestId: input.requestId,
      correlationId: input.correlationId,
    });
  }

  let selected = input.candidatePersonId
    ? plausible.find((candidate) => candidate.relationship === 'local' && candidate.personId === input.candidatePersonId)
    : undefined;

  if (!selected && resolution.status === 'RESTRICTED_POSSIBLE_MATCH') {
    const restricted = plausible.filter((candidate) => candidate.relationship === 'external' && candidate.disclosure === 'restricted');
    if (restricted.length === 1) selected = restricted[0];
  }

  if (!selected) {
    throw new EnrollmentIntakeApiError('INVALID_INPUT', 'Selecione um candidato local válido ou forneça evidência suficiente para o possível match restrito.');
  }

  const strongIdentifierConflict = resolution.status === 'REVIEW_REQUIRED'
    && resolution.matchReasons.some((reason) => reason === 'student_number' || reason === 'legacy_student_id');
  const reasonCode = strongIdentifierConflict
    ? 'IDENTIFIER_CONFLICT'
    : resolution.status === 'MULTIPLE_MATCHES'
      ? 'MULTIPLE_CANDIDATES_RESOLVED'
      : 'MATCH_CONFIRMED_WITH_NEW_EVIDENCE';

  return proposeIdentityDecision(pool, {
    institutionId: context.institutionId,
    actorPersonId: context.personId,
    caseKey,
    proposedAction: 'REUSE_PERSON',
    reasonCode,
    proposedCandidatePersonId: selected.personId,
    candidatePersonIds: plausible.map((candidate) => candidate.personId),
    matchReasons: resolution.matchReasons,
    evidenceTypes: input.evidenceTypes,
    requestId: input.requestId,
    correlationId: input.correlationId,
  });
}

export async function decideEnrollmentIdentityDecision(
  pool: EnrollmentApiPool,
  context: InstitutionalContext,
  decisionId: string,
  outcome: 'approve' | 'reject' | 'request_more_information',
) {
  if (!validUuid(decisionId)) throw new EnrollmentIntakeApiError('INVALID_INPUT', 'Decisão de identidade inválida.');
  return decideIdentityDecision(pool, {
    institutionId: context.institutionId,
    actorPersonId: context.personId,
    decisionId,
    outcome,
  });
}

export async function listEnrollmentIdentityDecisionQueue(pool: EnrollmentApiPool, context: InstitutionalContext) {
  return listPublicIdentityDecisions(pool, context.institutionId, context.personId);
}

export async function readEnrollmentIdentityDecision(pool: EnrollmentApiPool, context: InstitutionalContext, decisionRef: string) {
  return getPublicIdentityDecision(pool, context.institutionId, context.personId, decisionRef);
}
