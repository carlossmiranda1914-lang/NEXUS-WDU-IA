/**
 * Documents Foundation I6 — Deletion Execution State Machine
 * Mission: DOCUMENTS-FOUNDATION-I6
 *
 * DELETION STATE SEQUENCE:
 *   DELETION_AUTHORIZED
 *   → Phase 1: DB Transaction (durable intent, lock version FOR UPDATE, revoke grants, holds check)
 *   → DELETION_IN_PROGRESS
 *   → Phase 2: External storage effect (deleteObject() + headObject=NOT_FOUND)
 *   → Phase 3: DB Transaction (remove storage_refs, version.status='deleted', append DeletionRecord)
 *   → DELETED  ✅ terminal
 *
 * CRASH-SAFE INVARIANTS:
 *   - Intent (DELETION_IN_PROGRESS, revoked grants) is committed BEFORE external storage effect
 *   - If process crashes between DB intent and storage delete, or during storage delete,
 *     retry / reconciliation safely resumes and completes physical delete + finalization.
 *   - version.status='deleted' NEVER written before confirmed physical deletion.
 *   - DeletionRecord is STRICTLY APPEND-ONLY (zero UPDATE queries, written only on confirmed delete).
 *   - UNKNOWN provider outcome → FAIL_CLOSED (deletion_reconciliation_required).
 *   - Hold-vs-delete race prevented via SELECT ... FOR UPDATE on document_versions.
 *   - actor_authority_scope is derived from trusted InstitutionalContext.role (not caller-controlled).
 *
 * PRODUCTION_REAL_STORAGE_DELETION=FORBIDDEN (no real provider; test adapter only)
 */

import type { Pool } from 'pg';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import type { ObjectStorageProvider } from './object-storage-provider.ts';
import {
  validateDeletionPseudonymizationKey,
  deriveDeletionPseudonymizedRef,
  generateDeletionOperationId,
  createDeletionExecutionFingerprint,
  type DeletionRecordData,
} from './document-retention-model.ts';
import {
  PostgresRetentionAssignmentRepository,
  PostgresRetentionHoldRepository,
  PostgresDeletionAuthorizationRepository,
  PostgresDeletionRecordRepository,
} from './document-retention-repository.ts';
import { PostgresDocumentAuditRepository } from './document-audit.ts';
import { PostgresDocumentOutboxRepository } from './document-event-repository.ts';

const retentionAssignmentRepo = new PostgresRetentionAssignmentRepository();
const holdRepo = new PostgresRetentionHoldRepository();
const deletionAuthRepo = new PostgresDeletionAuthorizationRepository();
const deletionRecordRepo = new PostgresDeletionRecordRepository();
const auditRepo = new PostgresDocumentAuditRepository();
const outboxRepo = new PostgresDocumentOutboxRepository();

// ─── ExecuteDeletion ──────────────────────────────────────────────────────────

export interface ExecuteDeletionInput {
  deletionAuthorizationId: string;
  correlationId?: string | null;
}

export interface ExecuteDeletionResult {
  deletionRecord: DeletionRecordData | null;
  reconciliationRequired: boolean;
}

