/**
 * PostgreSQL Document Verification Repository
 * Mission: DOCUMENTS-FOUNDATION-I4
 */

import type pg from 'pg';
import type {
  DocumentTechnicalVerification,
  DocumentTechnicalAssessment,
  TechnicalVerificationStatus,
  TechnicalAssessmentType,
  TechnicalAssessmentStatus,
} from './document-verification-model.ts';
import type { DocumentVersionStatus } from './document-model.ts';

export interface CreateVerificationParams {
  institutionId: string;
  documentId: string;
  versionId: string;
}

export interface RecordAssessmentParams {
  institutionId: string;
  documentId: string;
  versionId: string;
  verificationId: string;
  assessmentType: TechnicalAssessmentType;
  status: TechnicalAssessmentStatus;
  provider: string;
  attemptNumber: number;
  startedAt?: Date;
  completedAt?: Date;
  facts?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}

export class PostgresDocumentVerificationRepository {
  public async createOrGetVerification(
    client: pg.PoolClient,
    params: CreateVerificationParams,
  ): Promise<DocumentTechnicalVerification> {
    const existing = await this.getVerificationByVersion(
      client,
      params.institutionId,
      params.versionId,
    );
    if (existing) {
      return existing;
    }

    const res = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_id: string;
      status: TechnicalVerificationStatus;
      started_at: Date;
      due_at: Date;
      completed_at: Date | null;
      attempt_count: number;
      last_attempt_at: Date;
      next_retry_at: Date | null;
      quarantine_reason: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO document_technical_verifications (
        institution_id,
        document_id,
        version_id,
        status,
        started_at,
        due_at,
        attempt_count,
        last_attempt_at
      ) VALUES ($1, $2, $3, 'under_verification', now(), now() + interval '24 hours', 1, now())
      ON CONFLICT (institution_id, version_id)
      DO UPDATE SET updated_at = now()
      RETURNING *`,
      [params.institutionId, params.documentId, params.versionId],
    );

    const row = res.rows[0];
    return this.mapVerificationRow(row);
  }

  public async getVerificationByVersion(
    client: pg.PoolClient,
    institutionId: string,
    versionId: string,
  ): Promise<DocumentTechnicalVerification | null> {
    const res = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_id: string;
      status: TechnicalVerificationStatus;
      started_at: Date;
      due_at: Date;
      completed_at: Date | null;
      attempt_count: number;
      last_attempt_at: Date;
      next_retry_at: Date | null;
      quarantine_reason: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM document_technical_verifications
       WHERE institution_id = $1 AND version_id = $2`,
      [institutionId, versionId],
    );

