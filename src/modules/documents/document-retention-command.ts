/**
 * Documents Foundation I6 — Retention & Hold Commands
 * Mission: DOCUMENTS-FOUNDATION-I6
 *
 * Commands: AssignRetention, EvaluateDeletionEligibility, AuthorizeDeletion, PlaceHold, ReleaseHold
 * All commands use the established executeIdempotentDocumentsCommand pattern.
 * No legal periods or jurisdiction defaults are permitted.
 * Absent jurisdiction/policy → FAIL_CLOSED.
 */

import type { Pool, PoolClient } from 'pg';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import {
  createRetentionAssignmentFingerprint,
  createHoldFingerprint,
  createHoldReleaseFingerprint,
  createDeletionAuthorizationFingerprint,
  type RetentionAssignmentRecord,
  type RetentionHoldRecord,
  type DeletionAuthorizationRecord,
  type DeletionEligibilityResult,
} from './document-retention-model.ts';
import type { RetentionPolicyEngine } from './document-retention-policy.ts';
import {
  PostgresRetentionAssignmentRepository,
  PostgresRetentionHoldRepository,
  PostgresDeletionAuthorizationRepository,
} from './document-retention-repository.ts';
import { PostgresDocumentRepository } from './document-repository.ts';
import { PostgresDocumentAuditRepository } from './document-audit.ts';
import { PostgresDocumentOutboxRepository } from './document-event-repository.ts';
import { executeIdempotentDocumentsCommand } from './document-command.ts';
import {
  DefaultDocumentAuthorizationAuthority,
  createDefaultDocumentAuthorizationRules,
  type DocumentAuthorizationAuthority,
} from './document-authorization-policy.ts';

const retentionAssignmentRepo = new PostgresRetentionAssignmentRepository();
const holdRepo = new PostgresRetentionHoldRepository();
const deletionAuthRepo = new PostgresDeletionAuthorizationRepository();
const docRepo = new PostgresDocumentRepository();
const auditRepo = new PostgresDocumentAuditRepository();
const outboxRepo = new PostgresDocumentOutboxRepository();

// ─── AssignRetention ──────────────────────────────────────────────────────────

export interface AssignRetentionInput {
  documentId: string;
  versionId: string;
  jurisdictionProfileId: string;
  category?: string;
  purpose?: string | null;
  clockTriggerEventAt: Date;
  policyId?: string;
  correlationId?: string | null;
}

