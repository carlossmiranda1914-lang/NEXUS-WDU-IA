-- Migration: 0036_documents_retention_holds_deletion.sql
-- Mission: DOCUMENTS-FOUNDATION-I6
-- Authority: Retention Holds & Deletion Foundation
--
-- PRODUCTION_AUTOMATED_RETENTION=BLOCKED (no governed jurisdiction profiles yet)
-- PRODUCTION_DEFINITIVE_DELETION=BLOCKED (no real storage provider + no governed policies)
-- All retention periods, clock triggers and authorization roles must come from governed config.
-- No legal period defaults are encoded here.

-- ─────────────────────────────────────────────────────────────────────────────
-- Extend document_versions.status to include deletion states
-- I1 original check: ('content_received','available','quarantined','superseded','withdrawn')
-- I6 adds:           'deletion_in_progress', 'deleted'
-- 'deleted' is terminal — content not recoverable under Documents authority.
-- 'deletion_in_progress' means physical deletion is pending / executing.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE document_versions
  DROP CONSTRAINT IF EXISTS document_versions_status_check;

ALTER TABLE document_versions
  ADD CONSTRAINT document_versions_status_check
    CHECK (status IN (
      'content_received',
      'available',
      'quarantined',
      'superseded',
      'withdrawn',
      'deletion_in_progress',
      'deleted'
    ));

