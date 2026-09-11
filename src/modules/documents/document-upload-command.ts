import type { Pool, PoolClient } from 'pg';
import crypto from 'node:crypto';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import type {
  DocumentVersionRecord,
  DocumentProvenanceRecord,
  StorageObjectReferenceRecord,
  ProvenanceOriginType,
} from './document-model.ts';
import { createCanonicalDocumentsFingerprint } from './document-model.ts';
import { PostgresDocumentRepository } from './document-repository.ts';
import { PostgresDocumentAuditRepository } from './document-audit.ts';
import { PostgresDocumentOutboxRepository } from './document-event-repository.ts';
import type {
  DocumentUploadSessionRecord,
  DocumentSizePolicyConfig,
} from './document-upload-model.ts';
import {
  calculateEffectiveSizeLimit,
  sanitizeDeclaredFilename,
  validateDeclaredMimeType,
  generateOpaqueStorageKey,
  generateCsprngUploadToken,
  hashUploadToken,
  verifyUploadToken,
} from './document-upload-model.ts';
import { PostgresDocumentUploadRepository } from './document-upload-repository.ts';
import type { ObjectStorageProvider } from './object-storage-provider.ts';
import { executeIdempotentDocumentsCommand } from './document-command.ts';

export interface CreateUploadSessionCommandInput {
  documentId: string;
  targetVersionNumber?: number | null;
  declaredFilename: string;
  declaredMimeType: string;
  declaredByteSize: number;
  policyConfig: DocumentSizePolicyConfig;
  storageProvider: string;
  storageBucket: string;
  provenance?: {
    sourceDomain: string;
    method: string;
    correlationId?: string | null;
  };
}

export interface CreateUploadSessionResult {
  session: DocumentUploadSessionRecord;
  rawToken: string;
  effectiveLimit: number;
}

export interface ResumeUploadSessionCommandInput {
  sessionId: string;
  rawToken: string;
  correlationId?: string | null;
}

export interface ResumeUploadSessionResult {
  session: DocumentUploadSessionRecord;
  rawToken: string;
}

export interface CancelUploadSessionCommandInput {
  sessionId: string;
  reason?: string;
  correlationId?: string | null;
}

export interface CompleteUploadSessionCommandInput {
  sessionId: string;
  rawToken: string;
  provenance: {
    originType: ProvenanceOriginType;
    actorPersonId?: string | null;
    sourceDomain: string;
    method: string;
    correlationId?: string | null;
  };
}

export interface CompleteUploadSessionResult {
  session: DocumentUploadSessionRecord;
  version: DocumentVersionRecord;
  provenance: DocumentProvenanceRecord;
  storageReference?: StorageObjectReferenceRecord;
}

export function createUploadSessionFingerprint(
  institutionId: string,
  input: CreateUploadSessionCommandInput,
  actorPersonId: string,
): string {
  return createCanonicalDocumentsFingerprint({
    institutionId,
    documentId: input.documentId,
    targetVersionNumber: input.targetVersionNumber ?? null,
    declaredFilename: input.declaredFilename,
    declaredMimeType: input.declaredMimeType,
    declaredByteSize: input.declaredByteSize,
    storageProvider: input.storageProvider,
    storageBucket: input.storageBucket,
    actorPersonId,
    provenance: {
      sourceDomain: input.provenance?.sourceDomain ?? 'documents.upload',
      method: input.provenance?.method ?? 'create_session',
      correlationId: input.provenance?.correlationId ?? null,
    },
  });
}

export function resumeUploadSessionFingerprint(
  institutionId: string,
  input: ResumeUploadSessionCommandInput,
  actorPersonId: string,
): string {
  return createCanonicalDocumentsFingerprint({
    institutionId,
    sessionId: input.sessionId,
    actorPersonId,
    correlationId: input.correlationId ?? null,
  });
}

export function cancelUploadSessionFingerprint(
  institutionId: string,
  input: CancelUploadSessionCommandInput,
  actorPersonId: string,
): string {
  return createCanonicalDocumentsFingerprint({
    institutionId,
    sessionId: input.sessionId,
    reason: input.reason ?? null,
    actorPersonId,
    correlationId: input.correlationId ?? null,
  });
}