export async function executeDeletionCommand(params: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  deletionPseudonymizationKey: string;
  storageProvider: ObjectStorageProvider;
  input: ExecuteDeletionInput;
}): Promise<{ replayed: boolean; result: ExecuteDeletionResult }> {
  const {
    pool, context, idempotencyKey,
    deletionPseudonymizationKey, storageProvider, input,
  } = params;

  // Validate key before anything else — fail closed on missing/weak key
  validateDeletionPseudonymizationKey(deletionPseudonymizationKey);

  const fingerprint = createDeletionExecutionFingerprint(
    context.institutionId,
    input.deletionAuthorizationId,
  );

  // Check idempotency ledger first
  const client0 = await pool.connect();
  let auth: Awaited<ReturnType<typeof deletionAuthRepo.getById>>;
  try {
    const existingIdem = await client0.query<{
      request_fingerprint: string;
      result_ref: string | null;
    }>(
      `SELECT request_fingerprint, result_ref
         FROM document_idempotency_records
        WHERE institution_id = $1
          AND command_scope = 'documents.deletion.execute'
          AND idempotency_key = $2`,
      [context.institutionId, idempotencyKey],
    );

    if (existingIdem.rows.length > 0) {
      const row = existingIdem.rows[0];
      if (row.request_fingerprint !== fingerprint) {
        throw new Error(
          `IDEMPOTENCY_FINGERPRINT_MISMATCH: Idempotency key '${idempotencyKey}' was previously used with a different fingerprint.`,
        );
      }
      const existingRecord = await deletionRecordRepo.getByAuthorizationId(
        client0, context.institutionId, input.deletionAuthorizationId,
      );
      if (existingRecord) {
        return {
          replayed: true,
          result: { deletionRecord: existingRecord, reconciliationRequired: false },
        };
      }
    }

    auth = await deletionAuthRepo.getById(client0, context.institutionId, input.deletionAuthorizationId);
    if (!auth) {
      throw new Error(`DELETION_AUTHORIZATION_NOT_FOUND: ${input.deletionAuthorizationId}`);
    }

    if (auth.authorizationStatus === 'deleted') {
      const existingRecord = await deletionRecordRepo.getByAuthorizationId(
        client0, context.institutionId, auth.id,
      );
      if (existingRecord) {
        return {
          replayed: true,
          result: { deletionRecord: existingRecord, reconciliationRequired: false },
        };
      }
    } else if (!['authorized', 'deletion_in_progress', 'deletion_reconciliation_required'].includes(auth.authorizationStatus)) {
      throw new Error(
        `DELETION_AUTHORIZATION_STATUS_INVALID: Cannot execute deletion for authorization ` +
        `with status='${auth.authorizationStatus}'.`,
      );
    }
  } finally {
    client0.release();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 1: DB Transaction — Persist Durable Intent (Lock, Holds, Grants, Status)
  // ─────────────────────────────────────────────────────────────────────────────
  const client1 = await pool.connect();
  let storageRef: { storageBucket: string; storageKey: string; storageProvider: string } | null = null;
  try {
    await client1.query('BEGIN');

    // Acquire row-level lock on document_versions to serialize with concurrent placeHoldCommand/executeDeletionCommand
    const verLock = await client1.query<{ id: string; status: string }>(
      `SELECT id, status FROM document_versions
        WHERE institution_id = $1 AND id = $2
        FOR UPDATE`,
      [context.institutionId, auth.versionId],
    );
    if (verLock.rows.length === 0) {
      throw new Error(`DOCUMENT_VERSION_NOT_FOUND: version ${auth.versionId}`);
    }
    const currentVerStatus = verLock.rows[0].status;
    if (currentVerStatus === 'deleted') {
      await client1.query('COMMIT');
      const dr = await deletionRecordRepo.getByAuthorizationId(client1, context.institutionId, auth.id);
      return { replayed: true, result: { deletionRecord: dr, reconciliationRequired: false } };
    }

    // Re-check active holds inside transaction
    const activeHolds = await holdRepo.countActiveHoldsForVersion(
      client1, context.institutionId, auth.versionId,
    );
    if (activeHolds > 0) {
      throw new Error(
        `ACTIVE_HOLD_PREVENTS_DELETION: ${activeHolds} active hold(s) block deletion.`,
      );
    }

    // Revoke all active content access grants BEFORE destructive storage call
    await client1.query(
      `UPDATE document_content_access_grants
          SET status = 'revoked',
              revoked_at = now(),
              revocation_reason = 'legal_deletion_in_progress',
              updated_at = now()
        WHERE institution_id = $1 AND version_id = $2 AND status = 'active'`,
      [context.institutionId, auth.versionId],
    );

    // Mark version as deletion_in_progress
    await client1.query(
      `UPDATE document_versions
          SET status = 'deletion_in_progress'
        WHERE institution_id = $1 AND id = $2
          AND status != 'deleted'`,
      [context.institutionId, auth.versionId],
    );

    // Transition authorization to deletion_in_progress
    await client1.query(
      `UPDATE document_deletion_authorizations
          SET authorization_status = 'deletion_in_progress', updated_at = now()
        WHERE institution_id = $1 AND id = $2
          AND authorization_status IN ('authorized', 'deletion_in_progress', 'deletion_reconciliation_required')`,
      [context.institutionId, auth.id],
    );

    // Read storage reference
    const srResult = await client1.query<{
      storage_bucket: string; storage_key: string; storage_provider: string;
    }>(
      `SELECT storage_bucket, storage_key, storage_provider
         FROM document_storage_references
        WHERE institution_id = $1 AND version_id = $2
        LIMIT 1`,
      [context.institutionId, auth.versionId],
    );
    if (srResult.rows.length > 0) {
      storageRef = {
        storageBucket: srResult.rows[0].storage_bucket,
        storageKey: srResult.rows[0].storage_key,
        storageProvider: srResult.rows[0].storage_provider,
      };
    }

    // Commit Phase 1 — durable deletion intent is now persisted in DB
    await outboxRepo.insertEvent(client1, {
      institutionId: context.institutionId,
      eventType: 'document.deletion_started',
      aggregateType: 'document',
      aggregateId: auth.documentId,
      actorPersonId: context.personId,
      actorKind: 'user',
      correlationId: input.correlationId ?? null,
      causationId: auth.id,
      payload: {
        deletionAuthorizationId: auth.id,
        documentId: auth.documentId,
        versionId: auth.versionId,
      },
    });

    await client1.query('COMMIT');
  } catch (p1Err) {
    await client1.query('ROLLBACK').catch(() => undefined);
    throw p1Err;
  } finally {
    client1.release();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 2: External Storage Deletion & Confirmation
  // ─────────────────────────────────────────────────────────────────────────────
  let physicalDeleteConfirmed = false;
  let failReason = '';

  if (storageRef) {
    try {
      const deleteResult = await storageProvider.deleteObject({
        institutionId: context.institutionId,
        storageBucket: storageRef.storageBucket,
        storageKey: storageRef.storageKey,
      });

      if (deleteResult.deleted || deleteResult.errorCode === 'OBJECT_NOT_FOUND') {
        try {
          const headResult = await storageProvider.headObject({
            institutionId: context.institutionId,
            storageBucket: storageRef.storageBucket,
            storageKey: storageRef.storageKey,
          });
          if (!headResult.exists) {
            physicalDeleteConfirmed = true;
          } else {
            failReason = 'STORAGE_OBJECT_STILL_EXISTS_AFTER_DELETE';
          }
        } catch {
          // headObject error = unknown outcome → FAIL_CLOSED
          failReason = 'HEAD_OBJECT_ERROR_AFTER_DELETE';
        }
      } else {
        failReason = deleteResult.errorCode ?? 'DELETE_RETURNED_NOT_DELETED';
      }
    } catch (storageErr: unknown) {
      // Any exception → FAIL_CLOSED
      failReason = `STORAGE_EXCEPTION: ${storageErr instanceof Error ? storageErr.message : String(storageErr)}`;
    }
  } else {
    // No storage reference (e.g. metadata-only version)
    physicalDeleteConfirmed = true;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 3: DB Finalization & Immutable DeletionRecord
  // ─────────────────────────────────────────────────────────────────────────────
  const client2 = await pool.connect();
  try {
    await client2.query('BEGIN');

    if (physicalDeleteConfirmed) {
      // 1. Remove StorageObjectReference (explicit, not CASCADE)
      if (storageRef) {
        await client2.query(
          `DELETE FROM document_storage_references
            WHERE institution_id = $1 AND version_id = $2`,
          [context.institutionId, auth.versionId],
        );
      }

      // 2. Mark version as deleted — ONLY after confirmed physical deletion
      await client2.query(
        `UPDATE document_versions
            SET status = 'deleted'
          WHERE institution_id = $1 AND id = $2
            AND status = 'deletion_in_progress'`,
        [context.institutionId, auth.versionId],
      );

      await deletionAuthRepo.updateStatus(
        client2, context.institutionId, auth.id, 'deleted',
      );
      await retentionAssignmentRepo.updateStatus(
        client2, context.institutionId, auth.retentionAssignmentId, 'deleted',
      );

      // 3. Check if DeletionRecord already written (e.g. concurrent race)
      let deletionRecord = await deletionRecordRepo.getByAuthorizationId(
        client2, context.institutionId, auth.id,
      );
      if (!deletionRecord) {
        const deletionOperationId = generateDeletionOperationId();
        const pseudonymizedRef = deriveDeletionPseudonymizedRef({
          deletionPseudonymizationKey,
          institutionId: context.institutionId,
          documentId: auth.documentId,
          versionId: auth.versionId,
          deletionAuthorizationId: auth.id,
        });

        // Append-only insert (result='deleted', storageDeletionConfirmed=true)
        deletionRecord = await deletionRecordRepo.insert(client2, {
          institutionId: context.institutionId,
          deletionAuthorizationId: auth.id,
          deletionOperationId,
          pseudonymizedRef,
          policyBasis: auth.policyBasis,
          policyVersion: auth.policyVersion,
          jurisdictionProfileId: auth.jurisdictionProfileId,
          result: 'deleted',
          storageDeletionConfirmed: true,
          actorAuthorityScope: context.role,
        });
      }

      await auditRepo.recordAuditEvent(client2, {
        institutionId: context.institutionId,
        documentId: auth.documentId,
        versionId: null, // version row tombstoned; no FK navigation for audit
        actorPersonId: context.personId,
        action: 'document.version_deleted',
        outcome: 'success',
        correlationId: input.correlationId ?? null,
        details: {
          deletionAuthorizationId: auth.id,
          policyBasis: auth.policyBasis,
          storageDeletionConfirmed: true,
        },
      });

      await outboxRepo.insertEvent(client2, {
        institutionId: context.institutionId,
        eventType: 'document.deleted',
        aggregateType: 'document',
        aggregateId: auth.documentId,
        actorPersonId: context.personId,
        actorKind: 'user',
        correlationId: input.correlationId ?? null,
        causationId: auth.id,
        payload: {
          deletionAuthorizationId: auth.id,
          deletionRecordId: deletionRecord.id,
          deletionOperationId: deletionRecord.deletionOperationId,
          documentId: auth.documentId,
          versionId: auth.versionId,
          policyBasis: auth.policyBasis,
        },
      });

      // 4. Record in document_idempotency_records
      await client2.query(
        `INSERT INTO document_idempotency_records (
          institution_id, command_scope, idempotency_key,
          request_fingerprint, result_ref, status
        ) VALUES ($1, 'documents.deletion.execute', $2, $3, $4, 'completed')
        ON CONFLICT (institution_id, command_scope, idempotency_key) DO NOTHING`,
        [context.institutionId, idempotencyKey, fingerprint, deletionRecord.id],
      );

      await client2.query('COMMIT');
      return {
        replayed: false,
        result: { deletionRecord, reconciliationRequired: false },
      };
    } else {
      // ── FAIL_CLOSED: unknown or failed storage outcome ───────────────────────
      await deletionAuthRepo.updateStatus(
        client2, context.institutionId, auth.id,
        'deletion_reconciliation_required',
      );

      await auditRepo.recordAuditEvent(client2, {
        institutionId: context.institutionId,
        documentId: auth.documentId,
        versionId: auth.versionId,
        actorPersonId: context.personId,
        action: 'document.deletion_reconciliation_required',
        outcome: 'failed',
        correlationId: input.correlationId ?? null,
        details: { failReason },
      });

      await outboxRepo.insertEvent(client2, {
        institutionId: context.institutionId,
        eventType: 'document.deletion_reconciliation_required',
        aggregateType: 'document',
        aggregateId: auth.documentId,
        actorPersonId: context.personId,
        actorKind: 'user',
        correlationId: input.correlationId ?? null,
        causationId: auth.id,
        payload: {
          deletionAuthorizationId: auth.id,
          documentId: auth.documentId,
          versionId: auth.versionId,
          failReason,
        },
      });

      await client2.query('COMMIT');
      return {
        replayed: false,
        result: { deletionRecord: null, reconciliationRequired: true },
      };
    }
  } catch (finalizeErr) {
    await client2.query('ROLLBACK').catch(() => undefined);
    throw finalizeErr;
  } finally {
    client2.release();
  }
}

// ─── ReconcileDeletion ────────────────────────────────────────────────────────

export interface ReconcileDeletionInput {
  deletionAuthorizationId: string;
  correlationId?: string | null;
}

export async function reconcileDeletionCommand(params: {
  pool: Pool;
  context: InstitutionalContext;
  deletionPseudonymizationKey: string;
  storageProvider: ObjectStorageProvider;
  input: ReconcileDeletionInput;
}): Promise<ExecuteDeletionResult> {
  const { pool, context, deletionPseudonymizationKey, storageProvider, input } = params;

  validateDeletionPseudonymizationKey(deletionPseudonymizationKey);

  let auth: Awaited<ReturnType<typeof deletionAuthRepo.getById>>;
  let storageRef: { storageBucket: string; storageKey: string } | null = null;

  const client = await pool.connect();
  try {
    auth = await deletionAuthRepo.getById(
      client, context.institutionId, input.deletionAuthorizationId,
    );
    if (!auth) {
      throw new Error(`DELETION_AUTHORIZATION_NOT_FOUND: ${input.deletionAuthorizationId}`);
    }
    if (auth.authorizationStatus === 'deleted') {
      const dr = await deletionRecordRepo.getByAuthorizationId(client, context.institutionId, auth.id);
      if (dr) return { deletionRecord: dr, reconciliationRequired: false };
    }
    if (auth.authorizationStatus !== 'deletion_reconciliation_required' &&
        auth.authorizationStatus !== 'deletion_in_progress') {
      throw new Error(
        `RECONCILIATION_NOT_APPLICABLE: authorization status='${auth.authorizationStatus}'`,
      );
    }

    // Look up remaining storage reference
    const srResult = await client.query<{
      storage_bucket: string; storage_key: string;
    }>(
      `SELECT storage_bucket, storage_key
         FROM document_storage_references
        WHERE institution_id = $1 AND version_id = $2
        LIMIT 1`,
      [context.institutionId, auth.versionId],
    );
    if (srResult.rows.length > 0) {
      storageRef = {
        storageBucket: srResult.rows[0].storage_bucket,
        storageKey: srResult.rows[0].storage_key,
      };
    }
  } finally {
    client.release();
  }

  // Probe storage
  let storageGone = false;
  if (!storageRef) {
    storageGone = true;
  } else {
    try {
      const headResult = await storageProvider.headObject({
        institutionId: context.institutionId,
        storageBucket: storageRef.storageBucket,
        storageKey: storageRef.storageKey,
      });
      if (!headResult.exists) {
        storageGone = true;
      } else {
        const deleteResult = await storageProvider.deleteObject({
          institutionId: context.institutionId,
          storageBucket: storageRef.storageBucket,
          storageKey: storageRef.storageKey,
        });
        if (deleteResult.deleted) {
          const confirmHead = await storageProvider.headObject({
            institutionId: context.institutionId,
            storageBucket: storageRef.storageBucket,
            storageKey: storageRef.storageKey,
          });
          storageGone = !confirmHead.exists;
        }
      }
    } catch {
      // headObject/deleteObject error → FAIL_CLOSED
      storageGone = false;
    }
  }

  const client2 = await pool.connect();
  try {
    await client2.query('BEGIN');

    if (storageGone) {
      // Finalize deletion
      if (storageRef) {
        await client2.query(
          `DELETE FROM document_storage_references
            WHERE institution_id = $1 AND version_id = $2`,
          [context.institutionId, auth.versionId],
        );
      }

      await client2.query(
        `UPDATE document_versions
            SET status = 'deleted'
          WHERE institution_id = $1 AND id = $2
            AND status = 'deletion_in_progress'`,
        [context.institutionId, auth.versionId],
      );

      await deletionAuthRepo.updateStatus(client2, context.institutionId, auth.id, 'deleted');
      await retentionAssignmentRepo.updateStatus(
        client2, context.institutionId, auth.retentionAssignmentId, 'deleted',
      );

      let deletionRecord = await deletionRecordRepo.getByAuthorizationId(
        client2, context.institutionId, auth.id,
      );
      if (!deletionRecord) {
        const deletionOperationId = generateDeletionOperationId();
        const pseudonymizedRef = deriveDeletionPseudonymizedRef({
          deletionPseudonymizationKey,
          institutionId: context.institutionId,
          documentId: auth.documentId,
          versionId: auth.versionId,
          deletionAuthorizationId: auth.id,
        });

        deletionRecord = await deletionRecordRepo.insert(client2, {
          institutionId: context.institutionId,
          deletionAuthorizationId: auth.id,
          deletionOperationId,
          pseudonymizedRef,
          policyBasis: auth.policyBasis,
          policyVersion: auth.policyVersion,
          jurisdictionProfileId: auth.jurisdictionProfileId,
          result: 'deleted',
          storageDeletionConfirmed: true,
          actorAuthorityScope: context.role,
        });
      }

      await auditRepo.recordAuditEvent(client2, {
        institutionId: context.institutionId,
        documentId: auth.documentId,
        versionId: null,
        actorPersonId: context.personId,
        action: 'document.deletion_reconciled',
        outcome: 'success',
        correlationId: input.correlationId ?? null,
        details: { storageDeletionConfirmed: true },
      });

      await outboxRepo.insertEvent(client2, {
        institutionId: context.institutionId,
        eventType: 'document.deleted',
        aggregateType: 'document',
        aggregateId: auth.documentId,
        actorPersonId: context.personId,
        actorKind: 'user',
        correlationId: input.correlationId ?? null,
        causationId: auth.id,
        payload: {
          deletionAuthorizationId: auth.id,
          deletionRecordId: deletionRecord.id,
          deletionOperationId: deletionRecord.deletionOperationId,
          documentId: auth.documentId,
          versionId: auth.versionId,
          policyBasis: auth.policyBasis,
        },
      });

      await client2.query('COMMIT');
      return { deletionRecord, reconciliationRequired: false };
    } else {
      // Storage still exists or probing failed — remain RECONCILIATION_REQUIRED
      await deletionAuthRepo.updateStatus(
        client2, context.institutionId, auth.id, 'deletion_reconciliation_required',
      );
      await client2.query('COMMIT');
      return { deletionRecord: null, reconciliationRequired: true };
    }
  } catch (err) {
    await client2.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client2.release();
  }
}
