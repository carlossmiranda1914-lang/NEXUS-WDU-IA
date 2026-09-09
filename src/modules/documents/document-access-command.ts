/**
 * Documents Foundation I5 Secure Content Access Commands
 * Mission: DOCUMENTS-FOUNDATION-I5
 */

import crypto from 'crypto';
import type { Pool, PoolClient } from 'pg';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import {
  DocumentContentAccessGrant,
  GrantAction,
  ContentAccessAuthorizationPayload,
  ContentStreamResult,
  CONTENT_ACCESS_GRANT_TTL_SECONDS,
  hashAccessToken,
  sanitizeDisplayFilename,
} from './document-access-model.ts';
import {
  DocumentAccessPolicyEngine,
  EvaluateAccessParams,
} from './document-access-policy.ts';
import { PostgresDocumentAccessRepository } from './document-access-repository.ts';
import { PostgresDocumentRepository } from './document-repository.ts';
import { PostgresDocumentAuditRepository } from './document-audit.ts';
import { ObjectStorageProvider } from './object-storage-provider.ts';
import { createCanonicalDocumentsFingerprint } from './document-model.ts';
import { executeIdempotentDocumentsCommand } from './document-command.ts';

// Deterministic seed for HMAC-based token derivation per idempotent command
const ACCESS_GRANT_TOKEN_SECRET =
  process.env.DOCUMENTS_ACCESS_GRANT_SECRET ||
  'nexus_edu_ia_documents_access_grant_deterministic_seed_v1_secure';

function deriveDeterministicAccessToken(params: {
  institutionId: string;
  idempotencyKey: string;
  fingerprint: string;
}): string {
  return crypto
    .createHmac('sha256', ACCESS_GRANT_TOKEN_SECRET)
    .update(`${params.institutionId}:${params.idempotencyKey}:${params.fingerprint}`)
    .digest('hex');
}

export interface AuthorizeContentAccessCommandInput {
  documentId: string;
  versionId: string;
  action: GrantAction;
  policyEngine: DocumentAccessPolicyEngine;
  correlationId?: string;
}

export interface ExchangeGrantForStreamCommandInput {
  rawAccessToken: string;
  policyEngine: DocumentAccessPolicyEngine;
  storageProvider: ObjectStorageProvider;
  displayFilename?: string;
  correlationId?: string;
}

export interface RevokeGrantCommandInput {
  grantId: string;
  reason: string;
  correlationId?: string;
}

const docRepo = new PostgresDocumentRepository();
const accessRepo = new PostgresDocumentAccessRepository();
const auditRepo = new PostgresDocumentAuditRepository();

export function createAuthorizeContentAccessFingerprint(
  institutionId: string,
  input: AuthorizeContentAccessCommandInput,
  actorPersonId: string,
): string {
  return createCanonicalDocumentsFingerprint({
    institutionId,
    documentId: input.documentId,
    versionId: input.versionId,
    action: input.action,
    actorPersonId,
    correlationId: input.correlationId ?? null,
  });
}

export function createRevokeGrantFingerprint(
  institutionId: string,
  input: RevokeGrantCommandInput,
  actorPersonId: string,
): string {
  return createCanonicalDocumentsFingerprint({
    institutionId,
    grantId: input.grantId,
    reason: input.reason,
    actorPersonId,
    correlationId: input.correlationId ?? null,
  });
}

/**
 * Authorize content access and issue a time-bounded server-mediated access grant.
 */
