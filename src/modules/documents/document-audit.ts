import type { DocumentAuditEventRecord, DocumentAuditOutcome } from './document-model.ts';

export interface QueryClient {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface RecordAuditEventInput {
  institutionId: string;
  documentId?: string | null;
  versionId?: string | null;
  actorPersonId?: string | null;
  action: string;
  outcome: DocumentAuditOutcome;
  occurredAt?: Date;
  correlationId?: string | null;
  details?: Record<string, unknown>;
}

export class PostgresDocumentAuditRepository {
  async recordAuditEvent(client: QueryClient, input: RecordAuditEventInput): Promise<DocumentAuditEventRecord> {
    const occurredAt = input.occurredAt ?? new Date();
    const details = input.details ?? {};
    const result = await client.query<{
      id: string;
      institution_id: string;
      document_id: string | null;
      version_id: string | null;
      actor_person_id: string | null;
      action: string;
      outcome: DocumentAuditOutcome;
      occurred_at: Date;
      correlation_id: string | null;
      details: Record<string, unknown>;
    }>(
      `INSERT INTO document_audit_events (
        institution_id, document_id, version_id, actor_person_id, action, outcome, occurred_at, correlation_id, details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, institution_id, document_id, version_id, actor_person_id, action, outcome, occurred_at, correlation_id, details`,
      [
        input.institutionId,
        input.documentId ?? null,
        input.versionId ?? null,
        input.actorPersonId ?? null,
        input.action,
        input.outcome,
        occurredAt,
        input.correlationId ?? null,
        JSON.stringify(details),
      ],
    );

    const row = result.rows[0];
    return {
      id: row.id,
      institutionId: row.institution_id,
      documentId: row.document_id,
      versionId: row.version_id,
      actorPersonId: row.actor_person_id,
      action: row.action,
      outcome: row.outcome,
      occurredAt: row.occurred_at,
      correlationId: row.correlation_id,
      details: row.details,
    };
  }

  async getAuditEventsForDocument(
    client: QueryClient,
    institutionId: string,
    documentId: string,
  ): Promise<DocumentAuditEventRecord[]> {
    const result = await client.query<{
      id: string;
      institution_id: string;
      document_id: string | null;
      version_id: string | null;
      actor_person_id: string | null;
      action: string;
      outcome: DocumentAuditOutcome;
      occurred_at: Date;
      correlation_id: string | null;
      details: Record<string, unknown>;
    }>(
      `SELECT id, institution_id, document_id, version_id, actor_person_id, action, outcome, occurred_at, correlation_id, details
         FROM document_audit_events
        WHERE institution_id = $1 AND document_id = $2
        ORDER BY occurred_at DESC, id DESC`,
      [institutionId, documentId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      institutionId: row.institution_id,
      documentId: row.document_id,
      versionId: row.version_id,
      actorPersonId: row.actor_person_id,
      action: row.action,
      outcome: row.outcome,
      occurredAt: row.occurred_at,
      correlationId: row.correlation_id,
      details: row.details,
    }));
  }
}
