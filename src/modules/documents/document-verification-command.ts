/**
 * Documents Foundation I4 Technical Verification Commands
 * Mission: DOCUMENTS-FOUNDATION-I4
 */

import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import type { DocumentExecutionContext } from './verification-worker.ts';
import type {
  DocumentTechnicalVerification,
  DocumentTechnicalAssessment,
  TechnicalAssessmentType,
  TechnicalAssessmentStatus,
  TechnicalVerificationRetryPolicy,
  VerificationEvaluationResult,
} from './document-verification-model.ts';
import {
  evaluateVerificationOutcome,
  calculateNextRetry,
} from './document-verification-model.ts';
import { PostgresDocumentRepository } from './document-repository.ts';
import { PostgresDocumentVerificationRepository } from './document-verification-repository.ts';
import { PostgresDocumentAuditRepository } from './document-audit.ts';
import { PostgresDocumentOutboxRepository } from './document-event-repository.ts';
import { executeIdempotentDocumentsCommand } from './document-command.ts';
import { createCanonicalDocumentsFingerprint } from './document-model.ts';
import type { ObjectStorageProvider } from './object-storage-provider.ts';
import type { MalwareScanner } from './malware-scanner.ts';
import type { ContentTypeDetector } from './content-type-detector.ts';

export interface StartVerificationInput {
  documentId: string;
  versionId: string;
}

export interface RecordAssessmentInput {
  documentId: string;
  versionId: string;
  verificationId: string;
  assessmentType: TechnicalAssessmentType;
  status: TechnicalAssessmentStatus;
  provider: string;
  attemptNumber: number;
  facts?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}

export interface FinalizeVerificationInput {
  documentId: string;
  versionId: string;
  verificationId: string;
  retryPolicy?: TechnicalVerificationRetryPolicy;
}

export interface ExecutePipelineInput {
  documentId: string;
  versionId: string;
  storageProvider: ObjectStorageProvider;
  malwareScanner: MalwareScanner;
  contentTypeDetector: ContentTypeDetector;
  retryPolicy: TechnicalVerificationRetryPolicy;
}

export interface PipelineExecutionResult {
  verification: DocumentTechnicalVerification;
  assessments: DocumentTechnicalAssessment[];
  evaluation: VerificationEvaluationResult;
  versionStatus: string;
}

const docRepo = new PostgresDocumentRepository();
const verificationRepo = new PostgresDocumentVerificationRepository();
const auditRepo = new PostgresDocumentAuditRepository();
const outboxRepo = new PostgresDocumentOutboxRepository();

export async function startTechnicalVerificationCommand(params: {
  pool: Pool;
  context: DocumentExecutionContext;
  idempotencyKey: string;
  input: StartVerificationInput;
}): Promise<{ replayed: boolean; result: DocumentTechnicalVerification }> {
  const { pool, context, idempotencyKey, input } = params;

  const fingerprint = createCanonicalDocumentsFingerprint({
    institutionId: context.institutionId,
    documentId: input.documentId,
    versionId: input.versionId,
    command: 'start_technical_verification',
  });

  return executeIdempotentDocumentsCommand({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.technical_verification.start',
      idempotencyKey,
      canonicalFingerprint: fingerprint,
    },
    execute: async (client: PoolClient) => {
      // Validate version existence and tenant isolation
      const version = await docRepo.getVersionById(
        client,
        context.institutionId,
        input.versionId,
      );
      if (!version || version.documentId !== input.documentId) {
        throw new Error(`DOCUMENT_VERSION_NOT_FOUND: version ${input.versionId} not found in institution ${context.institutionId}`);
      }

      const verification = await verificationRepo.createOrGetVerification(client, {
        institutionId: context.institutionId,
        documentId: input.documentId,
        versionId: input.versionId,
      });

      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: input.documentId,
        versionId: input.versionId,
        actorPersonId: context.personId,
        action: 'document.verification_started',
        outcome: 'success',
        details: {
          verificationId: verification.id,
          attemptCount: verification.attemptCount,
          dueAt: verification.dueAt.toISOString(),
        },
      });

      return {
        resultRef: verification.id,
        result: verification,
      };
    },
    loadResult: async (client: PoolClient, resultRef: string) => {
      const v = await verificationRepo.getVerificationById(client, context.institutionId, resultRef);
      if (!v) {
        throw new Error(`Verification ${resultRef} not found on reload`);
      }
      return v;
    },
  });
}

