/**
 * Documents Foundation I5 Secure Content Access Commands
 * Mission: DOCUMENTS-FOUNDATION-I5
 *
 * Security invariants:
 *   TOKEN_STRATEGY=KEYED_DETERMINISTIC_HMAC_SHA256
 *   TOKEN_ENTROPY_SOURCE=TRUSTED_SECRET_KEY (accessGrantTokenKey trusted dependency)
 *   NO_RAW_TOKEN_AT_REST — only SHA-256 hash persisted
 *   IDEMPOTENT_TOKEN_RECOVERY=PASS — replay re-derives same token from same canonical identity
 *   CURRENT_ACTOR_MUST_EQUAL_GRANTEE — enforced during token exchange
 *   HARDCODED_SECRET_FALLBACK=REMOVED — no production defaults in source
 *   CALLER_CONTROLLED_POLICY_ENGINE=REMOVED — policyEngine is a trusted dependency
 *   ACCESS_GRANT_TOKEN_KEY_MISSING — fail closed when key absent or invalid
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
import { PostgresDocumentOutboxRepository } from './document-event-repository.ts';
import { ObjectStorageProvider } from './object-storage-provider.ts';
import { createCanonicalDocumentsFingerprint } from './document-model.ts';
import { executeIdempotentDocumentsCommand } from './document-command.ts';
import {
  type DocumentAuthorizationAuthority,
  DefaultDocumentAuthorizationAuthority,
  createDefaultDocumentAuthorizationRules,
} from './document-authorization-policy.ts';

// Minimum key length for HMAC secret (256 bits = 64 hex chars, or 32 raw bytes)
const MIN_TOKEN_KEY_LENGTH = 32;

/**
 * Derive a deterministic, keyed access token from canonical command identity.
 *
 * TOKEN_STRATEGY=KEYED_DETERMINISTIC_HMAC_SHA256
 * - Same canonical identity + same key → same token (idempotent recovery)
 * - Different key → cannot reproduce token (mismatched exchange fails)
 * - Raw token never persisted; only SHA-256 hash stored in DB
 */
function deriveAccessToken(params: {
  tokenKey: string;
  institutionId: string;
  commandScope: string;
  idempotencyKey: string;
  canonicalFingerprint: string;
}): string {
  return crypto
    .createHmac('sha256', params.tokenKey)
    .update(
      `${params.institutionId}:${params.commandScope}:${params.idempotencyKey}:${params.canonicalFingerprint}`,
    )
    .digest('hex');
}

export interface AuthorizeContentAccessCommandInput {
  documentId: string;
  versionId: string;
  action: GrantAction;
  correlationId?: string;
}

