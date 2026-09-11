-- FINANCE-F7-05: durable bytes for Finance-owned official artifact evidence.
CREATE TABLE finance_financial_document_artifact_blobs (
  storage_reference TEXT PRIMARY KEY,
  content BYTEA NOT NULL CHECK (octet_length(content) > 0),
  stored_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION trg_finance_financial_document_artifact_blobs_immutable_check()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Financial document artifact bytes are append-only and cannot be changed or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_finance_financial_document_artifact_blobs_immutability
BEFORE UPDATE OR DELETE ON finance_financial_document_artifact_blobs
FOR EACH ROW EXECUTE FUNCTION trg_finance_financial_document_artifact_blobs_immutable_check();
