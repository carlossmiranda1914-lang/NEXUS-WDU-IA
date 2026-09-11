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
import { executeIdempotentDocumentsCommand } from './document-command.ts';

const retentionAssignmentRepo = new PostgresRetentionAssignmentRepository();
const holdRepo = new PostgresRetentionHoldRepository();
const deletionAuthRepo = new PostgresDeletionAuthorizationRepository();
const docRepo = new PostgresDocumentRepository();
const auditRepo = new PostgresDocumentAuditRepository();

// ─── AssignRetention ──────────────────────────────────────────────────────────

export interface AssignRetentionInput {
  documentId: string;
  versionId: string;
  jurisdictionProfileId: string;
  category: string;
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
  input: AssignRetentionInput;
}): Promise<{ replayed: boolean; result: RetentionAssignmentRecord }> {
  const { pool, context, idempotencyKey, policyEngine, input } = params;

  // Resolve policy — FAIL_CLOSED if not found (no default period)
  const policy = policyEngine.resolvePolicy({
    institutionId: context.institutionId,
    category: input.category,
    jurisdictionProfileId: input.jurisdictionProfileId,
    policyId: input.policyId,
  });
  if (!policy) {
    throw new Error(
      `JURISDICTION_PROFILE_MISSING: No governed retention policy found for ` +
      `category='${input.category}' jurisdiction='${input.jurisdictionProfileId}'. ` +
      `PRODUCTION_AUTOMATED_RETENTION=BLOCKED until approved profiles are configured.`,
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
      // Verify document version belongs to this institution
      const version = await docRepo.getVersionById(client, context.institutionId, input.versionId);
      if (!version || version.documentId !== input.documentId) {
        throw new Error(`DOCUMENT_VERSION_NOT_FOUND: version ${input.versionId}`);
      }
      if (version.status === 'deletion_in_progress' || version.status === 'deleted') {
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
        category: input.category,
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
    // Verify ownership
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
  actorAuthorityScope: string;
  correlationId?: string | null;
}

export async function authorizeDeletionCommand(params: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  policyEngine: RetentionPolicyEngine;
  input: AuthorizeDeletionInput;
}): Promise<{ replayed: boolean; result: DeletionAuthorizationRecord }> {
  const { pool, context, idempotencyKey, policyEngine, input } = params;

  const client0 = await pool.connect();
  let assignment: RetentionAssignmentRecord;
  try {
    const ver = await docRepo.getVersionById(client0, context.institutionId, input.versionId);
    if (!ver || ver.documentId !== input.documentId) {
      throw new Error(`DOCUMENT_NOT_FOUND: version ${input.versionId}`);
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

  // Verify actor authority scope against policy
  const policy = policyEngine.resolvePolicy({
    institutionId: context.institutionId,
    category: assignment.category,
    jurisdictionProfileId: assignment.jurisdictionProfileId,
    policyId: assignment.policyId,
  });
  if (!policy || !policyEngine.isDeletionAuthorized(policy, input.actorAuthorityScope)) {
    throw new Error(
      `DELETION_AUTHORIZATION_DENIED: Actor authority scope '${input.actorAuthorityScope}' ` +
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
      // Re-check holds inside the transaction (concurrency guard)
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
          actorAuthorityScope: input.actorAuthorityScope,
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
  actorAuthorityScope: string;
  correlationId?: string | null;
}

export async function placeHoldCommand(params: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  policyEngine: RetentionPolicyEngine;
  input: PlaceHoldInput;
}): Promise<{ replayed: boolean; result: RetentionHoldRecord }> {
  const { pool, context, idempotencyKey, policyEngine, input } = params;

  // Resolve policy for hold authorization check
  const client0 = await pool.connect();
  let policyCategory: string;
  let policyJurisdiction: string;
  try {
    const ver = await docRepo.getVersionById(client0, context.institutionId, input.versionId);
    if (!ver || ver.documentId !== input.documentId) {
      throw new Error(`DOCUMENT_NOT_FOUND: version ${input.versionId}`);
    }
    const a = await retentionAssignmentRepo.getByVersionId(client0, context.institutionId, input.versionId);
    if (!a) throw new Error('RETENTION_ASSIGNMENT_MISSING: Hold requires a retention assignment on the version.');
    policyCategory = a.category;
    policyJurisdiction = a.jurisdictionProfileId;
  } finally {
    client0.release();
  }

  const policy = policyEngine.resolvePolicy({
    institutionId: context.institutionId,
    category: policyCategory,
    jurisdictionProfileId: policyJurisdiction,
  });
  if (!policy || !policyEngine.isHoldAuthorized(policy, input.holdType, input.actorAuthorityScope)) {
    throw new Error(
      `HOLD_AUTHORITY_DENIED: Actor scope '${input.actorAuthorityScope}' cannot place ` +
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
  actorAuthorityScope: string;
  correlationId?: string | null;
}

export async function releaseHoldCommand(params: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  policyEngine: RetentionPolicyEngine;
  input: ReleaseHoldInput;
}): Promise<{ replayed: boolean; result: RetentionHoldRecord }> {
  const { pool, context, idempotencyKey, policyEngine, input } = params;

  // Verify hold belongs to this institution before fingerprinting
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
    const a = await retentionAssignmentRepo.getByVersionId(client0, context.institutionId, input.versionId);
    policyCategory = a?.category ?? '';
    policyJurisdiction = a?.jurisdictionProfileId ?? '';
  } finally {
    client0.release();
  }

  const policy = policyEngine.resolvePolicy({
    institutionId: context.institutionId,
    category: policyCategory,
    jurisdictionProfileId: policyJurisdiction,
  });
  if (!policy || !policyEngine.isHoldAuthorized(policy, existingHold.holdType, input.actorAuthorityScope)) {
    throw new Error(`HOLD_AUTHORITY_DENIED: Actor scope '${input.actorAuthorityScope}' cannot release hold.`);
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

      return { resultRef: released.id, result: released };
    },
    loadResult: async (client: PoolClient, resultRef: string) => {
      const h = await holdRepo.getById(client, context.institutionId, resultRef);
      if (!h) throw new Error(`HOLD_NOT_FOUND: ${resultRef}`);
      return h;
    },
  });
}
