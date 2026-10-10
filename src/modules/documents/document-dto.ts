import type { DocumentStatus, DocumentVersionStatus, StorageContentAvailability } from './document-model.ts';

export interface FrontendSafeDocumentVersionDto {
  id: string;
  versionNumber: number;
  mimeType: string;
  byteSize: number;
  sha256Hash: string;
  status: DocumentVersionStatus;
  contentAvailability?: 'unknown' | 'available' | 'unavailable';
  originalFilename?: string;
  declaredFilename?: string;
  createdByPersonName?: string | null;
  createdAt: string;
}

export interface FrontendSafeAssociationDto {
  id: string;
  targetDomain: string;
  targetResourceType: string;
  targetResourceId: string;
  targetEntityName?: string | null;
  purpose: string;
  status: string;
  pinnedVersionId: string | null;
  createdAt: string;
}

export interface FrontendSafeRetentionDto {
  id: string;
  policyId: string;
  policyVersion: string;
  jurisdictionProfileId: string;
  category: string;
  purpose: string | null;
  clockTriggerType: string;
  clockTriggerEventAt: string;
  retainUntil: string;
  retentionStatus: string;
  assignedAt: string;
}

export interface FrontendSafeHoldDto {
  id: string;
  versionId: string;
  holdType: 'legal' | 'administrative';
  authority: string;
  reason: string;
  effectiveAt: string;
  releasedAt: string | null;
  releaseReason: string | null;
  holdStatus: 'active' | 'released';
}

export interface FrontendSafeDocumentCapabilities {
  canOpen: boolean;
  canDownload: boolean;
  canUploadVersion: boolean;
  canPlaceHold: boolean;
  canReleaseHold: boolean;
  canAuthorizeDeletion: boolean;
  canExecuteDeletion: boolean;
}

export interface FrontendSafeDocumentDto {
  id: string;
  institutionId: string;
  category: string;
  classification: string | null;
  status: DocumentStatus;
  contentAvailability?: StorageContentAvailability;
  originalFilename?: string;
  declaredFilename?: string;
  title?: string;
  createdByPersonName?: string | null;
  createdAt: string;
  updatedAt: string;
  currentVersion: FrontendSafeDocumentVersionDto | null;
  versionCount: number;
  associations: FrontendSafeAssociationDto[];
  retention: FrontendSafeRetentionDto | null;
  activeHolds: FrontendSafeHoldDto[];
  capabilities: FrontendSafeDocumentCapabilities;
}

export interface FrontendSafeActivityDto {
  id: string;
  occurredAt: string;
  eventType: string;
  title: string;
  description: string;
  actorKind: 'person' | 'system';
  actorName: string | null;
}

export interface FrontendSafeUploadSessionDto {
  id: string;
  documentId: string;
  targetVersionNumber: number | null;
  declaredFilename: string;
  declaredMimeType: string;
  declaredByteSize: number;
  status: string;
  authorizedUntil: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * List of disallowed internal field names to guarantee no internal coordinates or secrets leak.
 */
export const DISALLOWED_INTERNAL_KEYS = new Set([
  'storage_bucket',
  'storage_key',
  'storageBucket',
  'storageKey',
  'storage_provider',
  'storageProvider',
  'upload_token_hash',
  'uploadTokenHash',
  'token_hash',
  'tokenHash',
  'claim_expires_at',
  'claimed_at',
  'last_error_code',
  'last_error_message',
]);

/**
 * Recursively scans an object or array to ensure no forbidden internal keys appear.
 */
export function assertNoInternalSecretsInDto(obj: unknown, path = ''): void {
  if (obj === null || typeof obj !== 'object') {
    return;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      assertNoInternalSecretsInDto(obj[i], `${path}[${i}]`);
    }
    return;
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (DISALLOWED_INTERNAL_KEYS.has(key)) {
      throw new Error(`SECURITY_LEAK_DETECTED: Forbidden internal field "${key}" present at "${path}.${key}"`);
    }
    assertNoInternalSecretsInDto(value, path ? `${path}.${key}` : key);
  }
}
