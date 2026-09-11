/**
 * Documents Foundation I7 - Outbox Processing & Dispatch Commands
 * Mission: DOCUMENTS-FOUNDATION-I7
 */

import type { Pool } from 'pg';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import {
  DocumentOutboxEvent,
} from './document-event-model.ts';
import {
  PostgresDocumentOutboxRepository,
} from './document-event-repository.ts';

export interface DocumentOutboxOperationalPolicy {
  batchSize: number;
  leaseDurationSeconds: number;
  maxAttempts: number;
  calculateBackoffSeconds: (attempt: number) => number;
}

/**
 * Synthetic operational policy fixture for test suites only.
 * Production dispatch paths MUST NOT fallback to synthetic defaults.
 */
export const SYNTHETIC_TEST_OUTBOX_POLICY: DocumentOutboxOperationalPolicy = {
  batchSize: 10,
  leaseDurationSeconds: 30,
  maxAttempts: 3,
  calculateBackoffSeconds: (attempt: number) => Math.min(60, Math.pow(2, attempt)),
};

export interface ProcessOutboxBatchResult {
  claimedCount: number;
  publishedCount: number;
  processedCount: number;
  failedCount: number;
  deadLetterCount: number;
}

export interface DocumentEventPublisher {
  publish(event: DocumentOutboxEvent): Promise<void>;
}

export type DocumentEventDispatcher = (event: DocumentOutboxEvent) => Promise<void>;

export interface ProcessDocumentOutboxBatchParams {
  pool: Pool;
  authority: InstitutionalContext;
  operationalPolicy: DocumentOutboxOperationalPolicy;
  publisher?: DocumentEventPublisher;
  dispatcher?: DocumentEventDispatcher;
}

function resolveTrustedInstitutionId(
  authority: InstitutionalContext,
): string {
  if (!authority || typeof authority !== 'object') {
    throw new Error(
      'UNAUTHORIZED_WORKER_AUTHORITY: processDocumentOutboxBatchCommand requires an authoritative InstitutionalContext',
    );
  }

  // Validate InstitutionalContext fields strictly
  if (
    typeof authority.institutionId !== 'string' ||
    authority.institutionId.trim().length === 0 ||
    typeof authority.personId !== 'string' ||
    authority.personId.trim().length === 0 ||
    typeof authority.role !== 'string' ||
    !authority.role
  ) {
    throw new Error(
      'UNAUTHORIZED_WORKER_AUTHORITY: Authority must be an authentic InstitutionalContext with personId and institutional role',
    );
  }

  // Reject forged plain worker authority objects
  if ('workerRole' in authority || 'workerId' in authority) {
    throw new Error(
      'UNAUTHORIZED_WORKER_AUTHORITY: Arbitrary or forged worker authority objects are rejected. Use authoritative InstitutionalContext.',
    );
  }

  return authority.institutionId;
}

function validateOperationalPolicy(
  policy: DocumentOutboxOperationalPolicy,
): void {
  if (!policy || typeof policy !== 'object') {
    throw new Error(
      'OPERATIONAL_POLICY_REQUIRED: processDocumentOutboxBatchCommand requires an explicit trusted DocumentOutboxOperationalPolicy (no production defaults allowed)',
    );
  }

  if (typeof policy.batchSize !== 'number' || policy.batchSize <= 0 || !Number.isInteger(policy.batchSize)) {
    throw new Error('INVALID_OPERATIONAL_POLICY: batchSize must be a positive integer greater than 0');
  }

  if (typeof policy.leaseDurationSeconds !== 'number' || policy.leaseDurationSeconds <= 0) {
    throw new Error('INVALID_OPERATIONAL_POLICY: leaseDurationSeconds must be a positive number greater than 0');
  }

  if (typeof policy.maxAttempts !== 'number' || policy.maxAttempts <= 0 || !Number.isInteger(policy.maxAttempts)) {
    throw new Error('INVALID_OPERATIONAL_POLICY: maxAttempts must be a positive integer greater than 0');
  }

  if (typeof policy.calculateBackoffSeconds !== 'function') {
    throw new Error('INVALID_OPERATIONAL_POLICY: calculateBackoffSeconds must be an explicit calculation function');
  }
}

export async function processDocumentOutboxBatchCommand(
  params: ProcessDocumentOutboxBatchParams,
): Promise<ProcessOutboxBatchResult> {
  const { pool, authority, operationalPolicy } = params;

  // 1. Resolve trusted tenant scope - raw caller strings / forged worker objects strictly forbidden
  const institutionId = resolveTrustedInstitutionId(authority);

  // 2. Validate explicit operational policy - production fallbacks strictly forbidden
  validateOperationalPolicy(operationalPolicy);

  // 3. Fail closed if neither dispatcher nor publisher is provided
  if (!params.dispatcher && !params.publisher) {
    throw new Error(
      'DISPATCHER_REQUIRED: processDocumentOutboxBatchCommand requires an explicit dispatcher or publisher (fail closed)',
    );
  }

  const { batchSize, leaseDurationSeconds, maxAttempts, calculateBackoffSeconds } = operationalPolicy;

  const dispatchFn: DocumentEventDispatcher =
    params.dispatcher ?? ((event) => params.publisher!.publish(event));

  const outboxRepo = new PostgresDocumentOutboxRepository();
  const client = await pool.connect();

  let claimedEvents: DocumentOutboxEvent[] = [];
  try {
    claimedEvents = await outboxRepo.claimPendingEvents(
      client,
      institutionId,
      batchSize,
      leaseDurationSeconds,
    );
  } finally {
    client.release();
  }

  let publishedCount = 0;
  let failedCount = 0;
  let deadLetterCount = 0;

  for (const event of claimedEvents) {
    const eventClient = await pool.connect();
    try {
      await dispatchFn(event);
      await outboxRepo.completeEvent(eventClient, institutionId, event.id);
      publishedCount++;
    } catch (pubError) {
      failedCount++;
      const errorCode = pubError instanceof Error ? pubError.name || 'PUBLISH_ERROR' : 'UNKNOWN_ERROR';
      const errorMessage = pubError instanceof Error ? pubError.message : String(pubError);
      const backoffSecs = calculateBackoffSeconds(event.attempts);

      if (typeof backoffSecs !== 'number' || backoffSecs < 0) {
        throw new Error('INVALID_OPERATIONAL_POLICY: calculateBackoffSeconds returned an invalid backoff value');
      }

      await outboxRepo.failEvent(
        eventClient,
        institutionId,
        event.id,
        errorCode,
        errorMessage,
        backoffSecs,
        maxAttempts,
      );

      // Check if transitioned to dead letter
      const checkEvent = await outboxRepo.getEventById(eventClient, institutionId, event.id);
      if (checkEvent?.status === 'dead_letter') {
        deadLetterCount++;
      }
    } finally {
      eventClient.release();
    }
  }

  return {
    claimedCount: claimedEvents.length,
    publishedCount,
    processedCount: publishedCount,
    failedCount,
    deadLetterCount,
  };
}