export async function assignRetentionCommand(params: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  policyEngine: RetentionPolicyEngine;
  authorizationAuthority?: DocumentAuthorizationAuthority;
  input: AssignRetentionInput;
}): Promise<{ replayed: boolean; result: RetentionAssignmentRecord }> {
  const { pool, context, idempotencyKey, policyEngine, input } = params;

  // 1. Clock trigger validation — explicit, valid Date required
  if (!input.clockTriggerEventAt || Number.isNaN(new Date(input.clockTriggerEventAt).getTime())) {
    throw new Error('CLOCK_TRIGGER_EVENT_REQUIRED: clockTriggerEventAt must be a valid Date.');
  }

  // 2. Pre-verify document and version ownership, status, and authoritative category
  const client0 = await pool.connect();
  let authoritativeCategory: string;
  let documentStatus: string;
  let versionStatus: string;
  try {
    const docRes = await client0.query<{ id: string; category: string; status: string }>(
      `SELECT id, category, status FROM documents
       WHERE institution_id = $1 AND id = $2`,
      [context.institutionId, input.documentId],
    );
    if (docRes.rows.length === 0) {
      throw new Error(`DOCUMENT_VERSION_NOT_FOUND: document ${input.documentId} not found for institution.`);
    }
    const doc = docRes.rows[0];
    authoritativeCategory = doc.category;
    documentStatus = doc.status;

    if (documentStatus === 'deletion_in_progress' || documentStatus === 'deleted') {
      throw new Error(`DOCUMENT_DELETION_IN_PROGRESS: Cannot assign retention to document with status='${documentStatus}'.`);
    }

    // Authoritative document category wins: client category mismatch => DENY
    if (input.category && input.category !== authoritativeCategory) {
      throw new Error(
        `CATEGORY_MISMATCH: Input category '${input.category}' does not match authoritative document category '${authoritativeCategory}'.`,
      );
    }

    const verRes = await client0.query<{ id: string; document_id: string; status: string }>(
      `SELECT id, document_id, status FROM document_versions
       WHERE institution_id = $1 AND id = $2`,
      [context.institutionId, input.versionId],
    );
    if (verRes.rows.length === 0 || verRes.rows[0].document_id !== input.documentId) {
      throw new Error(`DOCUMENT_VERSION_NOT_FOUND: version ${input.versionId}`);
    }
    versionStatus = verRes.rows[0].status;
    if (versionStatus === 'deletion_in_progress' || versionStatus === 'deleted') {
      throw new Error(`VERSION_DELETION_IN_PROGRESS: Cannot assign retention to version being deleted.`);
    }
  } finally {
    client0.release();
  }

  // 3. Central H1 Authorization check (action=assign_retention)
  const authAuthority =
    params.authorizationAuthority ??
    new DefaultDocumentAuthorizationAuthority({
      rules: createDefaultDocumentAuthorizationRules(),
    });

  const authDecision = authAuthority.authorize({
    institutionId: context.institutionId,
    personId: context.personId,
    role: context.role,
    action: 'assign_retention',
    documentId: input.documentId,
    versionId: input.versionId,
    documentCategory: authoritativeCategory,
    documentStatus: documentStatus as any,
    versionStatus: versionStatus as any,
  });

  if (!authDecision.allowed) {
    throw new Error(
      `AUTHORIZATION_DENIED: Role '${context.role}' is not authorized to assign retention. Reason: ${authDecision.reasonCode}`,
    );
  }

  // 4. Resolve policy with authoritative category — FAIL_CLOSED if not found
  const policy = policyEngine.resolvePolicy({
    institutionId: context.institutionId,
    category: authoritativeCategory,
    jurisdictionProfileId: input.jurisdictionProfileId,
    policyId: input.policyId,
  });
  if (!policy) {
    throw new Error(
      `JURISDICTION_PROFILE_MISSING: No governed retention policy found for ` +
      `category='${authoritativeCategory}' jurisdiction='${input.jurisdictionProfileId}'. ` +
      `PRODUCTION_AUTOMATED_RETENTION=BLOCKED until approved profiles are configured.`,
    );
  }

  if (policy.category !== authoritativeCategory) {
    throw new Error(
      `POLICY_CATEGORY_MISMATCH: Policy category '${policy.category}' does not match authoritative category '${authoritativeCategory}'.`,
    );
  }

  const retainUntil = policyEngine.calculateRetainUntil(policy, input.clockTriggerEventAt);
  const fingerprint = createRetentionAssignmentFingerprint(
    context.institutionId,
    input.versionId,
    policy.policyId,
    policy.policyVersion,
    policy.jurisdictionProfileId,
    policy.clockTriggerType,
    input.clockTriggerEventAt,
  );

  return executeIdempotentDocumentsCommand<RetentionAssignmentRecord>({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.retention.assign',
      idempotencyKey,
      canonicalFingerprint: fingerprint,
    },
    execute: async (client: PoolClient) => {
      // Re-verify under row-level lock inside transaction
      const verLock = await client.query<{ id: string; document_id: string; status: string }>(
        `SELECT id, document_id, status FROM document_versions
         WHERE institution_id = $1 AND id = $2 AND document_id = $3
         FOR UPDATE`,
        [context.institutionId, input.versionId, input.documentId],
      );
      if (verLock.rows.length === 0) {
        throw new Error(`DOCUMENT_VERSION_NOT_FOUND: version ${input.versionId}`);
      }
      if (verLock.rows[0].status === 'deletion_in_progress' || verLock.rows[0].status === 'deleted') {
        throw new Error(`VERSION_DELETION_IN_PROGRESS: Cannot assign retention to version being deleted.`);
      }

      const assignment = await retentionAssignmentRepo.insert(client, {
        institutionId: context.institutionId,
        documentId: input.documentId,
        versionId: input.versionId,
        policyId: policy.policyId,
        policyVersion: policy.policyVersion,
        jurisdictionProfileId: policy.jurisdictionProfileId,
        jurisdictionProfileVersion: policy.jurisdictionProfileVersion,
        category: authoritativeCategory,
        purpose: input.purpose ?? null,
        clockTriggerType: policy.clockTriggerType,
        clockTriggerEventAt: input.clockTriggerEventAt,
        retainUntil,
        assignedByPersonId: context.personId,
        correlationId: input.correlationId ?? null,
      });

      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: input.documentId,
        versionId: input.versionId,
        actorPersonId: context.personId,
        action: 'document.retention_assigned',
        outcome: 'success',
        correlationId: input.correlationId ?? null,
        details: {
          assignmentId: assignment.id,
          policyId: policy.policyId,
          retainUntil: retainUntil.toISOString(),
          clockTriggerType: policy.clockTriggerType,
        },
      });

      await outboxRepo.insertEvent(client, {
        institutionId: context.institutionId,
        eventType: 'document.retention_assigned',
        aggregateType: 'document',
        aggregateId: input.documentId,
        actorPersonId: context.personId,
        actorKind: 'user',
        correlationId: input.correlationId ?? null,
        causationId: assignment.id,
        payload: {
          assignmentId: assignment.id,
          documentId: input.documentId,
          versionId: input.versionId,
          policyId: policy.policyId,
          retainUntil: retainUntil.toISOString(),
          clockTriggerType: policy.clockTriggerType,
        },
      });

      return { resultRef: assignment.id, result: assignment };
    },
    loadResult: async (client: PoolClient, resultRef: string) => {
      const assignment = await retentionAssignmentRepo.getById(client, context.institutionId, resultRef);
      if (!assignment) throw new Error(`RETENTION_ASSIGNMENT_NOT_FOUND: ${resultRef}`);
      return assignment;
    },
  });
}