export async function authorizeContentAccessCommand(params: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  input: AuthorizeContentAccessCommandInput;
}): Promise<{ replayed: boolean; result: ContentAccessAuthorizationPayload }> {
  const { pool, context, idempotencyKey, input } = params;

  const fingerprint = createAuthorizeContentAccessFingerprint(
    context.institutionId,
    input,
    context.personId,
  );

  const rawToken = deriveDeterministicAccessToken({
    institutionId: context.institutionId,
    idempotencyKey,
    fingerprint,
  });
  const tokenHash = hashAccessToken(rawToken);

  return executeIdempotentDocumentsCommand<ContentAccessAuthorizationPayload>({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.secure_content_access.authorize',
      idempotencyKey,
      canonicalFingerprint: fingerprint,
    },
    execute: async (client: PoolClient) => {
      // 1. Fetch Document and Version
      const doc = await docRepo.getDocumentById(client, context.institutionId, input.documentId);
      if (!doc) {
        throw new Error(
          `DOCUMENT_NOT_FOUND: Document ${input.documentId} does not exist in institution ${context.institutionId}`,
        );
      }

      const version = await docRepo.getVersionById(client, context.institutionId, input.versionId);
      if (!version) {
        throw new Error(
          `VERSION_NOT_FOUND: Version ${input.versionId} does not exist in document ${input.documentId}`,
        );
      }

      if (version.documentId !== doc.id) {
        throw new Error(
          `VERSION_DOCUMENT_MISMATCH: Version ${input.versionId} does not belong to document ${input.documentId}`,
        );
      }

      // 2. Evaluate Policy
      const accessAction = input.action === 'open' ? 'open_content' : 'download_content';
      const evalParams: EvaluateAccessParams = {
        institutionId: context.institutionId,
        personId: context.personId,
        role: context.role,
        documentCategory: doc.category,
        action: accessAction,
        documentStatus: doc.status,
        versionStatus: version.status,
      };

      const evalResult = input.policyEngine.evaluateAccess(evalParams);
      if (!evalResult.allowed) {
        // Record factual denial audit event
        await auditRepo.recordAuditEvent(client, {
          institutionId: context.institutionId,
          documentId: doc.id,
          versionId: version.id,
          actorPersonId: context.personId,
          action: `document.content_access_denied.${input.action}`,
          outcome: 'denied',
          correlationId: input.correlationId || null,
          details: {
            reason: evalResult.reason,
            role: context.role,
            category: doc.category,
            action: input.action,
            versionStatus: version.status,
          },
        });

        throw new Error(evalResult.reason || 'POLICY_DENIED: Access to document content is denied');
      }

      // 3. Create Access Grant
      const expiresAt = new Date(Date.now() + CONTENT_ACCESS_GRANT_TTL_SECONDS * 1000);
      const grant = await accessRepo.createAccessGrant(client, {
        institutionId: context.institutionId,
        documentId: doc.id,
        versionId: version.id,
        granteePersonId: context.personId,
        action: input.action,
        tokenHash,
        expiresAt,
        correlationId: input.correlationId,
      });

      // 4. Record factual grant audit event
      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: doc.id,
        versionId: version.id,
        actorPersonId: context.personId,
        action: `document.content_access_granted.${input.action}`,
        outcome: 'success',
        correlationId: input.correlationId || null,
        details: {
          grantId: grant.id,
          action: grant.action,
          expiresAt: grant.expiresAt.toISOString(),
          granteePersonId: grant.granteePersonId,
        },
      });

      return {
        resultRef: grant.id,
        result: {
          grant,
          rawAccessToken: rawToken,
          expiresInSeconds: CONTENT_ACCESS_GRANT_TTL_SECONDS,
        },
      };
    },
    loadResult: async (client: PoolClient, resultRef: string) => {
      const grant = await accessRepo.getGrantById(client, context.institutionId, resultRef);
      if (!grant) {
        throw new Error(`Grant ${resultRef} not found on reload`);
      }
      return {
        grant,
        rawAccessToken: rawToken, // Usable deterministic token on replay
        expiresInSeconds: Math.max(
          0,
          Math.floor((grant.expiresAt.getTime() - Date.now()) / 1000),
        ),
      };
    },
  });
}

/**
 * Exchange an active, non-revoked grant token for a validated content stream.
 * Server revalidates grant state, membership, role, and policy in real-time.
 */
