ALTER TABLE finance_financial_documents
  ADD COLUMN documentary_snapshot JSONB,
  ADD COLUMN documentary_snapshot_schema_version INTEGER;

ALTER TABLE finance_financial_documents
  ADD CONSTRAINT finance_financial_documents_snapshot_version_check
  CHECK (documentary_snapshot_schema_version IS NULL OR documentary_snapshot_schema_version > 0);

CREATE INDEX finance_financial_documents_snapshot_schema_idx
  ON finance_financial_documents (institution_id, documentary_snapshot_schema_version)
  WHERE documentary_snapshot_schema_version IS NOT NULL;
