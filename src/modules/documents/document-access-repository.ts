/**
 * Documents Foundation I5 Secure Content Access Repository
 * Mission: DOCUMENTS-FOUNDATION-I5
 */

import pg from 'pg';
import {
  DocumentContentAccessGrant,
  GrantAction,
  GrantStatus,
} from './document-access-model';
import { InstitutionalRole } from '../../auth/institutional-context';

export interface CreateGrantParams {
  institutionId: string;
  documentId: string;
  versionId: string;
  granteePersonId: string;
  action: GrantAction;
  tokenHash: string;
  expiresAt: Date;
  correlationId?: string;
}

export interface RevokeGrantParams {
  institutionId: string;
  grantId: string;
  revokedByPersonId: string;
  reason: string;
}

export interface GranteeMembershipInfo {
  membershipId: string;
  institutionId: string;
  personId: string;
  role: InstitutionalRole;
  isActive: boolean;
}

export class PostgresDocumentAccessRepository {
  public async createAccessGrant(
    client: pg.PoolClient,
    params: CreateGrantParams,
  ): Promise<DocumentContentAccessGrant> {
    const res = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_id: string;
      grantee_person_id: string;
      action: GrantAction;
      status: GrantStatus;
      token_hash: string;
      issued_at: Date;
      expires_at: Date;
      consumed_at: Date | null;
      revoked_at: Date | null;
      revocation_reason: string | null;
      revoked_by_person_id: string | null;
      correlation_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO document_content_access_grants (
        institution_id,
        document_id,
        version_id,
        grantee_person_id,
        action,
        status,
        token_hash,
        issued_at,
        expires_at,
        correlation_id
      ) VALUES ($1, $2, $3, $4, $5, 'active', $6, NOW(), $7, $8)
      RETURNING *`,
      [
        params.institutionId,
        params.documentId,
        params.versionId,
        params.granteePersonId,
        params.action,
        params.tokenHash,
        params.expiresAt,
        params.correlationId || null,
      ],
    );

    return this.mapGrantRow(res.rows[0]);
  }

  public async getGrantById(
    client: pg.PoolClient,
    institutionId: string,
    grantId: string,
  ): Promise<DocumentContentAccessGrant | null> {
    const res = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_id: string;
      grantee_person_id: string;
      action: GrantAction;
      status: GrantStatus;
      token_hash: string;
      issued_at: Date;
      expires_at: Date;
      consumed_at: Date | null;
      revoked_at: Date | null;
      revocation_reason: string | null;
      revoked_by_person_id: string | null;
      correlation_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM document_content_access_grants
       WHERE institution_id = $1 AND id = $2`,
      [institutionId, grantId],
    );

    if (res.rows.length === 0) {
      return null;
    }
    return this.mapGrantRow(res.rows[0]);
  }

  public async getGrantByTokenHash(
    client: pg.PoolClient,
    institutionId: string,
    tokenHash: string,
  ): Promise<DocumentContentAccessGrant | null> {
    const res = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_id: string;
      grantee_person_id: string;
      action: GrantAction;
      status: GrantStatus;
      token_hash: string;
      issued_at: Date;
      expires_at: Date;
      consumed_at: Date | null;
      revoked_at: Date | null;
      revocation_reason: string | null;
      revoked_by_person_id: string | null;
      correlation_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM document_content_access_grants
       WHERE institution_id = $1 AND token_hash = $2`,
      [institutionId, tokenHash],
    );

    if (res.rows.length === 0) {
      return null;
    }
    return this.mapGrantRow(res.rows[0]);
  }

  public async getGrantByTokenHashForUpdate(
    client: pg.PoolClient,
    institutionId: string,
    tokenHash: string,
  ): Promise<DocumentContentAccessGrant | null> {
    const res = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_id: string;
      grantee_person_id: string;
      action: GrantAction;
      status: GrantStatus;
      token_hash: string;
      issued_at: Date;
      expires_at: Date;
      consumed_at: Date | null;
      revoked_at: Date | null;
      revocation_reason: string | null;
      revoked_by_person_id: string | null;
      correlation_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM document_content_access_grants
       WHERE institution_id = $1 AND token_hash = $2
       FOR UPDATE`,
      [institutionId, tokenHash],
    );

    if (res.rows.length === 0) {
      return null;
    }
    return this.mapGrantRow(res.rows[0]);
  }

  public async revokeGrant(
    client: pg.PoolClient,
    params: RevokeGrantParams,
  ): Promise<DocumentContentAccessGrant | null> {
    const res = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_id: string;
      grantee_person_id: string;
      action: GrantAction;
      status: GrantStatus;
      token_hash: string;
      issued_at: Date;
      expires_at: Date;
      consumed_at: Date | null;
      revoked_at: Date | null;
      revocation_reason: string | null;
      revoked_by_person_id: string | null;
      correlation_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE document_content_access_grants
       SET status = 'revoked',
           revoked_at = NOW(),
           revocation_reason = $3,
           revoked_by_person_id = $4,
           updated_at = NOW()
       WHERE institution_id = $1 AND id = $2 AND status = 'active'
       RETURNING *`,
      [params.institutionId, params.grantId, params.reason, params.revokedByPersonId],
    );

    if (res.rows.length === 0) {
      return null;
    }
    return this.mapGrantRow(res.rows[0]);
  }

  public async recordGrantUsage(
    client: pg.PoolClient,
    institutionId: string,
    grantId: string,
  ): Promise<void> {
    await client.query(
      `UPDATE document_content_access_grants
       SET consumed_at = COALESCE(consumed_at, NOW()),
           updated_at = NOW()
       WHERE institution_id = $1 AND id = $2`,
      [institutionId, grantId],
    );
  }

  public async getGranteeMembership(
    client: pg.PoolClient,
    institutionId: string,
    personId: string,
  ): Promise<GranteeMembershipInfo | null> {
    const res = await client.query<{
      id: string;
      institution_id: string;
      person_id: string;
      role: InstitutionalRole;
      status: string;
    }>(
      `SELECT id, institution_id, person_id, role, status
       FROM memberships
       WHERE institution_id = $1 AND person_id = $2`,
      [institutionId, personId],
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      membershipId: row.id,
      institutionId: row.institution_id,
      personId: row.person_id,
      role: row.role,
      isActive: row.status === 'active',
    };
  }

  private mapGrantRow(row: {
    id: string;
    institution_id: string;
    document_id: string;
    version_id: string;
    grantee_person_id: string;
    action: GrantAction;
    status: GrantStatus;
    token_hash: string;
    issued_at: Date;
    expires_at: Date;
    consumed_at: Date | null;
    revoked_at: Date | null;
    revocation_reason: string | null;
    revoked_by_person_id: string | null;
    correlation_id: string | null;
    created_at: Date;
    updated_at: Date;
  }): DocumentContentAccessGrant {
    return {
      id: row.id,
      institutionId: row.institution_id,
      documentId: row.document_id,
      versionId: row.version_id,
      granteePersonId: row.grantee_person_id,
      action: row.action,
      status: row.status,
      tokenHash: row.token_hash,
      issuedAt: row.issued_at,
      expiresAt: row.expires_at,
      consumedAt: row.consumed_at,
      revokedAt: row.revoked_at,
      revocationReason: row.revocation_reason,
      revokedByPersonId: row.revoked_by_person_id,
      correlationId: row.correlation_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