export function completeUploadSessionFingerprint(
  institutionId: string,
  input: CompleteUploadSessionCommandInput,
  actorPersonId: string,
): string {
  return createCanonicalDocumentsFingerprint({
    institutionId,
    sessionId: input.sessionId,
    actorPersonId,
    provenance: {
      originType: input.provenance.originType,
      actorPersonId: input.provenance.actorPersonId ?? null,
      sourceDomain: input.provenance.sourceDomain,
      method: input.provenance.method,
      correlationId: input.provenance.correlationId ?? null,
    },
  });
}

export async function createUploadSessionCommand(input: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  input: CreateUploadSessionCommandInput;
}): Promise<{ replayed: boolean; result: CreateUploadSessionResult }> {
  const { pool, context, idempotencyKey, input: cmdInput } = input;

  // 1. Evaluate file size policy - FAIL CLOSED if global limit missing
  const effectiveLimit = calculateEffectiveSizeLimit(cmdInput.policyConfig);
  if (cmdInput.declaredByteSize <= 0) {
    throw new Error('declaredByteSize must be greater than 0.');
  }
  if (cmdInput.declaredByteSize > effectiveLimit) {
    throw new Error(
      `DECLARED_SIZE_EXCEEDS_POLICY: Declared byte size (${cmdInput.declaredByteSize}) exceeds effective limit (${effectiveLimit}).`,
    );
  }

  // 2. Validate declared metadata
  const sanitizedFilename = sanitizeDeclaredFilename(cmdInput.declaredFilename);
  validateDeclaredMimeType(cmdInput.declaredMimeType);

  const canonicalFingerprint = createUploadSessionFingerprint(
    context.institutionId,
    cmdInput,
    context.personId,
  );

  const docRepo = new PostgresDocumentRepository();
  const uploadRepo = new PostgresDocumentUploadRepository();
  const auditRepo = new PostgresDocumentAuditRepository();

  return executeIdempotentDocumentsCommand({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.create_upload_session',
      idempotencyKey,
      canonicalFingerprint,
    },
    execute: async (client) => {
      // Confirm document exists in institution
      const doc = await docRepo.getDocumentById(client, context.institutionId, cmdInput.documentId);
      if (!doc) {
        throw new Error(
          `Document ${cmdInput.documentId} not found in institution ${context.institutionId}`,
        );
      }

      // Generate session IDs and storage key
      const sessionId = crypto.randomUUID();
      const objectId = crypto.randomUUID();
      const storageKey = generateOpaqueStorageKey({
        institutionId: context.institutionId,
        documentId: cmdInput.documentId,
        sessionId,
        objectId,
      });

      // Generate CSPRNG raw token and SHA-256 hash
      const rawToken = generateCsprngUploadToken();
      const tokenHash = hashUploadToken(rawToken);

      const now = new Date();
      const authorizedUntil = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      // Insert upload session with predetermined ID
      const insertResult = await client.query<{
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
        completed_version_id: string | null;
        created_by_person_id: string;
        created_at: Date;
        updated_at: Date;
      }>(
        `INSERT INTO document_upload_sessions (
          id, institution_id, document_id, target_version_number, declared_filename, declared_mime_type, declared_byte_size,
          storage_provider, storage_bucket, storage_key, status, upload_token_hash, authorized_until, expires_at, created_by_person_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'authorized', $11, $12, $13, $14)
        RETURNING id, institution_id, document_id, target_version_number, declared_filename, declared_mime_type, declared_byte_size,
                  storage_provider, storage_bucket, storage_key, status, upload_token_hash, authorized_until, expires_at,
                  completed_version_id, created_by_person_id, created_at, updated_at`,
        [
          sessionId,
          context.institutionId,
          cmdInput.documentId,
          cmdInput.targetVersionNumber ?? null,
          sanitizedFilename,
          cmdInput.declaredMimeType,
          cmdInput.declaredByteSize,
          cmdInput.storageProvider,
          cmdInput.storageBucket,
          storageKey,
          tokenHash,
          authorizedUntil,
          expiresAt,
          context.personId,
        ],
      );

      const row = insertResult.rows[0];
      const sessionRecord: DocumentUploadSessionRecord = {
        id: row.id,
        institutionId: row.institution_id,
        documentId: row.document_id,
        targetVersionNumber: row.target_version_number,
        declaredFilename: row.declared_filename,
        declaredMimeType: row.declared_mime_type,
        declaredByteSize: Number(row.declared_byte_size),
        storageProvider: row.storage_provider,
        storageBucket: row.storage_bucket,
        storageKey: row.storage_key,
        status: row.status as any,
        uploadTokenHash: row.upload_token_hash,
        authorizedUntil: row.authorized_until,
        expiresAt: row.expires_at,
        completedVersionId: row.completed_version_id,
        createdByPersonId: row.created_by_person_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };

      // Record audit event (NEVER include rawToken or tokenHash in audit details)
      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: doc.id,
        actorPersonId: context.personId,
        action: 'document.upload_session_created',
        outcome: 'success',
        correlationId: cmdInput.provenance?.correlationId,
        details: {
          sessionId: sessionRecord.id,
          documentId: sessionRecord.documentId,
          declaredFilename: sessionRecord.declaredFilename,
          declaredMimeType: sessionRecord.declaredMimeType,
          declaredByteSize: sessionRecord.declaredByteSize,
          authorizedUntil: sessionRecord.authorizedUntil.toISOString(),
          expiresAt: sessionRecord.expiresAt.toISOString(),
          storageProvider: sessionRecord.storageProvider,
          storageBucket: sessionRecord.storageBucket,
        },
      });

      return {
        resultRef: sessionRecord.id,
        result: {
          session: sessionRecord,
          rawToken,
          effectiveLimit,
        },
      };
    },
    loadResult: async (client, resultRef) => {
      const session = await uploadRepo.getSessionById(client, context.institutionId, resultRef);
      if (!session) throw new Error('Persisted upload session missing on replay');

      const now = new Date();
      if (
        session.status === 'completed' ||
        session.status === 'cancelled' ||
        session.status === 'failed' ||
        session.status === 'expired' ||
        now > session.expiresAt
      ) {
        return {
          session,
          rawToken: '[TERMINAL_SESSION_UNUSABLE]',
          effectiveLimit,
        };
      }

      // Idempotent replay credential recovery protocol:
      // Emit a fresh CSPRNG token, atomically rotate the token hash in DB, and invalidate any prior lost token
      const freshRawToken = generateCsprngUploadToken();
      const freshTokenHash = hashUploadToken(freshRawToken);
      const newAuthorizedUntil = new Date(
        Math.min(now.getTime() + 15 * 60 * 1000, session.expiresAt.getTime()),
      );

      const refreshedSession = await uploadRepo.rotateSessionToken(
        client,
        context.institutionId,
        session.id,
        freshTokenHash,
        newAuthorizedUntil,
      );

      return {
        session: refreshedSession,
        rawToken: freshRawToken,
        effectiveLimit,
      };
    },
  });
}

