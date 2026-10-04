/**
 * Documents Foundation I7 - Event Models & Envelope Contracts
 * Mission: DOCUMENTS-FOUNDATION-I7
 */

export const SUPPORTED_DOCUMENT_EVENT_SCHEMA_VERSION = '1.0';
export const DOCUMENT_EVENT_SCHEMA_VERSION = SUPPORTED_DOCUMENT_EVENT_SCHEMA_VERSION;

export const DOCUMENT_EVENT_TYPES = [
  'document.created',
  'document.version_created',
  'document.upload_completed',
  'document.verification_passed',
  'document.quarantined',
  'document.association_created',
  'document.association_changed',
  'document.access_granted',
  'document.access_revoked',
  'document.retention_assigned',
  'document.hold_placed',
  'document.hold_released',
  'document.deletion_authorized',
  'document.deletion_started',
  'document.deleted',
  'document.deletion_reconciliation_required',
] as const;

export type DocumentEventType = (typeof DOCUMENT_EVENT_TYPES)[number];

export const DOCUMENT_AGGREGATE_TYPES = [
  'document',
  'document_version',
  'document_association',
  'document_access_grant',
  'document_retention',
  'document_hold',
  'document_deletion',
] as const;

export type DocumentAggregateType = (typeof DOCUMENT_AGGREGATE_TYPES)[number];

export type DocumentOutboxStatus = 'pending' | 'claimed' | 'published' | 'dead_letter';

export type ActorKind = 'person' | 'system' | 'user';

export interface DocumentOutboxEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  institutionId: string;
  eventType: DocumentEventType;
  schemaVersion: string;
  aggregateType: DocumentAggregateType;
  aggregateId: string;
  occurredAt: Date;
  actorPersonId: string | null;
  actorKind: 'person' | 'system';
  correlationId: string | null;
  causationId: string | null;
  payload: TPayload;
  status: DocumentOutboxStatus;
  attempts: number;
  maxAttempts: number | null;
  nextAttemptAt: Date;
  claimedAt: Date | null;
  claimExpiresAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  publishedAt: Date | null;
  deadLetteredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentEventIntent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  institutionId: string;
  eventType: DocumentEventType;
  schemaVersion?: string;
  aggregateType: DocumentAggregateType;
  aggregateId: string;
  occurredAt?: Date;
  actorPersonId?: string | null;
  actorKind?: ActorKind;
  correlationId?: string | null;
  causationId?: string | null;
  payload: TPayload;
  maxAttempts?: number | null;
}

export function validateEventPayloadSecurity(payload: unknown): void {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('SECURITY_VIOLATION: Event payload must be a non-null plain object.');
  }

  const jsonStr = JSON.stringify(payload);
  const forbiddenPatterns = [
    /rawAccessToken/i,
    /accessToken/i,
    /tokenHash/i,
    /"token"\s*:/i,
    /secret/i,
    /password/i,
    /tokenKey/i,
    /pseudonymizationKey/i,
    /authorizationToken/i,
    /auth_token/i,
    /apiKey/i,
    /authorization_code/i,
    /authorization\s*:\s*bearer/i,
    /privateKey/i,
    /clientSecret/i,
    /bearer\s+[a-z0-9]/i,
    /BEGIN PRIVATE KEY/i,
  ];

  for (const pat of forbiddenPatterns) {
    if (pat.test(jsonStr)) {
      throw new Error(`SECURITY_VIOLATION: Event payload contains forbidden sensitive pattern: ${pat}`);
    }
  }
}

export function isSupportedDocumentEventSchemaVersion(schemaVersion?: string | null): boolean {
  if (!schemaVersion || typeof schemaVersion !== 'string') return false;
  return schemaVersion === SUPPORTED_DOCUMENT_EVENT_SCHEMA_VERSION;
}

export const isSupportedSchemaVersion = isSupportedDocumentEventSchemaVersion;