// ─── EvaluateDeletionEligibility ─────────────────────────────────────────────

export interface EvaluateDeletionEligibilityInput {
  documentId: string;
  versionId: string;
  correlationId?: string | null;
}

export async function evaluateDeletionEligibilityCommand(params: {
  pool: Pool;
  context: InstitutionalContext;
  input: EvaluateDeletionEligibilityInput;
}): Promise<DeletionEligibilityResult> {
  const { pool, context, input } = params;
  const client = await pool.connect();
  try {
    // Verify document and version ownership under tenant context
    const docRes = await client.query<{ id: string; status: string }>(
      `SELECT id, status FROM documents WHERE institution_id = $1 AND id = $2`,
      [context.institutionId, input.documentId],
    );
    if (docRes.rows.length === 0) {
      throw new Error(`DOCUMENT_NOT_FOUND: document ${input.documentId}`);
    }

    const version = await docRepo.getVersionById(client, context.institutionId, input.versionId);
    if (!version || version.documentId !== input.documentId) {
      throw new Error(`DOCUMENT_NOT_FOUND: version ${input.versionId} not found for institution.`);
    }

    const assignment = await retentionAssignmentRepo.getByVersionId(client, context.institutionId, input.versionId);
    const activeHoldCount = await holdRepo.countActiveHoldsForVersion(client, context.institutionId, input.versionId);

    const now = new Date();
    const retentionExpired = assignment != null && assignment.retainUntil <= now;
    const noActiveHolds = activeHoldCount === 0;
    const policyResolved = assignment != null;
    const jurisdictionValid = assignment != null && assignment.jurisdictionProfileId.length > 0;

    const blockers: string[] = [];
    if (!policyResolved) blockers.push('NO_RETENTION_ASSIGNMENT');
    if (!retentionExpired) blockers.push('RETENTION_ACTIVE');
    if (!noActiveHolds) blockers.push(`ACTIVE_HOLDS:${activeHoldCount}`);
    if (!jurisdictionValid) blockers.push('JURISDICTION_INVALID');

    const eligible = policyResolved && retentionExpired && noActiveHolds && jurisdictionValid;

    // Update retention_status to eligible_for_deletion if eligible
    if (eligible && assignment && assignment.retentionStatus === 'retention_expired') {
      await retentionAssignmentRepo.updateStatus(client, context.institutionId, assignment.id, 'eligible_for_deletion');
    } else if (assignment && assignment.retentionStatus === 'retention_active' && retentionExpired) {
      await retentionAssignmentRepo.updateStatus(client, context.institutionId, assignment.id, 'retention_expired');
    }

    return { eligible, retentionExpired, noActiveHolds, policyResolved, jurisdictionValid, blockers };
  } finally {
    client.release();
  }
}

