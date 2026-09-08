-- DOCUMENTS-FOUNDATION-I1: Canonical Document Core Authority
-- Institution-scoped logical documents, immutable versions, provenance, opaque storage references, idempotency, and factual audit events.

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK (length(trim(category)) BETWEEN 2 AND 64),
  classification TEXT CHECK (classification IS NULL OR length(trim(classification)) BETWEEN 2 AND 64),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deprecating', 'restricted')),
  created_by_person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT documents_institution_id_unique UNIQUE (institution_id, id)
);

CREATE INDEX IF NOT EXISTS documents_institution_category_idx
  ON documents (institution_id, category);

CREATE INDEX IF NOT EXISTS documents_institution_created_idx
  ON documents (institution_id, created_at DESC);

CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  document_id UUID NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  mime_type TEXT NOT NULL CHECK (length(trim(mime_type)) BETWEEN 3 AND 128),
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  sha256_hash TEXT NOT NULL CHECK (sha256_hash ~ '^[a-f0-9]{64}$'),
  status TEXT NOT NULL DEFAULT 'content_received' CHECK (status IN ('content_received', 'available', 'quarantined', 'superseded', 'withdrawn')),
  created_by_person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_versions_document_tenant_fk
    FOREIGN KEY (institution_id, document_id)
    REFERENCES documents(institution_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT document_versions_institution_id_unique
    UNIQUE (institution_id, id),
  CONSTRAINT document_versions_institution_document_id_unique
    UNIQUE (institution_id, document_id, id),
  CONSTRAINT document_versions_document_version_unique
    UNIQUE (institution_id, document_id, version_number)
);

CREATE INDEX IF NOT EXISTS document_versions_document_sequence_idx
  ON document_versions (institution_id, document_id, version_number DESC);

CREATE INDEX IF NOT EXISTS document_versions_hash_idx
  ON document_versions (institution_id, sha256_hash);

CREATE TABLE IF NOT EXISTS document_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  document_id UUID NOT NULL,
  version_id UUID NOT NULL,
  origin_type TEXT NOT NULL CHECK (origin_type IN ('user_upload', 'system_generated', 'domain_generated', 'import', 'external_integration', 'legacy_migration')),
  actor_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  source_domain TEXT NOT NULL CHECK (length(trim(source_domain)) BETWEEN 2 AND 64),
  method TEXT NOT NULL CHECK (length(trim(method)) BETWEEN 2 AND 64),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  correlation_id TEXT CHECK (correlation_id IS NULL OR length(trim(correlation_id)) BETWEEN 4 AND 128),
  CONSTRAINT document_provenance_version_doc_tenant_fk
    FOREIGN KEY (institution_id, document_id, version_id)
    REFERENCES document_versions(institution_id, document_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS document_provenance_version_idx
  ON document_provenance (institution_id, version_id);

CREATE TABLE IF NOT EXISTS document_storage_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  version_id UUID NOT NULL,
  storage_provider TEXT NOT NULL CHECK (length(trim(storage_provider)) BETWEEN 2 AND 64),
  storage_bucket TEXT NOT NULL CHECK (length(trim(storage_bucket)) BETWEEN 2 AND 128),
  storage_key TEXT NOT NULL CHECK (length(trim(storage_key)) BETWEEN 4 AND 512),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_storage_references_version_tenant_fk
    FOREIGN KEY (institution_id, version_id)
    REFERENCES document_versions(institution_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT document_storage_references_version_unique
    UNIQUE (institution_id, version_id, storage_provider, storage_key)
);

CREATE INDEX IF NOT EXISTS document_storage_references_version_idx
  ON document_storage_references (institution_id, version_id);

CREATE TABLE IF NOT EXISTS document_idempotency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  command_scope TEXT NOT NULL CHECK (length(trim(command_scope)) BETWEEN 4 AND 128),
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) BETWEEN 8 AND 160),
  request_fingerprint TEXT NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  result_ref TEXT NOT NULL CHECK (length(trim(result_ref)) > 0),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_idempotency_records_scope_unique
    UNIQUE (institution_id, command_scope, idempotency_key)
);

CREATE TABLE IF NOT EXISTS document_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  document_id UUID,
  version_id UUID,
  actor_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (length(trim(action)) BETWEEN 2 AND 64),
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'denied', 'failed')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  correlation_id TEXT CHECK (correlation_id IS NULL OR length(trim(correlation_id)) BETWEEN 4 AND 128),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT document_audit_events_document_tenant_fk
    FOREIGN KEY (institution_id, document_id)
    REFERENCES documents(institution_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT document_audit_events_version_tenant_fk
    FOREIGN KEY (institution_id, version_id)
    REFERENCES document_versions(institution_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS document_audit_events_tenant_occurred_idx
  ON document_audit_events (institution_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS document_audit_events_document_idx
  ON document_audit_events (institution_id, document_id)
  WHERE document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_audit_events_version_idx
  ON document_audit_events (institution_id, version_id)
  WHERE version_id IS NOT NULL;
