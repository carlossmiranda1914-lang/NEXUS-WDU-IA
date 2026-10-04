import type { Application, RequestHandler, Response } from 'express';
import { Readable } from 'node:stream';
import { pool } from '../../db/index.ts';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import type { ObjectStorageProvider } from './object-storage-provider.ts';
import { DocumentVerificationWorker } from './verification-worker.ts';
import { ClamAvMalwareScanner } from './clamav-malware-scanner.ts';
import { LocalUatMalwareScanner } from './local-uat-malware-scanner.ts';
import type { MalwareScanner } from './malware-scanner.ts';
import type { DocumentAccessPolicyEngine } from './document-access-policy.ts';
import type { RetentionPolicyEngine } from './document-retention-policy.ts';
import {
  type DocumentAuthorizationAuthority,
  DefaultDocumentAuthorizationAuthority,
  createDefaultDocumentAuthorizationRules,
  isManagementRole,
} from './document-authorization-policy.ts';
import { PostgresDocumentRepository } from './document-repository.ts';
import {
  listDocumentsQuery,
  getDocumentDetailQuery,
  getDocumentActivityQuery,
  type DocumentOperationalAvailability,
} from './document-query-service.ts';
import {
  createDocumentCommand,
} from './document-command.ts';
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
  createDocumentAssociationCommand,
  transitionAssociationStatusCommand,
} from './document-association-command.ts';
import {
  assignRetentionCommand,
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
  type FrontendSafeDocumentVersionDto,
} from './document-dto.ts';
import {
  CANONICAL_DOCUMENT_CATEGORIES,
  CANONICAL_DOCUMENT_CLASSIFICATIONS,
  CANONICAL_SUPPORTED_MIME_TYPES,
  isCanonicalCategory,
  normalizeDocumentCategory,
} from './document-model.ts';
import {
  type DocumentUploadSessionRecord,
  type DocumentSizePolicyConfig,
  calculateEffectiveSizeLimit,
  verifyUploadToken,
} from './document-upload-model.ts';

