ALTER TABLE enrollment_documents
  ADD CONSTRAINT enrollment_documents_institution_id_id_application_unique
  UNIQUE (institution_id, id, enrollment_application_id);

CREATE TABLE enrollment_document_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  enrollment_application_id UUID NOT NULL,
  enrollment_document_id UUID NOT NULL,
  storage_key TEXT NOT NULL UNIQUE CHECK (storage_key ~ '^[a-z0-9_-]{32,128}$'),
  original_filename TEXT NOT NULL CHECK (char_length(original_filename) BETWEEN 1 AND 255),
  content_type TEXT NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  byte_size INTEGER CHECK (byte_size IS NULL OR (byte_size > 0 AND byte_size <= 6291456)),
  sha256 TEXT CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'),
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 160),
  request_fingerprint TEXT NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  status TEXT NOT NULL CHECK (status IN ('uploading', 'persisted', 'cleanup_pending', 'failed')),
  lease_expires_at TIMESTAMPTZ,
  persisted_at TIMESTAMPTZ,
  failure_reason TEXT,
  uploaded_by UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT enrollment_document_files_status_consistency CHECK (
    (status = 'uploading' AND lease_expires_at IS NOT NULL AND persisted_at IS NULL AND byte_size IS NULL AND sha256 IS NULL)
    OR (status = 'persisted' AND lease_expires_at IS NULL AND persisted_at IS NOT NULL AND byte_size IS NOT NULL AND sha256 IS NOT NULL)
    OR (status IN ('cleanup_pending', 'failed') AND persisted_at IS NULL)
  ),
  CONSTRAINT enrollment_document_files_application_fk
    FOREIGN KEY (institution_id, enrollment_application_id)
    REFERENCES enrollment_applications(institution_id, id) ON DELETE CASCADE,
  CONSTRAINT enrollment_document_files_document_fk
    FOREIGN KEY (institution_id, enrollment_document_id, enrollment_application_id)
    REFERENCES enrollment_documents(institution_id, id, enrollment_application_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX enrollment_document_files_persisted_document_unique
  ON enrollment_document_files (institution_id, enrollment_document_id)
  WHERE status = 'persisted';

CREATE UNIQUE INDEX enrollment_document_files_idempotency_unique
  ON enrollment_document_files (institution_id, enrollment_document_id, idempotency_key);

CREATE INDEX enrollment_document_files_reservation_idx
  ON enrollment_document_files (institution_id, enrollment_document_id, lease_expires_at)
  WHERE status = 'uploading';
