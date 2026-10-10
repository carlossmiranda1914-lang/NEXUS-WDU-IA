import type {
  DocumentRecord,
  DocumentStatus,
  DocumentVersionRecord,
  DocumentVersionStatus,
  DocumentProvenanceRecord,
  ProvenanceOriginType,
  StorageObjectReferenceRecord,
  StorageContentAvailability,
} from './document-model.ts';
import {
  validateDocumentCategory,
  validateMimeType,
  validateSha256Hash,
  validateByteSize,
} from './document-model.ts';
import type { QueryClient } from './document-audit.ts';

export interface CreateDocumentInput {
  institutionId: string;
  category: string;
  classification?: string | null;
  status?: DocumentStatus;
  createdByPersonId: string;
}

export interface CreateVersionInput {
  institutionId: string;
  documentId: string;
  mimeType: string;
  byteSize: number;
  sha256Hash: string;
  status?: DocumentVersionStatus;
  createdByPersonId: string;
  provenance: {
    originType: ProvenanceOriginType;
    actorPersonId?: string | null;
    sourceDomain: string;
    method: string;
    correlationId?: string | null;
  };
  storageReference?: {
    storageProvider: string;
    storageBucket: string;
    storageKey: string;
    contentAvailability?: StorageContentAvailability;
    unavailableReason?: string | null;
  };
}

