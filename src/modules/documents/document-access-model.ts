/**
 * Documents Foundation I5 Secure Content Access Models
 * Mission: DOCUMENTS-FOUNDATION-I5
 */

import crypto from 'crypto';

export type AccessAction = 'view_metadata' | 'open_content' | 'download_content';
export type GrantAction = 'open' | 'download';
export type GrantStatus = 'active' | 'consumed' | 'expired' | 'revoked';

export const CONTENT_ACCESS_GRANT_TTL_SECONDS = 300; // 5 minutes

export interface DocumentContentAccessGrant {
  id: string;
  institutionId: string;
  documentId: string;
  versionId: string;
  granteePersonId: string;
  action: GrantAction;
  status: GrantStatus;
  tokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
  consumedAt?: Date | null;
  revokedAt?: Date | null;
  revocationReason?: string | null;
  revokedByPersonId?: string | null;
  correlationId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessEvaluationResult {
  allowed: boolean;
  reason?: string;
  action: AccessAction;
  documentCategory: string;
  institutionId: string;
  personId: string;
  role: string;
}

export interface ContentAccessAuthorizationPayload {
  grant: DocumentContentAccessGrant;
  rawAccessToken?: string; // Only returned on initial issuance, never persisted
  expiresInSeconds: number;
}

export interface ContentStreamResult {
  stream: NodeJS.ReadableStream;
  byteSize: number;
  mimeType: string;
  sha256Hash: string;
  displayFilename: string;
  contentDisposition: string;
  grantId: string;
}

export function hashAccessToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function generateSecureAccessToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function maskAccessToken(rawToken: string): string {
  if (!rawToken || rawToken.length < 8) return '****';
  return `${rawToken.slice(0, 4)}...${rawToken.slice(-4)}`;
}

export function sanitizeDisplayFilename(filename: string): string {
  if (!filename) return 'document.bin';
  // Remove control chars, path separators and unsafe characters
  const clean = filename
    .replace(/[/\\]/g, '_')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim();
  return clean.length > 0 ? clean : 'document.bin';
}
