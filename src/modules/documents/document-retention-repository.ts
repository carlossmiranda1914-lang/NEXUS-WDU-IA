/**
 * Documents Foundation I6 — Retention & Deletion Repository
 * Mission: DOCUMENTS-FOUNDATION-I6
 *
 * All queries are institution-scoped (composite tenant FK in WHERE clauses).
 * Append-only for DeletionRecord (no UPDATE, no DELETE on that table).
 */

import type { PoolClient } from 'pg';
import type {
  RetentionAssignmentRecord,
  RetentionHoldRecord,
  DeletionAuthorizationRecord,
  DeletionRecordData,
  RetentionStatus,
  DeletionAuthorizationStatus,
} from './document-retention-model.ts';

// ─── Retention Assignment Repository ─────────────────────────────────────────

export class PostgresRetentionAssignmentRepository {
  async insert(
    client: PoolClient,
    params: {
      institutionId: string;
      documentId: string;
      versionId: string;
      policyId: string;
      policyVersion: string;
      jurisdictionProfileId: string;
      jurisdictionProfileVersion: string;
      category: string;
      purpose: string | null;
      clockTriggerType: string;
      clockTriggerEventAt: Date;
      retainUntil: Date;
      assignedByPersonId: string;
      correlationId: string | null;
    },
  ): Promise<RetentionAssignmentRecord> {
    const result = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_id: string;
      policy_id: string;
      policy_version: string;
      jurisdiction_profile_id: string;
      jurisdiction_profile_version: string;
      category: string;
      purpose: string | null;
      clock_trigger_type: string;
      clock_trigger_event_at: Date;
      retain_until: Date;
      retention_status: string;
      assigned_at: Date;
      assigned_by_person_id: string;
      correlation_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO document_retention_assignments (
        institution_id, document_id, version_id,
        policy_id, policy_version,
        jurisdiction_profile_id, jurisdiction_profile_version,
        category, purpose,
        clock_trigger_type, clock_trigger_event_at, retain_until,
        retention_status,
        assigned_by_person_id, correlation_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'retention_active',$13,$14)
      RETURNING *`,
      [
        params.institutionId, params.documentId, params.versionId,
        params.policyId, params.policyVersion,
        params.jurisdictionProfileId, params.jurisdictionProfileVersion,
        params.category, params.purpose,
        params.clockTriggerType, params.clockTriggerEventAt, params.retainUntil,
        params.assignedByPersonId, params.correlationId,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async getByVersionId(
    client: PoolClient,
    institutionId: string,
    versionId: string,
  ): Promise<RetentionAssignmentRecord | null> {
    const result = await client.query(
      `SELECT * FROM document_retention_assignments
        WHERE institution_id = $1 AND version_id = $2`,
      [institutionId, versionId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async getById(
    client: PoolClient,
    institutionId: string,
    id: string,
  ): Promise<RetentionAssignmentRecord | null> {
    const result = await client.query(
      `SELECT * FROM document_retention_assignments
        WHERE institution_id = $1 AND id = $2`,
      [institutionId, id],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async updateStatus(
    client: PoolClient,
    institutionId: string,
    id: string,
    status: RetentionStatus,
  ): Promise<void> {
    const res = await client.query(
      `UPDATE document_retention_assignments
          SET retention_status = $3, updated_at = now()
        WHERE institution_id = $1 AND id = $2`,
      [institutionId, id, status],
    );
    if (res.rowCount === 0) {
      throw new Error(`RETENTION_ASSIGNMENT_NOT_FOUND: ${id}`);
    }
  }

  private mapRow(row: Record<string, unknown>): RetentionAssignmentRecord {
    return {
      id: row.id as string,
      institutionId: row.institution_id as string,
      documentId: row.document_id as string,
      versionId: row.version_id as string,
      policyId: row.policy_id as string,
      policyVersion: row.policy_version as string,
      jurisdictionProfileId: row.jurisdiction_profile_id as string,
      jurisdictionProfileVersion: row.jurisdiction_profile_version as string,
      category: row.category as string,
      purpose: row.purpose as string | null,
      clockTriggerType: row.clock_trigger_type as string,
      clockTriggerEventAt: row.clock_trigger_event_at as Date,
      retainUntil: row.retain_until as Date,
      retentionStatus: row.retention_status as RetentionStatus,
      assignedAt: row.assigned_at as Date,
      assignedByPersonId: row.assigned_by_person_id as string,
      correlationId: row.correlation_id as string | null,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }
}

// ─── Retention Hold Repository ────────────────────────────────────────────────

export class PostgresRetentionHoldRepository {
  async insert(
    client: PoolClient,
    params: {
      institutionId: string;
      documentId: string;
      versionId: string;
      holdType: 'legal' | 'administrative';
      authority: string;
      reason: string;
      createdByPersonId: string;
      correlationId: string | null;
    },
  ): Promise<RetentionHoldRecord> {
    const result = await client.query(
      `INSERT INTO document_retention_holds (
        institution_id, document_id, version_id,
        hold_type, authority, reason,
        created_by_person_id, correlation_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        params.institutionId, params.documentId, params.versionId,
        params.holdType, params.authority, params.reason,
        params.createdByPersonId, params.correlationId,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async getById(
    client: PoolClient,
    institutionId: string,
    id: string,
  ): Promise<RetentionHoldRecord | null> {
    const result = await client.query(
      `SELECT * FROM document_retention_holds
        WHERE institution_id = $1 AND id = $2`,
      [institutionId, id],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async countActiveHoldsForVersion(
    client: PoolClient,
    institutionId: string,
    versionId: string,
  ): Promise<number> {
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM document_retention_holds
        WHERE institution_id = $1 AND version_id = $2 AND hold_status = 'active'`,
      [institutionId, versionId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  async getActiveHoldsForVersion(
    client: PoolClient,
    institutionId: string,
    versionId: string,
  ): Promise<RetentionHoldRecord[]> {
    const result = await client.query(
      `SELECT * FROM document_retention_holds
        WHERE institution_id = $1 AND version_id = $2 AND hold_status = 'active'
        ORDER BY created_at ASC`,
      [institutionId, versionId],
    );
    return result.rows.map(this.mapRow);
  }

  async releaseHold(
    client: PoolClient,
    institutionId: string,
    holdId: string,
    releasedByPersonId: string,
    releaseReason: string,
    releaseCorrelationId: string | null,
  ): Promise<RetentionHoldRecord> {
    const result = await client.query(
      `UPDATE document_retention_holds
          SET hold_status = 'released',
              released_at = now(),
              released_by_person_id = $3,
              release_reason = $4,
              release_correlation_id = $5,
              updated_at = now()
        WHERE institution_id = $1 AND id = $2 AND hold_status = 'active'
        RETURNING *`,
      [institutionId, holdId, releasedByPersonId, releaseReason, releaseCorrelationId],
    );
    if (result.rows.length === 0) {
      throw new Error(`HOLD_NOT_FOUND_OR_ALREADY_RELEASED: hold ${holdId} not found or already released.`);
    }
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: Record<string, unknown>): RetentionHoldRecord {
    return {
      id: row.id as string,
      institutionId: row.institution_id as string,
      documentId: row.document_id as string,
      versionId: row.version_id as string,
      holdType: row.hold_type as 'legal' | 'administrative',
      authority: row.authority as string,
      reason: row.reason as string,
      effectiveAt: row.effective_at as Date,
      releasedAt: row.released_at as Date | null,
      releasedByPersonId: row.released_by_person_id as string | null,
      releaseReason: row.release_reason as string | null,
      releaseCorrelationId: row.release_correlation_id as string | null,
      holdStatus: row.hold_status as 'active' | 'released',
      createdByPersonId: row.created_by_person_id as string,
      correlationId: row.correlation_id as string | null,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }
}

// ─── Deletion Authorization Repository ───────────────────────────────────────

export class PostgresDeletionAuthorizationRepository {
  async insert(
    client: PoolClient,
    params: {
      institutionId: string;
      documentId: string;
      versionId: string;
      retentionAssignmentId: string;
      policyBasis: string;
      policyVersion: string;
      jurisdictionProfileId: string;
      authorizedByPersonId: string;
      correlationId: string | null;
    },
  ): Promise<DeletionAuthorizationRecord> {
    const result = await client.query(
      `INSERT INTO document_deletion_authorizations (
        institution_id, document_id, version_id,
        retention_assignment_id,
        policy_basis, policy_version, jurisdiction_profile_id,
        authorized_by_person_id, correlation_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        params.institutionId, params.documentId, params.versionId,
        params.retentionAssignmentId,
        params.policyBasis, params.policyVersion, params.jurisdictionProfileId,
        params.authorizedByPersonId, params.correlationId,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async getById(
    client: PoolClient,
    institutionId: string,
    id: string,
  ): Promise<DeletionAuthorizationRecord | null> {
    const result = await client.query(
      `SELECT * FROM document_deletion_authorizations
        WHERE institution_id = $1 AND id = $2`,
      [institutionId, id],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async updateStatus(
    client: PoolClient,
    institutionId: string,
    id: string,
    status: DeletionAuthorizationStatus,
    currentExpected?: DeletionAuthorizationStatus,
  ): Promise<void> {
    const query = currentExpected
      ? `UPDATE document_deletion_authorizations
            SET authorization_status = $3, updated_at = now()
          WHERE institution_id = $1 AND id = $2 AND authorization_status = $4`
      : `UPDATE document_deletion_authorizations
            SET authorization_status = $3, updated_at = now()
          WHERE institution_id = $1 AND id = $2`;
    const params = currentExpected
      ? [institutionId, id, status, currentExpected]
      : [institutionId, id, status];
    const res = await client.query(query, params);
    if (res.rowCount === 0) {
      throw new Error(
        `DELETION_AUTHORIZATION_NOT_FOUND_OR_STATUS_CONFLICT: auth ${id} ` +
        (currentExpected ? `expected status '${currentExpected}'` : ''),
      );
    }
  }

  private mapRow(row: Record<string, unknown>): DeletionAuthorizationRecord {
    return {
      id: row.id as string,
      institutionId: row.institution_id as string,
      documentId: row.document_id as string,
      versionId: row.version_id as string,
      retentionAssignmentId: row.retention_assignment_id as string,
      policyBasis: row.policy_basis as string,
      policyVersion: row.policy_version as string,
      jurisdictionProfileId: row.jurisdiction_profile_id as string,
      authorizedByPersonId: row.authorized_by_person_id as string,
      authorizedAt: row.authorized_at as Date,
      authorizationStatus: row.authorization_status as DeletionAuthorizationStatus,
      correlationId: row.correlation_id as string | null,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }
}

// ─── Deletion Record Repository (append-only) ─────────────────────────────────

export class PostgresDeletionRecordRepository {
  async insert(
    client: PoolClient,
    params: {
      institutionId: string;
      deletionAuthorizationId: string;
      deletionOperationId: string;
      pseudonymizedRef: string;
      policyBasis: string;
      policyVersion: string;
      jurisdictionProfileId: string;
      result: 'deleted';
      storageDeletionConfirmed: true;
      actorAuthorityScope: string;
    },
  ): Promise<DeletionRecordData> {
    const result = await client.query(
      `INSERT INTO document_deletion_records (
        institution_id, deletion_authorization_id,
        deletion_operation_id, pseudonymized_ref,
        policy_basis, policy_version, jurisdiction_profile_id,
        result, storage_deletion_confirmed,
        actor_authority_scope
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        params.institutionId, params.deletionAuthorizationId,
        params.deletionOperationId, params.pseudonymizedRef,
        params.policyBasis, params.policyVersion, params.jurisdictionProfileId,
        params.result, params.storageDeletionConfirmed,
        params.actorAuthorityScope,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async getByAuthorizationId(
    client: PoolClient,
    institutionId: string,
    deletionAuthorizationId: string,
  ): Promise<DeletionRecordData | null> {
    const result = await client.query(
      `SELECT * FROM document_deletion_records
        WHERE institution_id = $1 AND deletion_authorization_id = $2`,
      [institutionId, deletionAuthorizationId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async getByPseudonymizedRef(
    client: PoolClient,
    institutionId: string,
    pseudonymizedRef: string,
  ): Promise<DeletionRecordData | null> {
    const result = await client.query(
      `SELECT * FROM document_deletion_records
        WHERE institution_id = $1 AND pseudonymized_ref = $2`,
      [institutionId, pseudonymizedRef],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  private mapRow(row: Record<string, unknown>): DeletionRecordData {
    return {
      id: row.id as string,
      institutionId: row.institution_id as string,
      deletionAuthorizationId: row.deletion_authorization_id as string,
      deletionOperationId: row.deletion_operation_id as string,
      pseudonymizedRef: row.pseudonymized_ref as string,
      policyBasis: row.policy_basis as string,
      policyVersion: row.policy_version as string,
      jurisdictionProfileId: row.jurisdiction_profile_id as string,
      result: 'deleted',
      storageDeletionConfirmed: row.storage_deletion_confirmed as boolean,
      executedAt: row.executed_at as Date,
      actorAuthorityScope: row.actor_authority_scope as string,
      createdAt: row.created_at as Date,
    };
  }
}
