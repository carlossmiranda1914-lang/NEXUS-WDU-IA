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

export interface DocumentOutboxRetryPolicy {
  maxAttempts: number;
  calculateBackoffSeconds: (attempt: number) => number;
}

export const DEFAULT_SYNTHETIC_RETRY_POLICY: DocumentOutboxRetryPolicy = {
  maxAttempts: 3,
  calculateBackoffSeconds: (attempt: number) => Math.min(60, Math.pow(2, attempt)),
};

export interface ProcessOutboxBatchInput {
  limit?: number;
  batchSize?: number;
  leaseSeconds?: number;
  claimDurationSeconds?: number;
  retryPolicy?: DocumentOutboxRetryPolicy;
}

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

export async function processDocumentOutboxBatchCommand(params: {
  pool: Pool;
  context?: InstitutionalContext;
  institutionId?: string;
  publisher?: DocumentEventPublisher;
  dispatcher?: DocumentEventDispatcher;
  batchSize?: number;
  claimDurationSeconds?: number;
  input?: ProcessOutboxBatchInput;
}): Promise<ProcessOutboxBatchResult> {
  const { pool, context, input } = params;
  const institutionId = context?.institutionId ?? params.institutionId;

  if (!institutionId) {
    throw new Error('INSTITUTION_ID_REQUIRED: processDocumentOutboxBatchCommand requires an institutionId or InstitutionalContext');
  }

  const limit = input?.batchSize ?? input?.limit ?? params.batchSize ?? 10;
  const leaseSeconds = input?.claimDurationSeconds ?? input?.leaseSeconds ?? params.claimDurationSeconds ?? 300;
  const retryPolicy = input?.retryPolicy ?? DEFAULT_SYNTHETIC_RETRY_POLICY;

  const dispatchFn: DocumentEventDispatcher =
    params.dispatcher ??
    (params.publisher ? (event) => params.publisher!.publish(event) : async () => {});

  const outboxRepo = new PostgresDocumentOutboxRepository();
  const client = await pool.connect();

  let claimedEvents: DocumentOutboxEvent[] = [];
  try {
    claimedEvents = await outboxRepo.claimPendingEvents(
      client,
      institutionId,
      limit,
      leaseSeconds,
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
      const backoffSecs = retryPolicy.calculateBackoffSeconds(event.attempts);

      await outboxRepo.failEvent(
        eventClient,
        institutionId,
        event.id,
        errorCode,
        errorMessage,
        backoffSecs,
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
