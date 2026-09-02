import crypto from 'crypto';
import { resolvePersonForInstitution } from './person-resolution-access.ts';
import { normalizeBirthDate, normalizeIdentifier, normalizePersonName, normalizePhone, type PersonResolutionInput, type PersonResolutionResult } from './person-resolution.ts';

export type IdentityDecisionAction = 'REUSE_PERSON' | 'CREATE_PERSON' | 'REVIEW_REQUIRED' | 'REJECT_DECISION';
export type IdentityDecisionReasonCode =
  | 'MATCH_CONFIRMED_WITH_NEW_EVIDENCE'
  | 'MULTIPLE_CANDIDATES_RESOLVED'
  | 'CONFLICT_REQUIRES_REVIEW'
  | 'NEW_PERSON_APPROVED_DESPITE_CONFLICT'
  | 'IDENTIFIER_CONFLICT'
  | 'INSUFFICIENT_EVIDENCE';
export type IdentityDecisionStatus =
  | 'pending_confirmation'
  | 'pending_second_approval'
  | 'needs_more_information'
  | 'approved'
  | 'rejected';

type AuthorityRole = 'secretariat' | 'director' | 'institution_admin';

type Policy = {
  riskLevel: 'B' | 'C';
  allowedProposalRoles: readonly AuthorityRole[];
  initialStatus: IdentityDecisionStatus;
  requiredApprovalRole: 'leadership' | 'institution_admin' | null;
  requireIndependentApprover: boolean;
  requireInstitutionAdminAmongApprovers: boolean;
};

const MATCH_REASON_ALLOWLIST = new Set(['student_number', 'legacy_student_id', 'name', 'birth_date', 'phone']);
const EVIDENCE_TYPE_ALLOWLIST = new Set([
  'civil_document_presented',
  'school_record',
  'guardian_attestation',
  'birth_date_confirmation',
  'phone_confirmation',
  'legacy_record',
  'manual_interview',
]);

const POLICY: Record<IdentityDecisionReasonCode, Policy> = {
  MATCH_CONFIRMED_WITH_NEW_EVIDENCE: {
    riskLevel: 'B',
    allowedProposalRoles: ['secretariat', 'director', 'institution_admin'],
    initialStatus: 'pending_confirmation',
    requiredApprovalRole: 'leadership',
    requireIndependentApprover: true,
    requireInstitutionAdminAmongApprovers: false,
  },
  MULTIPLE_CANDIDATES_RESOLVED: {
    riskLevel: 'B',
    allowedProposalRoles: ['secretariat', 'director', 'institution_admin'],
    initialStatus: 'pending_confirmation',
    requiredApprovalRole: 'leadership',
    requireIndependentApprover: true,
    requireInstitutionAdminAmongApprovers: false,
  },
  CONFLICT_REQUIRES_REVIEW: {
    riskLevel: 'B',
    allowedProposalRoles: ['secretariat', 'director', 'institution_admin'],
    initialStatus: 'needs_more_information',
    requiredApprovalRole: null,
    requireIndependentApprover: false,
    requireInstitutionAdminAmongApprovers: false,
  },
  NEW_PERSON_APPROVED_DESPITE_CONFLICT: {
    riskLevel: 'C',
    allowedProposalRoles: ['director', 'institution_admin'],
    initialStatus: 'pending_second_approval',
    requiredApprovalRole: 'leadership',
    requireIndependentApprover: true,
    requireInstitutionAdminAmongApprovers: true,
  },
  IDENTIFIER_CONFLICT: {
    riskLevel: 'C',
    allowedProposalRoles: ['director', 'institution_admin'],
    initialStatus: 'pending_confirmation',
    requiredApprovalRole: 'institution_admin',
    requireIndependentApprover: true,
    requireInstitutionAdminAmongApprovers: true,
  },
  INSUFFICIENT_EVIDENCE: {
    riskLevel: 'B',
    allowedProposalRoles: ['secretariat', 'director', 'institution_admin'],
    initialStatus: 'needs_more_information',
    requiredApprovalRole: null,
    requireIndependentApprover: false,
    requireInstitutionAdminAmongApprovers: false,
  },
};

