import type { Pool, PoolClient } from 'pg';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import type {
  DocumentRecord,
  DocumentVersionRecord,
  DocumentProvenanceRecord,
  StorageObjectReferenceRecord,
  ProvenanceOriginType,
} from './document-model.ts';
import { createCanonicalDocumentsFingerprint } from './document-model.ts';
import {
  PostgresDocumentRepository,
} from './document-repository.ts';
import {
  PostgresDocumentAuditRepository,
} from './document-audit.ts';
import {
  PostgresDocumentOutboxRepository,
} from './document-event-repository.ts';

export interface DocumentsCommandIdentity {
  institutionId: string;
  commandScope: string;
  idempotencyKey: string;
  canonicalFingerprint: string;
}

export interface CreateDocumentWithVersionInput {
  category: string;
  classification?: string | null;
  mimeType: string;
  byteSize: number;
  sha256Hash: string;
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
  };
}

export interface AppendDocumentVersionInput {
  documentId: string;
  mimeType: string;
  byteSize: number;
  sha256Hash: string;
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
  };
}

export interface DocumentCreationResult {
  document: DocumentRecord;
  version: DocumentVersionRecord;
  provenance: DocumentProvenanceRecord;
  storageReference?: StorageObjectReferenceRecord;
}

export interface VersionCreationResult {
  version: DocumentVersionRecord;
  provenance: DocumentProvenanceRecord;
  storageReference?: StorageObjectReferenceRecord;
}

export function createDocumentCreationFingerprint(
  institutionId: string,
  input: CreateDocumentWithVersionInput,
  actorPersonId: string,
): string {
  return createCanonicalDocumentsFingerprint({
    institutionId,
    category: input.category,
    classification: input.classification ?? null,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    sha256Hash: input.sha256Hash.toLowerCase(),
    actorPersonId,
    provenance: {
      originType: input.provenance.originType,
      actorPersonId: input.provenance.actorPersonId ?? null,
      sourceDomain: input.provenance.sourceDomain,
      method: input.provenance.method,
      correlationId: input.provenance.correlationId ?? null,
    },
    storageReference: input.storageReference
      ? {
          storageProvider: input.storageReference.storageProvider,
          storageBucket: input.storageReference.storageBucket,
          storageKey: input.storageReference.storageKey,
        }
      : null,
  });
}

export function createAppendVersionFingerprint(
  institutionId: string,
  input: AppendDocumentVersionInput,
  actorPersonId: string,
): string {
  return createCanonicalDocumentsFingerprint({
    institutionId,
    documentId: input.documentId,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    sha256Hash: input.sha256Hash.toLowerCase(),
    actorPersonId,
    provenance: {
      originType: input.provenance.originType,
      actorPersonId: input.provenance.actorPersonId ?? null,
      sourceDomain: input.provenance.sourceDomain,
      method: input.provenance.method,
      correlationId: input.provenance.correlationId ?? null,
    },
    storageReference: input.storageReference
      ? {
          storageProvider: input.storageReference.storageProvider,
          storageBucket: input.storageReference.storageBucket,
          storageKey: input.storageReference.storageKey,
        }
      : null,
  });
}

