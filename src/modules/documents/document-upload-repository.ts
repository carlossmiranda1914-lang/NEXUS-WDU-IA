import type { QueryClient } from './document-audit.ts';
import type {
  DocumentUploadSessionRecord,
  UploadSessionStatus,
} from './document-upload-model.ts';
import {
  sanitizeDeclaredFilename,
  validateDeclaredMimeType,
  validateDeclaredByteSize,
  validateUploadSessionTransition,
} from './document-upload-model.ts';

export interface CreateUploadSessionInput {
  institutionId: string;
  documentId: string;
  targetVersionNumber?: number | null;
  declaredFilename: string;
  declaredMimeType: string;
  declaredByteSize: number;
  storageProvider: string;
  storageBucket: string;
  storageKey: string;
  uploadTokenHash: string;
  authorizedUntil: Date;
  expiresAt: Date;
  createdByPersonId: string;
}

export class PostgresDocumentUploadRepository {
  async createUploadSession(
    client: QueryClient,
    input: CreateUploadSessionInput,
  ): Promise<DocumentUploadSessionRecord> {
    const cleanFilename = sanitizeDeclaredFilename(input.declaredFilename);
    validateDeclaredMimeType(input.declaredMimeType);
    validateDeclaredByteSize(input.declaredByteSize);

    const result = await client.query<{
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
      status: UploadSessionStatus;
      upload_token_hash: string;
      authorized_until: Date;
      expires_at: Date;
      completed_version_id: string | null;
      created_by_person_id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO document_upload_sessions (
        institution_id, document_id, target_version_number, declared_filename, declared_mime_type, declared_byte_size,
        storage_provider, storage_bucket, storage_key, status, upload_token_hash, authorized_until, expires_at, created_by_person_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'authorized', $10, $11, $12, $13)
      RETURNING id, institution_id, document_id, target_version_number, declared_filename, declared_mime_type, declared_byte_size,
                storage_provider, storage_bucket, storage_key, status, upload_token_hash, authorized_until, expires_at,
                completed_version_id, created_by_person_id, created_at, updated_at`,
      [
        input.institutionId,
        input.documentId,
        input.targetVersionNumber ?? null,
        cleanFilename,
        input.declaredMimeType,
        input.declaredByteSize,
        input.storageProvider,
        input.storageBucket,
        input.storageKey,
        input.uploadTokenHash,
        input.authorizedUntil,
        input.expiresAt,
        input.createdByPersonId,
      ],
    );

    const row = result.rows[0];
    return {
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
      status: row.status,
      uploadTokenHash: row.upload_token_hash,
      authorizedUntil: row.authorized_until,
      expiresAt: row.expires_at,
      completedVersionId: row.completed_version_id,
      createdByPersonId: row.created_by_person_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getSessionById(
    client: QueryClient,
    institutionId: string,
    sessionId: string,
  ): Promise<DocumentUploadSessionRecord | null> {
    const result = await client.query<{
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
      status: UploadSessionStatus;
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
        WHERE institution_id = $1 AND id = $2`,
      [institutionId, sessionId],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
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
      status: row.status,
      uploadTokenHash: row.upload_token_hash,
      authorizedUntil: row.authorized_until,
      expiresAt: row.expires_at,
      completedVersionId: row.completed_version_id,
      createdByPersonId: row.created_by_person_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async rotateSessionToken(
    client: QueryClient,
    institutionId: string,
    sessionId: string,
    newTokenHash: string,
    newAuthorizedUntil: Date,
  ): Promise<DocumentUploadSessionRecord> {
    const result = await client.query<{
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
      status: UploadSessionStatus;
      upload_token_hash: string;
      authorized_until: Date;
      expires_at: Date;
      completed_version_id: string | null;
      created_by_person_id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE document_upload_sessions
          SET upload_token_hash = $3,
              authorized_until = $4,
              status = 'authorized',
              updated_at = now()
        WHERE institution_id = $1 AND id = $2
        RETURNING id, institution_id, document_id, target_version_number, declared_filename, declared_mime_type, declared_byte_size,
                  storage_provider, storage_bucket, storage_key, status, upload_token_hash, authorized_until, expires_at,
                  completed_version_id, created_by_person_id, created_at, updated_at`,
      [institutionId, sessionId, newTokenHash, newAuthorizedUntil],
    );

    if (result.rows.length === 0) {
      throw new Error(`Upload session ${sessionId} not found for token rotation.`);
    }

    const row = result.rows[0];
    return {
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
      status: row.status,
      uploadTokenHash: row.upload_token_hash,
      authorizedUntil: row.authorized_until,
      expiresAt: row.expires_at,
      completedVersionId: row.completed_version_id,
      createdByPersonId: row.created_by_person_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async transitionSessionStatus(
    client: QueryClient,
    institutionId: string,
    sessionId: string,
    targetStatus: UploadSessionStatus,
  ): Promise<DocumentUploadSessionRecord> {
    const current = await this.getSessionById(client, institutionId, sessionId);
    if (!current) {
      throw new Error(`Upload session ${sessionId} not found in institution ${institutionId}`);
    }

    validateUploadSessionTransition(current.status, targetStatus);

    const result = await client.query<{
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
      status: UploadSessionStatus;
      upload_token_hash: string;
      authorized_until: Date;
      expires_at: Date;
      completed_version_id: string | null;
      created_by_person_id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE document_upload_sessions
          SET status = $3,
              updated_at = now()
        WHERE institution_id = $1 AND id = $2
        RETURNING id, institution_id, document_id, target_version_number, declared_filename, declared_mime_type, declared_byte_size,
                  storage_provider, storage_bucket, storage_key, status, upload_token_hash, authorized_until, expires_at,
                  completed_version_id, created_by_person_id, created_at, updated_at`,
      [institutionId, sessionId, targetStatus],
    );

    const row = result.rows[0];
    return {
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
      status: row.status,
      uploadTokenHash: row.upload_token_hash,
      authorizedUntil: row.authorized_until,
      expiresAt: row.expires_at,
      completedVersionId: row.completed_version_id,
      createdByPersonId: row.created_by_person_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async completeSessionWithVersion(
    client: QueryClient,
    institutionId: string,
    sessionId: string,
    completedVersionId: string,
  ): Promise<DocumentUploadSessionRecord> {
    const result = await client.query<{
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
      status: UploadSessionStatus;
      upload_token_hash: string;
      authorized_until: Date;
      expires_at: Date;
      completed_version_id: string | null;
      created_by_person_id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE document_upload_sessions
          SET status = 'completed',
              completed_version_id = $3,
              updated_at = now()
        WHERE institution_id = $1 AND id = $2 AND status IN ('authorized', 'uploading')
        RETURNING id, institution_id, document_id, target_version_number, declared_filename, declared_mime_type, declared_byte_size,
                  storage_provider, storage_bucket, storage_key, status, upload_token_hash, authorized_until, expires_at,
                  completed_version_id, created_by_person_id, created_at, updated_at`,
      [institutionId, sessionId, completedVersionId],
    );

    if (result.rows.length === 0) {
      throw new Error(`Upload session ${sessionId} cannot be completed (invalid status or not found).`);
    }

    const row = result.rows[0];
    return {
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
      status: row.status,
      uploadTokenHash: row.upload_token_hash,
      authorizedUntil: row.authorized_until,
      expiresAt: row.expires_at,
      completedVersionId: row.completed_version_id,
      createdByPersonId: row.created_by_person_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listSessionsForDocument(
    client: QueryClient,
    institutionId: string,
    documentId: string,
  ): Promise<DocumentUploadSessionRecord[]> {
    const result = await client.query<{
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
      status: UploadSessionStatus;
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
        WHERE institution_id = $1 AND document_id = $2
        ORDER BY created_at DESC, id DESC`,
      [institutionId, documentId],
    );

    return result.rows.map((row) => ({
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
      status: row.status,
      uploadTokenHash: row.upload_token_hash,
      authorizedUntil: row.authorized_until,
      expiresAt: row.expires_at,
      completedVersionId: row.completed_version_id,
      createdByPersonId: row.created_by_person_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}
