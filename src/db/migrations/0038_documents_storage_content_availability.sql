-- 0038_documents_storage_content_availability.sql
-- Documents Foundation vNext: Content Availability Projection on Storage References
-- Enforces 3 operational availability states: 'unknown', 'available', 'unavailable'
-- Pre-existing records start at 'unknown' by default. Only verified storage persistence promotes to 'available'.

ALTER TABLE document_storage_references
  ADD COLUMN IF NOT EXISTS content_availability TEXT NOT NULL DEFAULT 'unknown'
    CHECK (content_availability IN ('unknown', 'available', 'unavailable')),
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS unavailable_reason TEXT NULL;

CREATE INDEX IF NOT EXISTS document_storage_references_availability_idx
  ON document_storage_references (institution_id, content_availability);
