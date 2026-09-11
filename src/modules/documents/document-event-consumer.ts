/**
 * Documents Foundation I7 - Idempotent Event Consumer & Notification Bridge
 * Mission: DOCUMENTS-FOUNDATION-I7
 */

import type { Pool, PoolClient } from 'pg';
import {
  DocumentOutboxEvent,
  isSupportedDocumentEventSchemaVersion,
} from './document-event-model.ts';
import {
  PostgresDocumentConsumerLedgerRepository,
} from './document-event-repository.ts';

export type DocumentEventHandler = (
  client: PoolClient,
  event: DocumentOutboxEvent,
) => Promise<void>;

export type TransactionalDocumentEventHandler = DocumentEventHandler;

export interface ConsumerExecutionResult {
  success: boolean;
  alreadyProcessed: boolean;
  executed: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export async function processDocumentEventWithIdempotency(params: {
  pool: Pool;
  institutionId: string;
  consumerId: string;
  event: DocumentOutboxEvent;
  handler: DocumentEventHandler;
}): Promise<ConsumerExecutionResult> {
  const { pool, institutionId, consumerId, event, handler } = params;

  if (institutionId !== event.institutionId) {
    return {
      success: false,
      alreadyProcessed: false,
      executed: false,
      errorCode: 'TENANT_MISMATCH',
      errorMessage: `Consumer institution '${institutionId}' does not match event institution '${event.institutionId}'`,
    };
  }

  // Fail closed on unsupported schema version
  if (!isSupportedDocumentEventSchemaVersion(event.schemaVersion)) {
    return {
      success: false,
      alreadyProcessed: false,
      executed: false,
      errorCode: 'UNSUPPORTED_SCHEMA_VERSION',
      errorMessage: `Event schema version '${event.schemaVersion}' is not supported.`,
    };
  }

  const ledgerRepo = new PostgresDocumentConsumerLedgerRepository();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { alreadyProcessed } = await ledgerRepo.recordProcessing(
      client,
      institutionId,
      consumerId,
      event.id,
      'processed',
      { eventType: event.eventType, occurredAt: event.occurredAt.toISOString() },
    );

    if (alreadyProcessed) {
      await client.query('COMMIT');
      return { success: true, alreadyProcessed: true, executed: false };
    }

    // Invariant: Consumer ledger insert + persistent consumer side effect executed in SAME PostgreSQL transaction
    await handler(client, event);

    await client.query('COMMIT');
    return { success: true, alreadyProcessed: false, executed: true };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// ── Notification Bridge Subscriber Interface ───────────────────────────────────

export interface NotificationIntent {
  recipientPersonId: string | null;
  institutionId: string;
  category: 'document_verified' | 'document_quarantined' | 'access_granted' | 'document_deleted' | 'retention_hold';
  title: string;
  message: string;
  metadata: Record<string, unknown>;
}

export class MockNotificationBridge {
  public publishedEvents: DocumentOutboxEvent[] = [];
  public dispatchedNotifications: NotificationIntent[] = [];

  constructor(
    public shouldFail = false,
    public failureReason = 'NOTIFICATION_BRIDGE_FAILED',
  ) {}

  async publish(event: DocumentOutboxEvent): Promise<void> {
    if (this.shouldFail) {
      throw new Error(this.failureReason);
    }
    this.publishedEvents.push(event);
  }

  async notify(intent: NotificationIntent): Promise<void> {
    if (this.shouldFail) {
      throw new Error(this.failureReason);
    }
    this.dispatchedNotifications.push(intent);
  }
}

export function createDocumentNotificationBridgeHandler(
  bridge: MockNotificationBridge,
): DocumentEventHandler {
  return async (_client: PoolClient, event: DocumentOutboxEvent) => {
    switch (event.eventType) {
      case 'document.verification_passed':
        await bridge.notify({
          recipientPersonId: event.actorPersonId,
          institutionId: event.institutionId,
          category: 'document_verified',
          title: 'Documento Verificado',
          message: `O documento foi verificado com sucesso.`,
          metadata: { documentId: event.aggregateId, ...event.payload },
        });
        break;

      case 'document.quarantined':
        await bridge.notify({
          recipientPersonId: event.actorPersonId,
          institutionId: event.institutionId,
          category: 'document_quarantined',
          title: 'Documento em Quarentena',
          message: `O documento foi colocado em quarentena de segurança.`,
          metadata: { documentId: event.aggregateId, ...event.payload },
        });
        break;

      case 'document.access_granted':
        await bridge.notify({
          recipientPersonId: (event.payload.subjectPersonId as string) ?? event.actorPersonId,
          institutionId: event.institutionId,
          category: 'access_granted',
          title: 'Acesso a Documento Concedido',
          message: `Foi emitido acesso temporário ao documento.`,
          metadata: { grantId: event.aggregateId, ...event.payload },
        });
        break;

      case 'document.deleted':
        await bridge.notify({
          recipientPersonId: event.actorPersonId,
          institutionId: event.institutionId,
          category: 'document_deleted',
          title: 'Documento Eliminado Definitivamente',
          message: `O documento foi eliminado em conformidade com as regras de retenção.`,
          metadata: { deletionAuthorizationId: event.aggregateId, ...event.payload },
        });
        break;

      case 'document.hold_placed':
        await bridge.notify({
          recipientPersonId: event.actorPersonId,
          institutionId: event.institutionId,
          category: 'retention_hold',
          title: 'Bloqueio de Retenção Aplicado',
          message: `Um bloqueio legal/administrativo foi aplicado ao documento.`,
          metadata: { holdId: event.aggregateId, ...event.payload },
        });
        break;

      default:
        // No notification for internal administrative events
        break;
    }
  };
}