export async function executeIdempotentDocumentsCommand<T>(input: {
  pool: Pool;
  context: InstitutionalContext;
  identity: DocumentsCommandIdentity;
  execute: (client: PoolClient) => Promise<{ resultRef: string; result: T }>;
  loadResult: (client: PoolClient, resultRef: string) => Promise<T>;
}): Promise<{ replayed: boolean; result: T }> {
  const { pool, context, identity, execute, loadResult } = input;

  if (context.institutionId !== identity.institutionId) {
    throw new Error('InstitutionalContext mismatch: caller is not authorized for target institution.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Transactional advisory lock serialized on (institutionId, commandScope, idempotencyKey)
    const lockKey = `${identity.institutionId}:${identity.commandScope}:${identity.idempotencyKey}`;
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey]);

    // 2. Check for existing idempotency record
    const existing = await client.query<{
      request_fingerprint: string;
      result_ref: string;
      status: string;
    }>(
      `SELECT request_fingerprint, result_ref, status
         FROM document_idempotency_records
        WHERE institution_id = $1 AND command_scope = $2 AND idempotency_key = $3
        FOR UPDATE`,
      [identity.institutionId, identity.commandScope, identity.idempotencyKey],
    );

    if (existing.rows.length > 0) {
      const record = existing.rows[0];
      if (record.request_fingerprint !== identity.canonicalFingerprint) {
        throw new Error(
          `IDEMPOTENCY_CONFLICT: Key "${identity.idempotencyKey}" was already used with a different request payload.`,
        );
      }

      const result = await loadResult(client, record.result_ref);
      await client.query('COMMIT');
      return { replayed: true, result };
    }

    // 3. Execute domain action within transaction
    let executionResult: { resultRef: string; result: T };
    try {
      executionResult = await execute(client);
    } catch (execError) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw execError;
    }

    // 4. Record idempotency ledger
    try {
      await client.query(
        `INSERT INTO document_idempotency_records (
          institution_id, command_scope, idempotency_key, request_fingerprint, result_ref, status
        ) VALUES ($1, $2, $3, $4, $5, 'completed')`,
        [
          identity.institutionId,
          identity.commandScope,
          identity.idempotencyKey,
          identity.canonicalFingerprint,
          executionResult.resultRef,
        ],
      );

      await client.query('COMMIT');
      return { replayed: false, result: executionResult.result };
    } catch (insertError: any) {
      // Fallback in case of unique constraint race
      await client.query('ROLLBACK').catch(() => undefined);

      if (insertError?.code === '23505') {
        // Query committed record in new read transaction
        const fallbackClient = await pool.connect();
        try {
          const fallbackQuery = await fallbackClient.query<{
            request_fingerprint: string;
            result_ref: string;
          }>(
            `SELECT request_fingerprint, result_ref
               FROM document_idempotency_records
              WHERE institution_id = $1 AND command_scope = $2 AND idempotency_key = $3`,
            [identity.institutionId, identity.commandScope, identity.idempotencyKey],
          );

          if (fallbackQuery.rows.length > 0) {
            const fallbackRecord = fallbackQuery.rows[0];
            if (fallbackRecord.request_fingerprint !== identity.canonicalFingerprint) {
              throw new Error(
                `IDEMPOTENCY_CONFLICT: Key "${identity.idempotencyKey}" was already used with a different request payload.`,
              );
            }
            const replayedResult = await loadResult(fallbackClient, fallbackRecord.result_ref);
            return { replayed: true, result: replayedResult };
          }
        } finally {
          fallbackClient.release();
        }
      }

      throw insertError;
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createDocumentWithInitialVersionCommand(input: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  input: CreateDocumentWithVersionInput;
}): Promise<{ replayed: boolean; result: DocumentCreationResult }> {
  const { pool, context, idempotencyKey, input: creationInput } = input;
  const canonicalFingerprint = createDocumentCreationFingerprint(
    context.institutionId,
    creationInput,
    context.personId,
  );

  const repo = new PostgresDocumentRepository();
  const auditRepo = new PostgresDocumentAuditRepository();

  return executeIdempotentDocumentsCommand({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.create_with_initial_version',
      idempotencyKey,
      canonicalFingerprint,
    },
    execute: async (client) => {
      const doc = await repo.createDocument(client, {
        institutionId: context.institutionId,
        category: creationInput.category,
        classification: creationInput.classification,
        createdByPersonId: context.personId,
      });

      const { version, provenance, storageReference } = await repo.createNextVersion(client, {
        institutionId: context.institutionId,
        documentId: doc.id,
        mimeType: creationInput.mimeType,
        byteSize: creationInput.byteSize,
        sha256Hash: creationInput.sha256Hash,
        createdByPersonId: context.personId,
        provenance: {
          originType: creationInput.provenance.originType,
          actorPersonId: creationInput.provenance.actorPersonId ?? context.personId,
          sourceDomain: creationInput.provenance.sourceDomain,
          method: creationInput.provenance.method,
          correlationId: creationInput.provenance.correlationId,
        },
        storageReference: creationInput.storageReference,
      });

      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: doc.id,
        versionId: version.id,
        actorPersonId: context.personId,
        action: 'document.created',
        outcome: 'success',
        correlationId: creationInput.provenance.correlationId,
        details: {
          category: doc.category,
          versionNumber: version.versionNumber,
          mimeType: version.mimeType,
          byteSize: version.byteSize,
          sha256Hash: version.sha256Hash,
        },
      });

      const outboxRepo = new PostgresDocumentOutboxRepository();
      await outboxRepo.insertEventIntent(client, {
        institutionId: context.institutionId,
        eventType: 'document.created',
        aggregateType: 'document',
        aggregateId: doc.id,
        actorPersonId: context.personId,
        correlationId: creationInput.provenance.correlationId,
        payload: {
          category: doc.category,
          classification: doc.classification,
          initialVersionId: version.id,
        },
      });
      await outboxRepo.insertEventIntent(client, {
        institutionId: context.institutionId,
        eventType: 'document.version_created',
        aggregateType: 'document_version',
        aggregateId: version.id,
        actorPersonId: context.personId,
        correlationId: creationInput.provenance.correlationId,
        payload: {
          documentId: doc.id,
          versionNumber: version.versionNumber,
          mimeType: version.mimeType,
          byteSize: version.byteSize,
          sha256Hash: version.sha256Hash,
        },
      });

      return {
        resultRef: `${doc.id}:${version.id}`,
        result: { document: doc, version, provenance, storageReference },
      };
    },
    loadResult: async (client, resultRef) => {
      const [documentId, versionId] = resultRef.split(':');
      const doc = await repo.getDocumentById(client, context.institutionId, documentId);
      if (!doc) throw new Error('Persisted document missing on replay');
      const version = await repo.getVersionById(client, context.institutionId, versionId);
      if (!version) throw new Error('Persisted version missing on replay');
      const provenance = await repo.getProvenanceForVersion(client, context.institutionId, versionId);
      const storageReference = await repo.getStorageReferenceForVersion(client, context.institutionId, versionId);

      return {
        document: doc,
        version,
        provenance: provenance[0],
        storageReference: storageReference ?? undefined,
      };
    },
  });
}

