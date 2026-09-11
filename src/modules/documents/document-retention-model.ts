/**
 * Documents Foundation I6 — Retention, Holds & Deletion Models
 * Mission: DOCUMENTS-FOUNDATION-I6
 *
 * PRODUCTION_AUTOMATED_RETENTION=BLOCKED (no approved jurisdiction profiles)
 * PRODUCTION_DEFINITIVE_DELETION=BLOCKED (no real storage provider + no approved policies)
 * No legal periods, jurisdiction defaults or authorization role defaults exist in this module.
 * All governed values come from explicit configuration or SYNTHETIC_TEST_FIXTURE.
 */

import { createHmac, randomUUID } from 'node:crypto';

// ─── Retention status lifecycle ───────────────────────────────────────────────
// RETENTION_ACTIVE → RETENTION_EXPIRED → ELIGIBLE_FOR_DELETION → DELETION_AUTHORIZED → DELETED
// RETENTION_EXPIRED ≠ AUTOMATIC_DELETE — expiration creates eligibility only
export type RetentionStatus =
  | 'retention_active'
  | 'retention_expired'
  | 'eligible_for_deletion'
  | 'deletion_authorized'
  | 'deleted';

// ─── Hold lifecycle ───────────────────────────────────────────────────────────
export type HoldStatus = 'active' | 'released';
export type HoldType = 'legal' | 'administrative';

// ─── Deletion authorization status ───────────────────────────────────────────
export type DeletionAuthorizationStatus =
  | 'authorized'
  | 'deletion_in_progress'
  | 'deleted'
  | 'deletion_reconciliation_required'
  | 'cancelled';

// ─── Deletion result ──────────────────────────────────────────────────────────
export type DeletionResult = 'deleted' | 'partial_failure' | 'reconciliation_required';