export async function resumeUploadSessionCommand(input: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  input: ResumeUploadSessionCommandInput;
}): Promise<{ replayed: boolean; result: ResumeUploadSessionResult }> {
  const { pool, context, idempotencyKey, input: resumeInput } = input;
  const canonicalFingerprint = resumeUploadSessionFingerprint(
    context.institutionId,
    resumeInput,
    context.personId,
  );

  const uploadRepo = new PostgresDocumentUploadRepository();
  const auditRepo = new PostgresDocumentAuditRepository();

  return executeIdempotentDocumentsCommand({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.resume_upload_session',
      idempotencyKey,
      canonicalFingerprint,
    },
    execute: async (client) => {
      // 1. Lock session row for update
      const lockResult = await client.query<{
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
        completed_version_id: string | null;
        created_by_person_id: string;
        created_at: Date;
        updated_at: Date;
      }>(
        `SELECT id, institution_id, document_id, target_version_number, declared_filename, declared_mime_type, declared_byte_size,
                storage_provider, storage_bucket, storage_key, status, upload_token_hash, authorized_until, expires_at,
                completed_version_id, created_by_person_id, created_at, updated_at
           FROM document_upload_sessions
          WHERE institution_id = $1 AND id = $2
          FOR UPDATE`,
        [context.institutionId, resumeInput.sessionId],
      );

      if (lockResult.rows.length === 0) {
        throw new Error(
          `Upload session ${resumeInput.sessionId} not found in institution ${context.institutionId}`,
        );
      }

      const row = lockResult.rows[0];
      const now = new Date();

      // 2. Terminal state checks
      if (row.status === 'cancelled') {
        throw new Error('RESUME_CANCELLED_DENIED: Cancelled upload session cannot be resumed.');
      }
      if (row.status === 'completed') {
        throw new Error('RESUME_COMPLETED_DENIED: Completed upload session cannot be resumed.');
      }
      if (row.status === 'failed') {
        throw new Error('RESUME_FAILED_DENIED: Failed upload session cannot be resumed.');
      }
      if (row.status === 'expired' || now > new Date(row.expires_at)) {
        throw new Error('RESUME_EXPIRED_DENIED: Expired upload session cannot be resumed.');
      }

      // 3. Verify previous token
      const isTokenValid = verifyUploadToken(resumeInput.rawToken, row.upload_token_hash);
      if (!isTokenValid) {
        throw new Error('INVALID_UPLOAD_TOKEN: Provided upload authorization token does not match session.');
      }

      // 4. Rotate token: generate new raw token and new token hash
      const newRawToken = generateCsprngUploadToken();
      const newTokenHash = hashUploadToken(newRawToken);

      // 5. Calculate new authorization window
      const sessionExpiresAt = new Date(row.expires_at);
      const newAuthorizedUntil = new Date(
        Math.min(now.getTime() + 15 * 60 * 1000, sessionExpiresAt.getTime()),
      );

      const updatedSession = await uploadRepo.rotateSessionToken(
        client,
        context.institutionId,
        resumeInput.sessionId,
        newTokenHash,
        newAuthorizedUntil,
      );

      // 6. Record audit event (NEVER rawToken or tokenHash in details)
      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: updatedSession.documentId,
        actorPersonId: context.personId,
        action: 'document.upload_session_resumed',
        outcome: 'success',
        correlationId: resumeInput.correlationId,
        details: {
          sessionId: updatedSession.id,
          authorizedUntil: updatedSession.authorizedUntil.toISOString(),
          expiresAt: updatedSession.expiresAt.toISOString(),
        },
      });

      return {
        resultRef: updatedSession.id,
        result: {
          session: updatedSession,
          rawToken: newRawToken,
        },
      };
    },
    loadResult: async (client, resultRef) => {
      const session = await uploadRepo.getSessionById(client, context.institutionId, resultRef);
      if (!session) throw new Error('Persisted upload session missing on replay');

      const now = new Date();
      if (
        session.status === 'completed' ||
        session.status === 'cancelled' ||
        session.status === 'failed' ||
        session.status === 'expired' ||
        now > session.expiresAt
      ) {
        return {
          session,
          rawToken: '[TERMINAL_SESSION_UNUSABLE]',
        };
      }

      // Idempotent replay credential recovery protocol:
      // Emit a fresh CSPRNG token, atomically rotate the token hash in DB, and invalidate any prior lost token
      const freshRawToken = generateCsprngUploadToken();
      const freshTokenHash = hashUploadToken(freshRawToken);
      const newAuthorizedUntil = new Date(
        Math.min(now.getTime() + 15 * 60 * 1000, session.expiresAt.getTime()),
      );

      const refreshedSession = await uploadRepo.rotateSessionToken(
        client,
        context.institutionId,
        session.id,
        freshTokenHash,
        newAuthorizedUntil,
      );

      return {
        session: refreshedSession,
        rawToken: freshRawToken,
      };
    },
  });
}

