import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';

export type UploadSessionStatus =
  | 'created'
  | 'authorized'
  | 'uploading'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'failed';

export interface DocumentUploadSessionRecord {
  id: string;
  institutionId: string;
  documentId: string;
  targetVersionNumber: number | null;
  declaredFilename: string;
  declaredMimeType: string;
  declaredByteSize: number;
  storageProvider: string;
  storageBucket: string;
  storageKey: string;
  status: UploadSessionStatus;
  uploadTokenHash: string;
  authorizedUntil: Date;
  expiresAt: Date;
  completedVersionId: string | null;
  createdByPersonId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SizePolicyContext {
  configuredGlobalHardLimit?: number | null;
  globalMaxByteSize?: number | null;
  institutionLimit?: number | null;
  institutionMaxByteSize?: number | null;
  categoryLimit?: number | null;
  categoryMaxByteSize?: number | null;
}

export type DocumentSizePolicyConfig = SizePolicyContext;

/**
 * Strips path separators, directory traversal markers, NUL bytes, and control characters.
 * Returns clean sanitized basename between 1 and 255 characters.
 */
export function sanitizeDeclaredFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid declaredFilename: Must be a non-empty string.');
  }

  // Reject NUL bytes and control characters
  if (/[\u0000-\u001F\u007F-\u009F]/.test(filename)) {
    throw new Error('Invalid declaredFilename: Contains forbidden control characters.');
  }

  const clean = filename.trim();
  if (!clean) {
    throw new Error('Invalid declaredFilename: Contains only whitespace characters.');
  }

  // Extract basename to defeat path traversal (e.g. ../../etc/passwd)
  const base = path.basename(clean.replace(/[/\\]+/g, '/'));
  if (!base || base === '.' || base === '..') {
    throw new Error(`Invalid declaredFilename: Unsafe path pattern in "${filename}".`);
  }

  if (base.length > 255) {
    throw new Error(`Invalid declaredFilename: Exceeds maximum length of 255 characters (length=${base.length}).`);
  }

  return base;
}

export function validateDeclaredMimeType(mimeType: string): void {
  const trimmed = mimeType?.trim();
  if (!trimmed || trimmed.length < 3 || trimmed.length > 128) {
    throw new Error(`Invalid declaredMimeType: "${mimeType}". Must be between 3 and 128 characters.`);
  }
  if (!trimmed.includes('/') || trimmed.startsWith('/') || trimmed.endsWith('/')) {
    throw new Error(`Invalid declaredMimeType format: "${mimeType}". Expected "type/subtype".`);
  }
}

export function validateDeclaredByteSize(byteSize: number, effectiveLimit?: number): void {
  if (typeof byteSize !== 'number' || !Number.isInteger(byteSize) || byteSize <= 0) {
    throw new Error(`Invalid declaredByteSize: ${byteSize}. Must be a positive integer.`);
  }
  if (effectiveLimit !== undefined && byteSize > effectiveLimit) {
    throw new Error(
      `Declared file size (${byteSize} bytes) exceeds effective maximum limit (${effectiveLimit} bytes).`,
    );
  }
}

/**
 * Calculates effective maximum size limit across policy hierarchy:
 * GLOBAL_HARD_LIMIT -> INSTITUTION_LIMIT -> CATEGORY_LIMIT.
 * Fails closed if global hard limit is missing or invalid.
 */
export function calculateEffectiveSizeLimit(policy: SizePolicyContext): number {
  const global = policy.configuredGlobalHardLimit ?? policy.globalMaxByteSize;
  if (global === undefined || global === null || global <= 0) {
    throw new Error(
      'GLOBAL_SIZE_LIMIT_REQUIRED: Production upload authorization fails closed without a valid configured global hard limit.',
    );
  }

  let limit = global;
  const inst = policy.institutionLimit ?? policy.institutionMaxByteSize;
  if (inst !== undefined && inst !== null && inst > 0) {
    limit = Math.min(limit, inst);
  }

  const cat = policy.categoryLimit ?? policy.categoryMaxByteSize;
  if (cat !== undefined && cat !== null && cat > 0) {
    limit = Math.min(limit, cat);
  }

  return limit;
}

export interface StorageKeyParams {
  institutionId: string;
  documentId: string;
  sessionId?: string;
  sessionOpaqueId?: string;
  objectId?: string;
  objectOpaqueId?: string;
}

/**
 * Generates an opaque, PII-free storage key for object storage.
 */
export function generateOpaqueStorageKey(
  paramsOrInstitutionId: StorageKeyParams | string,
  documentId?: string,
  sessionOpaqueId?: string,
  objectOpaqueId?: string,
): string {
  if (typeof paramsOrInstitutionId === 'object') {
    const p = paramsOrInstitutionId;
    const sess = p.sessionId ?? p.sessionOpaqueId;
    const obj = p.objectId ?? p.objectOpaqueId;
    return `inst_${p.institutionId}/doc_${p.documentId}/session_${sess}/${obj}`;
  }

  return `inst_${paramsOrInstitutionId}/doc_${documentId}/session_${sessionOpaqueId}/${objectOpaqueId}`;
}

/**
 * Generates a high-entropy CSPRNG raw token (64 bytes hex = 128 hex characters).
 */
export function generateCsprngUploadToken(): string {
  return randomBytes(64).toString('hex');
}

export function generateUploadAuthorizationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = generateCsprngUploadToken();
  const tokenHash = hashUploadToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashUploadToken(rawToken: string): string {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.length < 32) {
    throw new Error('Invalid raw authorization token for hashing.');
  }
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export const hashUploadAuthorizationToken = hashUploadToken;

export function verifyUploadToken(providedRawToken: string, expectedHash: string): boolean {
  if (!providedRawToken || !expectedHash) return false;
  try {
    const providedHash = hashUploadToken(providedRawToken);
    const bufProvided = Buffer.from(providedHash, 'hex');
    const bufExpected = Buffer.from(expectedHash, 'hex');
    if (bufProvided.length !== bufExpected.length) return false;
    return timingSafeEqual(bufProvided, bufExpected);
  } catch {
    return false;
  }
}

/**
 * State machine transition rules for DocumentUploadSession.
 */
export function validateUploadSessionTransition(
  currentStatus: UploadSessionStatus,
  targetStatus: UploadSessionStatus,
): void {
  const validTransitions: Record<UploadSessionStatus, UploadSessionStatus[]> = {
    created: ['authorized', 'failed', 'cancelled'],
    authorized: ['uploading', 'completed', 'cancelled', 'expired', 'failed'],
    uploading: ['completed', 'cancelled', 'expired', 'failed'],
    completed: [],
    cancelled: [],
    expired: [],
    failed: ['uploading'],
  };

  const allowed = validTransitions[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw new Error(
      `Invalid upload session state transition: Cannot transition from "${currentStatus}" to "${targetStatus}".`,
    );
  }
}
