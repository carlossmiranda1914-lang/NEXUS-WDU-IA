import type { QueryClient } from './document-audit.ts';
import type {
  DocumentAssociationRecord,
  AssociationStatus,
  BusinessDecisionReferenceRecord,
  DecisionOutcome,
} from './document-association-model.ts';
import {
  validateTargetDomain,
  validateTargetResourceType,
  validateTargetResourceId,
  validatePurpose,
  validateAuthorityDomain,
  validateDecisionType,
  validateExternalReference,
  validateAssociationTransition,
} from './document-association-model.ts';

export interface CreateAssociationInput {
  institutionId: string;
  documentId: string;
  pinnedVersionId?: string | null;
  targetDomain: string;
  targetResourceType: string;
  targetResourceId: string;
  purpose: string;
  createdByPersonId: string;
}

export interface RecordBusinessDecisionReferenceInput {
  institutionId: string;
  associationId: string;
  documentId: string;
  versionId: string;
  authorityDomain: string;
  decisionType: string;
  decisionOutcome: DecisionOutcome;
  decisionReason?: string | null;
  externalReference: string;
  decidedByPersonId?: string | null;
  correlationId?: string | null;
}

export class PostgresDocumentAssociationRepository {
  async createAssociation(
    client: QueryClient,
    input: CreateAssociationInput,
  ): Promise<DocumentAssociationRecord> {
    validateTargetDomain(input.targetDomain);
    validateTargetResourceType(input.targetResourceType);
    validateTargetResourceId(input.targetResourceId);
    validatePurpose(input.purpose);

    const result = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      pinned_version_id: string | null;
      target_domain: string;
      target_resource_type: string;
      target_resource_id: string;
      purpose: string;
      status: AssociationStatus;
      created_by_person_id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO document_associations (
        institution_id, document_id, pinned_version_id, target_domain, target_resource_type, target_resource_id, purpose, created_by_person_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, institution_id, document_id, pinned_version_id, target_domain, target_resource_type, target_resource_id, purpose, status, created_by_person_id, created_at, updated_at`,
      [
        input.institutionId,
        input.documentId,
        input.pinnedVersionId ?? null,
        input.targetDomain,
        input.targetResourceType,
        input.targetResourceId,
        input.purpose,
        input.createdByPersonId,
      ],
    );

    const row = result.rows[0];
    return {
      id: row.id,
      institutionId: row.institution_id,
      documentId: row.document_id,
      pinnedVersionId: row.pinned_version_id,
      targetDomain: row.target_domain,
      targetResourceType: row.target_resource_type,
      targetResourceId: row.target_resource_id,
      purpose: row.purpose,
      status: row.status,
      createdByPersonId: row.created_by_person_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAssociationById(
    client: QueryClient,
    institutionId: string,
    associationId: string,
  ): Promise<DocumentAssociationRecord | null> {
    const result = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      pinned_version_id: string | null;
      target_domain: string;
      target_resource_type: string;
      target_resource_id: string;
      purpose: string;
      status: AssociationStatus;
      created_by_person_id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, institution_id, document_id, pinned_version_id, target_domain, target_resource_type, target_resource_id, purpose, status, created_by_person_id, created_at, updated_at
         FROM document_associations
        WHERE institution_id = $1 AND id = $2`,
      [institutionId, associationId],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      institutionId: row.institution_id,
      documentId: row.document_id,
      pinnedVersionId: row.pinned_version_id,
      targetDomain: row.target_domain,
      targetResourceType: row.target_resource_type,
      targetResourceId: row.target_resource_id,
      purpose: row.purpose,
      status: row.status,
      createdByPersonId: row.created_by_person_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listAssociationsForDocument(
    client: QueryClient,
    institutionId: string,
    documentId: string,
  ): Promise<DocumentAssociationRecord[]> {
    const result = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      pinned_version_id: string | null;
      target_domain: string;
      target_resource_type: string;
      target_resource_id: string;
      purpose: string;
      status: AssociationStatus;
      created_by_person_id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, institution_id, document_id, pinned_version_id, target_domain, target_resource_type, target_resource_id, purpose, status, created_by_person_id, created_at, updated_at
         FROM document_associations
        WHERE institution_id = $1 AND document_id = $2
        ORDER BY created_at DESC, id DESC`,
      [institutionId, documentId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      institutionId: row.institution_id,
      documentId: row.document_id,
      pinnedVersionId: row.pinned_version_id,
      targetDomain: row.target_domain,
      targetResourceType: row.target_resource_type,
      targetResourceId: row.target_resource_id,
      purpose: row.purpose,
      status: row.status,
      createdByPersonId: row.created_by_person_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async listAssociationsForTarget(
    client: QueryClient,
    institutionId: string,
    targetDomain: string,
    targetResourceType: string,
    targetResourceId: string,
  ): Promise<DocumentAssociationRecord[]> {
    const result = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      pinned_version_id: string | null;
      target_domain: string;
      target_resource_type: string;
      target_resource_id: string;
      purpose: string;
      status: AssociationStatus;
      created_by_person_id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, institution_id, document_id, pinned_version_id, target_domain, target_resource_type, target_resource_id, purpose, status, created_by_person_id, created_at, updated_at
         FROM document_associations
        WHERE institution_id = $1 AND target_domain = $2 AND target_resource_type = $3 AND target_resource_id = $4
        ORDER BY created_at DESC, id DESC`,
      [institutionId, targetDomain, targetResourceType, targetResourceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      institutionId: row.institution_id,
      documentId: row.document_id,
      pinnedVersionId: row.pinned_version_id,
      targetDomain: row.target_domain,
      targetResourceType: row.target_resource_type,
      targetResourceId: row.target_resource_id,
      purpose: row.purpose,
      status: row.status,
      createdByPersonId: row.created_by_person_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async pinVersion(
    client: QueryClient,
    institutionId: string,
    associationId: string,
    versionId: string,
  ): Promise<DocumentAssociationRecord> {
    // 1. Lock association row for update
    const currentResult = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      pinned_version_id: string | null;
      target_domain: string;
      target_resource_type: string;
      target_resource_id: string;
      purpose: string;
      status: AssociationStatus;
      created_by_person_id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, institution_id, document_id, pinned_version_id, target_domain, target_resource_type, target_resource_id, purpose, status, created_by_person_id, created_at, updated_at
         FROM document_associations
        WHERE institution_id = $1 AND id = $2
        FOR UPDATE`,
      [institutionId, associationId],
    );

    if (currentResult.rows.length === 0) {
      throw new Error(`Association ${associationId} not found in institution ${institutionId}`);
    }

    const current = currentResult.rows[0];
    if (current.status !== 'active') {
      throw new Error(
        `Cannot pin version on association with status "${current.status}". Only active associations can be pinned.`,
      );
    }

    // 2. Update pinned_version_id (PostgreSQL composite FK will enforce that versionId belongs to current.document_id and institutionId)
    const updateResult = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      pinned_version_id: string | null;
      target_domain: string;
      target_resource_type: string;
      target_resource_id: string;
      purpose: string;
      status: AssociationStatus;
      created_by_person_id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE document_associations
          SET pinned_version_id = $3, updated_at = now()
        WHERE institution_id = $1 AND id = $2
        RETURNING id, institution_id, document_id, pinned_version_id, target_domain, target_resource_type, target_resource_id, purpose, status, created_by_person_id, created_at, updated_at`,
      [institutionId, associationId, versionId],
    );

    const row = updateResult.rows[0];
    return {
      id: row.id,
      institutionId: row.institution_id,
      documentId: row.document_id,
      pinnedVersionId: row.pinned_version_id,
      targetDomain: row.target_domain,
      targetResourceType: row.target_resource_type,
      targetResourceId: row.target_resource_id,
      purpose: row.purpose,
      status: row.status,
      createdByPersonId: row.created_by_person_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async transitionStatus(
    client: QueryClient,
    institutionId: string,
    associationId: string,
    targetStatus: AssociationStatus,
  ): Promise<DocumentAssociationRecord> {
    const currentResult = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      pinned_version_id: string | null;
      target_domain: string;
      target_resource_type: string;
      target_resource_id: string;
      purpose: string;
      status: AssociationStatus;
      created_by_person_id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, institution_id, document_id, pinned_version_id, target_domain, target_resource_type, target_resource_id, purpose, status, created_by_person_id, created_at, updated_at
         FROM document_associations
        WHERE institution_id = $1 AND id = $2
        FOR UPDATE`,
      [institutionId, associationId],
    );

    if (currentResult.rows.length === 0) {
      throw new Error(`Association ${associationId} not found in institution ${institutionId}`);
    }

    const current = currentResult.rows[0];
    validateAssociationTransition(current.status, targetStatus);

    const updateResult = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      pinned_version_id: string | null;
      target_domain: string;
      target_resource_type: string;
      target_resource_id: string;
      purpose: string;
      status: AssociationStatus;
      created_by_person_id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE document_associations
          SET status = $3, updated_at = now()
        WHERE institution_id = $1 AND id = $2
        RETURNING id, institution_id, document_id, pinned_version_id, target_domain, target_resource_type, target_resource_id, purpose, status, created_by_person_id, created_at, updated_at`,
      [institutionId, associationId, targetStatus],
    );

    const row = updateResult.rows[0];
    return {
      id: row.id,
      institutionId: row.institution_id,
      documentId: row.document_id,
      pinnedVersionId: row.pinned_version_id,
      targetDomain: row.target_domain,
      targetResourceType: row.target_resource_type,
      targetResourceId: row.target_resource_id,
      purpose: row.purpose,
      status: row.status,
      createdByPersonId: row.created_by_person_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async recordBusinessDecisionReference(
    client: QueryClient,
    input: RecordBusinessDecisionReferenceInput,
  ): Promise<BusinessDecisionReferenceRecord> {
    validateAuthorityDomain(input.authorityDomain);
    validateDecisionType(input.decisionType);
    validateExternalReference(input.externalReference);

    const result = await client.query<{
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
      `INSERT INTO document_business_decision_references (
        institution_id, association_id, document_id, version_id, authority_domain, decision_type, decision_outcome, decision_reason, external_reference, decided_by_person_id, correlation_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, institution_id, association_id, document_id, version_id, authority_domain, decision_type, decision_outcome, decision_reason, external_reference, decided_by_person_id, observed_at, correlation_id`,
      [
        input.institutionId,
        input.associationId,
        input.documentId,
        input.versionId,
        input.authorityDomain,
        input.decisionType,
        input.decisionOutcome,
        input.decisionReason ?? null,
        input.externalReference,
        input.decidedByPersonId ?? null,
        input.correlationId ?? null,
      ],
    );

    const row = result.rows[0];
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
  }

  async listDecisionReferencesForAssociation(
    client: QueryClient,
    institutionId: string,
    associationId: string,
  ): Promise<BusinessDecisionReferenceRecord[]> {
    const result = await client.query<{
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
        WHERE institution_id = $1 AND association_id = $2
        ORDER BY observed_at DESC, id DESC`,
      [institutionId, associationId],
    );

    return result.rows.map((row) => ({
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
    }));
  }
}
