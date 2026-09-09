-- DOCUMENTS-FOUNDATION-I3: Canonical Document Storage & Upload Foundation Authority
-- Institution-scoped upload sessions, temporary authorization tokens, resumable sessions, and version linking.

CREATE TABLE IF NOT EXISTS document_upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  document_id UUID NOT NULL,
  target_version_number INTEGER CHECK (target_version_number > 0),
  declared_filename TEXT NOT NULL CHECK (length(trim(declared_filename)) BETWEEN 1 AND 255),
  declared_mime_type TEXT NOT NULL CHECK (length(trim(declared_mime_type)) BETWEEN 3 AND 128),
  declared_byte_size BIGINT NOT NULL CHECK (declared_byte_size > 0),
  storage_provider TEXT NOT NULL CHECK (length(trim(storage_provider)) BETWEEN 2 AND 64),
  storage_bucket TEXT NOT NULL CHECK (length(trim(storage_bucket)) BETWEEN 2 AND 128),
  storage_key TEXT NOT NULL CHECK (length(trim(storage_key)) BETWEEN 4 AND 512),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'authorized', 'uploading', 'completed', 'cancelled', 'expired', 'failed')),
  upload_token_hash TEXT NOT NULL CHECK (upload_token_hash ~ '^[a-f0-9]{64}$'),
  authorized_until TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  completed_version_id UUID,
  created_by_person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_upload_sessions_institution_id_unique
    UNIQUE (institution_id, id),
  CONSTRAINT document_upload_sessions_document_tenant_fk
    FOREIGN KEY (institution_id, document_id)
    REFERENCES documents(institution_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT document_upload_sessions_completed_version_tenant_fk
    FOREIGN KEY (institution_id, document_id, completed_version_id)
    REFERENCES document_versions(institution_id, document_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT document_upload_sessions_expiry_order
    CHECK (authorized_until <= expires_at)
);

CREATE INDEX IF NOT EXISTS document_upload_sessions_document_idx
  ON document_upload_sessions (institution_id, document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS document_upload_sessions_status_idx
  ON document_upload_sessions (institution_id, status);

CREATE INDEX IF NOT EXISTS document_upload_sessions_token_idx
  ON document_upload_sessions (institution_id, upload_token_hash);