export async function recordTechnicalAssessmentCommand(params: {
  pool: Pool;
  context: DocumentExecutionContext;
  idempotencyKey: string;
  input: RecordAssessmentInput;
}): Promise<{ replayed: boolean; result: DocumentTechnicalAssessment }> {
  const { pool, context, idempotencyKey, input } = params;

  const fingerprint = createCanonicalDocumentsFingerprint({
    institutionId: context.institutionId,
    documentId: input.documentId,
    versionId: input.versionId,
    verificationId: input.verificationId,
    assessmentType: input.assessmentType,
    status: input.status,
    provider: input.provider,
    attemptNumber: input.attemptNumber,
    errorCode: input.errorCode || null,
  });

  return executeIdempotentDocumentsCommand({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.technical_verification.assessment',
      idempotencyKey,
      canonicalFingerprint: fingerprint,
    },
    execute: async (client: PoolClient) => {
      const verification = await verificationRepo.getVerificationById(
        client,
        context.institutionId,
        input.verificationId,
      );
      if (!verification) {
        throw new Error(`Verification ${input.verificationId} not found in institution ${context.institutionId}`);
      }

      // Check stale attempt: reject stale attempt results
      if (input.attemptNumber < verification.attemptCount) {
        throw new Error(
          `STALE_ATTEMPT_REJECTED: incoming attempt ${input.attemptNumber} is older than canonical attempt ${verification.attemptCount}`,
        );
      }

      const assessment = await verificationRepo.recordAssessmentResult(client, {
        institutionId: context.institutionId,
        documentId: input.documentId,
        versionId: input.versionId,
        verificationId: input.verificationId,
        assessmentType: input.assessmentType,
        status: input.status,
        provider: input.provider,
        attemptNumber: input.attemptNumber,
        facts: input.facts,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
      });

      // If assessment is FAIL, immediately transition verification to quarantined (fail-closed domination)
      if (input.status === 'fail') {
        const quarantineReason = `Assessment ${input.assessmentType} failed: ${input.errorMessage || input.errorCode || 'security check failed'}`;
        await verificationRepo.transitionVerificationStatus(
          client,
          context.institutionId,
          input.verificationId,
          'quarantined',
          quarantineReason,
        );

        // CAS update version status if not already quarantined
        const version = await docRepo.getVersionById(
          client,
          context.institutionId,
          input.versionId,
        );
        if (version && version.status !== 'quarantined') {
          await verificationRepo.transitionVersionStatus(
            client,
            context.institutionId,
            input.documentId,
            input.versionId,
            version.status,
            'quarantined',
          );

          await outboxRepo.insertEvent(client, {
            institutionId: context.institutionId,
            eventType: 'document.quarantined',
            aggregateType: 'document',
            aggregateId: input.documentId,
            actorPersonId: context.personId,
            actorKind: 'system',
            correlationId: null,
            causationId: assessment.id,
            payload: {
              documentId: input.documentId,
              versionId: input.versionId,
              verificationId: input.verificationId,
              reason: quarantineReason,
              assessmentType: input.assessmentType,
            },
          });
        }
      }

      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: input.documentId,
        versionId: input.versionId,
        actorPersonId: context.personId,
        action: 'document.assessment_completed',
        outcome: input.status === 'fail' || input.status === 'error' ? 'failed' : 'success',
        details: {
          verificationId: input.verificationId,
          assessmentType: input.assessmentType,
          status: input.status,
          provider: input.provider,
          attemptNumber: input.attemptNumber,
          errorCode: input.errorCode,
        },
      });

      return {
        resultRef: assessment.id,
        result: assessment,
      };
    },
    loadResult: async (client: PoolClient, resultRef: string) => {
      const res = await client.query<{
        id: string;
        institution_id: string;
        document_id: string;
        version_id: string;
        verification_id: string;
        assessment_type: TechnicalAssessmentType;
        status: TechnicalAssessmentStatus;
        provider: string;
        attempt_number: number;
        started_at: Date;
        completed_at: Date | null;
        facts: Record<string, unknown>;
        error_code: string | null;
        error_message: string | null;
        created_at: Date;
      }>(
        `SELECT * FROM document_technical_assessments
         WHERE institution_id = $1 AND id = $2`,
        [context.institutionId, resultRef],
      );
      if (res.rows.length === 0) {
        throw new Error(`Assessment ${resultRef} not found on reload`);
      }
      const row = res.rows[0];
      return {
        id: row.id,
        institutionId: row.institution_id,
        documentId: row.document_id,
        versionId: row.version_id,
        verificationId: row.verification_id,
        assessmentType: row.assessment_type,
        status: row.status,
        provider: row.provider,
        attemptNumber: row.attempt_number,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        facts: typeof row.facts === 'string' ? JSON.parse(row.facts) : row.facts,
        errorCode: row.error_code,
        errorMessage: row.error_message,
        createdAt: row.created_at,
      };
    },
  });
}