    if (res.rows.length === 0) {
      return null;
    }
    return this.mapVerificationRow(res.rows[0]);
  }

  public async getVerificationById(
    client: pg.PoolClient,
    institutionId: string,
    verificationId: string,
  ): Promise<DocumentTechnicalVerification | null> {
    const res = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_id: string;
      status: TechnicalVerificationStatus;
      started_at: Date;
      due_at: Date;
      completed_at: Date | null;
      attempt_count: number;
      last_attempt_at: Date;
      next_retry_at: Date | null;
      quarantine_reason: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM document_technical_verifications
       WHERE institution_id = $1 AND id = $2`,
      [institutionId, verificationId],
    );

    if (res.rows.length === 0) {
      return null;
    }
    return this.mapVerificationRow(res.rows[0]);
  }

  public async recordAssessmentResult(
    client: pg.PoolClient,
    params: RecordAssessmentParams,
  ): Promise<DocumentTechnicalAssessment> {
    // 1. Check for existing assessment for (institution_id, verification_id, assessment_type, attempt_number)
    const existingRes = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_id: string;
      verification_id: string;
      assessment_type: TechnicalAssessmentType;
      status: TechnicalAssessmentStatus;
      provider: string;
      attempt_number: number;
      started_at: Date;
      completed_at: Date | null;
      facts: Record<string, unknown>;
      error_code: string | null;
      error_message: string | null;
      created_at: Date;
    }>(
      `SELECT * FROM document_technical_assessments
       WHERE institution_id = $1 AND verification_id = $2 AND assessment_type = $3 AND attempt_number = $4
       FOR UPDATE`,
      [params.institutionId, params.verificationId, params.assessmentType, params.attemptNumber],
    );

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];

      // Exact idempotent replay or conflicting same-attempt result:
      // ZERO UPDATE on existing assessment. Original row remains byte-for-byte immutable.
      return this.mapAssessmentRow(existing);
    }

    // 2. New assessment insert (append-only)
    const res = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_id: string;
      verification_id: string;
      assessment_type: TechnicalAssessmentType;
      status: TechnicalAssessmentStatus;
      provider: string;
      attempt_number: number;
      started_at: Date;
      completed_at: Date | null;
      facts: Record<string, unknown>;
      error_code: string | null;
      error_message: string | null;
      created_at: Date;
    }>(
      `INSERT INTO document_technical_assessments (
        institution_id,
        document_id,
        version_id,
        verification_id,
        assessment_type,
        status,
        provider,
        attempt_number,
        started_at,
        completed_at,
        facts,
        error_code,
        error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        params.institutionId,
        params.documentId,
        params.versionId,
        params.verificationId,
        params.assessmentType,
        params.status,
        params.provider,
        params.attemptNumber,
        params.startedAt || new Date(),
        params.completedAt || new Date(),
        JSON.stringify(params.facts || {}),
        params.errorCode || null,
        params.errorMessage || null,
      ],
    );

    return this.mapAssessmentRow(res.rows[0]);
  }

  public async listAssessmentsForVerification(
    client: pg.PoolClient,
    institutionId: string,
    verificationId: string,
  ): Promise<DocumentTechnicalAssessment[]> {
    const res = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_id: string;
      verification_id: string;
      assessment_type: TechnicalAssessmentType;
      status: TechnicalAssessmentStatus;
      provider: string;
      attempt_number: number;
      started_at: Date;
      completed_at: Date | null;
      facts: Record<string, unknown>;
      error_code: string | null;
      error_message: string | null;
      created_at: Date;
    }>(
      `SELECT * FROM document_technical_assessments
       WHERE institution_id = $1 AND verification_id = $2
       ORDER BY started_at ASC, attempt_number ASC`,
      [institutionId, verificationId],
    );

    return res.rows.map((row) => this.mapAssessmentRow(row));
  }

  public async transitionVerificationStatus(
    client: pg.PoolClient,
    institutionId: string,
    verificationId: string,
    newStatus: TechnicalVerificationStatus,
    quarantineReason?: string | null,
    nextRetryAt?: Date | null,
  ): Promise<DocumentTechnicalVerification> {
    const current = await client.query<{ status: string }>(
      `SELECT status FROM document_technical_verifications WHERE institution_id = $1 AND id = $2`,
      [institutionId, verificationId],
    );

    if (current.rows.length === 0) {
      throw new Error(`Verification ${verificationId} not found for status transition in institution ${institutionId}`);
    }

    if (current.rows[0].status === 'quarantined' && newStatus !== 'quarantined') {
      throw new Error(`QUARANTINE_IS_TERMINAL: Verification ${verificationId} is quarantined and cannot transition to ${newStatus}`);
    }

    const isCompleted = newStatus === 'available' || newStatus === 'quarantined' || newStatus === 'failed';
    const completedAtClause = isCompleted ? 'completed_at = COALESCE(completed_at, now()),' : '';

    const res = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_id: string;
      status: TechnicalVerificationStatus;
      started_at: Date;
      due_at: Date;
      completed_at: Date | null;
      attempt_count: number;
      last_attempt_at: Date;
      next_retry_at: Date | null;
      quarantine_reason: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE document_technical_verifications
       SET status = $1,
           quarantine_reason = COALESCE($2, quarantine_reason),
           next_retry_at = $3,
           ${completedAtClause}
           updated_at = now()
       WHERE institution_id = $4 AND id = $5
       RETURNING *`,
      [newStatus, quarantineReason || null, nextRetryAt || null, institutionId, verificationId],
    );

    return this.mapVerificationRow(res.rows[0]);
  }

  public async incrementAttempt(
    client: pg.PoolClient,
    institutionId: string,
    verificationId: string,
    nextRetryAt?: Date | null,
  ): Promise<DocumentTechnicalVerification> {
    const res = await client.query<{
      id: string;
      institution_id: string;
      document_id: string;
      version_id: string;
      status: TechnicalVerificationStatus;
      started_at: Date;
      due_at: Date;
      completed_at: Date | null;
      attempt_count: number;
      last_attempt_at: Date;
      next_retry_at: Date | null;
      quarantine_reason: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE document_technical_verifications
       SET attempt_count = attempt_count + 1,
           last_attempt_at = now(),
           next_retry_at = $1,
           updated_at = now()
       WHERE institution_id = $2 AND id = $3
       RETURNING *`,
      [nextRetryAt || null, institutionId, verificationId],
    );

    if (res.rows.length === 0) {
      throw new Error(`Verification ${verificationId} not found in institution ${institutionId}`);
    }

    return this.mapVerificationRow(res.rows[0]);
  }

  /**
   * Atomic CAS status transition of DocumentVersion.
   * Promotes: content_received -> available | quarantined.
   * Quarantine is terminal.
   */
  public async transitionVersionStatus(
    client: pg.PoolClient,
    institutionId: string,
    documentId: string,
    versionId: string,
    expectedStatus: DocumentVersionStatus,
    newStatus: DocumentVersionStatus,
  ): Promise<void> {
    if (expectedStatus === 'quarantined' && newStatus !== 'quarantined') {
      throw new Error(`QUARANTINE_IS_TERMINAL: Version ${versionId} is quarantined and cannot transition to ${newStatus}`);
    }

    const res = await client.query(
      `UPDATE document_versions
       SET status = $1
       WHERE institution_id = $2 AND document_id = $3 AND id = $4 AND status = $5`,
      [newStatus, institutionId, documentId, versionId, expectedStatus],
    );

    if (res.rowCount === 0) {
      // Fetch current status to report conflict accurately
      const check = await client.query<{ status: string }>(
        `SELECT status FROM document_versions WHERE institution_id = $1 AND id = $2`,
        [institutionId, versionId],
      );
      const actual = check.rows[0]?.status || 'NOT_FOUND';
      throw new Error(
        `DOCUMENT_VERSION_CONCURRENT_STATE_CONFLICT: expected status '${expectedStatus}', found '${actual}' for version ${versionId}`,
      );
    }
  }

  private mapVerificationRow(row: {
    id: string;
    institution_id: string;
    document_id: string;
    version_id: string;
    status: TechnicalVerificationStatus;
    started_at: Date;
    due_at: Date;
    completed_at: Date | null;
    attempt_count: number;
    last_attempt_at: Date;
    next_retry_at: Date | null;
    quarantine_reason: string | null;
    created_at: Date;
    updated_at: Date;
  }): DocumentTechnicalVerification {
    return {
      id: row.id,
      institutionId: row.institution_id,
      documentId: row.document_id,
      versionId: row.version_id,
      status: row.status,
      startedAt: row.started_at,
      dueAt: row.due_at,
      completedAt: row.completed_at,
      attemptCount: row.attempt_count,
      lastAttemptAt: row.last_attempt_at,
      nextRetryAt: row.next_retry_at,
      quarantineReason: row.quarantine_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAssessmentRow(row: {
    id: string;
    institution_id: string;
    document_id: string;
    version_id: string;
    verification_id: string;
    assessment_type: TechnicalAssessmentType;
    status: TechnicalAssessmentStatus;
    provider: string;
    attempt_number: number;
    started_at: Date;
    completed_at: Date | null;
    facts: Record<string, unknown>;
    error_code: string | null;
    error_message: string | null;
    created_at: Date;
  }): DocumentTechnicalAssessment {
    return {
      id: row.id,
      institutionId: row.institution_id,
      documentId: row.document_id,
      versionId: row.version_id,
      verificationId: row.verification_id,
      assessmentType: row.assessment_type,
      status: row.status,
      provider: row.provider,
      attemptNumber: row.attempt_number,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      facts: typeof row.facts === 'string' ? JSON.parse(row.facts) : row.facts,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    };
  }
}
