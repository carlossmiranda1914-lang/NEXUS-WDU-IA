/**
 * Documents Foundation I6 — Deletion Execution State Machine
 * Mission: DOCUMENTS-FOUNDATION-I6
 *
 * DELETION STATE SEQUENCE:
 *   DELETION_AUTHORIZED
 *   → DELETION_IN_PROGRESS           (guard: no holds, grants revoked)
 *   → [deleteObject() + headObject=NOT_FOUND]  — physical confirmation required
 *   → DELETE document_storage_references row  (explicit, not CASCADE)
 *   → document_version.status = 'deleted'      ← ONLY after confirmed physical deletion
 *   → DeletionRecord written (pseudonymized_ref, result='deleted', storage_deletion_confirmed=true)
 *   → DELETED  ✅ terminal
 *
 * On FAILURE or UNKNOWN provider outcome → FAIL_CLOSED:
 *   → authorization_status = 'deletion_reconciliation_required'
 *   → version.status remains 'deletion_in_progress'
 *   → storage_refs row NOT removed
 *   → DeletionRecord NOT written with result='deleted'
 *
 * INVARIANTS:
 *   - version.status='deleted' NEVER written before confirmed physical deletion
 *   - UNKNOWN provider outcome → FAIL_CLOSED (same as failure)
 *   - DeletionRecord.result='deleted' requires storage_deletion_confirmed=true (DB CHECK)
 *   - No raw document_id/version_id in DeletionRecord
 *   - No storage locator in DeletionRecord
 *   - Active grants revoked BEFORE first destructive storage call
 *   - Active holds re-checked BEFORE DELETION_IN_PROGRESS transition
 *
 * PRODUCTION_REAL_STORAGE_DELETION=FORBIDDEN (no real provider; test adapter only)
 */

import type { Pool, PoolClient } from 'pg';
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
import { PostgresDocumentRepository } from './document-repository.ts';
import { PostgresDocumentAuditRepository } from './document-audit.ts';
import { PostgresDocumentAccessRepository } from './document-access-repository.ts';
import { executeIdempotentDocumentsCommand } from './document-command.ts';

const retentionAssignmentRepo = new PostgresRetentionAssignmentRepository();
const holdRepo = new PostgresRetentionHoldRepository();
const deletionAuthRepo = new PostgresDeletionAuthorizationRepository();
const deletionRecordRepo = new PostgresDeletionRecordRepository();
const docRepo = new PostgresDocumentRepository();
const auditRepo = new PostgresDocumentAuditRepository();
const accessRepo = new PostgresDocumentAccessRepository();

// ─── ExecuteDeletion ──────────────────────────────────────────────────────────

export interface ExecuteDeletionInput {
  deletionAuthorizationId: string;
  actorAuthorityScope: string;
  correlationId?: string | null;
}

export interface ExecuteDeletionResult {
  deletionRecord: DeletionRecordData;
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