// ─── AuthorizeDeletion ────────────────────────────────────────────────────────

export interface AuthorizeDeletionInput {
  documentId: string;
  versionId: string;
  correlationId?: string | null;
}

export async function authorizeDeletionCommand(params: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  policyEngine: RetentionPolicyEngine;
  authorizationAuthority?: DocumentAuthorizationAuthority;
  input: AuthorizeDeletionInput;
}): Promise<{ replayed: boolean; result: DeletionAuthorizationRecord }> {
  const { pool, context, idempotencyKey, policyEngine, input } = params;

  // 1. Pre-validation checks before transaction
  const client0 = await pool.connect();
  let assignment: RetentionAssignmentRecord;
  try {
    const docRes = await client0.query<{ id: string; status: string }>(
      `SELECT id, status FROM documents
       WHERE institution_id = $1 AND id = $2`,
      [context.institutionId, input.documentId],
    );
    if (docRes.rows.length === 0) {
      throw new Error(`DOCUMENT_NOT_FOUND: document ${input.documentId}`);
    }
    if (docRes.rows[0].status === 'deletion_in_progress' || docRes.rows[0].status === 'deleted') {
      throw new Error(`DOCUMENT_DELETION_IN_PROGRESS: Document status is '${docRes.rows[0].status}'.`);
    }

    const ver = await docRepo.getVersionById(client0, context.institutionId, input.versionId);
    if (!ver || ver.documentId !== input.documentId) {
      throw new Error(`DOCUMENT_NOT_FOUND: version ${input.versionId}`);
    }
    if (ver.status === 'deletion_in_progress' || ver.status === 'deleted') {
      throw new Error(`VERSION_DELETION_IN_PROGRESS: Version status is '${ver.status}'.`);
    }

    const a = await retentionAssignmentRepo.getByVersionId(client0, context.institutionId, input.versionId);
    if (!a) throw new Error('RETENTION_ASSIGNMENT_MISSING: Cannot authorize deletion without retention assignment.');
    const isExpired = a.retainUntil <= new Date() || ['retention_expired', 'eligible_for_deletion'].includes(a.retentionStatus);
    if (!isExpired) {
      throw new Error(`RETENTION_ACTIVE: Cannot authorize deletion — retention_status=${a.retentionStatus}`);
    }
    const activeHolds = await holdRepo.countActiveHoldsForVersion(client0, context.institutionId, input.versionId);
    if (activeHolds > 0) {
      throw new Error(`ACTIVE_HOLD_PREVENTS_DELETION: ${activeHolds} active hold(s) block deletion.`);
    }
    assignment = a;
  } finally {
    client0.release();
  }

  // 2. Central H1 Authorization Authority check (action=authorize_deletion)
  const authAuthority =
    params.authorizationAuthority ??
    new DefaultDocumentAuthorizationAuthority({
      rules: createDefaultDocumentAuthorizationRules(),
    });

  const authDecision = authAuthority.authorize({
    institutionId: context.institutionId,
    personId: context.personId,
    role: context.role,
    action: 'authorize_deletion',
    documentId: input.documentId,
    versionId: input.versionId,
    documentCategory: assignment.category,
  });

  if (!authDecision.allowed) {
    throw new Error(
      `DELETION_AUTHORIZATION_DENIED: Role '${context.role}' is not authorized to authorize deletion. Reason: ${authDecision.reasonCode}`,
    );
  }

  // 3. Governed Retention Policy Engine check
  const policy = policyEngine.resolvePolicy({
    institutionId: context.institutionId,
    category: assignment.category,
    jurisdictionProfileId: assignment.jurisdictionProfileId,
    policyId: assignment.policyId,
  });
  if (!policy || !policyEngine.isDeletionAuthorized(policy, context.role)) {
    throw new Error(
      `DELETION_AUTHORIZATION_DENIED: Actor role '${context.role}' ` +
      `is not permitted to authorize deletion under policy '${assignment.policyId}'.`,
    );
  }

  const fingerprint = createDeletionAuthorizationFingerprint(
    context.institutionId,
    input.versionId,
    assignment.id,
    assignment.policyId,
  );

  return executeIdempotentDocumentsCommand<DeletionAuthorizationRecord>({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.deletion.authorize',
      idempotencyKey,
      canonicalFingerprint: fingerprint,
    },
    execute: async (client: PoolClient) => {
      // 4. Transactional revalidation under FOR UPDATE locks
      // Lock version row
      const verLock = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM document_versions
         WHERE institution_id = $1 AND id = $2 AND document_id = $3
         FOR UPDATE`,
        [context.institutionId, input.versionId, input.documentId],
      );
      if (verLock.rows.length === 0) {
        throw new Error(`DOCUMENT_NOT_FOUND: version ${input.versionId}`);
      }
      if (verLock.rows[0].status === 'deletion_in_progress' || verLock.rows[0].status === 'deleted') {
        throw new Error(`VERSION_DELETION_IN_PROGRESS: Cannot authorize deletion on version with status='${verLock.rows[0].status}'.`);
      }

      // Lock retention assignment row and re-verify expiration
      const assignLock = await client.query<{ id: string; retention_status: string; retain_until: Date }>(
        `SELECT id, retention_status, retain_until FROM document_retention_assignments
         WHERE institution_id = $1 AND id = $2 AND version_id = $3
         FOR UPDATE`,
        [context.institutionId, assignment.id, input.versionId],
      );
      if (assignLock.rows.length === 0) {
        throw new Error('RETENTION_ASSIGNMENT_MISSING');
      }
      const txA = assignLock.rows[0];
      if (txA.retention_status === 'deletion_authorized') {
        const existingAuth = await client.query<{ id: string }>(
          `SELECT id FROM document_deletion_authorizations
           WHERE institution_id = $1 AND version_id = $2 AND retention_assignment_id = $3`,
          [context.institutionId, input.versionId, assignment.id],
        );
        if (existingAuth.rows.length > 0) {
          throw new Error('DELETION_ALREADY_AUTHORIZED: Deletion is already authorized for this version.');
        }
      }
      const isStillExpired =
        new Date(txA.retain_until) <= new Date() ||
        ['retention_expired', 'eligible_for_deletion', 'deletion_authorized'].includes(txA.retention_status);
      if (!isStillExpired) {
        throw new Error(`RETENTION_ACTIVE: Cannot authorize deletion — retention_status=${txA.retention_status}`);
      }

      // Re-check holds inside transaction under lock (concurrency guard)
      const activeHolds = await holdRepo.countActiveHoldsForVersion(client, context.institutionId, input.versionId);
      if (activeHolds > 0) {
        throw new Error(`ACTIVE_HOLD_PREVENTS_DELETION: ${activeHolds} active hold(s) block deletion (re-check).`);
      }

      const auth = await deletionAuthRepo.insert(client, {
        institutionId: context.institutionId,
        documentId: input.documentId,
        versionId: input.versionId,
        retentionAssignmentId: assignment.id,
        policyBasis: assignment.policyId,
        policyVersion: assignment.policyVersion,
        jurisdictionProfileId: assignment.jurisdictionProfileId,
        authorizedByPersonId: context.personId,
        correlationId: input.correlationId ?? null,
      });

      await retentionAssignmentRepo.updateStatus(client, context.institutionId, assignment.id, 'deletion_authorized');

      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: input.documentId,
        versionId: input.versionId,
        actorPersonId: context.personId,
        action: 'document.deletion_authorized',
        outcome: 'success',
        correlationId: input.correlationId ?? null,
        details: {
          authorizationId: auth.id,
          policyBasis: assignment.policyId,
          actorAuthorityScope: context.role,
        },
      });

      await outboxRepo.insertEvent(client, {
        institutionId: context.institutionId,
        eventType: 'document.deletion_authorized',
        aggregateType: 'document',
        aggregateId: input.documentId,
        actorPersonId: context.personId,
        actorKind: 'user',
        correlationId: input.correlationId ?? null,
        causationId: auth.id,
        payload: {
          authorizationId: auth.id,
          documentId: input.documentId,
          versionId: input.versionId,
          retentionAssignmentId: assignment.id,
          policyBasis: assignment.policyId,
        },
      });

      return { resultRef: auth.id, result: auth };
    },
    loadResult: async (client: PoolClient, resultRef: string) => {
      const a = await deletionAuthRepo.getById(client, context.institutionId, resultRef);
      if (!a) throw new Error(`DELETION_AUTHORIZATION_NOT_FOUND: ${resultRef}`);
      return a;
    },
  });
}

// ─── PlaceHold ────────────────────────────────────────────────────────────────

export interface PlaceHoldInput {
  documentId: string;
  versionId: string;
  holdType: 'legal' | 'administrative';
  authority: string;
  reason: string;
  correlationId?: string | null;
}

export async function placeHoldCommand(params: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  policyEngine: RetentionPolicyEngine;
  authorizationAuthority?: DocumentAuthorizationAuthority;
  input: PlaceHoldInput;
}): Promise<{ replayed: boolean; result: RetentionHoldRecord }> {
  const { pool, context, idempotencyKey, policyEngine, input } = params;

  // 1. Validate inputs
  if (input.holdType !== 'legal' && input.holdType !== 'administrative') {
    throw new Error('INVALID_HOLD_TYPE: holdType must be "legal" or "administrative".');
  }

  // 2. Pre-verify document, version, and retention assignment
  const client0 = await pool.connect();
  let policyCategory: string;
  let policyJurisdiction: string;
  try {
    const docRes = await client0.query<{ id: string; category: string; status: string }>(
      `SELECT id, category, status FROM documents
       WHERE institution_id = $1 AND id = $2`,
      [context.institutionId, input.documentId],
    );
    if (docRes.rows.length === 0) {
      throw new Error(`DOCUMENT_NOT_FOUND: document ${input.documentId}`);
    }
    if (docRes.rows[0].status === 'deletion_in_progress' || docRes.rows[0].status === 'deleted') {
      throw new Error(`DOCUMENT_DELETION_IN_PROGRESS: Cannot place hold on document with status='${docRes.rows[0].status}'.`);
    }

    const ver = await docRepo.getVersionById(client0, context.institutionId, input.versionId);
    if (!ver || ver.documentId !== input.documentId) {
      throw new Error(`DOCUMENT_NOT_FOUND: version ${input.versionId}`);
    }
    if (ver.status === 'deletion_in_progress' || ver.status === 'deleted') {
      throw new Error(`VERSION_DELETION_IN_PROGRESS: Cannot place hold on version with status='${ver.status}'.`);
    }

    const a = await retentionAssignmentRepo.getByVersionId(client0, context.institutionId, input.versionId);
    if (!a) throw new Error('RETENTION_ASSIGNMENT_MISSING: Hold requires a retention assignment on the version.');
    policyCategory = a.category;
    policyJurisdiction = a.jurisdictionProfileId;
  } finally {
    client0.release();
  }

  // 3. Central H1 Authorization Authority check (action=place_hold)
  const authAuthority =
    params.authorizationAuthority ??
    new DefaultDocumentAuthorizationAuthority({
      rules: createDefaultDocumentAuthorizationRules(),
    });

  const authDecision = authAuthority.authorize({
    institutionId: context.institutionId,
    personId: context.personId,
    role: context.role,
    action: 'place_hold',
    documentId: input.documentId,
    versionId: input.versionId,
    documentCategory: policyCategory,
  });

  if (!authDecision.allowed) {
    throw new Error(
      `HOLD_AUTHORITY_DENIED: Role '${context.role}' is not authorized to place hold. Reason: ${authDecision.reasonCode}`,
    );
  }

  // 4. Governed Retention Policy Engine check
  const policy = policyEngine.resolvePolicy({
    institutionId: context.institutionId,
    category: policyCategory,
    jurisdictionProfileId: policyJurisdiction,
  });
  if (!policy || !policyEngine.isHoldAuthorized(policy, input.holdType, context.role)) {
    throw new Error(
      `HOLD_AUTHORITY_DENIED: Actor role '${context.role}' cannot place ` +
      `a '${input.holdType}' hold under policy '${policy?.policyId ?? 'none'}'.`,
    );
  }

  const fingerprint = createHoldFingerprint(
    context.institutionId,
    input.versionId,
    input.holdType,
    input.authority,
    input.reason,
  );

  return executeIdempotentDocumentsCommand<RetentionHoldRecord>({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.hold.place',
      idempotencyKey,
      canonicalFingerprint: fingerprint,
    },
    execute: async (client: PoolClient) => {
      // Serialize with concurrent deletion: lock document_versions row
      const verLock = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM document_versions
          WHERE institution_id = $1 AND id = $2 AND document_id = $3
          FOR UPDATE`,
        [context.institutionId, input.versionId, input.documentId],
      );
      if (verLock.rows.length === 0) {
        throw new Error(`DOCUMENT_NOT_FOUND: version ${input.versionId}`);
      }
      const verStatus = verLock.rows[0].status;
      if (verStatus === 'deletion_in_progress' || verStatus === 'deleted') {
        throw new Error(
          `VERSION_DELETION_IN_PROGRESS: Cannot place hold on version with status='${verStatus}'.`,
        );
      }

      const hold = await holdRepo.insert(client, {
        institutionId: context.institutionId,
        documentId: input.documentId,
        versionId: input.versionId,
        holdType: input.holdType,
        authority: input.authority,
        reason: input.reason,
        createdByPersonId: context.personId,
        correlationId: input.correlationId ?? null,
      });

      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: input.documentId,
        versionId: input.versionId,
        actorPersonId: context.personId,
        action: 'document.hold_placed',
        outcome: 'success',
        correlationId: input.correlationId ?? null,
        details: {
          holdId: hold.id,
          holdType: input.holdType,
          authority: input.authority,
        },
      });

      await outboxRepo.insertEvent(client, {
        institutionId: context.institutionId,
        eventType: 'document.hold_placed',
        aggregateType: 'document',
        aggregateId: input.documentId,
        actorPersonId: context.personId,
        actorKind: 'user',
        correlationId: input.correlationId ?? null,
        causationId: hold.id,
        payload: {
          holdId: hold.id,
          documentId: input.documentId,
          versionId: input.versionId,
          holdType: input.holdType,
          authority: input.authority,
          reason: input.reason,
        },
      });

      return { resultRef: hold.id, result: hold };
    },
    loadResult: async (client: PoolClient, resultRef: string) => {
      const h = await holdRepo.getById(client, context.institutionId, resultRef);
      if (!h) throw new Error(`HOLD_NOT_FOUND: ${resultRef}`);
      return h;
    },
  });
}

