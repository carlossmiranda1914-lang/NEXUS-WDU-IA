import type { Pool } from 'pg';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import { createCanonicalDocumentsFingerprint } from './document-model.ts';
import { executeIdempotentDocumentsCommand } from './document-command.ts';
import { PostgresDocumentAuditRepository } from './document-audit.ts';
import { PostgresDocumentOutboxRepository } from './document-event-repository.ts';
import {
  type DocumentAuthorizationAuthority,
  DefaultDocumentAuthorizationAuthority,
  createDefaultDocumentAuthorizationRules,
} from './document-authorization-policy.ts';
import type {
  DocumentAssociationRecord,
  AssociationStatus,
  BusinessDecisionReferenceRecord,
  DecisionOutcome,
} from './document-association-model.ts';
import {
  PostgresDocumentAssociationRepository,
  type CreateAssociationInput,
  type RecordBusinessDecisionReferenceInput,
} from './document-association-repository.ts';

export interface CreateAssociationCommandInput {
  documentId: string;
  pinnedVersionId?: string | null;
  targetDomain: string;
  targetResourceType: string;
  targetResourceId: string;
  purpose: string;
  correlationId?: string | null;
}

export interface PinVersionCommandInput {
  associationId: string;
  versionId: string;
  correlationId?: string | null;
}

export interface TransitionAssociationStatusCommandInput {
  associationId: string;
  targetStatus: AssociationStatus;
  reason?: string | null;
  correlationId?: string | null;
}

export interface RecordDecisionCommandInput {
  associationId: string;
  documentId: string;
  versionId: string;
  authorityDomain: string;
  decisionType: string;
  decisionOutcome: DecisionOutcome;
  decisionReason?: string | null;
  externalReference: string;
  correlationId?: string | null;
}

export function createAssociationCreationFingerprint(
  institutionId: string,
  input: CreateAssociationCommandInput,
  actorPersonId: string,
): string {
  return createCanonicalDocumentsFingerprint({
    institutionId,
    documentId: input.documentId,
    pinnedVersionId: input.pinnedVersionId ?? null,
    targetDomain: input.targetDomain,
    targetResourceType: input.targetResourceType,
    targetResourceId: input.targetResourceId,
    purpose: input.purpose,
    actorPersonId,
  });
}

export function createPinVersionFingerprint(
  institutionId: string,
  input: PinVersionCommandInput,
  actorPersonId: string,
): string {
  return createCanonicalDocumentsFingerprint({
    institutionId,
    associationId: input.associationId,
    versionId: input.versionId,
    actorPersonId,
  });
}

export function createTransitionAssociationStatusFingerprint(
  institutionId: string,
  input: TransitionAssociationStatusCommandInput,
  actorPersonId: string,
): string {
  return createCanonicalDocumentsFingerprint({
    institutionId,
    associationId: input.associationId,
    targetStatus: input.targetStatus,
    reason: input.reason ?? null,
    actorPersonId,
  });
}

export function createRecordDecisionReferenceFingerprint(
  institutionId: string,
  input: RecordDecisionCommandInput,
  actorPersonId: string,
): string {
  return createCanonicalDocumentsFingerprint({
    institutionId,
    associationId: input.associationId,
    documentId: input.documentId,
    versionId: input.versionId,
    authorityDomain: input.authorityDomain,
    decisionType: input.decisionType,
    decisionOutcome: input.decisionOutcome,
    decisionReason: input.decisionReason ?? null,
    externalReference: input.externalReference,
    actorPersonId,
  });
}