export async function finalizeTechnicalVerificationCommand(params: {
  pool: Pool;
  context: DocumentExecutionContext;
  idempotencyKey: string;
  input: FinalizeVerificationInput;
}): Promise<{ replayed: boolean; result: { verification: DocumentTechnicalVerification; evaluation: VerificationEvaluationResult } }> {
  const { pool, context, idempotencyKey, input } = params;

  const fingerprint = createCanonicalDocumentsFingerprint({
    institutionId: context.institutionId,
    documentId: input.documentId,
    versionId: input.versionId,
    verificationId: input.verificationId,
    command: 'finalize_technical_verification',
  });

  return executeIdempotentDocumentsCommand({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.technical_verification.finalize',
      idempotencyKey,
      canonicalFingerprint: fingerprint,
    },
    execute: async (client: PoolClient) => {
      const verification = await verificationRepo.getVerificationById(
        client,
        context.institutionId,
        input.verificationId,
      );
      if (!verification) {
        throw new Error(`Verification ${input.verificationId} not found in institution ${context.institutionId}`);
      }

      const version = await docRepo.getVersionById(
        client,
        context.institutionId,
        input.versionId,
      );
      if (!version || version.documentId !== input.documentId) {
        throw new Error(`Version ${input.versionId} not found in institution ${context.institutionId}`);
      }

      const assessments = await verificationRepo.listAssessmentsForVerification(
        client,
        context.institutionId,
        input.verificationId,
      );

      const evaluation = evaluateVerificationOutcome(assessments);

      // Quarantine is terminal: if version or verification is already quarantined, never promote to available
      if (version.status === 'quarantined' || verification.status === 'quarantined') {
        evaluation.overallStatus = 'quarantined';
        evaluation.isReadyForAvailability = false;
        evaluation.allMandatoryPassed = false;
        evaluation.quarantineReason = evaluation.quarantineReason || verification.quarantineReason || 'Version is permanently quarantined';
      }

      let updatedVerification = verification;

      if (evaluation.allMandatoryPassed && evaluation.overallStatus === 'available') {
        // Transition version status: content_received -> available
        if (version.status !== 'available') {
          await verificationRepo.transitionVersionStatus(
            client,
            context.institutionId,
            input.documentId,
            input.versionId,
            version.status,
            'available',
          );
        }

        updatedVerification = await verificationRepo.transitionVerificationStatus(
          client,
          context.institutionId,
          input.verificationId,
          'available',
        );

        await auditRepo.recordAuditEvent(client, {
          institutionId: context.institutionId,
          documentId: input.documentId,
          versionId: input.versionId,
          actorPersonId: context.personId,
          action: 'document.verification_available',
          outcome: 'success',
          details: {
            verificationId: input.verificationId,
            assessmentsCount: assessments.length,
          },
        });

        await outboxRepo.insertEvent(client, {
          institutionId: context.institutionId,
          eventType: 'document.verification_passed',
          aggregateType: 'document',
          aggregateId: input.documentId,
          actorPersonId: context.personId,
          actorKind: 'system',
          correlationId: null,
          causationId: input.verificationId,
          payload: {
            documentId: input.documentId,
            versionId: input.versionId,
            verificationId: input.verificationId,
            assessmentsCount: assessments.length,
          },
        });
      } else if (evaluation.overallStatus === 'quarantined') {
        // Transition version status: content_received -> quarantined
        let wasNewlyQuarantined = false;
        if (version.status !== 'quarantined') {
          wasNewlyQuarantined = true;
          await verificationRepo.transitionVersionStatus(
            client,
            context.institutionId,
            input.documentId,
            input.versionId,
            version.status,
            'quarantined',
          );
        }

        updatedVerification = await verificationRepo.transitionVerificationStatus(
          client,
          context.institutionId,
          input.verificationId,
          'quarantined',
          evaluation.quarantineReason,
        );

        await auditRepo.recordAuditEvent(client, {
          institutionId: context.institutionId,
          documentId: input.documentId,
          versionId: input.versionId,
          actorPersonId: context.personId,
          action: 'document.verification_quarantined',
          outcome: 'failed',
          details: {
            verificationId: input.verificationId,
            reason: evaluation.quarantineReason,
          },
        });

        if (wasNewlyQuarantined) {
          await outboxRepo.insertEvent(client, {
            institutionId: context.institutionId,
            eventType: 'document.quarantined',
            aggregateType: 'document',
            aggregateId: input.documentId,
            actorPersonId: context.personId,
            actorKind: 'system',
            correlationId: null,
            causationId: input.verificationId,
            payload: {
              documentId: input.documentId,
              versionId: input.versionId,
              verificationId: input.verificationId,
              reason: evaluation.quarantineReason,
            },
          });
        }
      } else if (evaluation.overallStatus === 'inconclusive') {
        let nextRetry: Date | null = null;
        if (input.retryPolicy) {
          nextRetry = calculateNextRetry(
            verification.attemptCount,
            input.retryPolicy,
            verification.startedAt,
            verification.dueAt,
          );
        }

        updatedVerification = await verificationRepo.transitionVerificationStatus(
          client,
          context.institutionId,
          input.verificationId,
          'inconclusive',
          null,
          nextRetry,
        );

        if (nextRetry) {
          await auditRepo.recordAuditEvent(client, {
            institutionId: context.institutionId,
            documentId: input.documentId,
            versionId: input.versionId,
            actorPersonId: context.personId,
            action: 'document.verification_retry_scheduled',
            outcome: 'success',
            details: {
              verificationId: input.verificationId,
              nextRetryAt: nextRetry.toISOString(),
              reason: evaluation.failureReason,
            },
          });
        } else {
          await auditRepo.recordAuditEvent(client, {
            institutionId: context.institutionId,
            documentId: input.documentId,
            versionId: input.versionId,
            actorPersonId: context.personId,
            action: 'document.verification_inconclusive',
            outcome: 'failed',
            details: {
              verificationId: input.verificationId,
              reason: evaluation.failureReason,
            },
          });
        }
      }

      return {
        resultRef: updatedVerification.id,
        result: {
          verification: updatedVerification,
          evaluation,
        },
      };
    },
    loadResult: async (client: PoolClient, resultRef: string) => {
      const v = await verificationRepo.getVerificationById(client, context.institutionId, resultRef);
      if (!v) {
        throw new Error(`Verification ${resultRef} not found on reload`);
      }
      const assessments = await verificationRepo.listAssessmentsForVerification(
        client,
        context.institutionId,
        resultRef,
      );
      const evaluation = evaluateVerificationOutcome(assessments);
      return {
        verification: v,
        evaluation,
      };
    },
  });
}