-- ─────────────────────────────────────────────────────────────────────────────
-- document_retention_assignments
-- Captures the governing retention assignment for a document version.
-- Policy version and jurisdiction profile are frozen at assignment time.
-- Changing a policy MUST NOT silently rewrite historical retain_until.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_retention_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  document_id UUID NOT NULL,
  version_id UUID NOT NULL,

  -- Governed policy reference — no hardcoded period allowed
  policy_id TEXT NOT NULL CHECK (length(trim(policy_id)) BETWEEN 4 AND 128),
  policy_version TEXT NOT NULL CHECK (length(trim(policy_version)) BETWEEN 1 AND 64),

  -- Jurisdiction profile reference — must be explicit; null means FAIL CLOSED
  jurisdiction_profile_id TEXT NOT NULL CHECK (length(trim(jurisdiction_profile_id)) BETWEEN 4 AND 128),
  jurisdiction_profile_version TEXT NOT NULL CHECK (length(trim(jurisdiction_profile_version)) BETWEEN 1 AND 64),

  category TEXT NOT NULL CHECK (length(trim(category)) BETWEEN 2 AND 64),
  purpose TEXT NULL CHECK (purpose IS NULL OR length(trim(purpose)) BETWEEN 2 AND 128),

  -- Clock trigger: sourced from policy config — never assumed to be uploaded_at
  clock_trigger_type TEXT NOT NULL CHECK (length(trim(clock_trigger_type)) BETWEEN 4 AND 64),
  clock_trigger_event_at TIMESTAMPTZ NOT NULL,

  -- Calculated server-side from policy at assignment time — immutable after assignment
  retain_until TIMESTAMPTZ NOT NULL,

  -- Lifecycle: retention_active → retention_expired → eligible_for_deletion → deletion_authorized → deleted
  retention_status TEXT NOT NULL DEFAULT 'retention_active'
    CHECK (retention_status IN (
      'retention_active',
      'retention_expired',
      'eligible_for_deletion',
      'deletion_authorized',
      'deleted'
    )),

  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by_person_id UUID NOT NULL,
  correlation_id TEXT CHECK (correlation_id IS NULL OR length(trim(correlation_id)) BETWEEN 4 AND 128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_doc_retention_assignments_inst_id UNIQUE (institution_id, id),
  CONSTRAINT uq_doc_retention_assignments_inst_ver UNIQUE (institution_id, version_id),

  CONSTRAINT fk_doc_retention_assignments_inst
    FOREIGN KEY (institution_id) REFERENCES institutions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_retention_assignments_inst_doc
    FOREIGN KEY (institution_id, document_id) REFERENCES documents (institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_retention_assignments_inst_doc_ver
    FOREIGN KEY (institution_id, document_id, version_id)
    REFERENCES document_versions (institution_id, document_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_retention_assignments_person
    FOREIGN KEY (assigned_by_person_id) REFERENCES people (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_doc_retention_assignments_inst_status
  ON document_retention_assignments (institution_id, retention_status);

CREATE INDEX IF NOT EXISTS idx_doc_retention_assignments_inst_ver
  ON document_retention_assignments (institution_id, version_id);

CREATE INDEX IF NOT EXISTS idx_doc_retention_assignments_retain_until
  ON document_retention_assignments (institution_id, retain_until)
  WHERE retention_status = 'retention_active';

-- ─────────────────────────────────────────────────────────────────────────────
-- document_retention_holds
-- Legal/administrative hold. An active hold blocks deletion.
-- Hold record is NEVER deleted — historical hold is preserved after release.
-- Person/corpus-level holds are OUT OF SCOPE for I6.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_retention_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  document_id UUID NOT NULL,
  version_id UUID NOT NULL,

  -- 'legal' | 'administrative'
  hold_type TEXT NOT NULL CHECK (hold_type IN ('legal', 'administrative')),

  -- Explicit authority/basis — informal boolean holds are forbidden
  authority TEXT NOT NULL CHECK (length(trim(authority)) BETWEEN 4 AND 256),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 4 AND 512),

  -- Server-derived effective timestamp — not client-supplied
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Release facts — null while hold is active
  released_at TIMESTAMPTZ NULL,
  released_by_person_id UUID NULL,
  release_reason TEXT NULL CHECK (release_reason IS NULL OR length(trim(release_reason)) BETWEEN 4 AND 512),
  release_correlation_id TEXT NULL CHECK (release_correlation_id IS NULL OR length(trim(release_correlation_id)) BETWEEN 4 AND 128),

  -- Lifecycle: active | released (historical record preserved — never deleted)
  hold_status TEXT NOT NULL DEFAULT 'active' CHECK (hold_status IN ('active', 'released')),

  created_by_person_id UUID NOT NULL,
  correlation_id TEXT CHECK (correlation_id IS NULL OR length(trim(correlation_id)) BETWEEN 4 AND 128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_doc_retention_holds_inst_id UNIQUE (institution_id, id),

  CONSTRAINT fk_doc_retention_holds_inst
    FOREIGN KEY (institution_id) REFERENCES institutions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_retention_holds_inst_doc
    FOREIGN KEY (institution_id, document_id) REFERENCES documents (institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_retention_holds_inst_doc_ver
    FOREIGN KEY (institution_id, document_id, version_id)
    REFERENCES document_versions (institution_id, document_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_retention_holds_created_by
    FOREIGN KEY (created_by_person_id) REFERENCES people (id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_retention_holds_released_by
    FOREIGN KEY (released_by_person_id) REFERENCES people (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_doc_retention_holds_inst_ver_active
  ON document_retention_holds (institution_id, version_id)
  WHERE hold_status = 'active';

CREATE INDEX IF NOT EXISTS idx_doc_retention_holds_inst_status
  ON document_retention_holds (institution_id, hold_status);

-- ─────────────────────────────────────────────────────────────────────────────
-- document_deletion_authorizations
-- Explicit governance record authorizing deletion of a specific version.
-- System evaluates eligibility; authorized actor authorizes; executor performs.
-- Knowledge of this ID alone does not grant deletion capability.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_deletion_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  document_id UUID NOT NULL,
  version_id UUID NOT NULL,
  retention_assignment_id UUID NOT NULL,

  -- Governed policy basis — required, not invented
  policy_basis TEXT NOT NULL CHECK (length(trim(policy_basis)) BETWEEN 4 AND 256),
  policy_version TEXT NOT NULL CHECK (length(trim(policy_version)) BETWEEN 1 AND 64),
  jurisdiction_profile_id TEXT NOT NULL CHECK (length(trim(jurisdiction_profile_id)) BETWEEN 4 AND 128),

  authorized_by_person_id UUID NOT NULL,
  authorized_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Execution status of the authorization
  authorization_status TEXT NOT NULL DEFAULT 'authorized'
    CHECK (authorization_status IN (
      'authorized',
      'deletion_in_progress',
      'deleted',
      'deletion_reconciliation_required',
      'cancelled'
    )),

  correlation_id TEXT CHECK (correlation_id IS NULL OR length(trim(correlation_id)) BETWEEN 4 AND 128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_doc_deletion_authorizations_inst_id UNIQUE (institution_id, id),
  CONSTRAINT uq_doc_deletion_authorizations_inst_ver UNIQUE (institution_id, version_id),

  CONSTRAINT fk_doc_deletion_auth_inst
    FOREIGN KEY (institution_id) REFERENCES institutions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_deletion_auth_inst_doc
    FOREIGN KEY (institution_id, document_id) REFERENCES documents (institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_deletion_auth_inst_doc_ver
    FOREIGN KEY (institution_id, document_id, version_id)
    REFERENCES document_versions (institution_id, document_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_deletion_auth_retention
    FOREIGN KEY (institution_id, retention_assignment_id)
    REFERENCES document_retention_assignments (institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_deletion_auth_person
    FOREIGN KEY (authorized_by_person_id) REFERENCES people (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_doc_deletion_authorizations_inst_status
  ON document_deletion_authorizations (institution_id, authorization_status);

-- ─────────────────────────────────────────────────────────────────────────────
-- document_deletion_records
-- Minimal pseudonymized deletion evidence — permanent tombstone.
-- MUST NOT contain: raw document_id, raw version_id, storage locator,
--                   binary content, filename, content hash, credentials.
-- pseudonymized_ref = HMAC-SHA256(deletionPseudonymizationKey, canonical_identity)
-- storage_deletion_confirmed=true is a REQUIRED precondition for result='deleted'.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_deletion_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,

  -- References the authorization that governed this deletion
  deletion_authorization_id UUID NOT NULL,

  -- Per-operation CSPRNG correlation — NOT the HMAC key
  deletion_operation_id TEXT NOT NULL CHECK (length(trim(deletion_operation_id)) BETWEEN 8 AND 128),

  -- HMAC-SHA256(deletionPseudonymizationKey, institution_id:document_id:version_id:authorization_id)
  -- Non-reversible without the key; no raw IDs stored
  pseudonymized_ref TEXT NOT NULL CHECK (pseudonymized_ref ~ '^[a-f0-9]{64}$'),

  -- Governed policy reference (not content, not PII)
  policy_basis TEXT NOT NULL CHECK (length(trim(policy_basis)) BETWEEN 4 AND 256),
  policy_version TEXT NOT NULL CHECK (length(trim(policy_version)) BETWEEN 1 AND 64),
  jurisdiction_profile_id TEXT NOT NULL CHECK (length(trim(jurisdiction_profile_id)) BETWEEN 4 AND 128),

  -- Outcome — 'deleted' REQUIRES storage_deletion_confirmed=true (enforced by CHECK)
  result TEXT NOT NULL CHECK (result IN ('deleted', 'partial_failure', 'reconciliation_required')),
  storage_deletion_confirmed BOOLEAN NOT NULL,

  -- CONSTRAINT: result='deleted' requires storage_deletion_confirmed=true
  CONSTRAINT chk_deletion_record_storage_confirmed
    CHECK (result != 'deleted' OR storage_deletion_confirmed = true),

  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Role/scope reference — NOT person PII unless legally required
  actor_authority_scope TEXT NOT NULL CHECK (length(trim(actor_authority_scope)) BETWEEN 2 AND 128),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- DeletionRecord is append-only; no UPDATE, no DELETE
  CONSTRAINT uq_doc_deletion_records_inst_id UNIQUE (institution_id, id),
  CONSTRAINT uq_doc_deletion_records_auth UNIQUE (institution_id, deletion_authorization_id),

  CONSTRAINT fk_doc_deletion_records_inst
    FOREIGN KEY (institution_id) REFERENCES institutions (id) ON DELETE RESTRICT
  -- Note: NO FK to document_versions — version row may be tombstoned but
  -- DeletionRecord must survive even after version metadata changes.
  -- institution_id FK is sufficient for tenant isolation.
);

CREATE INDEX IF NOT EXISTS idx_doc_deletion_records_inst
  ON document_deletion_records (institution_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_doc_deletion_records_pseudonym
  ON document_deletion_records (institution_id, pseudonymized_ref);