export async function createDocumentAssociationCommand(input: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  input: CreateAssociationCommandInput;
  authorizationAuthority?: DocumentAuthorizationAuthority;
}): Promise<{ replayed: boolean; result: DocumentAssociationRecord }> {
  const { pool, context, idempotencyKey, input: commandInput } = input;

  const authAuthority =
    input.authorizationAuthority ??
    new DefaultDocumentAuthorizationAuthority({
      rules: createDefaultDocumentAuthorizationRules(),
    });

  // Verify document existence and category in tenant
  const docCheck = await pool.query<{ id: string; category: string }>(
    `SELECT id, category FROM documents WHERE institution_id = $1 AND id = $2`,
    [context.institutionId, commandInput.documentId],
  );
  if (docCheck.rows.length === 0) {
    throw new Error(
      `DOCUMENT_NOT_FOUND: Document ${commandInput.documentId} not found in institution (violates foreign key constraint "document_associations_document_tenant_fk")`,
    );
  }
  const documentCategory = docCheck.rows[0].category;

  // Authorization enforcement: CREATE_ASSOCIATION
  const authDecision = authAuthority.authorize({
    institutionId: context.institutionId,
    personId: context.personId,
    role: context.role,
    action: 'create_association',
    documentId: commandInput.documentId,
    documentCategory,
    targetDomain: commandInput.targetDomain,
    targetResourceType: commandInput.targetResourceType,
    targetResourceId: commandInput.targetResourceId,
  });

  if (!authDecision.allowed) {
    throw new Error(`ACTION_NOT_PERMITTED: create_association is not permitted for role ${context.role}`);
  }

  const canonicalFingerprint = createAssociationCreationFingerprint(
    context.institutionId,
    commandInput,
    context.personId,
  );

  const repo = new PostgresDocumentAssociationRepository();
  const auditRepo = new PostgresDocumentAuditRepository();
  const outboxRepo = new PostgresDocumentOutboxRepository();

  return executeIdempotentDocumentsCommand({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.create_association',
      idempotencyKey,
      canonicalFingerprint,
    },
    execute: async (client) => {
      const association = await repo.createAssociation(client, {
        institutionId: context.institutionId,
        documentId: commandInput.documentId,
        pinnedVersionId: commandInput.pinnedVersionId,
        targetDomain: commandInput.targetDomain,
        targetResourceType: commandInput.targetResourceType,
        targetResourceId: commandInput.targetResourceId,
        purpose: commandInput.purpose,
        createdByPersonId: context.personId,
      });

      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: association.documentId,
        versionId: association.pinnedVersionId,
        actorPersonId: context.personId,
        action: 'association.created',
        outcome: 'success',
        correlationId: commandInput.correlationId,
        details: {
          associationId: association.id,
          targetDomain: association.targetDomain,
          targetResourceType: association.targetResourceType,
          targetResourceId: association.targetResourceId,
          purpose: association.purpose,
        },
      });

      await outboxRepo.insertEvent(client, {
        institutionId: context.institutionId,
        eventType: 'document.association_created',
        aggregateType: 'document_association',
        aggregateId: association.id,
        actorPersonId: context.personId,
        actorKind: 'user',
        correlationId: commandInput.correlationId ?? null,
        causationId: association.id,
        payload: {
          associationId: association.id,
          documentId: association.documentId,
          pinnedVersionId: association.pinnedVersionId,
          targetDomain: association.targetDomain,
          targetResourceType: association.targetResourceType,
          targetResourceId: association.targetResourceId,
          purpose: association.purpose,
        },
      });

      return {
        resultRef: association.id,
        result: association,
      };
    },
    loadResult: async (client, resultRef) => {
      const association = await repo.getAssociationById(client, context.institutionId, resultRef);
      if (!association) throw new Error('Persisted association missing on replay');
      return association;
    },
  });
}

export async function pinAssociationToVersionCommand(input: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  input: PinVersionCommandInput;
}): Promise<{ replayed: boolean; result: DocumentAssociationRecord }> {
  const { pool, context, idempotencyKey, input: commandInput } = input;
  const canonicalFingerprint = createPinVersionFingerprint(
    context.institutionId,
    commandInput,
    context.personId,
  );

  const repo = new PostgresDocumentAssociationRepository();
  const auditRepo = new PostgresDocumentAuditRepository();

  return executeIdempotentDocumentsCommand({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.pin_association_version',
      idempotencyKey,
      canonicalFingerprint,
    },
    execute: async (client) => {
      const association = await repo.pinVersion(
        client,
        context.institutionId,
        commandInput.associationId,
        commandInput.versionId,
      );

      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: association.documentId,
        versionId: association.pinnedVersionId,
        actorPersonId: context.personId,
        action: 'association.version_pinned',
        outcome: 'success',
        correlationId: commandInput.correlationId,
        details: {
          associationId: association.id,
          pinnedVersionId: association.pinnedVersionId,
        },
      });

      return {
        resultRef: association.id,
        result: association,
      };
    },
    loadResult: async (client, resultRef) => {
      const association = await repo.getAssociationById(client, context.institutionId, resultRef);
      if (!association) throw new Error('Persisted association missing on replay');
      return association;
    },
  });
}

