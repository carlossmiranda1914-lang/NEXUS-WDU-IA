import type { Application, RequestHandler, Response } from 'express';
import crypto from 'node:crypto';
import { pool } from '../../db/index.ts';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import type { ObjectStorageProvider } from './object-storage-provider.ts';
import type { DocumentAccessPolicyEngine } from './document-access-policy.ts';
import { ConfigurableDocumentAccessPolicyEngine } from './document-access-policy.ts';
import type { RetentionPolicyEngine } from './document-retention-policy.ts';
import { ConfigurableRetentionPolicyEngine } from './document-retention-policy.ts';
import { PostgresDocumentRepository } from './document-repository.ts';
import {
  listDocumentsQuery,
  getDocumentDetailQuery,
  getDocumentActivityQuery,
} from './document-query-service.ts';
import {
  createUploadSessionCommand,
  completeUploadSessionCommand,
  resumeUploadSessionCommand,
  cancelUploadSessionCommand,
} from './document-upload-command.ts';
import {
  authorizeContentAccessCommand,
  exchangeGrantForContentStreamCommand,
  revokeContentAccessGrantCommand,
} from './document-access-command.ts';
import {
  placeHoldCommand,
  releaseHoldCommand,
  authorizeDeletionCommand,
} from './document-retention-command.ts';
import {
  executeDeletionCommand,
  reconcileDeletionCommand,
} from './document-deletion-command.ts';
import {
  assertNoInternalSecretsInDto,
  type FrontendSafeUploadSessionDto,
} from './document-dto.ts';
import type { DocumentUploadSessionRecord } from './document-upload-model.ts';