export async function appendDocumentVersionCommand(input: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  input: AppendDocumentVersionInput;
}): Promise<{ replayed: boolean; result: VersionCreationResult }> {
  const { pool, context, idempotencyKey, input: appendInput } = input;
  const canonicalFingerprint = createAppendVersionFingerprint(
    context.institutionId,
    appendInput,
    context.personId,
  );

  const repo = new PostgresDocumentRepository();
  const auditRepo = new PostgresDocumentAuditRepository();

  return executeIdempotentDocumentsCommand({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.append_version',
      idempotencyKey,
      canonicalFingerprint,
    },
    execute: async (client) => {
      const doc = await repo.getDocumentById(client, context.institutionId, appendInput.documentId);
      if (!doc) {
        throw new Error(`Document ${appendInput.documentId} not found in institution ${context.institutionId}`);
      }

      const { version, provenance, storageReference } = await repo.createNextVersion(client, {
        institutionId: context.institutionId,
        documentId: doc.id,
        mimeType: appendInput.mimeType,
        byteSize: appendInput.byteSize,
        sha256Hash: appendInput.sha256Hash,
        createdByPersonId: context.personId,
        provenance: {
          originType: appendInput.provenance.originType,
          actorPersonId: appendInput.provenance.actorPersonId ?? context.personId,
          sourceDomain: appendInput.provenance.sourceDomain,
          method: appendInput.provenance.method,
          correlationId: appendInput.provenance.correlationId,
        },
        storageReference: appendInput.storageReference,
      });

      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: doc.id,
        versionId: version.id,
        actorPersonId: context.personId,
        action: 'document.version_appended',
        outcome: 'success',
        correlationId: appendInput.provenance.correlationId,
        details: {
          versionNumber: version.versionNumber,
          mimeType: version.mimeType,
          byteSize: version.byteSize,
          sha256Hash: version.sha256Hash,
        },
      });

      const outboxRepo = new PostgresDocumentOutboxRepository();
      await outboxRepo.insertEventIntent(client, {
        institutionId: context.institutionId,
        eventType: 'document.version_created',
        aggregateType: 'document_version',
        aggregateId: version.id,
        actorPersonId: context.personId,
        correlationId: appendInput.provenance.correlationId,
        payload: {
          documentId: doc.id,
          versionNumber: version.versionNumber,
          mimeType: version.mimeType,
          byteSize: version.byteSize,
          sha256Hash: version.sha256Hash,
        },
      });

      return {
        resultRef: `${doc.id}:${version.id}`,
        result: { version, provenance, storageReference },
      };
    },
    loadResult: async (client, resultRef) => {
      const [, versionId] = resultRef.split(':');
      const version = await repo.getVersionById(client, context.institutionId, versionId);
      if (!version) throw new Error('Persisted version missing on replay');
      const provenance = await repo.getProvenanceForVersion(client, context.institutionId, versionId);
      const storageReference = await repo.getStorageReferenceForVersion(client, context.institutionId, versionId);

      return {
        version,
        provenance: provenance[0],
        storageReference: storageReference ?? undefined,
      };
    },
  });
}