// ─── ReleaseHold ──────────────────────────────────────────────────────────────

export interface ReleaseHoldInput {
  holdId: string;
  documentId: string;
  versionId: string;
  releaseReason: string;
  correlationId?: string | null;
}

export async function releaseHoldCommand(params: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  policyEngine: RetentionPolicyEngine;
  authorizationAuthority?: DocumentAuthorizationAuthority;
  input: ReleaseHoldInput;
}): Promise<{ replayed: boolean; result: RetentionHoldRecord }> {
  const { pool, context, idempotencyKey, policyEngine, input } = params;

  // 1. Verify hold belongs to this institution, document, version before fingerprinting
  const client0 = await pool.connect();
  let existingHold: RetentionHoldRecord;
  let policyCategory = '';
  let policyJurisdiction = '';
  try {
    const h = await holdRepo.getById(client0, context.institutionId, input.holdId);
    if (!h) throw new Error(`HOLD_NOT_FOUND: ${input.holdId} not found for institution.`);
    if (h.versionId !== input.versionId || h.documentId !== input.documentId) {
      throw new Error('HOLD_DOCUMENT_MISMATCH: Hold does not belong to the specified document/version.');
    }
    existingHold = h;

    const docRes = await client0.query<{ id: string; category: string }>(
      `SELECT id, category FROM documents
       WHERE institution_id = $1 AND id = $2`,
      [context.institutionId, input.documentId],
    );
    if (docRes.rows.length === 0) {
      throw new Error(`DOCUMENT_NOT_FOUND: document ${input.documentId}`);
    }

    const ver = await docRepo.getVersionById(client0, context.institutionId, input.versionId);
    if (!ver || ver.documentId !== input.documentId) {
      throw new Error(`DOCUMENT_NOT_FOUND: version ${input.versionId}`);
    }

    const a = await retentionAssignmentRepo.getByVersionId(client0, context.institutionId, input.versionId);
    if (!a) {
      throw new Error('RETENTION_ASSIGNMENT_MISSING: Cannot release hold without retention assignment.');
    }
    policyCategory = a.category;
    policyJurisdiction = a.jurisdictionProfileId;
  } finally {
    client0.release();
  }

  // 2. Central H1 Authorization Authority check (action=release_hold)
  const authAuthority =
    params.authorizationAuthority ??
    new DefaultDocumentAuthorizationAuthority({
      rules: createDefaultDocumentAuthorizationRules(),
    });

  const authDecision = authAuthority.authorize({
    institutionId: context.institutionId,
    personId: context.personId,
    role: context.role,
    action: 'release_hold',
    documentId: input.documentId,
    versionId: input.versionId,
    documentCategory: policyCategory,
  });

  if (!authDecision.allowed) {
    throw new Error(
      `HOLD_AUTHORITY_DENIED: Role '${context.role}' is not authorized to release hold. Reason: ${authDecision.reasonCode}`,
    );
  }

  // 3. Governed Retention Policy Engine check
  const policy = policyEngine.resolvePolicy({
    institutionId: context.institutionId,
    category: policyCategory,
    jurisdictionProfileId: policyJurisdiction,
  });
  if (!policy || !policyEngine.isHoldAuthorized(policy, existingHold.holdType, context.role)) {
    throw new Error(`HOLD_AUTHORITY_DENIED: Actor role '${context.role}' cannot release hold.`);
  }

  const fingerprint = createHoldReleaseFingerprint(
    context.institutionId,
    input.holdId,
    input.releaseReason,
  );

  return executeIdempotentDocumentsCommand<RetentionHoldRecord>({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.hold.release',
      idempotencyKey,
      canonicalFingerprint: fingerprint,
    },
    execute: async (client: PoolClient) => {
      // Serialize with concurrent deletion: lock document_versions row
      const verLock = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM document_versions
          WHERE institution_id = $1 AND id = $2 AND document_id = $3
          FOR UPDATE`,
        [context.institutionId, input.versionId, input.documentId],
      );
      if (verLock.rows.length === 0) {
        throw new Error(`DOCUMENT_NOT_FOUND: version ${input.versionId}`);
      }
      if (verLock.rows[0].status === 'deletion_in_progress' || verLock.rows[0].status === 'deleted') {
        throw new Error(
          `VERSION_DELETION_IN_PROGRESS: Cannot release hold on version with status='${verLock.rows[0].status}'.`,
        );
      }

      // Re-verify hold under lock
      const holdLock = await client.query<{ id: string; hold_status: string }>(
        `SELECT id, hold_status FROM document_retention_holds
         WHERE institution_id = $1 AND id = $2 AND version_id = $3 AND document_id = $4
         FOR UPDATE`,
        [context.institutionId, input.holdId, input.versionId, input.documentId],
      );
      if (holdLock.rows.length === 0) {
        throw new Error(`HOLD_NOT_FOUND: ${input.holdId}`);
      }
      if (holdLock.rows[0].hold_status !== 'active') {
        throw new Error(`HOLD_NOT_ACTIVE: Hold is already released.`);
      }

      const released = await holdRepo.releaseHold(
        client,
        context.institutionId,
        input.holdId,
        context.personId,
        input.releaseReason,
        input.correlationId ?? null,
      );

      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: input.documentId,
        versionId: input.versionId,
        actorPersonId: context.personId,
        action: 'document.hold_released',
        outcome: 'success',
        correlationId: input.correlationId ?? null,
        details: {
          holdId: input.holdId,
          releaseReason: input.releaseReason,
        },
      });

      await outboxRepo.insertEvent(client, {
        institutionId: context.institutionId,
        eventType: 'document.hold_released',
        aggregateType: 'document',
        aggregateId: input.documentId,
        actorPersonId: context.personId,
        actorKind: 'user',
        correlationId: input.correlationId ?? null,
        causationId: released.id,
        payload: {
          holdId: input.holdId,
          documentId: input.documentId,
          versionId: input.versionId,
          releaseReason: input.releaseReason,
        },
      });

      return { resultRef: released.id, result: released };
    },
    loadResult: async (client: PoolClient, resultRef: string) => {
      const h = await holdRepo.getById(client, context.institutionId, resultRef);
      if (!h) throw new Error(`HOLD_NOT_FOUND: ${resultRef}`);
      return h;
    },
  });
}

