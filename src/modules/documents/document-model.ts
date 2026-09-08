import { createHash } from 'node:crypto';

export type DocumentStatus = 'active' | 'archived' | 'deprecating' | 'restricted';
export type DocumentVersionStatus = 'content_received' | 'available' | 'quarantined' | 'superseded' | 'withdrawn';
export type ProvenanceOriginType =
  | 'user_upload'
  | 'system_generated'
  | 'domain_generated'
  | 'import'
  | 'external_integration'
  | 'legacy_migration';

export type DocumentAuditOutcome = 'success' | 'denied' | 'failed';

export interface DocumentRecord {
  id: string;
  institutionId: string;
  category: string;
  classification: string | null;
  status: DocumentStatus;
  createdByPersonId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentVersionRecord {
  id: string;
  institutionId: string;
  documentId: string;
  versionNumber: number;
  mimeType: string;
  byteSize: number;
  sha256Hash: string;
  status: DocumentVersionStatus;
  createdByPersonId: string;
  createdAt: Date;
}

export interface DocumentProvenanceRecord {
  id: string;
  institutionId: string;
  documentId: string;
  versionId: string;
  originType: ProvenanceOriginType;
  actorPersonId: string | null;
  sourceDomain: string;
  method: string;
  occurredAt: Date;
  correlationId: string | null;
}

export interface StorageObjectReferenceRecord {
  id: string;
  institutionId: string;
  versionId: string;
  storageProvider: string;
  storageBucket: string;
  storageKey: string;
  createdAt: Date;
}

export interface DocumentAuditEventRecord {
  id: string;
  institutionId: string;
  documentId: string | null;
  versionId: string | null;
  actorPersonId: string | null;
  action: string;
  outcome: DocumentAuditOutcome;
  occurredAt: Date;
  correlationId: string | null;
  details: Record<string, unknown>;
}

export interface DocumentIdempotencyRecord {
  id: string;
  institutionId: string;
  commandScope: string;
  idempotencyKey: string;
  requestFingerprint: string;
  resultRef: string;
  status: 'completed' | 'failed';
  createdAt: Date;
}

export function validateDocumentCategory(category: string): void {
  const trimmed = category?.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 64) {
    throw new Error(`Invalid document category: "${category}". Must be between 2 and 64 characters.`);
  }
}

export function validateMimeType(mimeType: string): void {
  const trimmed = mimeType?.trim();
  if (!trimmed || trimmed.length < 3 || trimmed.length > 128 || !trimmed.includes('/')) {
    throw new Error(`Invalid mime type: "${mimeType}". Must be valid media type format.`);
  }
}

export function validateSha256Hash(hash: string): void {
  const trimmed = hash?.trim().toLowerCase();
  if (!trimmed || !/^[a-f0-9]{64}$/.test(trimmed)) {
    throw new Error(`Invalid SHA-256 hash: "${hash}". Must be 64-character lowercase hex.`);
  }
}

export function validateByteSize(byteSize: number): void {
  if (!Number.isInteger(byteSize) || byteSize < 0) {
    throw new Error(`Invalid byte size: ${byteSize}. Must be a non-negative integer.`);
  }
}

export function canonicalizeJson(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => [k, canonicalizeJson(v)]);
  return Object.fromEntries(entries);
}

export function createCanonicalDocumentsFingerprint(payload: unknown): string {
  const canonical = canonicalizeJson(payload);
  return createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex');
}