function reject(res: Response, status: number, error: string, code?: string) {
  return res.status(status).json({ error, ...(code ? { code } : {}) });
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

/**
 * Require a caller-supplied idempotency key.
 * Returns the key string on success, or writes a 428 Precondition Required
 * response and returns null so the caller can short-circuit.
 *
 * A key must be:
 *  - supplied via Idempotency-Key header, X-Idempotency-Key header, or body.idempotencyKey
 *  - a string of at least 8 characters
 *
 * Server-generated random keys are PROHIBITED: they defeat retry safety.
 */
function requireIdempotencyKey(
  req: AuthRequest,
  res: Response,
  bodyKey?: unknown,
): string | null {
  const headerKey = req.header('idempotency-key') || req.header('x-idempotency-key');
  if (typeof headerKey === 'string' && headerKey.trim().length >= 8) {
    return headerKey.trim();
  }
  if (typeof bodyKey === 'string' && bodyKey.trim().length >= 8) {
    return bodyKey.trim();
  }
  reject(
    res,
    428,
    'Idempotency-Key é obrigatório para esta operação. Forneça um identificador único via cabeçalho Idempotency-Key ou campo idempotencyKey no corpo (mínimo 8 caracteres).',
    'IDEMPOTENCY_KEY_REQUIRED',
  );
  return null;
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
      msg.includes('AUTHORIZATION_DENIED') ||
      msg.includes('POLICY_DENIED') ||
      msg.includes('ACTION_NOT_PERMITTED') ||
      msg.includes('HOLD_AUTHORITY_DENIED') ||
      msg.includes('DELETION_AUTHORITY_DENIED') ||
      msg.includes('DELETION_AUTHORIZATION_DENIED') ||
      msg.includes('GRANT_GRANTEE_MISMATCH') ||
      msg.includes('MEMBERSHIP_REVOKED_OR_INACTIVE') ||
      msg.includes('POLICY_NO_LONGER_AUTHORIZED') ||
      msg.includes('ACCESS_DENIED_QUARANTINED')
    ) {
      return reject(res, 403, msg, 'AUTHORIZATION_DENIED');
    }

    // 422 Unprocessable Entity - Governance state blockers
    if (msg.includes('RETENTION_ASSIGNMENT_MISSING')) {
      return reject(
        res,
        422,
        'Este documento ainda não possui uma política de retenção atribuída e, por isso, não pode ser eliminado.',
        'RETENTION_ASSIGNMENT_MISSING',
      );
    }
    if (msg.includes('RETENTION_ACTIVE') || msg.includes('RETENTION_PERIOD_ACTIVE')) {
      return reject(
        res,
        422,
        'O documento encontra-se sob prazo de retenção ativo e não pode ser eliminado.',
        'RETENTION_ACTIVE',
      );
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
      msg.includes('document_associations_document_tenant_fk') ||
      msg.includes('violates foreign key constraint') ||
      (error as any)?.code === '23503'
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
      msg.includes('IDEMPOTENCY_CONFLICT') ||
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

    // 422 Unprocessable Entity - Other domain state blockers
    if (
      msg.includes('DECLARED_SIZE_EXCEEDS_POLICY') ||
      msg.includes('UPLOAD_AUTHORIZATION_EXPIRED') ||
      msg.includes('NOT_AVAILABLE_FOR_ACCESS') ||
      msg.includes('VERSION_DELETION_IN_PROGRESS') ||
      msg.includes('DELETION_AUTHORIZATION_STATUS_INVALID') ||
      msg.includes('VERSION_NOT_ELIGIBLE_FOR_DELETION')
    ) {
      return reject(res, 422, msg, 'UNPROCESSABLE_STATE');
    }

    // 503 Service Unavailable
    if (
      msg.includes('POLICY_ENGINE_MISSING') ||
      msg.includes('RETENTION_POLICY_ENGINE_MISSING') ||
      msg.includes('UPLOAD_POLICY_MISSING') ||
      msg.includes('STORAGE_CONFIGURATION_MISSING') ||
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
  storageBucket?: string;
  uploadPolicyConfig?: DocumentSizePolicyConfig;
  policyEngine?: DocumentAccessPolicyEngine;
  retentionPolicyEngine?: RetentionPolicyEngine;
  authorizationAuthority?: DocumentAuthorizationAuthority;
  accessGrantTokenKey?: string;
  deletionPseudonymizationKey?: string;
  verificationWorker?: DocumentVerificationWorker | null;
  malwareScanner?: MalwareScanner | null;
}

export function registerDocumentRoutes(
  app: Application,
  dependencies: DocumentRouteDependencies = {},
): void {
  const docPool = dependencies.pool ?? pool;
  const docAuth = dependencies.requireAuth ?? requireAuth;

  // Canonical central authorization authority
  const authAuthority: DocumentAuthorizationAuthority =
    dependencies.authorizationAuthority ||
    new DefaultDocumentAuthorizationAuthority({
      rules: createDefaultDocumentAuthorizationRules(),
      delegates: {
        accessPolicyEngine: dependencies.policyEngine || undefined,
        retentionPolicyEngine: dependencies.retentionPolicyEngine || undefined,
      },
    });

  // Strict operational authority from dependencies or environment; NO synthetic fallbacks in production
  const accessGrantTokenKey =
    dependencies.accessGrantTokenKey || process.env.DOCUMENTS_ACCESS_GRANT_TOKEN_KEY || null;

  const deletionPseudonymizationKey =
    dependencies.deletionPseudonymizationKey ||
    process.env.DOCUMENTS_DELETION_PSEUDONYMIZATION_KEY ||
    null;

  const policyEngine: DocumentAccessPolicyEngine | null = dependencies.policyEngine || null;

  const retentionPolicyEngine: RetentionPolicyEngine | null =
    dependencies.retentionPolicyEngine || null;

  const uploadPolicyConfig: DocumentSizePolicyConfig | null =
    dependencies.uploadPolicyConfig ||
    (process.env.DOCUMENTS_GLOBAL_MAX_BYTE_SIZE
      ? {
          globalMaxByteSize: Number(process.env.DOCUMENTS_GLOBAL_MAX_BYTE_SIZE),
          institutionMaxByteSize: process.env.DOCUMENTS_INSTITUTION_MAX_BYTE_SIZE
            ? Number(process.env.DOCUMENTS_INSTITUTION_MAX_BYTE_SIZE)
            : undefined,
        }
      : null);

  const storageProvider: ObjectStorageProvider | null = dependencies.storageProvider || null;
  const storageBucket: string | null =
    dependencies.storageBucket || process.env.DOCUMENTS_STORAGE_BUCKET || null;

  let verificationWorker: DocumentVerificationWorker | null =
    dependencies.verificationWorker !== undefined
      ? dependencies.verificationWorker
      : null;

  if (dependencies.verificationWorker === undefined && storageProvider && storageBucket) {
    try {
      let malwareScanner = dependencies.malwareScanner;
      if (!malwareScanner) {
        if (
          (storageProvider.providerName === 'local_uat' ||
            process.env.DOCUMENTS_STORAGE_PROVIDER === 'local_uat' ||
            process.env.DOCUMENTS_MALWARE_SCANNER === 'local_uat') &&
          process.env.NODE_ENV !== 'production'
        ) {
          malwareScanner = new LocalUatMalwareScanner();
        } else {
          const clamavUrl =
            process.env.CLAMAV_SERVICE_URL || 'https://nexus-clamav-staging-oihjcxwo5a-ew.a.run.app';
          malwareScanner = new ClamAvMalwareScanner({
            serviceUrl: clamavUrl,
            host: process.env.CLAMAV_HOST || '127.0.0.1',
            port: Number(process.env.CLAMAV_PORT || 3310),
          });
        }
      }

      verificationWorker = new DocumentVerificationWorker({
        pool: docPool,
        storageProvider,
        malwareScanner,
        storageBucket,
        gcpProjectId: process.env.GOOGLE_CLOUD_PROJECT || 'nexus-wdu-staging',
        trustedAuthority: {
          kind: 'trusted_system_worker',
          workerId: 'deployed-staging-verification-worker-01',
          workerName: 'Nexus Cloud Run Verification Worker',
        },
      });
    } catch (workerErr) {
      console.error('[DOCUMENTS-CONTROLLER] Verification worker initialization failed:', workerErr);
    }
  }

  const operationalAvailability: DocumentOperationalAvailability = {
    canAccess: Boolean(storageProvider && policyEngine && accessGrantTokenKey),
    canUpload: Boolean(storageProvider && storageBucket && uploadPolicyConfig),
    canHold: Boolean(retentionPolicyEngine),
    canDelete: Boolean(storageProvider && retentionPolicyEngine && deletionPseudonymizationKey),
  };

  // 0. GET /api/documents/metadata (and /api/documents/taxonomy) — Governed canonical taxonomy
  app.get(['/api/documents/metadata', '/api/documents/taxonomy'], docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    return res.json({
      categories: CANONICAL_DOCUMENT_CATEGORIES,
      classifications: CANONICAL_DOCUMENT_CLASSIFICATIONS,
      supportedMimeTypes: CANONICAL_SUPPORTED_MIME_TYPES,
      operationalAvailability,
    });
  });

  // 1. GET /api/documents — List documents with bounded pagination and filters
  app.get('/api/documents', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    try {
      const response = await listDocumentsQuery(
        docPool,
        context,
        {
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
        },
        operationalAvailability,
        authAuthority,
      );

      assertNoInternalSecretsInDto(response.items);
      return res.json(response);
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 2. GET /api/documents/:id — Document detail with safe DTO
  app.get('/api/documents/:id', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const documentId = req.params.id;
    if (!validUuid(documentId)) {
      return reject(res, 400, 'Identificador de documento inválido.');
    }

    try {
      const doc = await getDocumentDetailQuery(docPool, context, documentId, operationalAvailability);
      if (!doc) {
        return reject(res, 404, 'Documento não encontrado no tenant.');
      }

      // Authorization enforcement: VIEW_METADATA
      const authDecision = authAuthority.authorize({
        institutionId: context.institutionId,
        personId: context.personId,
        role: context.role,
        action: 'view_metadata',
        documentId: doc.id,
        documentCategory: doc.category,
      });

      if (!authDecision.allowed) {
        // Anti-enumeration: return identical 404
        return reject(res, 404, 'Documento não encontrado no tenant.');
      }

      assertNoInternalSecretsInDto(doc);
      return res.json(doc);
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 2.1. GET /api/documents/:id/versions — Real tenant-scoped version history
  app.get('/api/documents/:id/versions', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const documentId = req.params.id;
    if (!validUuid(documentId)) {
      return reject(res, 400, 'Identificador de documento inválido.');
    }

    try {
      const doc = await getDocumentDetailQuery(docPool, context, documentId);
      if (!doc) {
        return reject(res, 404, 'Documento não encontrado no tenant.');
      }

      // Authorization enforcement: VIEW_VERSIONS
      const authDecision = authAuthority.authorize({
        institutionId: context.institutionId,
        personId: context.personId,
        role: context.role,
        action: 'view_versions',
        documentId: doc.id,
        documentCategory: doc.category,
      });

      if (!authDecision.allowed) {
        // Anti-enumeration: return identical 404
        return reject(res, 404, 'Documento não encontrado no tenant.');
      }

      const rows = await docPool.query<{
        id: string;
        document_id: string;
        version_number: number;
        mime_type: string;
        byte_size: string;
        sha256_hash: string;
        status: string;
        created_by_person_name: string | null;
        original_filename: string | null;
        created_at: Date;
      }>(
        `SELECT v.id, v.document_id, v.version_number, v.mime_type, v.byte_size, v.sha256_hash, v.status, v.created_at,
                p.name AS created_by_person_name,
                s.declared_filename AS original_filename
           FROM document_versions v
           LEFT JOIN people p ON p.id = v.created_by_person_id
           LEFT JOIN document_upload_sessions s ON s.institution_id = v.institution_id AND s.completed_version_id = v.id
          WHERE v.institution_id = $1 AND v.document_id = $2
          ORDER BY v.version_number DESC`,
        [context.institutionId, documentId],
      );

      const items: FrontendSafeDocumentVersionDto[] = rows.rows.map((r) => ({
        id: r.id,
        versionNumber: r.version_number,
        mimeType: r.mime_type,
        byteSize: Number(r.byte_size),
        sha256Hash: r.sha256_hash,
        status: r.status as any,
        originalFilename: r.original_filename || undefined,
        declaredFilename: r.original_filename || undefined,
        createdByPersonName: r.created_by_person_name,
        createdAt: r.created_at.toISOString(),
      }));

      assertNoInternalSecretsInDto(items);
      return res.json({ items });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 2.2. GET /api/documents/association-targets/search — Search same-tenant targets
  app.get('/api/documents/association-targets/search', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    // Authorization enforcement: SEARCH_ASSOCIATION_TARGET (evaluated BEFORE any target query)
    const authDecision = authAuthority.authorize({
      institutionId: context.institutionId,
      personId: context.personId,
      role: context.role,
      action: 'search_association_target',
    });

    if (!authDecision.allowed) {
      return reject(res, 403, 'Acesso não autorizado.', 'AUTHORIZATION_DENIED');
    }

    const domain = (req.query.domain as string) || 'enrollment';
    const searchQuery = ((req.query.q as string) || '').trim();

    try {
      if (domain === 'enrollment' || domain === 'student') {
        const query = `
          SELECT e.id, p.name AS student_name, y.name AS academic_year_name, o.name AS offer_name, e.status
          FROM enrollment_applications e
          JOIN people p ON p.id = e.student_person_id
          JOIN academic_years y ON y.id = e.academic_year_id
          JOIN enrollment_offers o ON o.id = e.offer_id
          WHERE e.institution_id = $1
            AND ($2 = '' OR p.name ILIKE $3 OR y.name ILIKE $3 OR o.name ILIKE $3)
          ORDER BY e.updated_at DESC
          LIMIT 25
        `;
        const result = await docPool.query(query, [
          context.institutionId,
          searchQuery,
          `%${searchQuery}%`,
        ]);
        const targets = result.rows.map((r: any) => ({
          id: r.id,
          name: `${r.student_name} (${r.academic_year_name})`,
          domain: 'enrollment',
          resourceType: 'enrollment_application',
          detail: `Oferta: ${r.offer_name} | Estado: ${r.status}`,
        }));
        return res.json({ targets });
      } else if (domain === 'academic') {
        const query = `
          SELECT y.id, y.name, y.status, y.starts_on, y.ends_on
          FROM academic_years y
          WHERE y.institution_id = $1
            AND ($2 = '' OR y.name ILIKE $3)
          ORDER BY y.starts_on DESC
          LIMIT 25
        `;
        const result = await docPool.query(query, [
          context.institutionId,
          searchQuery,
          `%${searchQuery}%`,
        ]);
        const targets = result.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          domain: 'academic',
          resourceType: 'academic_year',
          detail: `Ano Letivo | Estado: ${r.status}`,
        }));
        return res.json({ targets });
      } else {
        return reject(res, 400, 'Domínio de associação inválido (deve ser "enrollment" ou "academic").');
      }
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 2.3. POST /api/documents/:id/associations — Create canonical association
  app.post('/api/documents/:id/associations', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const documentId = req.params.id;
    if (!validUuid(documentId)) {
      return reject(res, 400, 'Identificador de documento inválido.');
    }

    const { targetDomain, targetResourceType, targetResourceId, purpose, pinnedVersionId } = req.body || {};
    if (!targetDomain || typeof targetDomain !== 'string') {
      return reject(res, 400, 'targetDomain é obrigatório.');
    }
    if (!targetResourceType || typeof targetResourceType !== 'string') {
      return reject(res, 400, 'targetResourceType é obrigatório.');
    }
    if (!targetResourceId || typeof targetResourceId !== 'string') {
      return reject(res, 400, 'targetResourceId é obrigatório.');
    }
    if (!purpose || typeof purpose !== 'string') {
      return reject(res, 400, 'purpose é obrigatório.');
    }
    if (pinnedVersionId !== undefined && pinnedVersionId !== null && !validUuid(pinnedVersionId)) {
      return reject(res, 400, 'pinnedVersionId inválido.');
    }

    try {
      const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
      if (idempotencyKey === null) return res;

      // Verify document existence and category in tenant
      const docCheck = await docPool.query<{ id: string; category: string }>(
        `SELECT id, category FROM documents WHERE institution_id = $1 AND id = $2`,
        [context.institutionId, documentId],
      );
      if (docCheck.rows.length === 0) {
        return reject(res, 404, 'Documento não encontrado no tenant.');
      }

      // Controller authorization enforcement: CREATE_ASSOCIATION
      const authDecision = authAuthority.authorize({
        institutionId: context.institutionId,
        personId: context.personId,
        role: context.role,
        action: 'create_association',
        documentId,
        documentCategory: docCheck.rows[0].category,
        targetDomain,
        targetResourceType,
        targetResourceId,
      });

      if (!authDecision.allowed) {
        return reject(res, 403, 'Acesso não autorizado.', 'AUTHORIZATION_DENIED');
      }

      const assocRes = await createDocumentAssociationCommand({
        pool: docPool,
        context,
        idempotencyKey,
        authorizationAuthority: authAuthority,
        input: {
          documentId,
          pinnedVersionId: pinnedVersionId || null,
          targetDomain,
          targetResourceType,
          targetResourceId,
          purpose,
          correlationId: req.header('x-correlation-id') || null,
        },
      });

      return res.status(201).json({
        success: true,
        association: assocRes.result,
        replayed: assocRes.replayed,
      });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 2.4. DELETE /api/documents/:id/associations/:assocId — Withdraw association
  app.delete('/api/documents/:id/associations/:assocId', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const documentId = req.params.id;
    const assocId = req.params.assocId;
    if (!validUuid(documentId) || !validUuid(assocId)) {
      return reject(res, 400, 'Identificadores inválidos.');
    }

    try {
      const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
      if (idempotencyKey === null) return res;

      // Verify association exists, belongs to tenant, and belongs to expected documentId
      const assocCheck = await docPool.query<{ id: string; document_id: string; status: string }>(
        `SELECT id, document_id, status FROM document_associations WHERE institution_id = $1 AND id = $2`,
        [context.institutionId, assocId],
      );
      if (assocCheck.rows.length === 0 || assocCheck.rows[0].document_id !== documentId) {
        return reject(res, 404, 'Associação não encontrada no tenant para este documento.');
      }

      // Verify document existence and category in tenant
      const docCheck = await docPool.query<{ id: string; category: string }>(
        `SELECT id, category FROM documents WHERE institution_id = $1 AND id = $2`,
        [context.institutionId, documentId],
      );
      if (docCheck.rows.length === 0) {
        return reject(res, 404, 'Documento não encontrado no tenant.');
      }

      // Controller authorization enforcement: REMOVE_ASSOCIATION
      const authDecision = authAuthority.authorize({
        institutionId: context.institutionId,
        personId: context.personId,
        role: context.role,
        action: 'remove_association',
        documentId,
        documentCategory: docCheck.rows[0].category,
      });

      if (!authDecision.allowed) {
        return reject(res, 403, 'Acesso não autorizado.', 'AUTHORIZATION_DENIED');
      }

      const result = await transitionAssociationStatusCommand({
        pool: docPool,
        context,
        idempotencyKey,
        expectedDocumentId: documentId,
        authorizationAuthority: authAuthority,
        input: {
          associationId: assocId,
          targetStatus: 'withdrawn',
          reason: (req.body?.reason as string) || 'Associação retirada pelo utilizador',
          correlationId: req.header('x-correlation-id') || null,
        },
      });

      return res.json({
        success: true,
        association: result.result,
        replayed: result.replayed,
      });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 3. GET /api/documents/:id/activity — Document factual activity history
  app.get('/api/documents/:id/activity', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const documentId = req.params.id;
    if (!validUuid(documentId)) {
      return reject(res, 400, 'Identificador de documento inválido.');
    }

    try {
      // First check document existence and category in tenant for authorization
      const docCheck = await docPool.query<{ id: string; category: string }>(
        `SELECT id, category FROM documents WHERE institution_id = $1 AND id = $2`,
        [context.institutionId, documentId],
      );

      if (docCheck.rows.length === 0) {
        return reject(res, 404, 'Documento não encontrado no tenant.');
      }

      // Authorization enforcement: VIEW_ACTIVITY
      const authDecision = authAuthority.authorize({
        institutionId: context.institutionId,
        personId: context.personId,
        role: context.role,
        action: 'view_activity',
        documentId,
        documentCategory: docCheck.rows[0].category,
      });

      if (!authDecision.allowed) {
        // Anti-enumeration: return identical 404
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

    if (!uploadPolicyConfig) {
      return rejectDomainError(res, new Error('UPLOAD_POLICY_MISSING'));
    }
    if (!storageProvider || !storageBucket) {
      return rejectDomainError(res, new Error('STORAGE_CONFIGURATION_MISSING'));
    }

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
      const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
      if (idempotencyKey === null) return res;

      if (!documentId) {
        if (category && typeof category === 'string' && !isCanonicalCategory(category.trim())) {
          return reject(
            res,
            400,
            `Invalid document category: "${category}". Category is not governed in canonical taxonomy.`,
            'INVALID_CATEGORY',
          );
        }

        // Canonical I1/I7 document creation command: domain fact, audit, outbox event intent, idempotency
        const docCreationRes = await createDocumentCommand({
          pool: docPool,
          context,
          idempotencyKey: `doc-${idempotencyKey}`,
          input: {
            category: category && typeof category === 'string' ? normalizeDocumentCategory(category) : 'general',
            classification:
              classification && typeof classification === 'string' ? classification.trim() : null,
            provenance: {
              sourceDomain: 'portal.documents',
              method: 'upload_session_create_doc',
              correlationId: req.header('x-correlation-id') || null,
            },
          },
        });
        documentId = docCreationRes.result.id;
      } else if (!validUuid(documentId)) {
        return reject(res, 400, 'documentId inválido.');
      }

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
          policyConfig: uploadPolicyConfig,
          storageProvider: storageProvider.providerName,
          storageBucket,
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

    if (!uploadPolicyConfig) {
      return rejectDomainError(res, new Error('UPLOAD_POLICY_MISSING'));
    }
    if (!storageProvider || !storageBucket) {
      return rejectDomainError(res, new Error('STORAGE_CONFIGURATION_MISSING'));
    }

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
      const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
      if (idempotencyKey === null) return res;
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
          policyConfig: uploadPolicyConfig,
          storageProvider: storageProvider.providerName,
          storageBucket,
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

  // 5.1. PUT /api/documents/upload-sessions/:sessionId/transfer — Real streaming byte transport
  app.put('/api/documents/upload-sessions/:sessionId/transfer', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    if (!uploadPolicyConfig) {
      return rejectDomainError(res, new Error('UPLOAD_POLICY_MISSING'));
    }
    if (!storageProvider) {
      return rejectDomainError(res, new Error('STORAGE_PROVIDER_MISSING'));
    }

    const sessionId = req.params.sessionId;
    if (!validUuid(sessionId)) {
      return reject(res, 400, 'sessionId inválido.');
    }

    const rawToken = req.header('x-upload-token');
    if (!rawToken || typeof rawToken !== 'string') {
      return reject(res, 400, 'X-Upload-Token header é obrigatório.', 'TOKEN_REQUIRED');
    }

    try {
      // 1. Resolve session in institution
      const sessionResult = await docPool.query<{
        id: string;
        institution_id: string;
        document_id: string;
        target_version_number: number | null;
        declared_filename: string;
        declared_mime_type: string;
        declared_byte_size: string;
        storage_provider: string;
        storage_bucket: string;
        storage_key: string;
        status: string;
        upload_token_hash: string;
        authorized_until: Date;
        expires_at: Date;
      }>(
        `SELECT id, institution_id, document_id, target_version_number, declared_filename, declared_mime_type, declared_byte_size,
                storage_provider, storage_bucket, storage_key, status, upload_token_hash, authorized_until, expires_at
           FROM document_upload_sessions
          WHERE institution_id = $1 AND id = $2`,
        [context.institutionId, sessionId],
      );

      if (sessionResult.rows.length === 0) {
        return reject(res, 404, 'Sessão de upload não encontrada no tenant.');
      }

      const row = sessionResult.rows[0];
      const now = new Date();

      // 2. Lifecycle checks
      if (row.status === 'cancelled') {
        return reject(res, 409, 'UPLOAD_SESSION_CANCELLED: Não é possível transferir ficheiro para uma sessão cancelada.');
      }
      if (row.status === 'completed') {
        return reject(res, 409, 'RESUME_COMPLETED_DENIED: Sessão de upload já se encontra concluída.');
      }
      if (row.status === 'failed') {
        return reject(res, 409, 'UPLOAD_SESSION_FAILED: Sessão de upload em estado de falha.');
      }
      if (row.status === 'expired' || now > new Date(row.expires_at)) {
        return reject(res, 409, 'UPLOAD_SESSION_EXPIRED: Sessão de upload expirada.');
      }
      if (now > new Date(row.authorized_until)) {
        return reject(res, 422, 'UPLOAD_AUTHORIZATION_EXPIRED: Janela de autorização de upload expirada.');
      }

      // 3. Token verification
      const isTokenValid = verifyUploadToken(rawToken, row.upload_token_hash);
      if (!isTokenValid) {
        return reject(res, 400, 'INVALID_UPLOAD_TOKEN: O token de upload fornecido é inválido.');
      }

      // 4. Validate policy limit
      const effectiveLimit = calculateEffectiveSizeLimit(uploadPolicyConfig);
      const declaredSize = Number(row.declared_byte_size);

      // 5. Stream transfer through storageProvider
      let inputStream: Readable = req;
      if (req.readableEnded && (req as any).body !== undefined) {
        const body = (req as any).body;
        const bodyBuf = Buffer.isBuffer(body)
          ? body
          : typeof body === 'string'
            ? Buffer.from(body)
            : Buffer.from(JSON.stringify(body));
        inputStream = Readable.from(bodyBuf);
      }

      const requestContentType = req.header('content-type');
      const effectiveMimeType =
        requestContentType && requestContentType !== 'application/octet-stream'
          ? requestContentType
          : row.declared_mime_type;

      let transferResult: { byteSize: number; sha256Hash: string; mimeType: string };
      if (typeof storageProvider.writeObjectStream === 'function') {
        transferResult = await storageProvider.writeObjectStream({
          institutionId: context.institutionId,
          storageBucket: row.storage_bucket,
          storageKey: row.storage_key,
          stream: inputStream,
          declaredByteSize: declaredSize,
          mimeType: effectiveMimeType,
        });
        if (transferResult.byteSize > effectiveLimit) {
          return reject(res, 422, `DECLARED_SIZE_EXCEEDS_POLICY: Tamanho do ficheiro excede o limite efetivo de ${effectiveLimit} bytes.`);
        }
      } else {
        throw new Error('STORAGE_PROVIDER_STREAM_NOT_SUPPORTED');
      }

      // 6. Confirm object presence in storage
      const head = await storageProvider.headObject({
        storageBucket: row.storage_bucket,
        storageKey: row.storage_key,
      });

      if (!head.exists) {
        return reject(res, 500, 'Falha ao confirmar persistência física do objeto transferido.');
      }

      return res.json({
        success: true,
        sessionId: row.id,
        byteSize: transferResult.byteSize,
        sha256Hash: transferResult.sha256Hash,
      });
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

    if (!storageProvider) {
      return rejectDomainError(res, new Error('STORAGE_PROVIDER_MISSING'));
    }

    try {
      const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
      if (idempotencyKey === null) return res;
      const completeRes = await completeUploadSessionCommand({
        pool: docPool,
        context,
        storageProvider,
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

      // Autonomous async verification execution on deployed worker
      if (verificationWorker && !completeRes.replayed) {
        const institutionId = context.institutionId;
        const documentId = completeRes.result.session.documentId;
        const versionId = completeRes.result.version.id;
        const actorPersonId = context.personId;

        setImmediate(() => {
          verificationWorker!.processVerificationJob({
            institutionId,
            documentId,
            versionId,
            actorPersonId,
          }).catch((workerErr) => {
            console.error(`[DEPLOYED_ASYNC_VERIFICATION_ERROR] Doc ${documentId} Ver ${versionId}:`, workerErr);
          });
        });
      }

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
      const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
      if (idempotencyKey === null) return res;
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
      const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
      if (idempotencyKey === null) return res;
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

    if (!policyEngine) {
      return rejectDomainError(res, new Error('POLICY_ENGINE_MISSING'));
    }
    if (!accessGrantTokenKey) {
      return rejectDomainError(res, new Error('ACCESS_GRANT_TOKEN_KEY_MISSING'));
    }

    const documentId = req.params.id;
    if (!validUuid(documentId)) {
      return reject(res, 400, 'Identificador de documento inválido.');
    }

    const { versionId: rawVersionId, action } = req.body || {};
    if (action !== 'open' && action !== 'download') {
      return reject(res, 400, 'Ação inválida: deve ser "open" ou "download".');
    }

    try {
      // Verify document existence and category in tenant
      const docCheck = await docPool.query<{ id: string; category: string; status: string }>(
        `SELECT id, category, status FROM documents WHERE institution_id = $1 AND id = $2`,
        [context.institutionId, documentId],
      );
      if (docCheck.rows.length === 0) {
        return reject(res, 404, 'Documento não encontrado no tenant.');
      }
      const documentCategory = docCheck.rows[0].category;
      const documentStatus = docCheck.rows[0].status as any;

      let versionId = rawVersionId;
      let versionStatus: any = undefined;
      if (!versionId) {
        // Resolve latest version
        const vResult = await docPool.query<{ id: string; status: string }>(
          `SELECT id, status FROM document_versions
           WHERE institution_id = $1 AND document_id = $2
           ORDER BY version_number DESC LIMIT 1`,
          [context.institutionId, documentId],
        );
        if (vResult.rows.length === 0) {
          return reject(res, 404, 'Nenhuma versão encontrada para este documento.');
        }
        versionId = vResult.rows[0].id;
        versionStatus = vResult.rows[0].status;
      } else if (!validUuid(versionId)) {
        return reject(res, 400, 'versionId inválido.');
      } else {
        const vCheck = await docPool.query<{ id: string; status: string }>(
          `SELECT id, status FROM document_versions
           WHERE institution_id = $1 AND document_id = $2 AND id = $3`,
          [context.institutionId, documentId, versionId],
        );
        if (vCheck.rows.length === 0) {
          return reject(res, 404, 'Versão não encontrada para este documento no tenant.');
        }
        versionStatus = vCheck.rows[0].status;
      }

      // Controller authorization enforcement: open_content | download_content
      const accessAction = action === 'open' ? 'open_content' : 'download_content';
      const authDecision = authAuthority.authorize({
        institutionId: context.institutionId,
        personId: context.personId,
        role: context.role,
        action: accessAction,
        documentId,
        documentCategory,
        documentStatus,
        versionStatus,
      });

      if (!authDecision.allowed) {
        return reject(res, 403, 'Acesso não autorizado.', 'AUTHORIZATION_DENIED');
      }

      const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
      if (idempotencyKey === null) return res;
      const authRes = await authorizeContentAccessCommand({
        pool: docPool,
        context,
        idempotencyKey,
        policyEngine,
        accessGrantTokenKey,
        authorizationAuthority: authAuthority,
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

    if (!policyEngine) {
      return rejectDomainError(res, new Error('POLICY_ENGINE_MISSING'));
    }
    if (!storageProvider) {
      return rejectDomainError(res, new Error('STORAGE_PROVIDER_MISSING'));
    }

    const { rawAccessToken, displayFilename } = req.body || {};
    if (!rawAccessToken || typeof rawAccessToken !== 'string') {
      return reject(res, 400, 'rawAccessToken é obrigatório.');
    }

    try {
      const streamResult = await exchangeGrantForContentStreamCommand({
        pool: docPool,
        context,
        policyEngine,
        storageProvider,
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
      // Verify grant exists in tenant
      const grantCheck = await docPool.query<{ id: string; document_id: string }>(
        `SELECT id, document_id FROM document_content_access_grants WHERE institution_id = $1 AND id = $2`,
        [context.institutionId, grantId],
      );
      if (grantCheck.rows.length === 0) {
        return reject(res, 404, 'Concessão de acesso não encontrada no tenant.');
      }
      const documentId = grantCheck.rows[0].document_id;

      // Verify document in tenant
      const docCheck = await docPool.query<{ id: string; category: string; status: string }>(
        `SELECT id, category, status FROM documents WHERE institution_id = $1 AND id = $2`,
        [context.institutionId, documentId],
      );
      const docCategory = docCheck.rows[0]?.category;
      const docStatus = docCheck.rows[0]?.status as any;

      // Controller authorization enforcement: revoke_grant
      const authDecision = authAuthority.authorize({
        institutionId: context.institutionId,
        personId: context.personId,
        role: context.role,
        action: 'revoke_grant',
        documentId,
        documentCategory: docCategory,
        documentStatus: docStatus,
      });

      if (!authDecision.allowed) {
        return reject(res, 403, 'Acesso não autorizado.', 'AUTHORIZATION_DENIED');
      }

      const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
      if (idempotencyKey === null) return res;
      const revokeRes = await revokeContentAccessGrantCommand({
        pool: docPool,
        context,
        idempotencyKey,
        authorizationAuthority: authAuthority,
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

  // 11.1. POST /api/documents/:id/retention — Governed retention assignment
  app.post(['/api/documents/:id/retention', '/api/documents/:id/retention/assign'], docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    // Enforce role authorization
    const isManager = ['admin', 'institution_admin', 'director', 'superadmin', 'system'].includes(context.role);
    if (!isManager) {
      return reject(res, 403, 'Apenas administradores podem atribuir políticas de retenção.', 'AUTHORIZATION_DENIED');
    }

    if (!retentionPolicyEngine) {
      return rejectDomainError(res, new Error('RETENTION_POLICY_ENGINE_MISSING'));
    }

    const documentId = req.params.id;
    if (!validUuid(documentId)) return reject(res, 400, 'Identificador de documento inválido.');

    const {
      versionId: rawVersionId,
      category: rawCategory,
      jurisdictionProfileId,
      purpose,
      clockTriggerEventAt: rawClockTriggerEventAt,
      policyId,
    } = req.body || {};

    if (!jurisdictionProfileId || typeof jurisdictionProfileId !== 'string' || !jurisdictionProfileId.trim()) {
      return reject(res, 400, 'jurisdictionProfileId é obrigatório e não pode ser vazio.');
    }

    if (!rawClockTriggerEventAt) {
      return reject(res, 400, 'clockTriggerEventAt é obrigatório.');
    }

    const clockTriggerEventAt = new Date(rawClockTriggerEventAt);
    if (Number.isNaN(clockTriggerEventAt.getTime())) {
      return reject(res, 400, 'clockTriggerEventAt data inválida.');
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

      let category = rawCategory;
      if (!category) {
        const dResult = await docPool.query<{ category: string }>(
          `SELECT category FROM documents
           WHERE institution_id = $1 AND id = $2`,
          [context.institutionId, documentId],
        );
        if (dResult.rows.length === 0) return reject(res, 404, 'Documento não encontrado.');
        category = dResult.rows[0].category;
      }

      const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
      if (idempotencyKey === null) return res;

      const assignRes = await assignRetentionCommand({
        pool: docPool,
        context,
        idempotencyKey,
        policyEngine: retentionPolicyEngine,
        input: {
          documentId,
          versionId,
          jurisdictionProfileId: jurisdictionProfileId.trim(),
          category,
          purpose: purpose || null,
          clockTriggerEventAt,
          policyId: policyId || undefined,
          correlationId: req.header('x-correlation-id') || null,
        },
      });

      const safeAssignment = {
        id: assignRes.result.id,
        documentId: assignRes.result.documentId,
        versionId: assignRes.result.versionId,
        policyId: assignRes.result.policyId,
        policyVersion: assignRes.result.policyVersion,
        jurisdictionProfileId: assignRes.result.jurisdictionProfileId,
        category: assignRes.result.category,
        purpose: assignRes.result.purpose,
        retainUntil: assignRes.result.retainUntil.toISOString(),
        retentionStatus: assignRes.result.retentionStatus,
        clockTriggerType: assignRes.result.clockTriggerType,
        clockTriggerEventAt: assignRes.result.clockTriggerEventAt.toISOString(),
        assignedAt: assignRes.result.assignedAt.toISOString(),
      };

      assertNoInternalSecretsInDto(safeAssignment);

      return res.status(201).json({
        success: true,
        retentionAssignment: safeAssignment,
        replayed: assignRes.replayed,
      });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 12. POST /api/documents/:id/holds — Place hold
  app.post('/api/documents/:id/holds', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const isManager = ['admin', 'institution_admin', 'director', 'superadmin', 'system'].includes(context.role);
    if (!isManager) {
      return reject(res, 403, 'Apenas administradores podem colocar bloqueios.', 'AUTHORIZATION_DENIED');
    }

    if (!retentionPolicyEngine) {
      return rejectDomainError(res, new Error('RETENTION_POLICY_ENGINE_MISSING'));
    }

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

      const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
      if (idempotencyKey === null) return res;
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

    const isManager = ['admin', 'institution_admin', 'director', 'superadmin', 'system'].includes(context.role);
    if (!isManager) {
      return reject(res, 403, 'Apenas administradores podem libertar bloqueios.', 'AUTHORIZATION_DENIED');
    }

    if (!retentionPolicyEngine) {
      return rejectDomainError(res, new Error('RETENTION_POLICY_ENGINE_MISSING'));
    }

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

      const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
      if (idempotencyKey === null) return res;
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

    const isManager = ['admin', 'institution_admin', 'director', 'superadmin', 'system'].includes(context.role);
    if (!isManager) {
      return reject(res, 403, 'Apenas administradores podem autorizar a eliminação.', 'AUTHORIZATION_DENIED');
    }

    if (!retentionPolicyEngine) {
      return rejectDomainError(res, new Error('RETENTION_POLICY_ENGINE_MISSING'));
    }

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

      const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
      if (idempotencyKey === null) return res;
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

    const isManager = ['admin', 'institution_admin', 'director', 'superadmin', 'system'].includes(context.role);
    if (!isManager) {
      return reject(res, 403, 'Apenas administradores podem executar a eliminação.', 'AUTHORIZATION_DENIED');
    }

    if (!deletionPseudonymizationKey) {
      return rejectDomainError(res, new Error('DELETION_PSEUDONYMIZATION_KEY_MISSING'));
    }
    if (!storageProvider) {
      return rejectDomainError(res, new Error('STORAGE_PROVIDER_MISSING'));
    }

    const documentId = req.params.id;
    if (!validUuid(documentId)) return reject(res, 400, 'Identificador de documento inválido.');

    const { deletionAuthorizationId } = req.body || {};
    if (!deletionAuthorizationId || !validUuid(deletionAuthorizationId)) {
      return reject(res, 400, 'deletionAuthorizationId inválido.');
    }

    try {
      const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
      if (idempotencyKey === null) return res;
      const execRes = await executeDeletionCommand({
        pool: docPool,
        context,
        idempotencyKey,
        deletionPseudonymizationKey,
        storageProvider,
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

    if (!deletionPseudonymizationKey) {
      return rejectDomainError(res, new Error('DELETION_PSEUDONYMIZATION_KEY_MISSING'));
    }
    if (!storageProvider) {
      return rejectDomainError(res, new Error('STORAGE_PROVIDER_MISSING'));
    }

    const documentId = req.params.id;
    if (!validUuid(documentId)) return reject(res, 400, 'Identificador de documento inválido.');

    const { deletionAuthorizationId } = req.body || {};
    if (!deletionAuthorizationId || !validUuid(deletionAuthorizationId)) {
      return reject(res, 400, 'deletionAuthorizationId inválido.');
    }

    try {
      const reconcileRes = await reconcileDeletionCommand({
        pool: docPool,
        context,
        deletionPseudonymizationKey,
        storageProvider,
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