export async function cancelUploadSessionCommand(input: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  input: CancelUploadSessionCommandInput;
}): Promise<{ replayed: boolean; result: DocumentUploadSessionRecord }> {
  const { pool, context, idempotencyKey, input: cancelInput } = input;
  const canonicalFingerprint = cancelUploadSessionFingerprint(
    context.institutionId,
    cancelInput,
    context.personId,
  );

  const uploadRepo = new PostgresDocumentUploadRepository();
  const auditRepo = new PostgresDocumentAuditRepository();

  return executeIdempotentDocumentsCommand({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.cancel_upload_session',
      idempotencyKey,
      canonicalFingerprint,
    },
    execute: async (client) => {
      // 1. Lock session row for update
      const session = await client.query<{
        id: string;
        institution_id: string;
        document_id: string;
        status: string;
      }>(
        `SELECT id, institution_id, document_id, status
           FROM document_upload_sessions
          WHERE institution_id = $1 AND id = $2
          FOR UPDATE`,
        [context.institutionId, cancelInput.sessionId],
      );

      if (session.rows.length === 0) {
        throw new Error(
          `Upload session ${cancelInput.sessionId} not found in institution ${context.institutionId}`,
        );
      }

      const currentStatus = session.rows[0].status;
      if (currentStatus === 'completed') {
        throw new Error('CANCEL_COMPLETED_DENIED: Completed upload session cannot be cancelled.');
      }
      if (currentStatus === 'cancelled') {
        const existing = await uploadRepo.getSessionById(client, context.institutionId, cancelInput.sessionId);
        return { resultRef: cancelInput.sessionId, result: existing! };
      }

      const updated = await uploadRepo.transitionSessionStatus(
        client,
        context.institutionId,
        cancelInput.sessionId,
        'cancelled',
      );

      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: updated.documentId,
        actorPersonId: context.personId,
        action: 'document.upload_session_cancelled',
        outcome: 'success',
        correlationId: cancelInput.correlationId,
        details: {
          sessionId: updated.id,
          reason: cancelInput.reason ?? null,
        },
      });

      return {
        resultRef: updated.id,
        result: updated,
      };
    },
    loadResult: async (client, resultRef) => {
      const session = await uploadRepo.getSessionById(client, context.institutionId, resultRef);
      if (!session) throw new Error('Persisted upload session missing on replay');
      return session;
    },
  });
}