export interface IdentityDecisionQueryClient {
  query<T = any>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
}

export interface IdentityDecisionPool {
  connect(): Promise<IdentityDecisionQueryClient & { release(): void }>;
}

export interface ProposeIdentityDecisionInput {
  institutionId: string;
  actorPersonId: string;
  caseKey: string;
  proposedAction: IdentityDecisionAction;
  reasonCode: IdentityDecisionReasonCode;
  proposedCandidatePersonId?: string | null;
  candidatePersonIds?: readonly string[];
  matchReasons?: readonly string[];
  evidenceTypes?: readonly string[];
  requestId?: string | null;
  correlationId?: string | null;
  /** Server-created Enrollment binding. Legacy decisions remain deliberately unbound. */
  intakeBinding?: { offerId: string; student: PersonResolutionInput } | null;
}

export interface DecideIdentityDecisionInput {
  institutionId: string;
  actorPersonId: string;
  decisionId: string;
  outcome: 'approve' | 'reject' | 'request_more_information';
}

export interface IdentityDecisionRecord {
  id: string;
  publicRef: string;
  institutionId: string;
  caseKey: string;
  riskLevel: 'B' | 'C';
  proposedAction: IdentityDecisionAction;
  reasonCode: IdentityDecisionReasonCode;
  status: IdentityDecisionStatus;
  requestedByPersonId: string;
  decidedByPersonId: string | null;
  approvedByPersonId: string | null;
  version: number;
  replayed?: boolean;
}
export interface SubmitIdentityDecisionEvidenceInput {
  institutionId: string; actorPersonId: string; decisionRef: string; expectedVersion: number;
  student: PersonResolutionInput; evidenceTypes: readonly string[]; requestId?: string | null; correlationId?: string | null;
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Shared, server-only enrollment identity correlation. */
export function buildEnrollmentIdentityCaseKey(institutionId: string, offerId: string, student: PersonResolutionInput): string {
  const canonical = JSON.stringify({
    institutionId,
    offerId,
    name: normalizePersonName(student.name),
    birthDate: normalizeBirthDate(student.birthDate),
    phone: normalizePhone(student.phone),
    studentNumber: normalizeIdentifier(student.studentNumber),
    legacyStudentId: normalizeIdentifier(student.legacyStudentId),
    nationalIdNumber: normalizeIdentifier(student.nationalIdNumber),
  });
  return `enrollment:${crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 48)}`;
}

/** The only shape permitted outside the server decision authority. */
export type PublicIdentityDecision = {
  decisionRef: string;
  status: IdentityDecisionStatus;
  riskLevel: 'B' | 'C';
  proposedAction: IdentityDecisionAction;
  reasonCode: IdentityDecisionReasonCode;
  version: number;
};

export function isPublicIdentityDecisionRef(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{36}$/i.test(value);
}

export class IdentityDecisionError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_DECISION_INPUT'
      | 'UNAUTHORIZED_DECISION'
      | 'DECISION_CASE_CONFLICT'
      | 'DECISION_NOT_FOUND'
      | 'DECISION_ALREADY_FINAL'
      | 'DECISION_BINDING_REQUIRED'
      | 'SEGREGATION_REQUIRED'
      | 'INSTITUTION_ADMIN_REQUIRED',
    message: string,
  ) {
    super(message);
    this.name = 'IdentityDecisionError';
  }
}

function sanitizeCaseKey(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9:_-]{8,160}$/.test(normalized)) {
    throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'caseKey must be 8-160 safe characters.');
  }
  return normalized;
}

function sanitizeList(values: readonly string[] | undefined, allowlist: Set<string>, max = 12): string[] {
  const unique = Array.from(new Set(values ?? []));
  if (unique.length > max || unique.some((value) => !allowlist.has(value))) {
    throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'Decision evidence contains an unsupported value.');
  }
  return unique;
}

