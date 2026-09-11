/**
 * Documents Foundation I7 - Event & Outbox Repository
 * Mission: DOCUMENTS-FOUNDATION-I7
 */

import type { PoolClient } from 'pg';
import {
  DocumentOutboxEvent,
  CreateDocumentEventIntent,
  SUPPORTED_DOCUMENT_EVENT_SCHEMA_VERSION,
  validateEventPayloadSecurity,
} from './document-event-model.ts';

interface OutboxRow {
  id: string;
  institution_id: string;
  event_type: string;
  schema_version: string;
  aggregate_type: string;
  aggregate_id: string;
  occurred_at: Date;
  actor_person_id: string | null;
  actor_kind: 'person' | 'system';
  correlation_id: string | null;
  causation_id: string | null;
  payload: Record<string, unknown>;
  status: 'pending' | 'claimed' | 'published' | 'dead_letter';
  attempts: number;
  max_attempts: number;
  next_attempt_at: Date;
  claimed_at: Date | null;
  claim_expires_at: Date | null;
  last_error_code: string | null;
  last_error_message: string | null;
  published_at: Date | null;
  dead_lettered_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapOutboxRow(row: OutboxRow): DocumentOutboxEvent {
  return {
    id: row.id,
    institutionId: row.institution_id,
    eventType: row.event_type as DocumentOutboxEvent['eventType'],
    schemaVersion: row.schema_version,
    aggregateType: row.aggregate_type as DocumentOutboxEvent['aggregateType'],
    aggregateId: row.aggregate_id,
    occurredAt: row.occurred_at,
    actorPersonId: row.actor_person_id,
    actorKind: row.actor_kind,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    nextAttemptAt: row.next_attempt_at,
    claimedAt: row.claimed_at,
    claimExpiresAt: row.claim_expires_at,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    publishedAt: row.published_at,
    deadLetteredAt: row.dead_lettered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface OutboxQueueMetrics {
  pendingCount: number;
  claimedCount: number;
  publishedCount: number;
  deadLetterCount: number;
  oldestPendingAgeSeconds: number | null;
  maxAttemptsObserved: number;
}

export class PostgresDocumentOutboxRepository {
  async insertEvent(
    client: PoolClient,
    intent: CreateDocumentEventIntent,
  ): Promise<DocumentOutboxEvent> {
    return this.insertEventIntent(client, intent);
  }

  async insertEventIntent(
    client: PoolClient,
    intent: CreateDocumentEventIntent,
  ): Promise<DocumentOutboxEvent> {
    validateEventPayloadSecurity(intent.payload);

    const schemaVersion = intent.schemaVersion ?? SUPPORTED_DOCUMENT_EVENT_SCHEMA_VERSION;
    const actorKind: 'person' | 'system' =
      intent.actorKind === 'user' || intent.actorKind === 'person'
        ? 'person'
        : intent.actorKind === 'system'
        ? 'system'
        : intent.actorPersonId
        ? 'person'
        : 'system';
    const maxAttempts =
      typeof intent.maxAttempts === 'number' && intent.maxAttempts > 0
        ? intent.maxAttempts
        : 3;

    const query = `
      INSERT INTO document_outbox_events (
        institution_id,
        event_type,
        schema_version,
        aggregate_type,
        aggregate_id,
        occurred_at,
        actor_person_id,
        actor_kind,
        correlation_id,
        causation_id,
        payload,
        status,
        attempts,
        max_attempts,
        next_attempt_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', 0, $12, now())
      RETURNING *
    `;

    const res = await client.query<OutboxRow>(query, [
      intent.institutionId,
      intent.eventType,
      schemaVersion,
      intent.aggregateType,
      intent.aggregateId,
      intent.occurredAt ?? new Date(),
      intent.actorPersonId ?? null,
      actorKind,
      intent.correlationId ?? null,
      intent.causationId ?? null,
      JSON.stringify(intent.payload),
      maxAttempts,
    ]);

    return mapOutboxRow(res.rows[0]);
  }

  async claimPendingEvents(
    client: PoolClient,
    institutionId: string,
    limit: number,
    leaseSeconds: number,
  ): Promise<DocumentOutboxEvent[]> {
    const query = `
      WITH candidates AS (
        SELECT id
          FROM document_outbox_events
         WHERE institution_id = $1
           AND (
             status = 'pending'
             OR (status = 'claimed' AND claim_expires_at <= now())
           )
           AND next_attempt_at <= now()
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $2
      )
      UPDATE document_outbox_events o
         SET status = 'claimed',
             claimed_at = now(),
             claim_expires_at = now() + ($3 || ' seconds')::interval,
             attempts = attempts + 1,
             updated_at = now()
        FROM candidates c
       WHERE o.id = c.id
         AND o.institution_id = $1
      RETURNING o.*
    `;

    const res = await client.query<OutboxRow>(query, [institutionId, limit, leaseSeconds]);
    return res.rows.map(mapOutboxRow);
  }

  async completeEvent(client: PoolClient, institutionId: string, eventId: string): Promise<void> {
    const query = `
      UPDATE document_outbox_events
         SET status = 'published',
             published_at = now(),
             claimed_at = NULL,
             claim_expires_at = NULL,
             updated_at = now()
       WHERE institution_id = $1
         AND id = $2
         AND status = 'claimed'
    `;
    await client.query(query, [institutionId, eventId]);
  }

  async failEvent(
    client: PoolClient,
    institutionId: string,
    eventId: string,
    errorCode: string,
    errorMessage: string,
    backoffSeconds: number,
    policyMaxAttempts: number,
  ): Promise<void> {
    if (typeof backoffSeconds !== 'number' || backoffSeconds < 0) {
      throw new Error('OPERATIONAL_POLICY_REQUIRED: backoffSeconds must be a non-negative number');
    }
    if (typeof policyMaxAttempts !== 'number' || policyMaxAttempts <= 0) {
      throw new Error('OPERATIONAL_POLICY_REQUIRED: policyMaxAttempts must be a positive number');
    }

    const checkRes = await client.query<{ attempts: number }>(
      `SELECT attempts FROM document_outbox_events WHERE institution_id = $1 AND id = $2`,
      [institutionId, eventId],
    );
    if (checkRes.rows.length === 0) return;

    const row = checkRes.rows[0];
    if (row.attempts >= policyMaxAttempts) {
      const deadLetterQuery = `
        UPDATE document_outbox_events
           SET status = 'dead_letter',
               dead_lettered_at = now(),
               claimed_at = NULL,
               claim_expires_at = NULL,
               last_error_code = $3,
               last_error_message = $4,
               updated_at = now()
         WHERE institution_id = $1
           AND id = $2
      `;
      await client.query(deadLetterQuery, [institutionId, eventId, errorCode, errorMessage]);
    } else {
      const retryQuery = `
        UPDATE document_outbox_events
           SET status = 'pending',
               next_attempt_at = now() + ($3 || ' seconds')::interval,
               claimed_at = NULL,
               claim_expires_at = NULL,
               last_error_code = $4,
               last_error_message = $5,
               updated_at = now()
         WHERE institution_id = $1
           AND id = $2
      `;
      await client.query(retryQuery, [institutionId, eventId, backoffSeconds, errorCode, errorMessage]);
    }
  }

  async getEventById(
    client: PoolClient,
    institutionId: string,
    eventId: string,
  ): Promise<DocumentOutboxEvent | null> {
    const query = `
      SELECT * FROM document_outbox_events
       WHERE institution_id = $1 AND id = $2
    `;
    const res = await client.query<OutboxRow>(query, [institutionId, eventId]);
    if (res.rows.length === 0) return null;
    return mapOutboxRow(res.rows[0]);
  }

  async getQueueMetrics(client: PoolClient, institutionId: string): Promise<OutboxQueueMetrics> {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
        COUNT(*) FILTER (WHERE status = 'claimed') AS claimed_count,
        COUNT(*) FILTER (WHERE status = 'published') AS published_count,
        COUNT(*) FILTER (WHERE status = 'dead_letter') AS dead_letter_count,
        EXTRACT(EPOCH FROM (now() - MIN(created_at) FILTER (WHERE status = 'pending'))) AS oldest_pending_age_seconds,
        COALESCE(MAX(attempts), 0) AS max_attempts_observed
      FROM document_outbox_events
      WHERE institution_id = $1
    `;
    const res = await client.query<{
      pending_count: string;
      claimed_count: string;
      published_count: string;
      dead_letter_count: string;
      oldest_pending_age_seconds: string | null;
      max_attempts_observed: string;
    }>(query, [institutionId]);

    const r = res.rows[0];
    return {
      pendingCount: parseInt(r.pending_count ?? '0', 10),
      claimedCount: parseInt(r.claimed_count ?? '0', 10),
      publishedCount: parseInt(r.published_count ?? '0', 10),
      deadLetterCount: parseInt(r.dead_letter_count ?? '0', 10),
      oldestPendingAgeSeconds: r.oldest_pending_age_seconds ? parseFloat(r.oldest_pending_age_seconds) : null,
      maxAttemptsObserved: parseInt(r.max_attempts_observed ?? '0', 10),
    };
  }

  async getOutboxMetrics(client: PoolClient, institutionId: string): Promise<OutboxQueueMetrics> {
    return this.getQueueMetrics(client, institutionId);
  }

  async markEventPublished(client: PoolClient, institutionId: string, eventId: string): Promise<boolean> {
    const query = `
      UPDATE document_outbox_events
         SET status = 'published',
             published_at = now(),
             claimed_at = NULL,
             claim_expires_at = NULL,
             updated_at = now()
       WHERE institution_id = $1
         AND id = $2
         AND status = 'claimed'
       RETURNING id
    `;
    const res = await client.query(query, [institutionId, eventId]);
    return res.rows.length > 0;
  }

  async markEventFailed(
    client: PoolClient,
    institutionId: string,
    eventId: string,
    error: { errorCode: string; errorMessage: string; backoffSeconds: number; policyMaxAttempts: number },
  ): Promise<boolean> {
    if (typeof error.backoffSeconds !== 'number' || error.backoffSeconds < 0) {
      throw new Error('OPERATIONAL_POLICY_REQUIRED: backoffSeconds must be a non-negative number');
    }
    if (typeof error.policyMaxAttempts !== 'number' || error.policyMaxAttempts <= 0) {
      throw new Error('OPERATIONAL_POLICY_REQUIRED: policyMaxAttempts must be a positive number');
    }

    const checkRes = await client.query<{ attempts: number }>(
      `SELECT attempts FROM document_outbox_events WHERE institution_id = $1 AND id = $2`,
      [institutionId, eventId],
    );
    if (checkRes.rows.length === 0) return false;

    const row = checkRes.rows[0];
    if (row.attempts >= error.policyMaxAttempts) {
      const deadLetterQuery = `
        UPDATE document_outbox_events
           SET status = 'dead_letter',
               dead_lettered_at = now(),
               claimed_at = NULL,
               claim_expires_at = NULL,
               last_error_code = $3,
               last_error_message = $4,
               updated_at = now()
         WHERE institution_id = $1
           AND id = $2
         RETURNING id
      `;
      const dlRes = await client.query(deadLetterQuery, [institutionId, eventId, error.errorCode, error.errorMessage]);
      return dlRes.rows.length > 0;
    } else {
      const retryQuery = `
        UPDATE document_outbox_events
           SET status = 'pending',
               next_attempt_at = now() + ($3 || ' seconds')::interval,
               claimed_at = NULL,
               claim_expires_at = NULL,
               last_error_code = $4,
               last_error_message = $5,
               updated_at = now()
         WHERE institution_id = $1
           AND id = $2
         RETURNING id
      `;
      const retryRes = await client.query(retryQuery, [institutionId, eventId, error.backoffSeconds, error.errorCode, error.errorMessage]);
      return retryRes.rows.length > 0;
    }
  }
}

export class PostgresDocumentConsumerLedgerRepository {
  async recordProcessing(
    client: PoolClient,
    institutionId: string,
    consumerId: string,
    eventId: string,
    status: 'processed' | 'skipped' | 'failed' = 'processed',
    details: Record<string, unknown> = {},
  ): Promise<{ alreadyProcessed: boolean; inserted: boolean }> {
    const query = `
      INSERT INTO document_event_consumer_ledger (
        institution_id,
        consumer_id,
        event_id,
        processed_at,
        status,
        details
      ) VALUES ($1, $2, $3, now(), $4, $5)
      ON CONFLICT (institution_id, consumer_id, event_id) DO NOTHING
      RETURNING id
    `;
    const res = await client.query(query, [
      institutionId,
      consumerId,
      eventId,
      status,
      JSON.stringify(details),
    ]);

    const inserted = res.rows.length > 0;
    return { alreadyProcessed: !inserted, inserted };
  }

  async recordProcessed(
    client: PoolClient,
    params: {
      institutionId: string;
      consumerId: string;
      eventId: string;
      status?: 'processed' | 'skipped' | 'failed' | 'completed';
      result?: Record<string, unknown>;
    },
  ): Promise<{ alreadyProcessed: boolean; inserted: boolean }> {
    const normStatus = params.status === 'completed' ? 'processed' : (params.status ?? 'processed');
    return this.recordProcessing(
      client,
      params.institutionId,
      params.consumerId,
      params.eventId,
      normStatus,
      params.result ?? {},
    );
  }

  async getEntry(
    client: PoolClient,
    institutionId: string,
    consumerId: string,
    eventId: string,
  ): Promise<{ id: string; institutionId: string; consumerId: string; eventId: string; processedAt: Date; status: string } | null> {
    const query = `
      SELECT id, institution_id, consumer_id, event_id, processed_at, status
        FROM document_event_consumer_ledger
       WHERE institution_id = $1 AND consumer_id = $2 AND event_id = $3
    `;
    const res = await client.query<{
      id: string;
      institution_id: string;
      consumer_id: string;
      event_id: string;
      processed_at: Date;
      status: string;
    }>(query, [institutionId, consumerId, eventId]);

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      institutionId: r.institution_id,
      consumerId: r.consumer_id,
      eventId: r.event_id,
      processedAt: r.processed_at,
      status: r.status,
    };
  }

  async isEventProcessed(
    client: PoolClient,
    institutionId: string,
    consumerId: string,
    eventId: string,
  ): Promise<boolean> {
    const query = `
      SELECT 1 FROM document_event_consumer_ledger
       WHERE institution_id = $1 AND consumer_id = $2 AND event_id = $3
    `;
    const res = await client.query(query, [institutionId, consumerId, eventId]);
    return res.rows.length > 0;
  }
}