export async function transitionAssociationStatusCommand(input: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  input: TransitionAssociationStatusCommandInput;
  expectedDocumentId?: string;
  authorizationAuthority?: DocumentAuthorizationAuthority;
}): Promise<{ replayed: boolean; result: DocumentAssociationRecord }> {
  const { pool, context, idempotencyKey, input: commandInput } = input;

  const authAuthority =
    input.authorizationAuthority ??
    new DefaultDocumentAuthorizationAuthority({
      rules: createDefaultDocumentAuthorizationRules(),
    });

  const repo = new PostgresDocumentAssociationRepository();
  const auditRepo = new PostgresDocumentAuditRepository();

  // Association ownership & existence lookup
  const assoc = await repo.getAssociationById(pool, context.institutionId, commandInput.associationId);
  if (!assoc) {
    throw new Error(`ASSOCIATION_NOT_FOUND: Association ${commandInput.associationId} not found in institution`);
  }

  // Association document consistency verification
  if (input.expectedDocumentId && assoc.documentId !== input.expectedDocumentId) {
    throw new Error(
      `ASSOCIATION_NOT_FOUND: Association ${commandInput.associationId} does not belong to document ${input.expectedDocumentId}`,
    );
  }

  // Verify document existence and category in tenant
  const docCheck = await pool.query<{ id: string; category: string }>(
    `SELECT id, category FROM documents WHERE institution_id = $1 AND id = $2`,
    [context.institutionId, assoc.documentId],
  );
  if (docCheck.rows.length === 0) {
    throw new Error(`DOCUMENT_NOT_FOUND: Document ${assoc.documentId} not found in institution`);
  }
  const documentCategory = docCheck.rows[0].category;

  // Authorization enforcement: REMOVE_ASSOCIATION (for targetStatus === 'withdrawn')
  const action = commandInput.targetStatus === 'withdrawn' ? 'remove_association' : 'create_association';
  const authDecision = authAuthority.authorize({
    institutionId: context.institutionId,
    personId: context.personId,
    role: context.role,
    action,
    documentId: assoc.documentId,
    documentCategory,
  });

  if (!authDecision.allowed) {
    throw new Error(`ACTION_NOT_PERMITTED: ${action} is not permitted for role ${context.role}`);
  }

  const canonicalFingerprint = createTransitionAssociationStatusFingerprint(
    context.institutionId,
    commandInput,
    context.personId,
  );

  return executeIdempotentDocumentsCommand({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.transition_association_status',
      idempotencyKey,
      canonicalFingerprint,
    },
    execute: async (client) => {
      const association = await repo.transitionStatus(
        client,
        context.institutionId,
        commandInput.associationId,
        commandInput.targetStatus,
      );

      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: association.documentId,
        versionId: association.pinnedVersionId,
        actorPersonId: context.personId,
        action: `association.${commandInput.targetStatus}`,
        outcome: 'success',
        correlationId: commandInput.correlationId,
        details: {
          associationId: association.id,
          targetStatus: commandInput.targetStatus,
          reason: commandInput.reason ?? null,
        },
      });

      return {
        resultRef: association.id,
        result: association,
      };
    },
    loadResult: async (client, resultRef) => {
      const association = await repo.getAssociationById(client, context.institutionId, resultRef);
      if (!association) throw new Error('Persisted association missing on replay');
      return association;
    },
  });
}

export async function recordBusinessDecisionReferenceCommand(input: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  input: RecordDecisionCommandInput;
}): Promise<{ replayed: boolean; result: BusinessDecisionReferenceRecord }> {
  const { pool, context, idempotencyKey, input: commandInput } = input;
  const canonicalFingerprint = createRecordDecisionReferenceFingerprint(
    context.institutionId,
    commandInput,
    context.personId,
  );

  const repo = new PostgresDocumentAssociationRepository();
  const auditRepo = new PostgresDocumentAuditRepository();

  return executeIdempotentDocumentsCommand({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.record_business_decision',
      idempotencyKey,
      canonicalFingerprint,
    },
    execute: async (client) => {
      const decisionRef = await repo.recordBusinessDecisionReference(client, {
        institutionId: context.institutionId,
        associationId: commandInput.associationId,
        documentId: commandInput.documentId,
        versionId: commandInput.versionId,
        authorityDomain: commandInput.authorityDomain,
        decisionType: commandInput.decisionType,
        decisionOutcome: commandInput.decisionOutcome,
        decisionReason: commandInput.decisionReason,
        externalReference: commandInput.externalReference,
        decidedByPersonId: context.personId,
        correlationId: commandInput.correlationId,
      });

      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: decisionRef.documentId,
        versionId: decisionRef.versionId,
        actorPersonId: context.personId,
        action: 'business_decision_reference.recorded',
        outcome: 'success',
        correlationId: commandInput.correlationId,
        details: {
          decisionRefId: decisionRef.id,
          associationId: decisionRef.associationId,
          authorityDomain: decisionRef.authorityDomain,
          decisionType: decisionRef.decisionType,
          decisionOutcome: decisionRef.decisionOutcome,
          externalReference: decisionRef.externalReference,
        },
      });

      return {
        resultRef: decisionRef.id,
        result: decisionRef,
      };
    },
    loadResult: async (client, resultRef) => {
      const query = await client.query<{
        id: string;
        institution_id: string;
        association_id: string;
        document_id: string;
        version_id: string;
        authority_domain: string;
        decision_type: string;
        decision_outcome: DecisionOutcome;
        decision_reason: string | null;
        external_reference: string;
        decided_by_person_id: string | null;
        observed_at: Date;
        correlation_id: string | null;
      }>(
        `SELECT id, institution_id, association_id, document_id, version_id, authority_domain, decision_type, decision_outcome, decision_reason, external_reference, decided_by_person_id, observed_at, correlation_id
           FROM document_business_decision_references
          WHERE institution_id = $1 AND id = $2`,
        [context.institutionId, resultRef],
      );

      if (query.rows.length === 0) throw new Error('Persisted decision reference missing on replay');
      const row = query.rows[0];
      return {
        id: row.id,
        institutionId: row.institution_id,
        associationId: row.association_id,
        documentId: row.document_id,
        versionId: row.version_id,
        authorityDomain: row.authority_domain,
        decisionType: row.decision_type,
        decisionOutcome: row.decision_outcome,
        decisionReason: row.decision_reason,
        externalReference: row.external_reference,
        decidedByPersonId: row.decided_by_person_id,
        observedAt: row.observed_at,
        correlationId: row.correlation_id,
      };
    },
  });
}