function sanitizeCandidateIds(values: readonly string[] | undefined): string[] {
  const unique = Array.from(new Set((values ?? []).filter(Boolean)));
  if (unique.length > 8) {
    throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'Too many candidate Person ids.');
  }
  return unique;
}

function validateProposalSemantics(input: ProposeIdentityDecisionInput, candidatePersonIds: readonly string[]) {
  if (input.proposedAction === 'CREATE_PERSON' && input.reasonCode !== 'NEW_PERSON_APPROVED_DESPITE_CONFLICT') {
    throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'Conflict creation requires the dedicated D-05 reason code.');
  }
  if (input.reasonCode === 'NEW_PERSON_APPROVED_DESPITE_CONFLICT' && input.proposedAction !== 'CREATE_PERSON') {
    throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'The conflict exception must propose CREATE_PERSON.');
  }
  if (['MATCH_CONFIRMED_WITH_NEW_EVIDENCE', 'MULTIPLE_CANDIDATES_RESOLVED', 'IDENTIFIER_CONFLICT'].includes(input.reasonCode)
      && input.proposedAction !== 'REUSE_PERSON') {
    throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'Resolved identity matches must propose REUSE_PERSON.');
  }
  if (['CONFLICT_REQUIRES_REVIEW', 'INSUFFICIENT_EVIDENCE'].includes(input.reasonCode)
      && input.proposedAction !== 'REVIEW_REQUIRED') {
    throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'Unresolved conflicts must remain REVIEW_REQUIRED.');
  }
  if (input.proposedAction === 'REUSE_PERSON') {
    if (!input.proposedCandidatePersonId || !candidatePersonIds.includes(input.proposedCandidatePersonId)) {
      throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'REUSE_PERSON requires one approved candidate from the internal candidate set.');
    }
  } else if (input.proposedCandidatePersonId) {
    throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'Only REUSE_PERSON may select a candidate Person.');
  }
}