export interface ExchangeGrantForStreamCommandInput {
  rawAccessToken: string;
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
const outboxRepo = new PostgresDocumentOutboxRepository();

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

const AUTHORIZE_COMMAND_SCOPE = 'documents.secure_content_access.authorize';

/**
 * Authorize content access and issue a time-bounded server-mediated access grant.
 *
 * policyEngine: trusted application dependency — must not come from request payload.
 * accessGrantTokenKey: trusted application secret — minimum 32 characters.
 *   TOKEN_STRATEGY=KEYED_DETERMINISTIC_HMAC_SHA256
 *   Same canonical identity + same key → same token on replay (idempotent token recovery).
 *   Only SHA-256 hash persisted; raw token never at rest.
 */
export async function authorizeContentAccessCommand(params: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  policyEngine: DocumentAccessPolicyEngine;
  accessGrantTokenKey: string;
  input: AuthorizeContentAccessCommandInput;
  authorizationAuthority?: DocumentAuthorizationAuthority;
}): Promise<{ replayed: boolean; result: ContentAccessAuthorizationPayload }> {
  const { pool, context, idempotencyKey, policyEngine, accessGrantTokenKey, input } = params;

  // FAIL_CLOSED: policyEngine must be a trusted dependency
  if (!policyEngine || typeof policyEngine.evaluateAccess !== 'function') {
    throw new Error('POLICY_ENGINE_MISSING: A trusted policy engine is required to authorize content access');
  }

  // FAIL_CLOSED: accessGrantTokenKey must be a valid trusted secret
  if (
    !accessGrantTokenKey ||
    typeof accessGrantTokenKey !== 'string' ||
    accessGrantTokenKey.length < MIN_TOKEN_KEY_LENGTH
  ) {
    throw new Error(
      `ACCESS_GRANT_TOKEN_KEY_MISSING: A valid token key (minimum ${MIN_TOKEN_KEY_LENGTH} characters) is required to derive access tokens`,
    );
  }

  const fingerprint = createAuthorizeContentAccessFingerprint(
    context.institutionId,
    input,
    context.personId,
  );

  // Derive deterministic token from canonical identity + trusted key
  // Same inputs → same token → idempotent token recovery on response loss
  const rawToken = deriveAccessToken({
    tokenKey: accessGrantTokenKey,
    institutionId: context.institutionId,
    commandScope: AUTHORIZE_COMMAND_SCOPE,
    idempotencyKey,
    canonicalFingerprint: fingerprint,
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

      // 2. Central H1 Authorization Authority enforcement (Defense in depth at command boundary)
      const accessAction = input.action === 'open' ? 'open_content' : 'download_content';
      const authAuthority =
        params.authorizationAuthority ??
        new DefaultDocumentAuthorizationAuthority({
          rules: createDefaultDocumentAuthorizationRules(),
        });

      const authDecision = authAuthority.authorize({
        institutionId: context.institutionId,
        personId: context.personId,
        role: context.role,
        action: accessAction,
        documentId: doc.id,
        documentCategory: doc.category,
        documentStatus: doc.status,
        versionStatus: version.status,
      });

      if (!authDecision.allowed) {
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
            reason: authDecision.reasonCode,
            role: context.role,
            category: doc.category,
            action: input.action,
            versionStatus: version.status,
          },
        });

        throw new Error(
          `AUTHORIZATION_DENIED: ${accessAction} is not permitted for role ${context.role} (${authDecision.reasonCode})`,
        );
      }

      // 3. Evaluate Delegated Access Policy (trusted dependency — not caller-supplied)
      const evalParams: EvaluateAccessParams = {
        institutionId: context.institutionId,
        personId: context.personId,
        role: context.role,
        documentCategory: doc.category,
        action: accessAction,
        documentStatus: doc.status,
        versionStatus: version.status,
      };

      const evalResult = policyEngine.evaluateAccess(evalParams);
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

      // 4. Create Access Grant (only tokenHash persisted — raw token never at rest)
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

      // 5. Emit document.access_granted outbox event (NEVER include raw access token)
      await outboxRepo.insertEvent(client, {
        institutionId: context.institutionId,
        eventType: 'document.access_granted',
        aggregateType: 'document',
        aggregateId: doc.id,
        actorPersonId: context.personId,
        actorKind: 'user',
        correlationId: input.correlationId ?? null,
        causationId: grant.id,
        payload: {
          grantId: grant.id,
          documentId: doc.id,
          versionId: version.id,
          granteePersonId: grant.granteePersonId,
          action: grant.action,
          expiresAt: grant.expiresAt.toISOString(),
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
      // Idempotent replay: grant remains active.
      // KEYED_DETERMINISTIC_HMAC_SHA256: re-derive same token from same canonical identity.
      // Token key is validated above — deterministic derivation ensures recovery on response loss.
      const grant = await accessRepo.getGrantById(client, context.institutionId, resultRef);
      if (!grant) {
        throw new Error(`Grant ${resultRef} not found on reload`);
      }
      const recoveredToken = deriveAccessToken({
        tokenKey: accessGrantTokenKey,
        institutionId: context.institutionId,
        commandScope: AUTHORIZE_COMMAND_SCOPE,
        idempotencyKey,
        canonicalFingerprint: fingerprint,
      });
      return {
        grant,
        rawAccessToken: recoveredToken,
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
 *
 * policyEngine and storageProvider: trusted application dependencies.
 * CURRENT_ACTOR_MUST_EQUAL_GRANTEE: context.personId must match grant.granteePersonId.
 */
export async function exchangeGrantForContentStreamCommand(params: {
  pool: Pool;
  context: InstitutionalContext;
  policyEngine: DocumentAccessPolicyEngine;
  storageProvider: ObjectStorageProvider;
  input: ExchangeGrantForStreamCommandInput;
  authorizationAuthority?: DocumentAuthorizationAuthority;
}): Promise<ContentStreamResult> {
  const { pool, context, policyEngine, storageProvider, input } = params;

  // FAIL_CLOSED: trusted dependencies must be present
  if (!policyEngine || typeof policyEngine.evaluateAccess !== 'function') {
    throw new Error('POLICY_ENGINE_MISSING: A trusted policy engine is required to exchange access grant');
  }
  if (!storageProvider || typeof storageProvider.openReadStream !== 'function') {
    throw new Error('STORAGE_PROVIDER_MISSING: A trusted storage provider is required to exchange access grant');
  }

  if (!input.rawAccessToken || typeof input.rawAccessToken !== 'string') {
    throw new Error('TOKEN_REQUIRED: Raw access token is mandatory for content stream exchange');
  }

  const tokenHash = hashAccessToken(input.rawAccessToken);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch and Lock Grant (scoped to context institution for tenant isolation)
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

    // 2. CURRENT_ACTOR_MUST_EQUAL_GRANTEE
    // Proves: the current authenticated actor is exactly the person who received the grant.
    // Prevents: token stolen by another person within the same institution.
    if (context.institutionId !== grant.institutionId || context.personId !== grant.granteePersonId) {
      throw new Error(
        `GRANT_GRANTEE_MISMATCH: The authenticated actor does not match the grant grantee. ` +
        `Access denied.`,
      );
    }

    // 3. Check Immediate Revocation
    if (grant.status === 'revoked') {
      throw new Error(
        `GRANT_REVOKED: Access grant ${grant.id} has been revoked (reason: ${grant.revocationReason || 'unknown'})`,
      );
    }

    // 4. Check Expiry
    if (grant.status === 'expired' || grant.expiresAt.getTime() <= Date.now()) {
      throw new Error(`GRANT_EXPIRED: Access grant ${grant.id} expired at ${grant.expiresAt.toISOString()}`);
    }

    if (grant.status !== 'active') {
      throw new Error(`GRANT_INACTIVE: Access grant is in state "${grant.status}"`);
    }

    // 5. Real-time Membership & Role Revalidation (of grantee — proven equal to actor above)
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

    // 6. Fetch Document and Version
    const doc = await docRepo.getDocumentById(client, context.institutionId, grant.documentId);
    if (!doc) {
      throw new Error(`DOCUMENT_NOT_FOUND: Document ${grant.documentId} does not exist`);
    }

    const version = await docRepo.getVersionById(client, context.institutionId, grant.versionId);
    if (!version) {
      throw new Error(`VERSION_NOT_FOUND: Version ${grant.versionId} does not exist`);
    }

    // 7. Verify Version belongs to Document
    if (version.documentId !== doc.id) {
      throw new Error(
        `VERSION_DOCUMENT_MISMATCH: Version ${version.id} does not belong to document ${doc.id}`,
      );
    }

    // 8. Lifecycle & Availability Checks (Document & Version)
    if (doc.status === 'archived') {
      throw new Error('DOCUMENT_ARCHIVED: Document is archived and cannot be accessed');
    }

    if (version.status === 'quarantined') {
      throw new Error('ACCESS_DENIED_QUARANTINED: Version is quarantined and cannot be accessed');
    }

    if (version.status !== 'available') {
      throw new Error(
        `NOT_AVAILABLE_FOR_ACCESS: Version ${version.id} is in status "${version.status}", content access requires "available"`,
      );
    }

    // 9. Central H1 Authorization Authority enforcement with CURRENT role
    const accessAction = grant.action === 'open' ? 'open_content' : 'download_content';
    const authAuthority =
      params.authorizationAuthority ??
      new DefaultDocumentAuthorizationAuthority({
        rules: createDefaultDocumentAuthorizationRules(),
      });

    const authDecision = authAuthority.authorize({
      institutionId: context.institutionId,
      personId: grant.granteePersonId,
      role: granteeMembership.role,
      action: accessAction,
      documentId: doc.id,
      documentCategory: doc.category,
      documentStatus: doc.status,
      versionStatus: version.status,
    });

    if (!authDecision.allowed) {
      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: doc.id,
        versionId: version.id,
        actorPersonId: grant.granteePersonId,
        action: `document.content_stream_denied.${grant.action}`,
        outcome: 'denied',
        correlationId: input.correlationId || null,
        details: {
          grantId: grant.id,
          reason: authDecision.reasonCode,
          currentRole: granteeMembership.role,
        },
      });

      throw new Error(
        `AUTHORIZATION_DENIED: ${accessAction} is not permitted for current role ${granteeMembership.role} (${authDecision.reasonCode})`,
      );
    }

    // 10. Real-time Delegated Policy Re-evaluation with Current Role (trusted dependency)
    const evalResult = policyEngine.evaluateAccess({
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

    // 11. Get Storage Object Reference
    const storageRef = await docRepo.getStorageReferenceForVersion(
      client,
      context.institutionId,
      version.id,
    );
    if (!storageRef) {
      throw new Error(`STORAGE_REFERENCE_NOT_FOUND: Storage reference missing for version ${version.id}`);
    }
    if (storageRef.contentAvailability !== 'available') {
      throw new Error(
        `CONTENT_UNAVAILABLE: Conteúdo indisponível no armazenamento para esta versão (estado: ${storageRef.contentAvailability}).`,
      );
    }

    // 12. Open Content Stream (trusted storage provider)
    let stream: NodeJS.ReadableStream;
    try {
      stream = await storageProvider.openReadStream({
        institutionId: context.institutionId,
        storageBucket: storageRef.storageBucket,
        storageKey: storageRef.storageKey,
      });
    } catch (storageErr: any) {
      const errMsg = storageErr instanceof Error ? storageErr.message : String(storageErr);
      const errCode = storageErr?.code || '';
      const isMissingObject =
        errCode === 'ENOENT' ||
        errCode === 'ERR_OBJECT_NOT_FOUND' ||
        errCode === 404 ||
        errMsg.includes('OBJECT_NOT_FOUND') ||
        errMsg.includes('not found') ||
        errMsg.includes('ENOENT') ||
        errMsg.includes('No such object');

      if (isMissingObject) {
        // Storage object physically missing or confirmed unreadable:
        // Update projection to 'unavailable' and emit factual audit event
        await docRepo.updateStorageContentAvailability(
          client,
          context.institutionId,
          version.id,
          'unavailable',
          'Physical storage object confirmed missing during access request',
        );
        await auditRepo.recordAuditEvent(client, {
          institutionId: context.institutionId,
          documentId: doc.id,
          versionId: version.id,
          actorPersonId: grant.granteePersonId,
          action: 'document.storage_object_missing',
          outcome: 'failed',
          correlationId: input.correlationId || null,
          details: {
            grantId: grant.id,
            action: grant.action,
            versionId: version.id,
            reason: 'Storage provider confirmed missing object',
          },
        });
        await client.query('COMMIT');
        throw new Error('CONTENT_UNAVAILABLE: Conteúdo indisponível no armazenamento para esta versão.');
      } else {
        // Transient provider error: Rollback and do NOT project as permanently unavailable!
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(
          `STORAGE_PROVIDER_TRANSIENT_ERROR: Falha temporária de comunicação com o armazenamento (${errMsg})`,
        );
      }
    }

    // 13. Record Grant Usage ONLY after stream open succeeds! (Defect resolution: usage ordering)
    await accessRepo.recordGrantUsage(client, context.institutionId, grant.id);

    // 14. Record factual content stream opened audit event
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
  authorizationAuthority?: DocumentAuthorizationAuthority;
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

      // Load referenced document for policy context & tenant boundary
      const doc = await docRepo.getDocumentById(client, context.institutionId, grant.documentId);
      if (!doc) {
        throw new Error(
          `DOCUMENT_NOT_FOUND: Document ${grant.documentId} not found in institution ${context.institutionId}`,
        );
      }

      // Central H1 Authorization Authority enforcement (Defense in depth at command boundary)
      const authAuthority =
        params.authorizationAuthority ??
        new DefaultDocumentAuthorizationAuthority({
          rules: createDefaultDocumentAuthorizationRules(),
        });

      const authDecision = authAuthority.authorize({
        institutionId: context.institutionId,
        personId: context.personId,
        role: context.role,
        action: 'revoke_grant',
        documentId: doc.id,
        documentCategory: doc.category,
        documentStatus: doc.status,
      });

      if (!authDecision.allowed) {
        await auditRepo.recordAuditEvent(client, {
          institutionId: context.institutionId,
          documentId: doc.id,
          versionId: grant.versionId,
          actorPersonId: context.personId,
          action: 'document.content_access_revoke_denied',
          outcome: 'denied',
          correlationId: input.correlationId || null,
          details: {
            grantId: grant.id,
            reason: authDecision.reasonCode,
            role: context.role,
          },
        });

        throw new Error(
          `AUTHORIZATION_DENIED: revoke_grant is not permitted for role ${context.role} (${authDecision.reasonCode})`,
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

      // Emit document.access_revoked outbox event
      await outboxRepo.insertEvent(client, {
        institutionId: context.institutionId,
        eventType: 'document.access_revoked',
        aggregateType: 'document',
        aggregateId: grant.documentId,
        actorPersonId: context.personId,
        actorKind: 'user',
        correlationId: input.correlationId ?? null,
        causationId: revokedGrant.id,
        payload: {
          grantId: revokedGrant.id,
          documentId: grant.documentId,
          versionId: grant.versionId,
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
