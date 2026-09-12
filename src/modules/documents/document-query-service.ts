import type { Pool } from 'pg';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import type {
  FrontendSafeDocumentDto,
  FrontendSafeDocumentVersionDto,
  FrontendSafeAssociationDto,
  FrontendSafeRetentionDto,
  FrontendSafeHoldDto,
  FrontendSafeDocumentCapabilities,
  FrontendSafeActivityDto,
} from './document-dto.ts';
import type { DocumentStatus, DocumentVersionStatus } from './document-model.ts';

export interface DocumentListQueryParams {
  page?: number | string;
  limit?: number | string;
  search?: string;
  category?: string;
  technicalStatus?: string;
  associationDomain?: string;
  retentionStatus?: string;
  holdStatus?: 'active' | 'released' | 'none';
  updatedFrom?: string;
  updatedTo?: string;
}

export interface DocumentListResponse {
  items: FrontendSafeDocumentDto[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface DocumentOperationalAvailability {
  canAccess?: boolean;
  canUpload?: boolean;
  canHold?: boolean;
  canDelete?: boolean;
}

function computeCapabilities(
  docStatus: DocumentStatus,
  currentVersionStatus: DocumentVersionStatus | null,
  activeHoldsCount: number,
  operationalAvailability?: DocumentOperationalAvailability,
): FrontendSafeDocumentCapabilities {
  const isArchived = docStatus === 'archived';
  const isVersionAvailable = currentVersionStatus === 'available';

  // Read actions are safe advisory flags based strictly on factual availability and operational dependencies; backend remains authoritative.
  const isAccessAvailable = operationalAvailability?.canAccess !== false;
  const canOpen = !isArchived && isVersionAvailable && isAccessAvailable;
  const canDownload = !isArchived && isVersionAvailable && isAccessAvailable;

  // Management actions: return conservative false. No API-local role matrix is used.
  // Backend command endpoints enforce authoritative policy and role authorization.
  return {
    canOpen,
    canDownload,
    canUploadVersion: false,
    canPlaceHold: false,
    canReleaseHold: false,
    canAuthorizeDeletion: false,
    canExecuteDeletion: false,
  };
}

export async function listDocumentsQuery(
  pool: Pool,
  context: InstitutionalContext,
  params: DocumentListQueryParams,
  operationalAvailability?: DocumentOperationalAvailability,
): Promise<DocumentListResponse> {
  const rawPage = Number(params.page);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const rawLimit = Number(params.limit);
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 20;
  const offset = (page - 1) * limit;

  const conditions: string[] = ['d.institution_id = $1'];
  const values: unknown[] = [context.institutionId];
  let paramIdx = 2;

  if (params.category && params.category.trim()) {
    conditions.push(`d.category = $${paramIdx++}`);
    values.push(params.category.trim());
  }

  if (params.search && params.search.trim()) {
    const searchPattern = `%${params.search.trim()}%`;
    conditions.push(`(
      d.category ILIKE $${paramIdx} OR
      d.classification ILIKE $${paramIdx} OR
      EXISTS (
        SELECT 1 FROM document_upload_sessions s
        WHERE s.institution_id = d.institution_id
          AND s.document_id = d.id
          AND s.declared_filename ILIKE $${paramIdx}
      )
    )`);
    values.push(searchPattern);
    paramIdx++;
  }

  if (params.technicalStatus && params.technicalStatus.trim()) {
    conditions.push(`EXISTS (
      SELECT 1 FROM document_versions v
      WHERE v.institution_id = d.institution_id
        AND v.document_id = d.id
        AND v.status = $${paramIdx++}
        AND v.version_number = (
          SELECT MAX(v2.version_number)
          FROM document_versions v2
          WHERE v2.institution_id = d.institution_id
            AND v2.document_id = d.id
        )
    )`);
    values.push(params.technicalStatus.trim());
  }

  if (params.associationDomain && params.associationDomain.trim()) {
    conditions.push(`EXISTS (
      SELECT 1 FROM document_associations a
      WHERE a.institution_id = d.institution_id
        AND a.document_id = d.id
        AND a.target_domain = $${paramIdx++}
        AND a.status = 'active'
    )`);
    values.push(params.associationDomain.trim());
  }

  if (params.retentionStatus && params.retentionStatus.trim()) {
    conditions.push(`EXISTS (
      SELECT 1 FROM document_retention_assignments r
      WHERE r.institution_id = d.institution_id
        AND r.document_id = d.id
        AND r.retention_status = $${paramIdx++}
    )`);
    values.push(params.retentionStatus.trim());
  }

  if (params.holdStatus) {
    if (params.holdStatus === 'active') {
      conditions.push(`EXISTS (
        SELECT 1 FROM document_retention_holds h
        WHERE h.institution_id = d.institution_id
          AND h.document_id = d.id
          AND h.hold_status = 'active'
      )`);
    } else if (params.holdStatus === 'released') {
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM document_retention_holds h
          WHERE h.institution_id = d.institution_id
            AND h.document_id = d.id
            AND h.hold_status = 'released'
        ) AND NOT EXISTS (
          SELECT 1 FROM document_retention_holds h
          WHERE h.institution_id = d.institution_id
            AND h.document_id = d.id
            AND h.hold_status = 'active'
        )
      )`);
    } else if (params.holdStatus === 'none') {
      conditions.push(`NOT EXISTS (
        SELECT 1 FROM document_retention_holds h
        WHERE h.institution_id = d.institution_id
          AND h.document_id = d.id
      )`);
    }
  }

  if (params.updatedFrom && params.updatedFrom.trim()) {
    conditions.push(`d.updated_at >= $${paramIdx++}::timestamptz`);
    values.push(params.updatedFrom.trim());
  }

  if (params.updatedTo && params.updatedTo.trim()) {
    conditions.push(`d.updated_at <= $${paramIdx++}::timestamptz`);
    values.push(params.updatedTo.trim());
  }

  const whereClause = conditions.join(' AND ');

  const countQuery = `SELECT count(*)::int AS total FROM documents d WHERE ${whereClause}`;
  const countResult = await pool.query<{ total: number }>(countQuery, values);
  const total = countResult.rows[0]?.total ?? 0;

  const selectQuery = `
    SELECT d.id, d.institution_id, d.category, d.classification, d.status, d.created_at, d.updated_at
    FROM documents d
    WHERE ${whereClause}
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;
  const listValues = [...values, limit, offset];
  const listResult = await pool.query<{
    id: string;
    institution_id: string;
    category: string;
    classification: string | null;
    status: DocumentStatus;
    created_at: Date;
    updated_at: Date;
  }>(selectQuery, listValues);

  const documentIds = listResult.rows.map((r) => r.id);
  if (documentIds.length === 0) {
    return {
      items: [],
      total,
      page,
      limit,
      hasMore: false,
    };
  }

  // Load associated metadata in batch
  const versionsQuery = `
    SELECT v.id, v.document_id, v.version_number, v.mime_type, v.byte_size, v.sha256_hash, v.status, v.created_at
    FROM document_versions v
    WHERE v.institution_id = $1 AND v.document_id = ANY($2::uuid[])
    ORDER BY v.document_id, v.version_number DESC
  `;
  const versionsResult = await pool.query<{
    id: string;
    document_id: string;
    version_number: number;
    mime_type: string;
    byte_size: string;
    sha256_hash: string;
    status: DocumentVersionStatus;
    created_at: Date;
  }>(versionsQuery, [context.institutionId, documentIds]);

  const associationsQuery = `
    SELECT a.id, a.document_id, a.target_domain, a.target_resource_type, a.target_resource_id, a.purpose, a.status, a.pinned_version_id, a.created_at
    FROM document_associations a
    WHERE a.institution_id = $1 AND a.document_id = ANY($2::uuid[])
    ORDER BY a.created_at DESC
  `;
  const associationsResult = await pool.query<{
    id: string;
    document_id: string;
    target_domain: string;
    target_resource_type: string;
    target_resource_id: string;
    purpose: string;
    status: string;
    pinned_version_id: string | null;
    created_at: Date;
  }>(associationsQuery, [context.institutionId, documentIds]);

  const retentionsQuery = `
    SELECT r.id, r.document_id, r.policy_id, r.policy_version, r.jurisdiction_profile_id, r.category, r.purpose,
           r.clock_trigger_type, r.clock_trigger_event_at, r.retain_until, r.retention_status, r.assigned_at
    FROM document_retention_assignments r
    WHERE r.institution_id = $1 AND r.document_id = ANY($2::uuid[])
    ORDER BY r.assigned_at DESC
  `;
  const retentionsResult = await pool.query<{
    id: string;
    document_id: string;
    policy_id: string;
    policy_version: string;
    jurisdiction_profile_id: string;
    category: string;
    purpose: string | null;
    clock_trigger_type: string;
    clock_trigger_event_at: Date;
    retain_until: Date;
    retention_status: string;
    assigned_at: Date;
  }>(retentionsQuery, [context.institutionId, documentIds]);

  const holdsQuery = `
    SELECT h.id, h.document_id, h.version_id, h.hold_type, h.authority, h.reason, h.effective_at, h.released_at, h.release_reason, h.hold_status
    FROM document_retention_holds h
    WHERE h.institution_id = $1 AND h.document_id = ANY($2::uuid[])
    ORDER BY h.effective_at DESC
  `;
  const holdsResult = await pool.query<{
    id: string;
    document_id: string;
    version_id: string;
    hold_type: 'legal' | 'administrative';
    authority: string;
    reason: string;
    effective_at: Date;
    released_at: Date | null;
    release_reason: string | null;
    hold_status: 'active' | 'released';
  }>(holdsQuery, [context.institutionId, documentIds]);

  // Group by document_id
  const versionsByDoc = new Map<string, typeof versionsResult.rows>();
  for (const v of versionsResult.rows) {
    const list = versionsByDoc.get(v.document_id) || [];
    list.push(v);
    versionsByDoc.set(v.document_id, list);
  }

  const associationsByDoc = new Map<string, typeof associationsResult.rows>();
  for (const a of associationsResult.rows) {
    const list = associationsByDoc.get(a.document_id) || [];
    list.push(a);
    associationsByDoc.set(a.document_id, list);
  }

  const retentionsByDoc = new Map<string, typeof retentionsResult.rows[0]>();
  for (const r of retentionsResult.rows) {
    if (!retentionsByDoc.has(r.document_id)) {
      retentionsByDoc.set(r.document_id, r);
    }
  }

  const activeHoldsByDoc = new Map<string, typeof holdsResult.rows>();
  for (const h of holdsResult.rows) {
    if (h.hold_status === 'active') {
      const list = activeHoldsByDoc.get(h.document_id) || [];
      list.push(h);
      activeHoldsByDoc.set(h.document_id, list);
    }
  }

  const items: FrontendSafeDocumentDto[] = listResult.rows.map((docRow) => {
    const docVersions = versionsByDoc.get(docRow.id) || [];
    const latestVersionRow = docVersions[0] || null;
    const docAssocs = associationsByDoc.get(docRow.id) || [];
    const docRetention = retentionsByDoc.get(docRow.id) || null;
    const docActiveHolds = activeHoldsByDoc.get(docRow.id) || [];

    const currentVersion: FrontendSafeDocumentVersionDto | null = latestVersionRow
      ? {
          id: latestVersionRow.id,
          versionNumber: latestVersionRow.version_number,
          mimeType: latestVersionRow.mime_type,
          byteSize: Number(latestVersionRow.byte_size),
          sha256Hash: latestVersionRow.sha256_hash,
          status: latestVersionRow.status,
          createdAt: new Date(latestVersionRow.created_at).toISOString(),
        }
      : null;

    const associations: FrontendSafeAssociationDto[] = docAssocs.map((a) => ({
      id: a.id,
      targetDomain: a.target_domain,
      targetResourceType: a.target_resource_type,
      targetResourceId: a.target_resource_id,
      purpose: a.purpose,
      status: a.status,
      pinnedVersionId: a.pinned_version_id,
      createdAt: new Date(a.created_at).toISOString(),
    }));

    const retention: FrontendSafeRetentionDto | null = docRetention
      ? {
          id: docRetention.id,
          policyId: docRetention.policy_id,
          policyVersion: docRetention.policy_version,
          jurisdictionProfileId: docRetention.jurisdiction_profile_id,
          category: docRetention.category,
          purpose: docRetention.purpose,
          clockTriggerType: docRetention.clock_trigger_type,
          clockTriggerEventAt: new Date(docRetention.clock_trigger_event_at).toISOString(),
          retainUntil: new Date(docRetention.retain_until).toISOString(),
          retentionStatus: docRetention.retention_status,
          assignedAt: new Date(docRetention.assigned_at).toISOString(),
        }
      : null;

    const activeHolds: FrontendSafeHoldDto[] = docActiveHolds.map((h) => ({
      id: h.id,
      versionId: h.version_id,
      holdType: h.hold_type,
      authority: h.authority,
      reason: h.reason,
      effectiveAt: new Date(h.effective_at).toISOString(),
      releasedAt: h.released_at ? new Date(h.released_at).toISOString() : null,
      releaseReason: h.release_reason,
      holdStatus: h.hold_status,
    }));

    const capabilities = computeCapabilities(
      docRow.status,
      currentVersion?.status ?? null,
      activeHolds.length,
      operationalAvailability,
    );

    return {
      id: docRow.id,
      institutionId: docRow.institution_id,
      category: docRow.category,
      classification: docRow.classification,
      status: docRow.status,
      createdAt: new Date(docRow.created_at).toISOString(),
      updatedAt: new Date(docRow.updated_at).toISOString(),
      currentVersion,
      versionCount: docVersions.length,
      associations,
      retention,
      activeHolds,
      capabilities,
    };
  });

  return {
    items,
    total,
    page,
    limit,
    hasMore: offset + items.length < total,
  };
}

export async function getDocumentDetailQuery(
  pool: Pool,
  context: InstitutionalContext,
  documentId: string,
  operationalAvailability?: DocumentOperationalAvailability,
): Promise<FrontendSafeDocumentDto | null> {
  const docResult = await pool.query<{
    id: string;
    institution_id: string;
    category: string;
    classification: string | null;
    status: DocumentStatus;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, institution_id, category, classification, status, created_at, updated_at
     FROM documents
     WHERE institution_id = $1 AND id = $2`,
    [context.institutionId, documentId],
  );

  if (docResult.rows.length === 0) {
    return null;
  }

  const docRow = docResult.rows[0];

  const versionsResult = await pool.query<{
    id: string;
    version_number: number;
    mime_type: string;
    byte_size: string;
    sha256_hash: string;
    status: DocumentVersionStatus;
    created_at: Date;
  }>(
    `SELECT id, version_number, mime_type, byte_size, sha256_hash, status, created_at
     FROM document_versions
     WHERE institution_id = $1 AND document_id = $2
     ORDER BY version_number DESC`,
    [context.institutionId, documentId],
  );

  const associationsResult = await pool.query<{
    id: string;
    target_domain: string;
    target_resource_type: string;
    target_resource_id: string;
    purpose: string;
    status: string;
    pinned_version_id: string | null;
    created_at: Date;
  }>(
    `SELECT id, target_domain, target_resource_type, target_resource_id, purpose, status, pinned_version_id, created_at
     FROM document_associations
     WHERE institution_id = $1 AND document_id = $2
     ORDER BY created_at DESC`,
    [context.institutionId, documentId],
  );

  const retentionsResult = await pool.query<{
    id: string;
    policy_id: string;
    policy_version: string;
    jurisdiction_profile_id: string;
    category: string;
    purpose: string | null;
    clock_trigger_type: string;
    clock_trigger_event_at: Date;
    retain_until: Date;
    retention_status: string;
    assigned_at: Date;
  }>(
    `SELECT id, policy_id, policy_version, jurisdiction_profile_id, category, purpose,
            clock_trigger_type, clock_trigger_event_at, retain_until, retention_status, assigned_at
     FROM document_retention_assignments
     WHERE institution_id = $1 AND document_id = $2
     ORDER BY assigned_at DESC
     LIMIT 1`,
    [context.institutionId, documentId],
  );

  const holdsResult = await pool.query<{
    id: string;
    version_id: string;
    hold_type: 'legal' | 'administrative';
    authority: string;
    reason: string;
    effective_at: Date;
    released_at: Date | null;
    release_reason: string | null;
    hold_status: 'active' | 'released';
  }>(
    `SELECT id, version_id, hold_type, authority, reason, effective_at, released_at, release_reason, hold_status
     FROM document_retention_holds
     WHERE institution_id = $1 AND document_id = $2 AND hold_status = 'active'
     ORDER BY effective_at DESC`,
    [context.institutionId, documentId],
  );

  const latestVersionRow = versionsResult.rows[0] || null;
  const currentVersion: FrontendSafeDocumentVersionDto | null = latestVersionRow
    ? {
        id: latestVersionRow.id,
        versionNumber: latestVersionRow.version_number,
        mimeType: latestVersionRow.mime_type,
        byteSize: Number(latestVersionRow.byte_size),
        sha256Hash: latestVersionRow.sha256_hash,
        status: latestVersionRow.status,
        createdAt: new Date(latestVersionRow.created_at).toISOString(),
      }
    : null;

  const associations: FrontendSafeAssociationDto[] = associationsResult.rows.map((a) => ({
    id: a.id,
    targetDomain: a.target_domain,
    targetResourceType: a.target_resource_type,
    targetResourceId: a.target_resource_id,
    purpose: a.purpose,
    status: a.status,
    pinnedVersionId: a.pinned_version_id,
    createdAt: new Date(a.created_at).toISOString(),
  }));

  const docRetention = retentionsResult.rows[0] || null;
  const retention: FrontendSafeRetentionDto | null = docRetention
    ? {
        id: docRetention.id,
        policyId: docRetention.policy_id,
        policyVersion: docRetention.policy_version,
        jurisdictionProfileId: docRetention.jurisdiction_profile_id,
        category: docRetention.category,
        purpose: docRetention.purpose,
        clockTriggerType: docRetention.clock_trigger_type,
        clockTriggerEventAt: new Date(docRetention.clock_trigger_event_at).toISOString(),
        retainUntil: new Date(docRetention.retain_until).toISOString(),
        retentionStatus: docRetention.retention_status,
        assignedAt: new Date(docRetention.assigned_at).toISOString(),
      }
    : null;

  const activeHolds: FrontendSafeHoldDto[] = holdsResult.rows.map((h) => ({
    id: h.id,
    versionId: h.version_id,
    holdType: h.hold_type,
    authority: h.authority,
    reason: h.reason,
    effectiveAt: new Date(h.effective_at).toISOString(),
    releasedAt: h.released_at ? new Date(h.released_at).toISOString() : null,
    releaseReason: h.release_reason,
    holdStatus: h.hold_status,
  }));

  const capabilities = computeCapabilities(
    docRow.status,
    currentVersion?.status ?? null,
    activeHolds.length,
    operationalAvailability,
  );

  return {
    id: docRow.id,
    institutionId: docRow.institution_id,
    category: docRow.category,
    classification: docRow.classification,
    status: docRow.status,
    createdAt: new Date(docRow.created_at).toISOString(),
    updatedAt: new Date(docRow.updated_at).toISOString(),
    currentVersion,
    versionCount: versionsResult.rows.length,
    associations,
    retention,
    activeHolds,
    capabilities,
  };
}

export async function getDocumentActivityQuery(
  pool: Pool,
  context: InstitutionalContext,
  documentId: string,
): Promise<FrontendSafeActivityDto[]> {
  // First confirm document exists in institution
  const docCheck = await pool.query<{ id: string }>(
    `SELECT id FROM documents WHERE institution_id = $1 AND id = $2`,
    [context.institutionId, documentId],
  );

  if (docCheck.rows.length === 0) {
    throw new Error('DOCUMENT_NOT_FOUND: Document does not exist in this institution.');
  }

  const query = `
    SELECT e.id, e.occurred_at, e.action, e.outcome, e.actor_person_id, p.name AS actor_name, e.details
    FROM document_audit_events e
    LEFT JOIN people p ON p.id = e.actor_person_id
    WHERE e.institution_id = $1 AND e.document_id = $2
    ORDER BY e.occurred_at DESC, e.id DESC
    LIMIT 100
  `;

  const result = await pool.query<{
    id: string;
    occurred_at: Date;
    action: string;
    outcome: string;
    actor_person_id: string | null;
    actor_name: string | null;
    details: Record<string, unknown>;
  }>(query, [context.institutionId, documentId]);

  return result.rows.map((row) => {
    const eventType = row.action;
    let title = eventType;
    let description = `Outcome: ${row.outcome}`;

    if (eventType === 'document.created') {
      title = 'Documento Criado';
      description = 'O documento lógico foi registado na plataforma.';
    } else if (eventType === 'document.upload_session_created') {
      title = 'Sessão de Upload Criada';
      description = 'Uma nova sessão de upload foi autorizada.';
    } else if (eventType === 'document.upload_completed') {
      title = 'Upload Concluído';
      description = 'Ficheiro recebido com sucesso e nova versão registada.';
    } else if (eventType.startsWith('document.content_access_granted')) {
      title = 'Acesso ao Conteúdo Autorizado';
      description = 'Autorização e concessão de acesso emitidas.';
    } else if (eventType.startsWith('document.content_stream_opened')) {
      title = 'Conteúdo Acedido';
      description = 'Fluxo de conteúdo transferido com sucesso.';
    } else if (eventType.startsWith('document.content_access_denied')) {
      title = 'Acesso Negado';
      description = 'Tentativa de acesso ao documento bloqueada por política.';
    } else if (eventType === 'document.content_access_revoked') {
      title = 'Acesso Revogado';
      description = 'A concessão de acesso foi revogada.';
    } else if (eventType === 'document.hold_placed') {
      title = 'Retenção / Bloqueio Aplicado';
      description = 'Foi colocado um bloqueio legal/administrativo.';
    } else if (eventType === 'document.hold_released') {
      title = 'Bloqueio Libertado';
      description = 'O bloqueio sobre o documento foi levantado.';
    } else if (eventType === 'document.deletion_authorized') {
      title = 'Eliminação Autorizada';
      description = 'A eliminação do documento foi autorizada conforme política de retenção.';
    } else if (eventType === 'document.deletion_executed') {
      title = 'Eliminação Executada';
      description = 'O conteúdo foi eliminado do armazenamento.';
    } else if (eventType === 'document.deletion_reconciled') {
      title = 'Eliminação Reconciliada';
      description = 'Eliminação reconciliada e finalizada com sucesso.';
    }

    return {
      id: row.id,
      occurredAt: new Date(row.occurred_at).toISOString(),
      eventType,
      title,
      description,
      actorKind: row.actor_person_id ? 'person' : 'system',
      actorName: row.actor_name || null,
    };
  });
}