export class PostgresDocumentRepository {
  async createDocument(client: QueryClient, input: CreateDocumentInput): Promise<DocumentRecord> {
    validateDocumentCategory(input.category);
    const status: DocumentStatus = input.status ?? 'active';

    const result = await client.query<{
      id: string;
      institution_id: string;
      category: string;
      classification: string | null;
      status: DocumentStatus;
      created_by_person_id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO documents (
        institution_id, category, classification, status, created_by_person_id
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id, institution_id, category, classification, status, created_by_person_id, created_at, updated_at`,
      [input.institutionId, input.category, input.classification ?? null, status, input.createdByPersonId],
    );

    const row = result.rows[0];
    return {
      id: row.id,
      institutionId: row.institution_id,
      category: row.category,
      classification: row.classification,
      status: row.status,
      createdByPersonId: row.created_by_person_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getDocumentById(
    client: QueryClient,
    institutionId: string,
    documentId: string,
  ): Promise<DocumentRecord | null> {
    const result = await client.query<{
      id: string;
      institution_id: string;
      category: string;
      classification: string | null;
      status: DocumentStatus;
      created_by_person_id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, institution_id, category, classification, status, created_by_person_id, created_at, updated_at
         FROM documents
        WHERE institution_id = $1 AND id = $2`,
      [institutionId, documentId],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      institutionId: row.institution_id,
      category: row.category,
      classification: row.classification,
      status: row.status,
      createdByPersonId: row.created_by_person_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async createNextVersion(
    client: QueryClient,
    input: CreateVersionInput,
  ): Promise<{
    version: DocumentVersionRecord;
    provenance: DocumentProvenanceRecord;
    storageReference?: StorageObjectReferenceRecord;
  }> {
    validateMimeType(input.mimeType);
    validateByteSize(input.byteSize);
    validateSha256Hash(input.sha256Hash);

    // 1. Lock the logical document row for update to sequence versions safely
    const docLock = await client.query<{ id: string }>(
      `SELECT id FROM documents WHERE institution_id = $1 AND id = $2 FOR UPDATE`,
      [input.institutionId, input.documentId],
    );

    if (docLock.rows.length === 0) {
      throw new Error(`Document ${input.documentId} not found in institution ${input.institutionId}`);
    }

    // 2. Determine strictly sequential next version number
    const seqResult = await client.query<{ next_version: number }>(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
         FROM document_versions
        WHERE institution_id = $1 AND document_id = $2`,
      [input.institutionId, input.documentId],
    );
    const nextVersionNumber = seqResult.rows[0].next_version;
    const versionStatus: DocumentVersionStatus = input.status ?? 'content_received';

    // 3. Insert immutable version record
    const versionResult = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_number: number;
      mime_type: string;
      byte_size: string | number;
      sha256_hash: string;
      status: DocumentVersionStatus;
      created_by_person_id: string;
      created_at: Date;
    }>(
      `INSERT INTO document_versions (
        institution_id, document_id, version_number, mime_type, byte_size, sha256_hash, status, created_by_person_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, institution_id, document_id, version_number, mime_type, byte_size, sha256_hash, status, created_by_person_id, created_at`,
      [
        input.institutionId,
        input.documentId,
        nextVersionNumber,
        input.mimeType,
        input.byteSize,
        input.sha256Hash.toLowerCase(),
        versionStatus,
        input.createdByPersonId,
      ],
    );

    const vRow = versionResult.rows[0];
    const versionRecord: DocumentVersionRecord = {
      id: vRow.id,
      institutionId: vRow.institution_id,
      documentId: vRow.document_id,
      versionNumber: vRow.version_number,
      mimeType: vRow.mime_type,
      byteSize: Number(vRow.byte_size),
      sha256Hash: vRow.sha256_hash,
      status: vRow.status,
      createdByPersonId: vRow.created_by_person_id,
      createdAt: vRow.created_at,
    };

    // 4. Insert provenance record
    const provResult = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_id: string;
      origin_type: ProvenanceOriginType;
      actor_person_id: string | null;
      source_domain: string;
      method: string;
      occurred_at: Date;
      correlation_id: string | null;
    }>(
      `INSERT INTO document_provenance (
        institution_id, document_id, version_id, origin_type, actor_person_id, source_domain, method, correlation_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, institution_id, document_id, version_id, origin_type, actor_person_id, source_domain, method, occurred_at, correlation_id`,
      [
        input.institutionId,
        input.documentId,
        versionRecord.id,
        input.provenance.originType,
        input.provenance.actorPersonId ?? null,
        input.provenance.sourceDomain,
        input.provenance.method,
        input.provenance.correlationId ?? null,
      ],
    );

    const pRow = provResult.rows[0];
    const provenanceRecord: DocumentProvenanceRecord = {
      id: pRow.id,
      institutionId: pRow.institution_id,
      documentId: pRow.document_id,
      versionId: pRow.version_id,
      originType: pRow.origin_type,
      actorPersonId: pRow.actor_person_id,
      sourceDomain: pRow.source_domain,
      method: pRow.method,
      occurredAt: pRow.occurred_at,
      correlationId: pRow.correlation_id,
    };

    // 5. Insert optional storage reference
    let storageRecord: StorageObjectReferenceRecord | undefined;
    if (input.storageReference) {
      const initialAvailability =
        input.storageReference.contentAvailability ??
        (input.status === 'available' ? 'available' : 'unknown');
      const sResult = await client.query<{
        id: string;
        institution_id: string;
        version_id: string;
        storage_provider: string;
        storage_bucket: string;
        storage_key: string;
        content_availability: StorageContentAvailability;
        last_checked_at: Date | null;
        unavailable_reason: string | null;
        created_at: Date;
      }>(
        `INSERT INTO document_storage_references (
          institution_id, version_id, storage_provider, storage_bucket, storage_key, content_availability, last_checked_at, unavailable_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, institution_id, version_id, storage_provider, storage_bucket, storage_key, content_availability, last_checked_at, unavailable_reason, created_at`,
        [
          input.institutionId,
          versionRecord.id,
          input.storageReference.storageProvider,
          input.storageReference.storageBucket,
          input.storageReference.storageKey,
          initialAvailability,
          initialAvailability === 'available' ? new Date() : null,
          input.storageReference.unavailableReason || null,
        ],
      );

      const sRow = sResult.rows[0];
      storageRecord = {
        id: sRow.id,
        institutionId: sRow.institution_id,
        versionId: sRow.version_id,
        storageProvider: sRow.storage_provider,
        storageBucket: sRow.storage_bucket,
        storageKey: sRow.storage_key,
        contentAvailability: sRow.content_availability,
        lastCheckedAt: sRow.last_checked_at,
        unavailableReason: sRow.unavailable_reason,
        createdAt: sRow.created_at,
      };
    }

    return {
      version: versionRecord,
      provenance: provenanceRecord,
      storageReference: storageRecord,
    };
  }

  async getVersion(
    client: QueryClient,
    institutionId: string,
    documentId: string,
    versionNumber: number,
  ): Promise<DocumentVersionRecord | null> {
    const result = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_number: number;
      mime_type: string;
      byte_size: string | number;
      sha256_hash: string;
      status: DocumentVersionStatus;
      created_by_person_id: string;
      created_at: Date;
    }>(
      `SELECT id, institution_id, document_id, version_number, mime_type, byte_size, sha256_hash, status, created_by_person_id, created_at
         FROM document_versions
        WHERE institution_id = $1 AND document_id = $2 AND version_number = $3`,
      [institutionId, documentId, versionNumber],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      institutionId: row.institution_id,
      documentId: row.document_id,
      versionNumber: row.version_number,
      mimeType: row.mime_type,
      byteSize: Number(row.byte_size),
      sha256Hash: row.sha256_hash,
      status: row.status,
      createdByPersonId: row.created_by_person_id,
      createdAt: row.created_at,
    };
  }

  async getVersionById(
    client: QueryClient,
    institutionId: string,
    versionId: string,
  ): Promise<DocumentVersionRecord | null> {
    const result = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_number: number;
      mime_type: string;
      byte_size: string | number;
      sha256_hash: string;
      status: DocumentVersionStatus;
      created_by_person_id: string;
      created_at: Date;
    }>(
      `SELECT id, institution_id, document_id, version_number, mime_type, byte_size, sha256_hash, status, created_by_person_id, created_at
         FROM document_versions
        WHERE institution_id = $1 AND id = $2`,
      [institutionId, versionId],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      institutionId: row.institution_id,
      documentId: row.document_id,
      versionNumber: row.version_number,
      mimeType: row.mime_type,
      byteSize: Number(row.byte_size),
      sha256Hash: row.sha256_hash,
      status: row.status,
      createdByPersonId: row.created_by_person_id,
      createdAt: row.created_at,
    };
  }

  async listVersions(
    client: QueryClient,
    institutionId: string,
    documentId: string,
  ): Promise<DocumentVersionRecord[]> {
    const result = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_number: number;
      mime_type: string;
      byte_size: string | number;
      sha256_hash: string;
      status: DocumentVersionStatus;
      created_by_person_id: string;
      created_at: Date;
    }>(
      `SELECT id, institution_id, document_id, version_number, mime_type, byte_size, sha256_hash, status, created_by_person_id, created_at
         FROM document_versions
        WHERE institution_id = $1 AND document_id = $2
        ORDER BY version_number ASC`,
      [institutionId, documentId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      institutionId: row.institution_id,
      documentId: row.document_id,
      versionNumber: row.version_number,
      mimeType: row.mime_type,
      byteSize: Number(row.byte_size),
      sha256Hash: row.sha256_hash,
      status: row.status,
      createdByPersonId: row.created_by_person_id,
      createdAt: row.created_at,
    }));
  }

  async getProvenanceForVersion(
    client: QueryClient,
    institutionId: string,
    versionId: string,
  ): Promise<DocumentProvenanceRecord[]> {
    const result = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_id: string;
      origin_type: ProvenanceOriginType;
      actor_person_id: string | null;
      source_domain: string;
      method: string;
      occurred_at: Date;
      correlation_id: string | null;
    }>(
      `SELECT id, institution_id, document_id, version_id, origin_type, actor_person_id, source_domain, method, occurred_at, correlation_id
         FROM document_provenance
        WHERE institution_id = $1 AND version_id = $2
        ORDER BY occurred_at ASC, id ASC`,
      [institutionId, versionId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      institutionId: row.institution_id,
      documentId: row.document_id,
      versionId: row.version_id,
      originType: row.origin_type,
      actorPersonId: row.actor_person_id,
      sourceDomain: row.source_domain,
      method: row.method,
      occurredAt: row.occurred_at,
      correlationId: row.correlation_id,
    }));
  }

  async getStorageReferenceForVersion(
    client: QueryClient,
    institutionId: string,
    versionId: string,
  ): Promise<StorageObjectReferenceRecord | null> {
    const result = await client.query<{
      id: string;
      institution_id: string;
      version_id: string;
      storage_provider: string;
      storage_bucket: string;
      storage_key: string;
      content_availability: StorageContentAvailability;
      last_checked_at: Date | null;
      unavailable_reason: string | null;
      created_at: Date;
    }>(
      `SELECT id, institution_id, version_id, storage_provider, storage_bucket, storage_key,
              content_availability, last_checked_at, unavailable_reason, created_at
         FROM document_storage_references
        WHERE institution_id = $1 AND version_id = $2`,
      [institutionId, versionId],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      institutionId: row.institution_id,
      versionId: row.version_id,
      storageProvider: row.storage_provider,
      storageBucket: row.storage_bucket,
      storageKey: row.storage_key,
      contentAvailability: row.content_availability,
      lastCheckedAt: row.last_checked_at,
      unavailableReason: row.unavailable_reason,
      createdAt: row.created_at,
    };
  }

  async updateStorageContentAvailability(
    client: QueryClient,
    institutionId: string,
    versionId: string,
    contentAvailability: StorageContentAvailability,
    unavailableReason?: string | null,
  ): Promise<void> {
    await client.query(
      `UPDATE document_storage_references
          SET content_availability = $1,
              last_checked_at = now(),
              unavailable_reason = $2
        WHERE institution_id = $3 AND version_id = $4`,
      [contentAvailability, unavailableReason || null, institutionId, versionId],
    );
  }
}