  // Read authorization to get fingerprint material
  const client0 = await pool.connect();
  let auth: Awaited<ReturnType<typeof deletionAuthRepo.getById>>;
  let storageRef: { storageBucket: string; storageKey: string; storageProvider: string } | null = null;
  try {
    auth = await deletionAuthRepo.getById(client0, context.institutionId, input.deletionAuthorizationId);
    if (!auth) {
      throw new Error(`DELETION_AUTHORIZATION_NOT_FOUND: ${input.deletionAuthorizationId}`);
    }
    if (auth.authorizationStatus === 'deleted') {
      // Already completed — allow idempotent replay via the idempotency ledger
    } else if (!['authorized', 'deletion_reconciliation_required'].includes(auth.authorizationStatus)) {
      throw new Error(
        `DELETION_AUTHORIZATION_STATUS_INVALID: Cannot execute deletion for authorization ` +
        `with status='${auth.authorizationStatus}'.`,
      );
    }

    // Look up the storage reference
    const srResult = await client0.query<{
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
  } finally {
    client0.release();
  }

  const fingerprint = createDeletionExecutionFingerprint(
    context.institutionId,
    input.deletionAuthorizationId,
  );

  return executeIdempotentDocumentsCommand<ExecuteDeletionResult>({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.deletion.execute',
      idempotencyKey,
      canonicalFingerprint: fingerprint,
    },
    execute: async (client: PoolClient) => {
      // ── STEP 1: Re-check active holds inside transaction (concurrency guard) ──
      const activeHolds = await holdRepo.countActiveHoldsForVersion(
        client, context.institutionId, auth!.versionId,
      );
      if (activeHolds > 0) {
        throw new Error(
          `ACTIVE_HOLD_PREVENTS_DELETION: ${activeHolds} active hold(s) block deletion.`,
        );
      }

      // ── STEP 2: Revoke all active content access grants for this version ──────
      // Grants revoked BEFORE any destructive storage call
      await client.query(
        `UPDATE document_content_access_grants
            SET status = 'revoked',
                revoked_at = now(),
                revocation_reason = 'legal_deletion_in_progress',
                updated_at = now()
          WHERE institution_id = $1 AND version_id = $2 AND status = 'active'`,
        [context.institutionId, auth!.versionId],
      );

      // ── STEP 3: Mark version as DELETION_IN_PROGRESS ──────────────────────────
      // version.status='deleted' is NEVER written here — only after confirmed physical deletion
      const versionUpdate = await client.query(
        `UPDATE document_versions
            SET status = 'deletion_in_progress'
          WHERE institution_id = $1 AND id = $2
            AND status NOT IN ('deletion_in_progress', 'deleted')
          RETURNING document_id`,
        [context.institutionId, auth!.versionId],
      );
      if (versionUpdate.rows.length === 0) {
        // Already in progress or deleted — this is safe for reconciliation
      }

      // ── STEP 4: Transition authorization to deletion_in_progress ─────────────
      await deletionAuthRepo.updateStatus(
        client, context.institutionId, auth!.id,
        'deletion_in_progress',
        'authorized',
      );

      // Commit the DELETION_IN_PROGRESS state before touching storage
      await client.query('COMMIT');

      // ─────────────────────────────────────────────────────────────────────────
      // STEPS 5-8 are outside the DB transaction (cross-system, non-atomic)
      // ─────────────────────────────────────────────────────────────────────────

      const deletionOperationId = generateDeletionOperationId();
      const pseudonymizedRef = deriveDeletionPseudonymizedRef({
        deletionPseudonymizationKey,
        institutionId: context.institutionId,
        documentId: auth!.documentId,
        versionId: auth!.versionId,
        deletionAuthorizationId: auth!.id,
      });

      // ── STEP 5: Physical storage deletion ────────────────────────────────────
      let physicalDeleteConfirmed = false;
      let failReason = '';

      if (storageRef) {
        try {
          const deleteResult = await storageProvider.deleteObject({
            institutionId: context.institutionId,
            storageBucket: storageRef.storageBucket,
            storageKey: storageRef.storageKey,
          });

          if (deleteResult.deleted) {
            // ── STEP 6: Confirm via headObject ────────────────────────────────
            try {
              const headResult = await storageProvider.headObject({
                institutionId: context.institutionId,
                storageBucket: storageRef.storageBucket,
                storageKey: storageRef.storageKey,
              });
              if (!headResult.exists) {
                physicalDeleteConfirmed = true;
              } else {
                // Object still exists — provider lied or eventual consistency delay
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
          // Any exception (timeout, network, provider error) → FAIL_CLOSED
          failReason = `STORAGE_EXCEPTION: ${storageErr instanceof Error ? storageErr.message : String(storageErr)}`;
        }
      } else {
        // No storage reference — version may never have had committed bytes (edge case)
        // Treat as confirmed (no physical object to delete)
        physicalDeleteConfirmed = true;
      }

      // Begin new transaction for finalization
      const client2 = await pool.connect();
      try {
        await client2.query('BEGIN');

        let deletionRecord: DeletionRecordData;

        if (physicalDeleteConfirmed) {
          // ── STEP 7: Remove StorageObjectReference (explicit, not CASCADE) ────
          if (storageRef) {
            await client2.query(
              `DELETE FROM document_storage_references
                WHERE institution_id = $1 AND version_id = $2`,
              [context.institutionId, auth!.versionId],
            );
          }

          // ── STEP 8: Mark version as deleted — ONLY after confirmed deletion ──
          await client2.query(
            `UPDATE document_versions
                SET status = 'deleted'
              WHERE institution_id = $1 AND id = $2
                AND status = 'deletion_in_progress'`,
            [context.institutionId, auth!.versionId],
          );

          await deletionAuthRepo.updateStatus(
            client2, context.institutionId, auth!.id, 'deleted',
          );
          await retentionAssignmentRepo.updateStatus(
            client2, context.institutionId, auth!.retentionAssignmentId, 'deleted',
          );

          // ── Write DeletionRecord: result='deleted' requires storage_deletion_confirmed=true ──
          deletionRecord = await deletionRecordRepo.insert(client2, {
            institutionId: context.institutionId,
            deletionAuthorizationId: auth!.id,
            deletionOperationId,
            pseudonymizedRef,
            policyBasis: auth!.policyBasis,
            policyVersion: auth!.policyVersion,
            jurisdictionProfileId: auth!.jurisdictionProfileId,
            result: 'deleted',
            storageDeletionConfirmed: true,
            actorAuthorityScope: input.actorAuthorityScope,
          });

          await auditRepo.recordAuditEvent(client2, {
            institutionId: context.institutionId,
            documentId: auth!.documentId,
            versionId: null,   // version row exists but is tombstoned; no FK navigation for audit
            actorPersonId: context.personId,
            action: 'document.version_deleted',
            outcome: 'success',
            correlationId: input.correlationId ?? null,
            details: {
              deletionOperationId,
              policyBasis: auth!.policyBasis,
              storageDeletionConfirmed: true,
            },
          });

          await client2.query('COMMIT');
          return {
            resultRef: deletionRecord.id,
            result: { deletionRecord, reconciliationRequired: false },
          };
        } else {
          // ── FAIL_CLOSED: unknown/failed storage outcome ───────────────────────
          await deletionAuthRepo.updateStatus(
            client2, context.institutionId, auth!.id,
            'deletion_reconciliation_required',
          );

          deletionRecord = await deletionRecordRepo.insert(client2, {
            institutionId: context.institutionId,
            deletionAuthorizationId: auth!.id,
            deletionOperationId,
            pseudonymizedRef,
            policyBasis: auth!.policyBasis,
            policyVersion: auth!.policyVersion,
            jurisdictionProfileId: auth!.jurisdictionProfileId,
            result: 'reconciliation_required',
            storageDeletionConfirmed: false,
            actorAuthorityScope: input.actorAuthorityScope,
          });

          await auditRepo.recordAuditEvent(client2, {
            institutionId: context.institutionId,
            documentId: auth!.documentId,
            versionId: auth!.versionId,
            actorPersonId: context.personId,
            action: 'document.deletion_reconciliation_required',
            outcome: 'failed',
            correlationId: input.correlationId ?? null,
            details: { deletionOperationId, failReason },
          });

          await client2.query('COMMIT');
          return {
            resultRef: deletionRecord.id,
            result: { deletionRecord, reconciliationRequired: true },
          };
        }
      } catch (finalizeErr) {
        await client2.query('ROLLBACK').catch(() => undefined);
        throw finalizeErr;
      } finally {
        client2.release();
      }
    },
    loadResult: async (client: PoolClient, resultRef: string) => {
      const dr = await deletionRecordRepo.getByAuthorizationId(
        client, context.institutionId, input.deletionAuthorizationId,
      );
      if (!dr) throw new Error(`DELETION_RECORD_NOT_FOUND: ${resultRef}`);
      return { deletionRecord: dr, reconciliationRequired: dr.result === 'reconciliation_required' };
    },
  });
}

// ─── ReconcileDeletion ────────────────────────────────────────────────────────

export interface ReconcileDeletionInput {
  deletionAuthorizationId: string;
  actorAuthorityScope: string;
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
  let existingRecord: Awaited<ReturnType<typeof deletionRecordRepo.getByAuthorizationId>>;

  const client = await pool.connect();
  try {
    auth = await deletionAuthRepo.getById(
      client, context.institutionId, input.deletionAuthorizationId,
    );
    if (!auth) {
      throw new Error(`DELETION_AUTHORIZATION_NOT_FOUND: ${input.deletionAuthorizationId}`);
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

    existingRecord = await deletionRecordRepo.getByAuthorizationId(
      client, context.institutionId, auth.id,
    );
  } finally {
    client.release();
  }

  // Probe storage
  let storageGone = false;
  if (!storageRef) {
    // No storage ref exists — either deleted by a previous partial run or never had committed bytes
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
        // Object still exists — try controlled delete
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
      // headObject/deleteObject error → FAIL_CLOSED: remain reconciliation_required
      storageGone = false;
    }
  }

  const deletionOperationId = existingRecord?.deletionOperationId ?? generateDeletionOperationId();
  const pseudonymizedRef = deriveDeletionPseudonymizedRef({
    deletionPseudonymizationKey,
    institutionId: context.institutionId,
    documentId: auth.documentId,
    versionId: auth.versionId,
    deletionAuthorizationId: auth.id,
  });

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

        let deletionRecord: DeletionRecordData;
        if (existingRecord) {
          // Record already exists — update result to deleted
          await client2.query(
            `UPDATE document_deletion_records
                SET result = 'deleted', storage_deletion_confirmed = true
              WHERE institution_id = $1 AND deletion_authorization_id = $2`,
            [context.institutionId, auth.id],
          );
          deletionRecord = (await deletionRecordRepo.getByAuthorizationId(client2, context.institutionId, auth.id))!;
        } else {
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
            actorAuthorityScope: input.actorAuthorityScope,
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
          details: { deletionOperationId, storageDeletionConfirmed: true },
        });

        await client2.query('COMMIT');
        return { deletionRecord, reconciliationRequired: false };
      } else {
        // Storage still exists or probing failed — remain RECONCILIATION_REQUIRED
        await deletionAuthRepo.updateStatus(
          client2, context.institutionId, auth.id, 'deletion_reconciliation_required',
        );
        await client2.query('COMMIT');

        const dr = (await (async () => {
          const c = await pool.connect();
          try {
            return await deletionRecordRepo.getByAuthorizationId(c, context.institutionId, auth.id);
          } finally { c.release(); }
        })());

        if (!dr) throw new Error('DELETION_RECORD_MISSING_AFTER_RECONCILIATION');
        return { deletionRecord: dr, reconciliationRequired: true };
      }
    } catch (err) {
      await client2.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client2.release();
    }
}