export async function exchangeGrantForContentStreamCommand(params: {
  pool: Pool;
  context: InstitutionalContext;
  input: ExchangeGrantForStreamCommandInput;
}): Promise<ContentStreamResult> {
  const { pool, context, input } = params;

  if (!input.rawAccessToken || typeof input.rawAccessToken !== 'string') {
    throw new Error('TOKEN_REQUIRED: Raw access token is mandatory for content stream exchange');
  }

  const tokenHash = hashAccessToken(input.rawAccessToken);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch and Lock Grant
    const grant = await accessRepo.getGrantByTokenHashForUpdate(
      client,
      context.institutionId,
      tokenHash,
    );

    if (!grant) {
      throw new Error(
        `GRANT_NOT_FOUND: No access grant found for token in institution ${context.institutionId}`,
      );
    }

    // 2. Check Immediate Revocation
    if (grant.status === 'revoked') {
      throw new Error(
        `GRANT_REVOKED: Access grant ${grant.id} has been revoked (reason: ${grant.revocationReason || 'unknown'})`,
      );
    }

    // 3. Check Expiry
    if (grant.status === 'expired' || grant.expiresAt.getTime() <= Date.now()) {
      throw new Error(`GRANT_EXPIRED: Access grant ${grant.id} expired at ${grant.expiresAt.toISOString()}`);
    }

    if (grant.status !== 'active') {
      throw new Error(`GRANT_INACTIVE: Access grant is in state "${grant.status}"`);
    }

    // 4. Real-time Membership & Role Revalidation
    const granteeMembership = await accessRepo.getGranteeMembership(
      client,
      context.institutionId,
      grant.granteePersonId,
    );

    if (!granteeMembership || !granteeMembership.isActive) {
      throw new Error(
        `MEMBERSHIP_REVOKED_OR_INACTIVE: Grantee person ${grant.granteePersonId} has no active membership in institution ${context.institutionId}`,
      );
    }

    // 5. Fetch Document and Version
    const doc = await docRepo.getDocumentById(client, context.institutionId, grant.documentId);
    if (!doc) {
      throw new Error(`DOCUMENT_NOT_FOUND: Document ${grant.documentId} does not exist`);
    }

    const version = await docRepo.getVersionById(client, context.institutionId, grant.versionId);
    if (!version) {
      throw new Error(`VERSION_NOT_FOUND: Version ${grant.versionId} does not exist`);
    }

    // 6. Real-time Policy Re-evaluation with Current Role
    const accessAction = grant.action === 'open' ? 'open_content' : 'download_content';
    const evalResult = input.policyEngine.evaluateAccess({
      institutionId: context.institutionId,
      personId: grant.granteePersonId,
      role: granteeMembership.role,
      documentCategory: doc.category,
      action: accessAction,
      documentStatus: doc.status,
      versionStatus: version.status,
    });

    if (!evalResult.allowed) {
      throw new Error(
        `POLICY_NO_LONGER_AUTHORIZED: Policy revalidation failed for role ${granteeMembership.role}: ${evalResult.reason}`,
      );
    }

    // 7. Get Storage Object Reference
    const storageRef = await docRepo.getStorageReferenceForVersion(
      client,
      context.institutionId,
      version.id,
    );
    if (!storageRef) {
      throw new Error(`STORAGE_REFERENCE_NOT_FOUND: Storage reference missing for version ${version.id}`);
    }

    // 8. Record Grant Usage
    await accessRepo.recordGrantUsage(client, context.institutionId, grant.id);

    // 9. Open Content Stream
    const stream = await input.storageProvider.openReadStream({
      institutionId: context.institutionId,
      storageBucket: storageRef.storageBucket,
      storageKey: storageRef.storageKey,
    });

    // 10. Record factual content stream opened audit event
    await auditRepo.recordAuditEvent(client, {
      institutionId: context.institutionId,
      documentId: doc.id,
      versionId: version.id,
      actorPersonId: grant.granteePersonId,
      action: `document.content_stream_opened.${grant.action}`,
      outcome: 'success',
      correlationId: input.correlationId || null,
      details: {
        grantId: grant.id,
        action: grant.action,
        byteSize: version.byteSize,
        mimeType: version.mimeType,
      },
    });

    await client.query('COMMIT');

    // Resolve display filename from input or completed upload session
    let resolvedFilename = input.displayFilename;
    if (!resolvedFilename) {
      const uploadSessRes = await client.query<{ declared_filename: string }>(
        `SELECT declared_filename FROM document_upload_sessions
         WHERE institution_id = $1 AND completed_version_id = $2
         LIMIT 1`,
        [context.institutionId, version.id],
      );
      if (uploadSessRes.rows.length > 0 && uploadSessRes.rows[0].declared_filename) {
        resolvedFilename = uploadSessRes.rows[0].declared_filename;
      }
    }

    const displayFilename = sanitizeDisplayFilename(
      resolvedFilename || `document_${doc.id}.bin`,
    );

    const dispositionType = grant.action === 'download' ? 'attachment' : 'inline';
    const contentDisposition = `${dispositionType}; filename="${displayFilename}"`;

    return {
      stream,
      byteSize: version.byteSize,
      mimeType: version.mimeType,
      sha256Hash: version.sha256Hash,
      displayFilename,
      contentDisposition,
      grantId: grant.id,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Revoke an existing active access grant immediately.
 */
export async function revokeContentAccessGrantCommand(params: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  input: RevokeGrantCommandInput;
}): Promise<{ replayed: boolean; result: DocumentContentAccessGrant }> {
  const { pool, context, idempotencyKey, input } = params;

  const fingerprint = createRevokeGrantFingerprint(
    context.institutionId,
    input,
    context.personId,
  );

  return executeIdempotentDocumentsCommand<DocumentContentAccessGrant>({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.secure_content_access.revoke',
      idempotencyKey,
      canonicalFingerprint: fingerprint,
    },
    execute: async (client: PoolClient) => {
      const grant = await accessRepo.getGrantById(client, context.institutionId, input.grantId);
      if (!grant) {
        throw new Error(
          `GRANT_NOT_FOUND: Access grant ${input.grantId} not found in institution ${context.institutionId}`,
        );
      }

      if (grant.status === 'revoked') {
        // Already revoked -> idempotent return
        return {
          resultRef: grant.id,
          result: grant,
        };
      }

      const revokedGrant = await accessRepo.revokeGrant(client, {
        institutionId: context.institutionId,
        grantId: input.grantId,
        revokedByPersonId: context.personId,
        reason: input.reason,
      });

      if (!revokedGrant) {
        throw new Error(`REVOCATION_FAILED: Failed to revoke grant ${input.grantId}`);
      }

      // Record factual revocation audit event
      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: grant.documentId,
        versionId: grant.versionId,
        actorPersonId: context.personId,
        action: 'document.content_access_revoked',
        outcome: 'success',
        correlationId: input.correlationId || null,
        details: {
          grantId: grant.id,
          reason: input.reason,
          revokedByPersonId: context.personId,
        },
      });

      return {
        resultRef: revokedGrant.id,
        result: revokedGrant,
      };
    },
    loadResult: async (client: PoolClient, resultRef: string) => {
      const g = await accessRepo.getGrantById(client, context.institutionId, resultRef);
      if (!g) {
        throw new Error(`Grant ${resultRef} not found on reload`);
      }
      return g;
    },
  });
}