export async function completeUploadSessionCommand(input: {
  pool: Pool;
  context: InstitutionalContext;
  storageProvider: ObjectStorageProvider;
  idempotencyKey: string;
  input: CompleteUploadSessionCommandInput;
}): Promise<{ replayed: boolean; result: CompleteUploadSessionResult }> {
  const { pool, context, storageProvider, idempotencyKey, input: completeInput } = input;
  const canonicalFingerprint = completeUploadSessionFingerprint(
    context.institutionId,
    completeInput,
    context.personId,
  );

  const docRepo = new PostgresDocumentRepository();
  const uploadRepo = new PostgresDocumentUploadRepository();
  const auditRepo = new PostgresDocumentAuditRepository();
  const outboxRepo = new PostgresDocumentOutboxRepository();

  return executeIdempotentDocumentsCommand({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.complete_upload_session',
      idempotencyKey,
      canonicalFingerprint,
    },
    execute: async (client) => {
      // 1. Lock session row for update
      const sessionResult = await client.query<{
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
        completed_version_id: string | null;
        created_by_person_id: string;
        created_at: Date;
        updated_at: Date;
      }>(
        `SELECT id, institution_id, document_id, target_version_number, declared_filename, declared_mime_type, declared_byte_size,
                storage_provider, storage_bucket, storage_key, status, upload_token_hash, authorized_until, expires_at,
                completed_version_id, created_by_person_id, created_at, updated_at
           FROM document_upload_sessions
          WHERE institution_id = $1 AND id = $2
          FOR UPDATE`,
        [context.institutionId, completeInput.sessionId],
      );

      if (sessionResult.rows.length === 0) {
        throw new Error(
          `Upload session ${completeInput.sessionId} not found in institution ${context.institutionId}`,
        );
      }

      const row = sessionResult.rows[0];
      const now = new Date();

      // 2. Handle double completion idempotency under lock
      if (row.status === 'completed' && row.completed_version_id) {
        const completedSession: DocumentUploadSessionRecord = {
          id: row.id,
          institutionId: row.institution_id,
          documentId: row.document_id,
          targetVersionNumber: row.target_version_number,
          declaredFilename: row.declared_filename,
          declaredMimeType: row.declared_mime_type,
          declaredByteSize: Number(row.declared_byte_size),
          storageProvider: row.storage_provider,
          storageBucket: row.storage_bucket,
          storageKey: row.storage_key,
          status: row.status as any,
          uploadTokenHash: row.upload_token_hash,
          authorizedUntil: row.authorized_until,
          expiresAt: row.expires_at,
          completedVersionId: row.completed_version_id,
          createdByPersonId: row.created_by_person_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };

        const version = await docRepo.getVersionById(client, context.institutionId, row.completed_version_id);
        if (!version) throw new Error('Persisted version missing on double completion');
        const provenance = await docRepo.getProvenanceForVersion(client, context.institutionId, row.completed_version_id);
        const storageReference = await docRepo.getStorageReferenceForVersion(client, context.institutionId, row.completed_version_id);

        return {
          resultRef: `${completedSession.id}:${row.completed_version_id}`,
          result: {
            session: completedSession,
            version,
            provenance: provenance[0],
            storageReference: storageReference ?? undefined,
          },
        };
      }

      // 3. Status checks
      if (row.status === 'cancelled') {
        throw new Error('UPLOAD_SESSION_CANCELLED: Cannot complete cancelled upload session.');
      }
      if (row.status === 'failed') {
        throw new Error('UPLOAD_SESSION_FAILED: Cannot complete failed upload session.');
      }
      if (row.status === 'expired' || now > new Date(row.expires_at)) {
        throw new Error('UPLOAD_SESSION_EXPIRED: Cannot complete expired upload session.');
      }
      if (now > new Date(row.authorized_until)) {
        throw new Error(
          'UPLOAD_AUTHORIZATION_EXPIRED: Upload authorization window has expired. Please resume session to obtain a new authorization window.',
        );
      }

      // 4. Verify token
      const isTokenValid = verifyUploadToken(completeInput.rawToken, row.upload_token_hash);
      if (!isTokenValid) {
        throw new Error('INVALID_UPLOAD_TOKEN: Provided upload authorization token does not match session.');
      }

      // 5. Query object storage provider for object presence and authoritative metadata
      const head = await storageProvider.headObject({
        storageBucket: row.storage_bucket,
        storageKey: row.storage_key,
      });

      if (!head.exists) {
        throw new Error(
          `STORAGE_OBJECT_NOT_FOUND: Uploaded object not found in storage bucket "${row.storage_bucket}" at key "${row.storage_key}".`,
        );
      }

      const authoritativeByteSize = head.byteSize;
      const authoritativeSha256Hash = head.sha256Hash;
      const authoritativeMimeType = head.mimeType || row.declared_mime_type;

      // 6. Create next DocumentVersion in document repository (status MUST be 'content_received')
      const { version, provenance, storageReference } = await docRepo.createNextVersion(client, {
        institutionId: context.institutionId,
        documentId: row.document_id,
        mimeType: authoritativeMimeType,
        byteSize: authoritativeByteSize,
        sha256Hash: authoritativeSha256Hash,
        status: 'content_received', // Strictly content_received, never available
        createdByPersonId: context.personId,
        provenance: {
          originType: completeInput.provenance.originType,
          actorPersonId: completeInput.provenance.actorPersonId ?? context.personId,
          sourceDomain: completeInput.provenance.sourceDomain,
          method: completeInput.provenance.method,
          correlationId: completeInput.provenance.correlationId,
        },
        storageReference: {
          storageProvider: row.storage_provider,
          storageBucket: row.storage_bucket,
          storageKey: row.storage_key,
        },
      });

      // 7. Mark upload session as COMPLETED and link to completed version
      const completedSession = await uploadRepo.completeSessionWithVersion(
        client,
        context.institutionId,
        row.id,
        version.id,
      );

      // 8. Record audit event
      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: row.document_id,
        versionId: version.id,
        actorPersonId: context.personId,
        action: 'document.upload_completed',
        outcome: 'success',
        correlationId: completeInput.provenance.correlationId,
        details: {
          sessionId: completedSession.id,
          versionId: version.id,
          versionNumber: version.versionNumber,
          versionStatus: version.status,
          byteSize: version.byteSize,
          sha256Hash: version.sha256Hash,
          storageProvider: completedSession.storageProvider,
          storageBucket: completedSession.storageBucket,
          storageKey: completedSession.storageKey,
        },
      });

      // 9. Record outbox event intent inside same transaction
      await outboxRepo.insertEvent(client, {
        institutionId: context.institutionId,
        eventType: 'document.upload_completed',
        aggregateType: 'document',
        aggregateId: row.document_id,
        actorPersonId: context.personId,
        actorKind: 'user',
        correlationId: completeInput.provenance.correlationId ?? null,
        causationId: completedSession.id,
        payload: {
          documentId: row.document_id,
          versionId: version.id,
          versionNumber: version.versionNumber,
          mimeType: version.mimeType,
          byteSize: version.byteSize,
          sha256Hash: version.sha256Hash,
          sessionId: completedSession.id,
          storageProvider: completedSession.storageProvider,
          storageBucket: completedSession.storageBucket,
          storageKey: completedSession.storageKey,
        },
      });

      return {
        resultRef: `${completedSession.id}:${version.id}`,
        result: {
          session: completedSession,
          version,
          provenance,
          storageReference,
        },
      };
    },
    loadResult: async (client, resultRef) => {
      const [sessionId, versionId] = resultRef.split(':');
      const session = await uploadRepo.getSessionById(client, context.institutionId, sessionId);
      if (!session) throw new Error('Persisted session missing on replay');
      const version = await docRepo.getVersionById(client, context.institutionId, versionId);
      if (!version) throw new Error('Persisted version missing on replay');
      const provenance = await docRepo.getProvenanceForVersion(client, context.institutionId, versionId);
      const storageReference = await docRepo.getStorageReferenceForVersion(client, context.institutionId, versionId);

      return {
        session,
        version,
        provenance: provenance[0],
        storageReference: storageReference ?? undefined,
      };
    },
  });
}