/**
 * End-to-end technical verification pipeline execution.
 * Runs streaming integrity check, size check, bounded content-type detection, malware scan,
 * and finalizes verification atomically and idempotently.
 */
export async function executeTechnicalVerificationPipelineCommand(params: {
  pool: Pool;
  context: DocumentExecutionContext;
  idempotencyKey: string;
  input: ExecutePipelineInput;
}): Promise<{ replayed: boolean; result: PipelineExecutionResult }> {
  const { pool, context, idempotencyKey, input } = params;

  // 1. Start verification
  const startRes = await startTechnicalVerificationCommand({
    pool,
    context,
    idempotencyKey: `${idempotencyKey}:start`,
    input: {
      documentId: input.documentId,
      versionId: input.versionId,
    },
  });

  const verification = startRes.result;
  const client = await pool.connect();

  try {
    const version = await docRepo.getVersionById(
      client,
      context.institutionId,
      input.versionId,
    );
    if (!version || version.documentId !== input.documentId) {
      throw new Error(`Version ${input.versionId} not found in institution ${context.institutionId}`);
    }

    const storageRef = await docRepo.getStorageReferenceForVersion(
      client,
      context.institutionId,
      input.versionId,
    );
    if (!storageRef) {
      throw new Error(`Storage reference missing for version ${input.versionId}`);
    }

    // 2. Perform Streaming Integrity Assessment (Hash & Size Calculation)
    const stream = await input.storageProvider.openReadStream({
      institutionId: context.institutionId,
      storageBucket: storageRef.storageBucket,
      storageKey: storageRef.storageKey,
    });

    const hash = createHash('sha256');
    let totalBytes = 0;
    const prefixChunks: Buffer[] = [];
    let prefixBytesCollected = 0;
    const maxPrefix = input.contentTypeDetector.maxPrefixInspectionBytes;

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        hash.update(chunk);
        totalBytes += chunk.length;
        const remaining = maxPrefix - prefixBytesCollected;
        if (remaining > 0) {
          const slice = chunk.subarray(0, Math.min(chunk.length, remaining));
          prefixChunks.push(slice);
          prefixBytesCollected += slice.length;
        }
      });
      stream.on('end', () => resolve());
      stream.on('error', (err) => reject(err));
    });

    const actualSha256 = hash.digest('hex').toLowerCase();
    const prefixBuffer = Buffer.concat(prefixChunks);

    // Record Integrity Assessment
    const integrityPass = actualSha256 === version.sha256Hash.toLowerCase();
    await recordTechnicalAssessmentCommand({
      pool,
      context,
      idempotencyKey: `${idempotencyKey}:integrity`,
      input: {
        documentId: input.documentId,
        versionId: input.versionId,
        verificationId: verification.id,
        assessmentType: 'integrity',
        status: integrityPass ? 'pass' : 'fail',
        provider: 'sha256_stream_verifier',
        attemptNumber: verification.attemptCount,
        facts: {
          expectedHash: version.sha256Hash,
          actualHash: actualSha256,
        },
        errorCode: integrityPass ? undefined : 'INTEGRITY_HASH_MISMATCH',
        errorMessage: integrityPass ? undefined : `Hash mismatch: expected ${version.sha256Hash}, computed ${actualSha256}`,
      },
    });

    // Record Size Assessment
    const sizePass = totalBytes === version.byteSize;
    await recordTechnicalAssessmentCommand({
      pool,
      context,
      idempotencyKey: `${idempotencyKey}:size`,
      input: {
        documentId: input.documentId,
        versionId: input.versionId,
        verificationId: verification.id,
        assessmentType: 'size',
        status: sizePass ? 'pass' : 'fail',
        provider: 'byte_size_verifier',
        attemptNumber: verification.attemptCount,
        facts: {
          expectedSize: version.byteSize,
          actualSize: totalBytes,
        },
        errorCode: sizePass ? undefined : 'BYTE_SIZE_MISMATCH',
        errorMessage: sizePass ? undefined : `Size mismatch: expected ${version.byteSize} bytes, got ${totalBytes} bytes`,
      },
    });

    // 3. Real Content-Type Assessment (Bounded Detection with Range Support when needed)
    let detectedType = input.contentTypeDetector.detect(prefixBuffer);
    if (detectedType.isContainer) {
      const declaredIsOpc =
        version.mimeType.includes('openxmlformats') ||
        version.mimeType.includes('wordprocessingml') ||
        version.mimeType.includes('spreadsheetml') ||
        version.mimeType.includes('presentationml');
      if (declaredIsOpc && totalBytes > prefixBuffer.length) {
        const config = input.contentTypeDetector.getConfig();
        const rangeLimit = Math.min(
          totalBytes,
          config.maxContainerMetadataBytes,
          config.zipMetadataInspectionLimit,
        );
        if (rangeLimit > prefixBuffer.length) {
          const extendedBuffer = await input.storageProvider.readRange({
            institutionId: context.institutionId,
            storageBucket: storageRef.storageBucket,
            storageKey: storageRef.storageKey,
            startByte: 0,
            endByte: rangeLimit - 1,
          });
          detectedType = input.contentTypeDetector.detect(extendedBuffer);
        }
      }
    }

    const compatibility = input.contentTypeDetector.evaluateCompatibility(
      version.mimeType,
      `file${detectedType.canonicalExtension}`,
      detectedType,
    );

    let typeAssessmentStatus: TechnicalAssessmentStatus = 'pass';
    let typeErrorCode: string | undefined;
    let typeErrorMessage: string | undefined;

    if (!compatibility.isCompatible) {
      typeAssessmentStatus = 'fail';
      typeErrorCode = 'CONTENT_TYPE_MISMATCH';
      typeErrorMessage = compatibility.reason;
    }

    await recordTechnicalAssessmentCommand({
      pool,
      context,
      idempotencyKey: `${idempotencyKey}:real_type`,
      input: {
        documentId: input.documentId,
        versionId: input.versionId,
        verificationId: verification.id,
        assessmentType: 'real_type',
        status: typeAssessmentStatus,
        provider: 'bounded_magic_byte_detector',
        attemptNumber: verification.attemptCount,
        facts: {
          declaredMimeType: version.mimeType,
          detectedMimeType: detectedType.mimeType,
          detectedExtension: detectedType.canonicalExtension,
          isContainer: detectedType.isContainer,
          containerType: detectedType.containerType,
        },
        errorCode: typeErrorCode,
        errorMessage: typeErrorMessage,
      },
    });

    // 4. Malware Assessment
    let malwareScanOutput;
    try {
      malwareScanOutput = await input.malwareScanner.scanObject({
        institutionId: context.institutionId,
        documentId: input.documentId,
        versionId: input.versionId,
        storageBucket: storageRef.storageBucket,
        storageKey: storageRef.storageKey,
        byteSize: totalBytes,
        sha256Hash: actualSha256,
        prefixBuffer,
        readStreamFactory: async () =>
          input.storageProvider.openReadStream({
            institutionId: context.institutionId,
            storageBucket: storageRef.storageBucket,
            storageKey: storageRef.storageKey,
          }),
      });
    } catch (err: any) {
      malwareScanOutput = {
        result: 'error' as const,
        provider: input.malwareScanner.providerName,
        errorCode: 'SCANNER_UNAVAILABLE',
        errorMessage: err.message || 'Malware scanner communication error',
      };
    }

    let malwareAssessmentStatus: TechnicalAssessmentStatus;
    if (malwareScanOutput.result === 'clean') {
      malwareAssessmentStatus = 'pass';
    } else if (malwareScanOutput.result === 'malicious') {
      malwareAssessmentStatus = 'fail';
    } else if (malwareScanOutput.result === 'inconclusive') {
      malwareAssessmentStatus = 'inconclusive';
    } else {
      malwareAssessmentStatus = 'error';
    }

    await recordTechnicalAssessmentCommand({
      pool,
      context,
      idempotencyKey: `${idempotencyKey}:malware`,
      input: {
        documentId: input.documentId,
        versionId: input.versionId,
        verificationId: verification.id,
        assessmentType: 'malware',
        status: malwareAssessmentStatus,
        provider: malwareScanOutput.provider,
        attemptNumber: verification.attemptCount,
        facts: malwareScanOutput.details || {},
        errorCode: malwareScanOutput.errorCode || (malwareAssessmentStatus === 'fail' ? 'MALWARE_DETECTED' : undefined),
        errorMessage: malwareScanOutput.errorMessage || (malwareAssessmentStatus === 'fail' ? `Threat detected: ${malwareScanOutput.threatName}` : undefined),
      },
    });

    // 5. Finalize Verification
    const finalizeRes = await finalizeTechnicalVerificationCommand({
      pool,
      context,
      idempotencyKey: `${idempotencyKey}:finalize`,
      input: {
        documentId: input.documentId,
        versionId: input.versionId,
        verificationId: verification.id,
        retryPolicy: input.retryPolicy,
      },
    });

    const finalVersion = await docRepo.getVersionById(
      client,
      context.institutionId,
      input.versionId,
    );
    const assessments = await verificationRepo.listAssessmentsForVerification(
      client,
      context.institutionId,
      verification.id,
    );

    return {
      replayed: finalizeRes.replayed,
      result: {
        verification: finalizeRes.result.verification,
        assessments,
        evaluation: finalizeRes.result.evaluation,
        versionStatus: finalVersion?.status || 'unknown',
      },
    };
  } finally {
    client.release();
  }
}