function reject(res: Response, status: number, error: string, code?: string) {
  return res.status(status).json({ error, ...(code ? { code } : {}) });
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function resolveIdempotencyKey(req: AuthRequest, bodyKey?: unknown): string {
  const headerKey = req.header('idempotency-key') || req.header('x-idempotency-key');
  if (typeof headerKey === 'string' && headerKey.trim().length >= 8) {
    return headerKey.trim();
  }
  if (typeof bodyKey === 'string' && bodyKey.trim().length >= 8) {
    return bodyKey.trim();
  }
  return `idem-${crypto.randomUUID()}`;
}

function sanitizeUploadSession(session: DocumentUploadSessionRecord): FrontendSafeUploadSessionDto {
  return {
    id: session.id,
    documentId: session.documentId,
    targetVersionNumber: session.targetVersionNumber,
    declaredFilename: session.declaredFilename,
    declaredMimeType: session.declaredMimeType,
    declaredByteSize: session.declaredByteSize,
    status: session.status,
    authorizedUntil: session.authorizedUntil.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
  };
}

export function rejectDomainError(res: Response, error: unknown): Response {
  if (error instanceof Error) {
    const msg = error.message;

    // 400 Bad Request
    if (
      msg.includes('Invalid document category') ||
      msg.includes('Invalid mime type') ||
      msg.includes('Invalid SHA-256') ||
      msg.includes('Invalid byte size') ||
      msg.includes('declaredByteSize must be greater than 0') ||
      msg.includes('TOKEN_REQUIRED') ||
      msg.includes('REASON_REQUIRED') ||
      msg.includes('INVALID_UPLOAD_TOKEN')
    ) {
      return reject(res, 400, msg, 'INVALID_REQUEST');
    }

    // 401 Unauthorized
    if (msg.includes('UNAUTHENTICATED') || msg.includes('AUTH_REQUIRED')) {
      return reject(res, 401, 'Autenticação institucional necessária.', 'UNAUTHENTICATED');
    }

    // 403 Forbidden
    if (
      msg.includes('POLICY_DENIED') ||
      msg.includes('ACTION_NOT_PERMITTED') ||
      msg.includes('HOLD_AUTHORITY_DENIED') ||
      msg.includes('DELETION_AUTHORITY_DENIED') ||
      msg.includes('GRANT_GRANTEE_MISMATCH') ||
      msg.includes('MEMBERSHIP_REVOKED_OR_INACTIVE') ||
      msg.includes('POLICY_NO_LONGER_AUTHORIZED') ||
      msg.includes('ACCESS_DENIED_QUARANTINED')
    ) {
      return reject(res, 403, msg, 'AUTHORIZATION_DENIED');
    }

    // 404 Not Found
    if (
      msg.includes('not found in institution') ||
      msg.includes('DOCUMENT_NOT_FOUND') ||
      msg.includes('VERSION_NOT_FOUND') ||
      msg.includes('GRANT_NOT_FOUND') ||
      msg.includes('HOLD_NOT_FOUND') ||
      msg.includes('DELETION_AUTHORIZATION_NOT_FOUND') ||
      msg.includes('STORAGE_OBJECT_NOT_FOUND') ||
      msg.includes('STORAGE_REFERENCE_NOT_FOUND') ||
      msg.includes('RETENTION_ASSIGNMENT_MISSING')
    ) {
      return reject(res, 404, 'O recurso solicitado não foi encontrado no tenant.', 'NOT_FOUND');
    }

    // 409 Conflict
    if (
      msg.includes('ACTIVE_HOLD_BLOCKS_DELETION') ||
      msg.includes('ACTIVE_HOLDS_PREVENT_DELETION') ||
      msg.includes('ACTIVE_HOLD_PREVENTS_DELETION') ||
      msg.includes('ACTIVE_HOLD') ||
      msg.includes('IDEMPOTENCY_FINGERPRINT_MISMATCH') ||
      msg.includes('RESUME_CANCELLED_DENIED') ||
      msg.includes('RESUME_COMPLETED_DENIED') ||
      msg.includes('RESUME_FAILED_DENIED') ||
      msg.includes('RESUME_EXPIRED_DENIED') ||
      msg.includes('CANCEL_COMPLETED_DENIED') ||
      msg.includes('UPLOAD_SESSION_CANCELLED') ||
      msg.includes('UPLOAD_SESSION_FAILED') ||
      msg.includes('UPLOAD_SESSION_EXPIRED') ||
      msg.includes('GRANT_REVOKED') ||
      msg.includes('GRANT_EXPIRED') ||
      msg.includes('GRANT_INACTIVE') ||
      msg.includes('HOLD_DOCUMENT_MISMATCH') ||
      msg.includes('VERSION_DOCUMENT_MISMATCH')
    ) {
      return reject(res, 409, msg, 'CONFLICT');
    }

    // 422 Unprocessable Entity
    if (
      msg.includes('DECLARED_SIZE_EXCEEDS_POLICY') ||
      msg.includes('UPLOAD_AUTHORIZATION_EXPIRED') ||
      msg.includes('NOT_AVAILABLE_FOR_ACCESS') ||
      msg.includes('VERSION_DELETION_IN_PROGRESS') ||
      msg.includes('DELETION_AUTHORIZATION_STATUS_INVALID') ||
      msg.includes('VERSION_NOT_ELIGIBLE_FOR_DELETION') ||
      msg.includes('RETENTION_PERIOD_ACTIVE')
    ) {
      return reject(res, 422, msg, 'UNPROCESSABLE_STATE');
    }

    // 503 Service Unavailable
    if (
      msg.includes('POLICY_ENGINE_MISSING') ||
      msg.includes('STORAGE_PROVIDER_MISSING') ||
      msg.includes('ACCESS_GRANT_TOKEN_KEY_MISSING') ||
      msg.includes('JURISDICTION_PROFILE_MISSING') ||
      msg.includes('DELETION_PSEUDONYMIZATION_KEY_MISSING') ||
      msg.includes('DELETION_PSEUDONYMIZATION_KEY_INVALID')
    ) {
      return reject(res, 503, 'Dependência operacional governada indisponível.', 'SERVICE_UNAVAILABLE');
    }
  }

  console.error('[DOCUMENTS-API] Unhandled error:', error);
  return reject(res, 500, 'Ocorreu um erro interno ao processar a operação de documentos.', 'INTERNAL_ERROR');
}

export interface DocumentRouteDependencies {
  pool?: typeof pool;
  requireAuth?: RequestHandler;
  storageProvider?: ObjectStorageProvider;
  policyEngine?: DocumentAccessPolicyEngine;
  retentionPolicyEngine?: RetentionPolicyEngine;
  accessGrantTokenKey?: string;
  deletionPseudonymizationKey?: string;
}

export function registerDocumentRoutes(
  app: Application,
  dependencies: DocumentRouteDependencies = {},
): void {
  const docPool = dependencies.pool ?? pool;
  const docAuth = dependencies.requireAuth ?? requireAuth;

  // Safe default engines if not explicitly provided
  const accessGrantTokenKey =
    dependencies.accessGrantTokenKey ||
    process.env.DOCUMENTS_ACCESS_GRANT_TOKEN_KEY ||
    'default-synthetic-test-token-key-minimum-32-chars';

  const deletionPseudonymizationKey =
    dependencies.deletionPseudonymizationKey ||
    process.env.DOCUMENTS_DELETION_PSEUDONYMIZATION_KEY ||
    'default-synthetic-test-deletion-pseudonymization-key-32-chars';

  const policyEngine: DocumentAccessPolicyEngine =
    dependencies.policyEngine ||
    new ConfigurableDocumentAccessPolicyEngine([
      { role: 'admin', category: '*', allowedActions: ['open_content', 'download_content'] },
      { role: 'director', category: '*', allowedActions: ['open_content', 'download_content'] },
      { role: 'secretariat', category: '*', allowedActions: ['open_content', 'download_content'] },
      { role: 'institution_admin', category: '*', allowedActions: ['open_content', 'download_content'] },
      { role: 'superadmin', category: '*', allowedActions: ['open_content', 'download_content'] },
      { role: 'teacher', category: '*', allowedActions: ['open_content', 'download_content'] },
      { role: 'student', category: '*', allowedActions: ['open_content', 'download_content'] },
      { role: 'parent', category: '*', allowedActions: ['open_content', 'download_content'] },
    ]);

  const retentionPolicyEngine: RetentionPolicyEngine =
    dependencies.retentionPolicyEngine ||
    new ConfigurableRetentionPolicyEngine([
      {
        policyId: 'synthetic-default-retention',
        policyVersion: '1.0',
        jurisdictionProfileId: 'AO-STD',
        jurisdictionProfileVersion: '1.0',
        category: 'identification',
        clockTriggerType: 'enrollment_completed',
        retentionDurationDays: 365 * 5,
        allowedHoldTypes: ['legal', 'administrative'],
        allowedDeletionAuthorityScopePatterns: ['admin', 'director', 'institution_admin', 'superadmin'],
      },
      {
        policyId: 'synthetic-general-retention',
        policyVersion: '1.0',
        jurisdictionProfileId: 'AO-STD',
        jurisdictionProfileVersion: '1.0',
        category: 'general',
        clockTriggerType: 'creation',
        retentionDurationDays: 365,
        allowedHoldTypes: ['legal', 'administrative'],
        allowedDeletionAuthorityScopePatterns: ['admin', 'director', 'institution_admin', 'superadmin'],
      },
    ]);

  // 1. GET /api/documents — List documents with bounded pagination and filters
  app.get('/api/documents', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    try {
      const response = await listDocumentsQuery(docPool, context, {
        page: req.query.page as string,
        limit: req.query.limit as string,
        search: req.query.search as string,
        category: req.query.category as string,
        technicalStatus: req.query.technicalStatus as string,
        associationDomain: req.query.associationDomain as string,
        retentionStatus: req.query.retentionStatus as string,
        holdStatus: req.query.holdStatus as any,
        updatedFrom: req.query.updatedFrom as string,
        updatedTo: req.query.updatedTo as string,
      });

      assertNoInternalSecretsInDto(response);
      return res.json(response);
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 2. GET /api/documents/:id — Document Detail DTO
  app.get('/api/documents/:id', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const documentId = req.params.id;
    if (!validUuid(documentId)) {
      return reject(res, 400, 'Identificador de documento inválido.');
    }

    try {
      const dto = await getDocumentDetailQuery(docPool, context, documentId);
      if (!dto) {
        return reject(res, 404, 'Documento não encontrado no tenant.');
      }

      assertNoInternalSecretsInDto(dto);
      return res.json(dto);
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 3. GET /api/documents/:id/activity — Document Activity History
  app.get('/api/documents/:id/activity', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const documentId = req.params.id;
    if (!validUuid(documentId)) {
      return reject(res, 400, 'Identificador de documento inválido.');
    }

    try {
      // Check document existence in tenant
      const detail = await getDocumentDetailQuery(docPool, context, documentId);
      if (!detail) {
        return reject(res, 404, 'Documento não encontrado no tenant.');
      }

      const activities = await getDocumentActivityQuery(docPool, context, documentId);
      assertNoInternalSecretsInDto(activities);
      return res.json({ items: activities });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 4. POST /api/documents/upload-sessions — Create new document or session
  app.post('/api/documents/upload-sessions', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const {
      documentId: rawDocId,
      category,
      classification,
      declaredFilename,
      declaredMimeType,
      declaredByteSize,
      targetVersionNumber,
    } = req.body || {};

    if (!declaredFilename || typeof declaredFilename !== 'string') {
      return reject(res, 400, 'declaredFilename é obrigatório.');
    }
    if (!declaredMimeType || typeof declaredMimeType !== 'string') {
      return reject(res, 400, 'declaredMimeType é obrigatório.');
    }
    if (typeof declaredByteSize !== 'number' || declaredByteSize <= 0) {
      return reject(res, 400, 'declaredByteSize deve ser um número maior que zero.');
    }

    try {
      let documentId = rawDocId;

      if (!documentId) {
        const docRepo = new PostgresDocumentRepository();
        const client = await docPool.connect();
        try {
          const newDoc = await docRepo.createDocument(client, {
            institutionId: context.institutionId,
            category: (category && typeof category === 'string' ? category.trim() : 'general'),
            classification: (classification && typeof classification === 'string' ? classification.trim() : null),
            createdByPersonId: context.personId,
          });
          documentId = newDoc.id;
        } finally {
          client.release();
        }
      } else if (!validUuid(documentId)) {
        return reject(res, 400, 'documentId inválido.');
      }

      const idempotencyKey = resolveIdempotencyKey(req, req.body?.idempotencyKey);
      const sessionResult = await createUploadSessionCommand({
        pool: docPool,
        context,
        idempotencyKey,
        input: {
          documentId,
          targetVersionNumber: targetVersionNumber ? Number(targetVersionNumber) : null,
          declaredFilename,
          declaredMimeType,
          declaredByteSize,
          policyConfig: {
            globalMaxByteSize: 50 * 1024 * 1024,
            institutionMaxByteSize: 25 * 1024 * 1024,
          },
          storageProvider: dependencies.storageProvider?.providerName || 'documents-storage',
          storageBucket: 'documents-vault',
          provenance: {
            sourceDomain: 'portal.documents',
            method: 'upload_session',
            correlationId: req.header('x-correlation-id') || null,
          },
        },
      });

      const safeSession = sanitizeUploadSession(sessionResult.result.session);
      const responseData = {
        documentId,
        sessionId: safeSession.id,
        session: safeSession,
        rawToken: sessionResult.result.rawToken,
        effectiveLimit: sessionResult.result.effectiveLimit,
        replayed: sessionResult.replayed,
      };

      assertNoInternalSecretsInDto(safeSession);
      return res.status(201).json(responseData);
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 5. POST /api/documents/:id/versions/upload-sessions — Create version upload session
  app.post('/api/documents/:id/versions/upload-sessions', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const documentId = req.params.id;
    if (!validUuid(documentId)) {
      return reject(res, 400, 'Identificador de documento inválido.');
    }

    const {
      declaredFilename,
      declaredMimeType,
      declaredByteSize,
      targetVersionNumber,
    } = req.body || {};

    if (!declaredFilename || typeof declaredFilename !== 'string') {
      return reject(res, 400, 'declaredFilename é obrigatório.');
    }
    if (!declaredMimeType || typeof declaredMimeType !== 'string') {
      return reject(res, 400, 'declaredMimeType é obrigatório.');
    }
    if (typeof declaredByteSize !== 'number' || declaredByteSize <= 0) {
      return reject(res, 400, 'declaredByteSize deve ser um número maior que zero.');
    }

    try {
      const idempotencyKey = resolveIdempotencyKey(req, req.body?.idempotencyKey);
      const sessionResult = await createUploadSessionCommand({
        pool: docPool,
        context,
        idempotencyKey,
        input: {
          documentId,
          targetVersionNumber: targetVersionNumber ? Number(targetVersionNumber) : null,
          declaredFilename,
          declaredMimeType,
          declaredByteSize,
          policyConfig: {
            globalMaxByteSize: 50 * 1024 * 1024,
            institutionMaxByteSize: 25 * 1024 * 1024,
          },
          storageProvider: dependencies.storageProvider?.providerName || 'documents-storage',
          storageBucket: 'documents-vault',
          provenance: {
            sourceDomain: 'portal.documents',
            method: 'version_upload_session',
            correlationId: req.header('x-correlation-id') || null,
          },
        },
      });

      const safeSession = sanitizeUploadSession(sessionResult.result.session);
      const responseData = {
        documentId,
        sessionId: safeSession.id,
        session: safeSession,
        rawToken: sessionResult.result.rawToken,
        effectiveLimit: sessionResult.result.effectiveLimit,
        replayed: sessionResult.replayed,
      };

      assertNoInternalSecretsInDto(safeSession);
      return res.status(201).json(responseData);
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 6. POST /api/documents/upload-sessions/:sessionId/complete — Complete upload session
  app.post('/api/documents/upload-sessions/:sessionId/complete', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const sessionId = req.params.sessionId;
    if (!validUuid(sessionId)) {
      return reject(res, 400, 'sessionId inválido.');
    }

    const { rawToken } = req.body || {};
    if (!rawToken || typeof rawToken !== 'string') {
      return reject(res, 400, 'rawToken é obrigatório.');
    }

    if (!dependencies.storageProvider) {
      return reject(res, 503, 'Provedor de armazenamento de objetos não configurado.');
    }

    try {
      const idempotencyKey = resolveIdempotencyKey(req, req.body?.idempotencyKey);
      const completeRes = await completeUploadSessionCommand({
        pool: docPool,
        context,
        storageProvider: dependencies.storageProvider,
        idempotencyKey,
        input: {
          sessionId,
          rawToken,
          provenance: {
            originType: 'user_upload',
            actorPersonId: context.personId,
            sourceDomain: 'portal.documents',
            method: 'complete_upload',
            correlationId: req.header('x-correlation-id') || null,
          },
        },
      });

      const safeSession = sanitizeUploadSession(completeRes.result.session);
      const safeVersion = {
        id: completeRes.result.version.id,
        versionNumber: completeRes.result.version.versionNumber,
        mimeType: completeRes.result.version.mimeType,
        byteSize: completeRes.result.version.byteSize,
        sha256Hash: completeRes.result.version.sha256Hash,
        status: completeRes.result.version.status,
        createdAt: completeRes.result.version.createdAt.toISOString(),
      };

      assertNoInternalSecretsInDto(safeSession);
      assertNoInternalSecretsInDto(safeVersion);

      return res.json({
        success: true,
        versionId: safeVersion.id,
        version: safeVersion,
        session: safeSession,
        replayed: completeRes.replayed,
      });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 7. POST /api/documents/upload-sessions/:sessionId/resume
  app.post('/api/documents/upload-sessions/:sessionId/resume', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const sessionId = req.params.sessionId;
    if (!validUuid(sessionId)) return reject(res, 400, 'sessionId inválido.');

    const { rawToken } = req.body || {};
    if (!rawToken || typeof rawToken !== 'string') {
      return reject(res, 400, 'rawToken é obrigatório.');
    }

    try {
      const idempotencyKey = resolveIdempotencyKey(req, req.body?.idempotencyKey);
      const resumeRes = await resumeUploadSessionCommand({
        pool: docPool,
        context,
        idempotencyKey,
        input: {
          sessionId,
          rawToken,
          correlationId: req.header('x-correlation-id') || null,
        },
      });

      const safeSession = sanitizeUploadSession(resumeRes.result.session);
      assertNoInternalSecretsInDto(safeSession);

      return res.json({
        success: true,
        sessionId: safeSession.id,
        session: safeSession,
        rawToken: resumeRes.result.rawToken,
        replayed: resumeRes.replayed,
      });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 8. POST /api/documents/upload-sessions/:sessionId/cancel
  app.post('/api/documents/upload-sessions/:sessionId/cancel', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const sessionId = req.params.sessionId;
    if (!validUuid(sessionId)) return reject(res, 400, 'sessionId inválido.');

    try {
      const idempotencyKey = resolveIdempotencyKey(req, req.body?.idempotencyKey);
      const cancelRes = await cancelUploadSessionCommand({
        pool: docPool,
        context,
        idempotencyKey,
        input: {
          sessionId,
          reason: req.body?.reason || null,
          correlationId: req.header('x-correlation-id') || null,
        },
      });

      const safeSession = sanitizeUploadSession(cancelRes.result);
      assertNoInternalSecretsInDto(safeSession);

      return res.json({
        success: true,
        session: safeSession,
        replayed: cancelRes.replayed,
      });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 9. POST /api/documents/:id/access — Authorize content access (Stage 1)
  app.post('/api/documents/:id/access', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const documentId = req.params.id;
    if (!validUuid(documentId)) {
      return reject(res, 400, 'Identificador de documento inválido.');
    }

    const { versionId: rawVersionId, action } = req.body || {};
    if (action !== 'open' && action !== 'download') {
      return reject(res, 400, 'Ação inválida: deve ser "open" ou "download".');
    }

    try {
      let versionId = rawVersionId;
      if (!versionId) {
        // Resolve latest version
        const vResult = await docPool.query<{ id: string }>(
          `SELECT id FROM document_versions
           WHERE institution_id = $1 AND document_id = $2
           ORDER BY version_number DESC LIMIT 1`,
          [context.institutionId, documentId],
        );
        if (vResult.rows.length === 0) {
          return reject(res, 404, 'Nenhuma versão encontrada para este documento.');
        }
        versionId = vResult.rows[0].id;
      } else if (!validUuid(versionId)) {
        return reject(res, 400, 'versionId inválido.');
      }

      const idempotencyKey = resolveIdempotencyKey(req, req.body?.idempotencyKey);
      const authRes = await authorizeContentAccessCommand({
        pool: docPool,
        context,
        idempotencyKey,
        policyEngine,
        accessGrantTokenKey,
        input: {
          documentId,
          versionId,
          action,
          correlationId: req.header('x-correlation-id') || undefined,
        },
      });

      const responseData = {
        grantId: authRes.result.grant.id,
        rawAccessToken: authRes.result.rawAccessToken,
        expiresInSeconds: authRes.result.expiresInSeconds,
        expiresAt: authRes.result.grant.expiresAt.toISOString(),
        action: authRes.result.grant.action,
        replayed: authRes.replayed,
      };

      return res.status(201).json(responseData);
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 10. POST /api/documents/access/exchange — Exchange grant token for content stream (Stage 2)
  app.post('/api/documents/access/exchange', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const { rawAccessToken, displayFilename } = req.body || {};
    if (!rawAccessToken || typeof rawAccessToken !== 'string') {
      return reject(res, 400, 'rawAccessToken é obrigatório.');
    }

    if (!dependencies.storageProvider) {
      return reject(res, 503, 'Provedor de armazenamento não disponível para transmissão.');
    }

    try {
      const streamResult = await exchangeGrantForContentStreamCommand({
        pool: docPool,
        context,
        policyEngine,
        storageProvider: dependencies.storageProvider,
        input: {
          rawAccessToken,
          displayFilename,
          correlationId: req.header('x-correlation-id') || undefined,
        },
      });

      res.setHeader('Content-Type', streamResult.mimeType);
      res.setHeader('Content-Length', streamResult.byteSize);
      res.setHeader('Content-Disposition', streamResult.contentDisposition);
      res.setHeader('X-Content-Type-Options', 'nosniff');

      streamResult.stream.pipe(res);
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 11. POST /api/documents/access/:grantId/revoke — Revoke access grant
  app.post('/api/documents/access/:grantId/revoke', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const grantId = req.params.grantId;
    if (!validUuid(grantId)) return reject(res, 400, 'grantId inválido.');

    const { reason } = req.body || {};
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return reject(res, 400, 'Motivo de revogação é obrigatório (mínimo 3 caracteres).');
    }

    try {
      const idempotencyKey = resolveIdempotencyKey(req, req.body?.idempotencyKey);
      const revokeRes = await revokeContentAccessGrantCommand({
        pool: docPool,
        context,
        idempotencyKey,
        input: {
          grantId,
          reason: reason.trim(),
          correlationId: req.header('x-correlation-id') || undefined,
        },
      });

      return res.json({
        success: true,
        grantId: revokeRes.result.id,
        status: revokeRes.result.status,
        replayed: revokeRes.replayed,
      });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 12. POST /api/documents/:id/holds — Place hold
  app.post('/api/documents/:id/holds', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const documentId = req.params.id;
    if (!validUuid(documentId)) return reject(res, 400, 'Identificador de documento inválido.');

    const { versionId: rawVersionId, holdType, authority, reason } = req.body || {};
    if (holdType !== 'legal' && holdType !== 'administrative') {
      return reject(res, 400, 'holdType deve ser "legal" ou "administrative".');
    }
    if (!authority || typeof authority !== 'string' || authority.trim().length < 4) {
      return reject(res, 400, 'authority é obrigatória (mínimo 4 caracteres).');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 4) {
      return reject(res, 400, 'reason é obrigatória (mínimo 4 caracteres).');
    }

    try {
      let versionId = rawVersionId;
      if (!versionId) {
        const vResult = await docPool.query<{ id: string }>(
          `SELECT id FROM document_versions
           WHERE institution_id = $1 AND document_id = $2
           ORDER BY version_number DESC LIMIT 1`,
          [context.institutionId, documentId],
        );
        if (vResult.rows.length === 0) return reject(res, 404, 'Nenhuma versão encontrada.');
        versionId = vResult.rows[0].id;
      } else if (!validUuid(versionId)) {
        return reject(res, 400, 'versionId inválido.');
      }

      const idempotencyKey = resolveIdempotencyKey(req, req.body?.idempotencyKey);
      const holdRes = await placeHoldCommand({
        pool: docPool,
        context,
        idempotencyKey,
        policyEngine: retentionPolicyEngine,
        input: {
          documentId,
          versionId,
          holdType,
          authority: authority.trim(),
          reason: reason.trim(),
          correlationId: req.header('x-correlation-id') || null,
        },
      });

      const safeHold = {
        id: holdRes.result.id,
        versionId: holdRes.result.versionId,
        holdType: holdRes.result.holdType,
        authority: holdRes.result.authority,
        reason: holdRes.result.reason,
        effectiveAt: holdRes.result.effectiveAt.toISOString(),
        releasedAt: holdRes.result.releasedAt ? holdRes.result.releasedAt.toISOString() : null,
        releaseReason: holdRes.result.releaseReason,
        holdStatus: holdRes.result.holdStatus,
      };

      assertNoInternalSecretsInDto(safeHold);
      return res.status(201).json({
        success: true,
        hold: safeHold,
        replayed: holdRes.replayed,
      });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 13. POST /api/documents/:id/holds/:holdId/release — Release hold
  app.post('/api/documents/:id/holds/:holdId/release', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const documentId = req.params.id;
    const holdId = req.params.holdId;
    if (!validUuid(documentId) || !validUuid(holdId)) {
      return reject(res, 400, 'Parâmetros de identificação inválidos.');
    }

    const { versionId: rawVersionId, releaseReason } = req.body || {};
    if (!releaseReason || typeof releaseReason !== 'string' || releaseReason.trim().length < 4) {
      return reject(res, 400, 'releaseReason é obrigatório (mínimo 4 caracteres).');
    }

    try {
      let versionId = rawVersionId;
      if (!versionId) {
        const hRes = await docPool.query<{ version_id: string }>(
          `SELECT version_id FROM document_retention_holds
           WHERE institution_id = $1 AND id = $2 AND document_id = $3`,
          [context.institutionId, holdId, documentId],
        );
        if (hRes.rows.length === 0) {
          return reject(res, 404, 'Bloqueio não encontrado para o documento.');
        }
        versionId = hRes.rows[0].version_id;
      } else if (!validUuid(versionId)) {
        return reject(res, 400, 'versionId inválido.');
      }

      const idempotencyKey = resolveIdempotencyKey(req, req.body?.idempotencyKey);
      const releaseRes = await releaseHoldCommand({
        pool: docPool,
        context,
        idempotencyKey,
        policyEngine: retentionPolicyEngine,
        input: {
          holdId,
          documentId,
          versionId,
          releaseReason: releaseReason.trim(),
          correlationId: req.header('x-correlation-id') || null,
        },
      });

      const safeHold = {
        id: releaseRes.result.id,
        versionId: releaseRes.result.versionId,
        holdType: releaseRes.result.holdType,
        authority: releaseRes.result.authority,
        reason: releaseRes.result.reason,
        effectiveAt: releaseRes.result.effectiveAt.toISOString(),
        releasedAt: releaseRes.result.releasedAt ? releaseRes.result.releasedAt.toISOString() : null,
        releaseReason: releaseRes.result.releaseReason,
        holdStatus: releaseRes.result.holdStatus,
      };

      assertNoInternalSecretsInDto(safeHold);
      return res.json({
        success: true,
        hold: safeHold,
        replayed: releaseRes.replayed,
      });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 14. POST /api/documents/:id/deletion/authorize — Authorize deletion
  app.post('/api/documents/:id/deletion/authorize', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const documentId = req.params.id;
    if (!validUuid(documentId)) return reject(res, 400, 'Identificador de documento inválido.');

    const { versionId: rawVersionId } = req.body || {};

    try {
      let versionId = rawVersionId;
      if (!versionId) {
        const vResult = await docPool.query<{ id: string }>(
          `SELECT id FROM document_versions
           WHERE institution_id = $1 AND document_id = $2
           ORDER BY version_number DESC LIMIT 1`,
          [context.institutionId, documentId],
        );
        if (vResult.rows.length === 0) return reject(res, 404, 'Nenhuma versão encontrada.');
        versionId = vResult.rows[0].id;
      } else if (!validUuid(versionId)) {
        return reject(res, 400, 'versionId inválido.');
      }

      const idempotencyKey = resolveIdempotencyKey(req, req.body?.idempotencyKey);
      const authRes = await authorizeDeletionCommand({
        pool: docPool,
        context,
        idempotencyKey,
        policyEngine: retentionPolicyEngine,
        input: {
          documentId,
          versionId,
          correlationId: req.header('x-correlation-id') || null,
        },
      });

      return res.status(201).json({
        success: true,
        authorizationId: authRes.result.id,
        authorizationStatus: authRes.result.authorizationStatus,
        policyBasis: authRes.result.policyBasis,
        replayed: authRes.replayed,
      });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 15. POST /api/documents/:id/deletion/execute — Execute deletion
  app.post('/api/documents/:id/deletion/execute', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const documentId = req.params.id;
    if (!validUuid(documentId)) return reject(res, 400, 'Identificador de documento inválido.');

    const { deletionAuthorizationId } = req.body || {};
    if (!deletionAuthorizationId || !validUuid(deletionAuthorizationId)) {
      return reject(res, 400, 'deletionAuthorizationId inválido.');
    }

    if (!dependencies.storageProvider) {
      return reject(res, 503, 'Provedor de armazenamento de objetos não configurado.');
    }

    try {
      const idempotencyKey = resolveIdempotencyKey(req, req.body?.idempotencyKey);
      const execRes = await executeDeletionCommand({
        pool: docPool,
        context,
        idempotencyKey,
        deletionPseudonymizationKey,
        storageProvider: dependencies.storageProvider,
        input: {
          deletionAuthorizationId,
          correlationId: req.header('x-correlation-id') || null,
        },
      });

      return res.json({
        success: true,
        reconciliationRequired: execRes.result.reconciliationRequired,
        deletionRecord: execRes.result.deletionRecord,
        replayed: execRes.replayed,
      });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 16. POST /api/documents/:id/deletion/reconcile — Reconcile deletion
  app.post('/api/documents/:id/deletion/reconcile', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const documentId = req.params.id;
    if (!validUuid(documentId)) return reject(res, 400, 'Identificador de documento inválido.');

    const { deletionAuthorizationId } = req.body || {};
    if (!deletionAuthorizationId || !validUuid(deletionAuthorizationId)) {
      return reject(res, 400, 'deletionAuthorizationId inválido.');
    }

    if (!dependencies.storageProvider) {
      return reject(res, 503, 'Provedor de armazenamento de objetos não configurado.');
    }

    try {
      const reconcileRes = await reconcileDeletionCommand({
        pool: docPool,
        context,
        deletionPseudonymizationKey,
        storageProvider: dependencies.storageProvider,
        input: {
          deletionAuthorizationId,
          correlationId: req.header('x-correlation-id') || null,
        },
      });

      return res.json({
        success: true,
        reconciliationRequired: reconcileRes.reconciliationRequired,
        deletionRecord: reconcileRes.deletionRecord,
      });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });
}