function fingerprintProposal(
  input: ProposeIdentityDecisionInput,
  policy: Policy,
  candidatePersonIds: readonly string[],
  matchReasons: readonly string[],
  evidenceTypes: readonly string[],
): string {
  const payload = JSON.stringify({
    institutionId: input.institutionId,
    caseKey: sanitizeCaseKey(input.caseKey),
    proposedAction: input.proposedAction,
    reasonCode: input.reasonCode,
    riskLevel: policy.riskLevel,
    proposedCandidatePersonId: input.proposedCandidatePersonId ?? null,
    candidatePersonIds: [...candidatePersonIds].sort(),
    matchReasons: [...matchReasons].sort(),
    evidenceTypes: [...evidenceTypes].sort(),
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function resolveAuthorityRole(
  client: IdentityDecisionQueryClient,
  institutionId: string,
  personId: string,
): Promise<AuthorityRole | null> {
  const result = await client.query<{ role: string }>(
    `SELECT role
       FROM memberships
      WHERE institution_id = $1
        AND person_id = $2
        AND status = 'active'
        AND role IN ('secretariat', 'director', 'institution_admin')`,
    [institutionId, personId],
  );
  const roles = new Set(result.rows.map((row) => row.role));
  if (roles.has('institution_admin')) return 'institution_admin';
  if (roles.has('director')) return 'director';
  if (roles.has('secretariat')) return 'secretariat';
  return null;
}

function mapRow(row: any, replayed = false): IdentityDecisionRecord {
  return {
    id: row.id,
    publicRef: row.public_ref,
    institutionId: row.institution_id,
    caseKey: row.case_key,
    riskLevel: row.risk_level,
    proposedAction: row.proposed_action,
    reasonCode: row.reason_code,
    status: row.status,
    requestedByPersonId: row.requested_by_person_id,
    decidedByPersonId: row.decided_by_person_id ?? null,
    approvedByPersonId: row.approved_by_person_id ?? null,
    version: row.version,
    replayed,
  };
}

function revisionInput(student: PersonResolutionInput) {
  return { name: student.name.trim(), birthDate: student.birthDate?.trim() || null, phone: student.phone?.trim() || null, studentNumber: student.studentNumber?.trim() || null, legacyStudentId: student.legacyStudentId?.trim() || null, nationalIdNumber: student.nationalIdNumber?.trim() || null };
}
function revisionFingerprint(input: SubmitIdentityDecisionEvidenceInput, evidenceTypes: readonly string[]) {
  return crypto.createHash('sha256').update(JSON.stringify({ decisionRef: input.decisionRef, student: revisionInput(input.student), evidenceTypes: [...evidenceTypes].sort() })).digest('hex');
}
function deriveRevision(resolution: PersonResolutionResult) {
  if (resolution.status === 'NO_MATCH') return { action: 'CREATE_PERSON' as const, reason: 'NEW_PERSON_APPROVED_DESPITE_CONFLICT' as const, status: 'pending_second_approval' as const, risk: 'C' as const, personId: null };
  // A revision can only reuse a uniquely resolved Person already local to this
  // institution. External/restricted matches remain review-required.
  if (resolution.status === 'LOCAL_MATCH' && resolution.candidatePersonId) return { action: 'REUSE_PERSON' as const, reason: 'MATCH_CONFIRMED_WITH_NEW_EVIDENCE' as const, status: 'pending_confirmation' as const, risk: 'B' as const, personId: resolution.candidatePersonId };
  return { action: 'REVIEW_REQUIRED' as const, reason: resolution.status === 'RESTRICTED_POSSIBLE_MATCH' ? 'CONFLICT_REQUIRES_REVIEW' as const : 'INSUFFICIENT_EVIDENCE' as const, status: 'needs_more_information' as const, risk: 'B' as const, personId: null };
}

/** Append-only evidence command: resolution and Person selection stay server-only. */
export async function submitIdentityDecisionEvidence(pool: IdentityDecisionPool, input: SubmitIdentityDecisionEvidenceInput): Promise<IdentityDecisionRecord> {
  if (!isPublicIdentityDecisionRef(input.decisionRef) || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'Invalid evidence revision request.');
  const evidenceTypes = sanitizeList(input.evidenceTypes, EVIDENCE_TYPE_ALLOWLIST);
  const fingerprint = revisionFingerprint(input, evidenceTypes);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!await resolveAuthorityRole(client, input.institutionId, input.actorPersonId)) throw new IdentityDecisionError('UNAUTHORIZED_DECISION', 'Actor is not authorized to submit identity evidence.');
    const found = await client.query<any>('SELECT * FROM identity_resolution_decisions WHERE institution_id = $1 AND public_ref = $2 FOR UPDATE', [input.institutionId, input.decisionRef]);
    if (!found.rowCount) throw new IdentityDecisionError('DECISION_NOT_FOUND', 'Identity decision was not found in this institution.');
    const decision = found.rows[0];
    if (!decision.enrollment_offer_id || !decision.initial_identity_inputs) {
      throw new IdentityDecisionError('DECISION_BINDING_REQUIRED', 'Legacy identity decisions cannot be revised without their original intake binding.');
    }
    const replay = await client.query<any>('SELECT id FROM identity_resolution_decision_revisions WHERE decision_id = $1 AND submission_fingerprint = $2', [decision.id, fingerprint]);
    if (replay.rowCount) { await client.query('COMMIT'); return mapRow(decision, true); }
    if (decision.version !== input.expectedVersion) throw new IdentityDecisionError('DECISION_CASE_CONFLICT', 'Identity decision version is stale.');
    if (decision.status !== 'needs_more_information') throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'Evidence may only revise a decision awaiting more information.');
    const resolution = await resolvePersonForInstitution(client, input.institutionId, input.student);
    const next = deriveRevision(resolution);
    const derivedCaseKey = buildEnrollmentIdentityCaseKey(input.institutionId, decision.enrollment_offer_id, input.student);
    // A re-resolution can normalize two previously distinct reviews into the
    // same canonical case. Serialize on that derived key and reject the
    // second rebind explicitly instead of relying on the unique constraint.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [input.institutionId, `identity:${derivedCaseKey}`]);
    const caseConflict = await client.query<{ id: string }>(
      `SELECT id FROM identity_resolution_decisions
        WHERE institution_id = $1 AND case_key = $2 AND id <> $3
        FOR UPDATE`,
      [input.institutionId, derivedCaseKey, decision.id],
    );
    if (caseConflict.rowCount) {
      throw new IdentityDecisionError('DECISION_CASE_CONFLICT', 'A re-resolução já pertence a outra decisão de identidade nesta instituição.');
    }
    // The decision row is already locked. Lock its latest child row (rather
    // than an aggregate) so revision numbering is valid PostgreSQL locking.
    const last = await client.query<{ revision_number: number }>('SELECT revision_number FROM identity_resolution_decision_revisions WHERE decision_id = $1 ORDER BY revision_number DESC LIMIT 1 FOR UPDATE', [decision.id]);
    const revisionNumber = (last.rows[0]?.revision_number ?? 0) + 1;
    await client.query(`INSERT INTO identity_resolution_decision_revisions (decision_id, revision_number, previous_case_key, derived_case_key, submission_fingerprint, submitted_by_person_id, request_id, correlation_id, submitted_identity_inputs, evidence_metadata, resolution_status, resolution_match_reasons, resolution_candidate_count, resolved_person_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12::jsonb,$13,$14::uuid)`, [decision.id, revisionNumber, decision.case_key, derivedCaseKey, fingerprint, input.actorPersonId, input.requestId ?? null, input.correlationId ?? null, JSON.stringify(revisionInput(input.student)), JSON.stringify(evidenceTypes), resolution.status, JSON.stringify(resolution.matchReasons), resolution.candidateCount, next.personId]);
    // The original decision evidence/fingerprint remains its immutable initial
    // snapshot. Every submitted input, evidence item and resolution result is
    // retained only in the append-only revision row above.
    const updated = await client.query<any>(`UPDATE identity_resolution_decisions SET case_key=$1, proposed_action=$2, reason_code=$3, risk_level=$4, status=$5, proposed_candidate_person_id=$6::uuid, candidate_person_ids=$7::jsonb, decided_by_person_id=NULL, approved_by_person_id=NULL, decided_at=NULL, updated_at=now(), version=version+1 WHERE id=$8::uuid AND institution_id=$9::uuid RETURNING *`, [derivedCaseKey, next.action, next.reason, next.risk, next.status, next.personId, JSON.stringify(next.personId ? [next.personId] : []), decision.id, input.institutionId]);
    await client.query('COMMIT'); return mapRow(updated.rows[0]);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export function toPublicIdentityDecision(row: any): PublicIdentityDecision {
  return {
    decisionRef: row.public_ref,
    status: row.status,
    riskLevel: row.risk_level,
    proposedAction: row.proposed_action,
    reasonCode: row.reason_code,
    version: row.version,
  };
}

export async function listPublicIdentityDecisions(pool: IdentityDecisionPool, institutionId: string, actorPersonId: string): Promise<PublicIdentityDecision[]> {
  const client = await pool.connect();
  try {
    const role = await resolveAuthorityRole(client, institutionId, actorPersonId);
    if (role !== 'director' && role !== 'institution_admin') throw new IdentityDecisionError('UNAUTHORIZED_DECISION', 'Leadership access is required to review identity decisions.');
    const result = await client.query<any>(`SELECT public_ref, status, risk_level, proposed_action, reason_code, version
      FROM identity_resolution_decisions WHERE institution_id = $1 AND status NOT IN ('approved', 'rejected') ORDER BY created_at ASC`, [institutionId]);
    return result.rows.map(toPublicIdentityDecision);
  } finally { client.release(); }
}

export async function getPublicIdentityDecision(pool: IdentityDecisionPool, institutionId: string, actorPersonId: string, decisionRef: string): Promise<PublicIdentityDecision> {
  if (!isPublicIdentityDecisionRef(decisionRef)) throw new IdentityDecisionError('DECISION_NOT_FOUND', 'Identity decision was not found in this institution.');
  const client = await pool.connect();
  try {
    const role = await resolveAuthorityRole(client, institutionId, actorPersonId);
    if (role !== 'director' && role !== 'institution_admin') throw new IdentityDecisionError('UNAUTHORIZED_DECISION', 'Leadership access is required to review identity decisions.');
    const result = await client.query<any>(`SELECT public_ref, status, risk_level, proposed_action, reason_code, version
      FROM identity_resolution_decisions WHERE institution_id = $1 AND public_ref = $2`, [institutionId, decisionRef]);
    if (!result.rowCount) throw new IdentityDecisionError('DECISION_NOT_FOUND', 'Identity decision was not found in this institution.');
    return toPublicIdentityDecision(result.rows[0]);
  } finally { client.release(); }
}

export async function proposeIdentityDecision(
  pool: IdentityDecisionPool,
  input: ProposeIdentityDecisionInput,
): Promise<IdentityDecisionRecord> {
  const policy = POLICY[input.reasonCode];
  if (!policy) throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'Unsupported reason code.');

  const caseKey = sanitizeCaseKey(input.caseKey);
  const candidatePersonIds = sanitizeCandidateIds(input.candidatePersonIds);
  const matchReasons = sanitizeList(input.matchReasons, MATCH_REASON_ALLOWLIST);
  const evidenceTypes = sanitizeList(input.evidenceTypes, EVIDENCE_TYPE_ALLOWLIST);
  if (input.intakeBinding && !validUuid(input.intakeBinding.offerId)) {
    throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'Invalid server intake binding.');
  }
  validateProposalSemantics(input, candidatePersonIds);
  const requestFingerprint = fingerprintProposal(input, policy, candidatePersonIds, matchReasons, evidenceTypes);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [input.institutionId, `identity:${caseKey}`]);

    const role = await resolveAuthorityRole(client, input.institutionId, input.actorPersonId);
    if (!role || !policy.allowedProposalRoles.includes(role)) {
      throw new IdentityDecisionError('UNAUTHORIZED_DECISION', 'Actor is not authorized to propose this identity decision.');
    }

    const existing = await client.query<any>(
      `SELECT * FROM identity_resolution_decisions
        WHERE institution_id = $1 AND case_key = $2
        FOR UPDATE`,
      [input.institutionId, caseKey],
    );
    if (existing.rowCount) {
      if (existing.rows[0].request_fingerprint !== requestFingerprint) {
        throw new IdentityDecisionError('DECISION_CASE_CONFLICT', 'caseKey already exists with different decision evidence.');
      }
      await client.query('COMMIT');
      return mapRow(existing.rows[0], true);
    }

    const created = await client.query<any>(
      `INSERT INTO identity_resolution_decisions (
         institution_id, case_key, request_fingerprint, risk_level, proposed_action, status, reason_code,
         proposed_candidate_person_id, candidate_person_ids, match_reasons, evidence_types,
         requested_by_person_id, request_id, correlation_id, policy_version, enrollment_offer_id, initial_identity_inputs
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14, 'D05-v1', $15::uuid, $16::jsonb)
       RETURNING *`,
      [
        input.institutionId,
        caseKey,
        requestFingerprint,
        policy.riskLevel,
        input.proposedAction,
        policy.initialStatus,
        input.reasonCode,
        input.proposedCandidatePersonId ?? null,
        JSON.stringify(candidatePersonIds),
        JSON.stringify(matchReasons),
        JSON.stringify(evidenceTypes),
        input.actorPersonId,
        input.requestId ?? null,
        input.correlationId ?? null,
        input.intakeBinding?.offerId ?? null,
        input.intakeBinding ? JSON.stringify(revisionInput(input.intakeBinding.student)) : null,
      ],
    );

    await client.query('COMMIT');
    return mapRow(created.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function decideIdentityDecision(
  pool: IdentityDecisionPool,
  input: DecideIdentityDecisionInput,
): Promise<IdentityDecisionRecord> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query<any>(
      `SELECT * FROM identity_resolution_decisions
        WHERE id = $1 AND institution_id = $2
        FOR UPDATE`,
      [input.decisionId, input.institutionId],
    );
    if (!existing.rowCount) {
      throw new IdentityDecisionError('DECISION_NOT_FOUND', 'Identity decision was not found in this institution.');
    }

    const row = existing.rows[0];
    const policy = POLICY[row.reason_code as IdentityDecisionReasonCode];
    if (row.status === 'approved' || row.status === 'rejected') {
      const sameOutcome = (row.status === 'approved' && input.outcome === 'approve')
        || (row.status === 'rejected' && input.outcome === 'reject');
      if (sameOutcome) { await client.query('COMMIT'); return mapRow(row, true); }
      throw new IdentityDecisionError('DECISION_ALREADY_FINAL', 'Identity decision is already final.');
    }
    if (row.status === 'needs_more_information' && input.outcome === 'request_more_information') {
      await client.query('COMMIT');
      return mapRow(row, true);
    }
    if (row.status === 'needs_more_information' && input.outcome === 'approve') {
      throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'A review-only decision cannot be approved into a bypass.');
    }

    const role = await resolveAuthorityRole(client, input.institutionId, input.actorPersonId);
    if (!role) throw new IdentityDecisionError('UNAUTHORIZED_DECISION', 'Actor has no active decision authority in this institution.');

    if (policy.requireIndependentApprover && input.actorPersonId === row.requested_by_person_id) {
      throw new IdentityDecisionError('SEGREGATION_REQUIRED', 'The proposer cannot approve their own sensitive identity decision.');
    }

    if (input.outcome === 'approve') {
      if (policy.requiredApprovalRole === null) {
        throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'This policy outcome does not support approval.');
      }
      if (policy.requiredApprovalRole === 'leadership' && role !== 'director' && role !== 'institution_admin') {
        throw new IdentityDecisionError('UNAUTHORIZED_DECISION', 'Leadership approval is required.');
      }
      if (policy.requiredApprovalRole === 'institution_admin' && role !== 'institution_admin') {
        throw new IdentityDecisionError('INSTITUTION_ADMIN_REQUIRED', 'Institution Admin approval is required.');
      }
      if (policy.requireInstitutionAdminAmongApprovers) {
        const proposerRole = await resolveAuthorityRole(client, input.institutionId, row.requested_by_person_id);
        if (role !== 'institution_admin' && proposerRole !== 'institution_admin') {
          throw new IdentityDecisionError('INSTITUTION_ADMIN_REQUIRED', 'At least one independent authority must be Institution Admin.');
        }
      }
    } else if (role !== 'director' && role !== 'institution_admin') {
      throw new IdentityDecisionError('UNAUTHORIZED_DECISION', 'Only leadership may reject or request more information for a sensitive decision.');
    }

    const nextStatus: IdentityDecisionStatus = input.outcome === 'approve'
      ? 'approved'
      : input.outcome === 'reject'
        ? 'rejected'
        : 'needs_more_information';

    const updated = await client.query<any>(
      `UPDATE identity_resolution_decisions
          SET status = $1,
              decided_by_person_id = $2::uuid,
              approved_by_person_id = CASE WHEN $1 = 'approved' THEN $2::uuid ELSE NULL END,
              decided_at = CASE WHEN $1 IN ('approved', 'rejected') THEN now() ELSE NULL END,
              updated_at = now(),
              version = version + 1
        WHERE id = $3::uuid AND institution_id = $4::uuid
        RETURNING *`,
      [nextStatus, input.actorPersonId, input.decisionId, input.institutionId],
    );

    await client.query('COMMIT');
    return mapRow(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
