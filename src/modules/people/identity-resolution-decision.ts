import crypto from 'crypto';

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
}

export interface DecideIdentityDecisionInput {
  institutionId: string;
  actorPersonId: string;
  decisionId: string;
  outcome: 'approve' | 'reject' | 'request_more_information';
}

export interface IdentityDecisionRecord {
  id: string;
  institutionId: string;
  caseKey: string;
  riskLevel: 'B' | 'C';
  proposedAction: IdentityDecisionAction;
  reasonCode: IdentityDecisionReasonCode;
  status: IdentityDecisionStatus;
  requestedByPersonId: string;
  approvedByPersonId: string | null;
  version: number;
  replayed?: boolean;
}

export class IdentityDecisionError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_DECISION_INPUT'
      | 'UNAUTHORIZED_DECISION'
      | 'DECISION_CASE_CONFLICT'
      | 'DECISION_NOT_FOUND'
      | 'DECISION_ALREADY_FINAL'
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

function fingerprintProposal(input: ProposeIdentityDecisionInput, policy: Policy): string {
  const payload = JSON.stringify({
    institutionId: input.institutionId,
    caseKey: sanitizeCaseKey(input.caseKey),
    proposedAction: input.proposedAction,
    reasonCode: input.reasonCode,
    riskLevel: policy.riskLevel,
    proposedCandidatePersonId: input.proposedCandidatePersonId ?? null,
    candidatePersonIds: [...sanitizeCandidateIds(input.candidatePersonIds)].sort(),
    matchReasons: [...sanitizeList(input.matchReasons, MATCH_REASON_ALLOWLIST)].sort(),
    evidenceTypes: [...sanitizeList(input.evidenceTypes, EVIDENCE_TYPE_ALLOWLIST)].sort(),
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
    institutionId: row.institution_id,
    caseKey: row.case_key,
    riskLevel: row.risk_level,
    proposedAction: row.proposed_action,
    reasonCode: row.reason_code,
    status: row.status,
    requestedByPersonId: row.requested_by_person_id,
    approvedByPersonId: row.approved_by_person_id ?? null,
    version: row.version,
    replayed,
  };
}

export async function proposeIdentityDecision(
  pool: IdentityDecisionPool,
  input: ProposeIdentityDecisionInput,
): Promise<IdentityDecisionRecord> {
  const policy = POLICY[input.reasonCode];
  if (!policy) throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'Unsupported reason code.');
  if (input.proposedAction === 'CREATE_PERSON' && input.reasonCode !== 'NEW_PERSON_APPROVED_DESPITE_CONFLICT') {
    throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'Conflict creation requires the dedicated D-05 reason code.');
  }
  if (input.reasonCode === 'NEW_PERSON_APPROVED_DESPITE_CONFLICT' && input.proposedAction !== 'CREATE_PERSON') {
    throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'The conflict exception must propose CREATE_PERSON.');
  }
  if (['MATCH_CONFIRMED_WITH_NEW_EVIDENCE', 'MULTIPLE_CANDIDATES_RESOLVED'].includes(input.reasonCode)
      && input.proposedAction !== 'REUSE_PERSON') {
    throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'Resolved match decisions must propose REUSE_PERSON.');
  }
  if (['CONFLICT_REQUIRES_REVIEW', 'INSUFFICIENT_EVIDENCE', 'IDENTIFIER_CONFLICT'].includes(input.reasonCode)
      && input.proposedAction !== 'REVIEW_REQUIRED') {
    throw new IdentityDecisionError('INVALID_DECISION_INPUT', 'This reason code must remain REVIEW_REQUIRED until authorized resolution exists.');
  }

  const caseKey = sanitizeCaseKey(input.caseKey);
  const candidatePersonIds = sanitizeCandidateIds(input.candidatePersonIds);
  const matchReasons = sanitizeList(input.matchReasons, MATCH_REASON_ALLOWLIST);
  const evidenceTypes = sanitizeList(input.evidenceTypes, EVIDENCE_TYPE_ALLOWLIST);
  const requestFingerprint = fingerprintProposal(input, policy);
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
         requested_by_person_id, request_id, correlation_id, policy_version
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14, 'D05-v1')
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
      throw new IdentityDecisionError('DECISION_ALREADY_FINAL', 'Identity decision is already final.');
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
              approved_by_person_id = $2,
              decided_at = CASE WHEN $1 IN ('approved', 'rejected') THEN now() ELSE NULL END,
              updated_at = now(),
              version = version + 1
        WHERE id = $3 AND institution_id = $4
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