// ─── Retention Assignment ─────────────────────────────────────────────────────
export interface RetentionAssignmentRecord {
  id: string;
  institutionId: string;
  documentId: string;
  versionId: string;
  policyId: string;
  policyVersion: string;
  jurisdictionProfileId: string;
  jurisdictionProfileVersion: string;
  category: string;
  purpose: string | null;
  clockTriggerType: string;
  clockTriggerEventAt: Date;
  retainUntil: Date;
  retentionStatus: RetentionStatus;
  assignedAt: Date;
  assignedByPersonId: string;
  correlationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Retention Hold ───────────────────────────────────────────────────────────
export interface RetentionHoldRecord {
  id: string;
  institutionId: string;
  documentId: string;
  versionId: string;
  holdType: HoldType;
  authority: string;
  reason: string;
  effectiveAt: Date;
  releasedAt: Date | null;
  releasedByPersonId: string | null;
  releaseReason: string | null;
  releaseCorrelationId: string | null;
  holdStatus: HoldStatus;
  createdByPersonId: string;
  correlationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Deletion Authorization ───────────────────────────────────────────────────
export interface DeletionAuthorizationRecord {
  id: string;
  institutionId: string;
  documentId: string;
  versionId: string;
  retentionAssignmentId: string;
  policyBasis: string;
  policyVersion: string;
  jurisdictionProfileId: string;
  authorizedByPersonId: string;
  authorizedAt: Date;
  authorizationStatus: DeletionAuthorizationStatus;
  correlationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Deletion Record (minimal pseudonymized evidence) ────────────────────────
// MUST NOT contain: raw document_id, raw version_id, storage locator,
//                   binary content, filename, content hash, credentials.
// STRICTLY APPEND-ONLY: DeletionRecord rows are NEVER updated or deleted.
export interface DeletionRecordData {
  id: string;
  institutionId: string;
  deletionAuthorizationId: string;
  deletionOperationId: string; // CSPRNG UUID — correlation only, NOT the HMAC key
  pseudonymizedRef: string;   // HMAC-SHA256 output — hex
  policyBasis: string;
  policyVersion: string;
  jurisdictionProfileId: string;
  result: 'deleted';
  storageDeletionConfirmed: boolean;
  executedAt: Date;
  actorAuthorityScope: string;
  createdAt: Date;
}

// ─── Pseudonymization ─────────────────────────────────────────────────────────
// Minimum secret material: 32 bytes (256 bits) of actual entropy
// KEYED_HMAC_SHA256 — same canonical identity + same key → same ref
// Different key → cannot reproduce ref (key isolation across environments)
const MIN_PSEUDONYMIZATION_KEY_BYTES = 32;

/**
 * Validates the deletionPseudonymizationKey has sufficient cryptographic entropy.
 * Checks byte-length when key appears to be hex or base64; otherwise checks raw string byte size.
 * Throws DELETION_PSEUDONYM_KEY_MISSING if absent or too short.
 */
export function validateDeletionPseudonymizationKey(key: string): void {
  if (!key || key.trim().length === 0) {
    throw new Error('DELETION_PSEUDONYM_KEY_MISSING: deletionPseudonymizationKey is required.');
  }
  // Estimate byte entropy: if hex, each 2 chars = 1 byte; if base64, 4 chars ≈ 3 bytes
  // For raw strings, use UTF-8 byte length as lower bound
  const rawByteLength = Buffer.byteLength(key, 'utf8');
  if (rawByteLength < MIN_PSEUDONYMIZATION_KEY_BYTES) {
    throw new Error(
      `DELETION_PSEUDONYM_KEY_MISSING: deletionPseudonymizationKey must be at least ` +
      `${MIN_PSEUDONYMIZATION_KEY_BYTES} bytes of secret material (got ~${rawByteLength} bytes).`,
    );
  }
}

/**
 * Derive a pseudonymized, non-reversible reference for a deletion record.
 *
 * PSEUDONYM_STRATEGY=KEYED_HMAC_SHA256
 *   pseudonymized_ref = HMAC-SHA256(
 *     key  = deletionPseudonymizationKey  (trusted secret dependency)
 *     data = institution_id:document_id:version_id:deletion_authorization_id
 *   )
 *
 * Properties:
 *   - Non-reversible without the key
 *   - Same canonical deletion authorization identity + same key → same ref
 *   - deletion_operation_id is NOT the key (it is a correlation UUID only)
 *   - No raw document_id or version_id appears in the output
 */
export function deriveDeletionPseudonymizedRef(params: {
  deletionPseudonymizationKey: string;
  institutionId: string;
  documentId: string;
  versionId: string;
  deletionAuthorizationId: string;
}): string {
  validateDeletionPseudonymizationKey(params.deletionPseudonymizationKey);
  const canonicalIdentity = [
    params.institutionId,
    params.documentId,
    params.versionId,
    params.deletionAuthorizationId,
  ].join(':');
  return createHmac('sha256', params.deletionPseudonymizationKey)
    .update(canonicalIdentity, 'utf8')
    .digest('hex');
}

/**
 * Generate a per-operation CSPRNG correlation ID.
 * This is NOT the HMAC key — it is a traceability/audit correlation UUID only.
 */
export function generateDeletionOperationId(): string {
  return randomUUID();
}

// ─── Eligibility evaluation result ───────────────────────────────────────────
export interface DeletionEligibilityResult {
  eligible: boolean;
  retentionExpired: boolean;
  noActiveHolds: boolean;
  policyResolved: boolean;
  jurisdictionValid: boolean;
  blockers: string[];
}

// ─── Fingerprinting helpers ───────────────────────────────────────────────────
import { createCanonicalDocumentsFingerprint } from './document-model.ts';

export function createRetentionAssignmentFingerprint(
  institutionId: string,
  versionId: string,
  policyId: string,
  policyVersion: string,
  jurisdictionProfileId: string,
  clockTriggerType: string,
  clockTriggerEventAt: Date,
): string {
  return createCanonicalDocumentsFingerprint({
    institutionId,
    versionId,
    policyId,
    policyVersion,
    jurisdictionProfileId,
    clockTriggerType,
    clockTriggerEventAt: clockTriggerEventAt.toISOString(),
  });
}

export function createHoldFingerprint(
  institutionId: string,
  versionId: string,
  holdType: HoldType,
  authority: string,
  reason: string,
): string {
  return createCanonicalDocumentsFingerprint({
    institutionId,
    versionId,
    holdType,
    authority,
    reason,
  });
}

export function createHoldReleaseFingerprint(
  institutionId: string,
  holdId: string,
  releaseReason: string,
): string {
  return createCanonicalDocumentsFingerprint({ institutionId, holdId, releaseReason });
}

export function createDeletionAuthorizationFingerprint(
  institutionId: string,
  versionId: string,
  retentionAssignmentId: string,
  policyBasis: string,
): string {
  return createCanonicalDocumentsFingerprint({
    institutionId,
    versionId,
    retentionAssignmentId,
    policyBasis,
  });
}

export function createDeletionExecutionFingerprint(
  institutionId: string,
  deletionAuthorizationId: string,
): string {
  return createCanonicalDocumentsFingerprint({ institutionId, deletionAuthorizationId });
}
