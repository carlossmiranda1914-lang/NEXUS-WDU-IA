-- FINANCE-F7-05: versioned official representation evidence. Financial Documents remain authoritative.
CREATE TABLE finance_financial_document_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  document_id UUID NOT NULL,
  render_version TEXT NOT NULL,
  template_version TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_hash TEXT NOT NULL,
  media_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size > 0),
  storage_reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','failed','missing','integrity_failed')),
  failure_code TEXT,
  CONSTRAINT finance_financial_document_artifacts_document_fk FOREIGN KEY (institution_id,document_id)
    REFERENCES finance_financial_documents(institution_id,id) ON DELETE RESTRICT,
  CONSTRAINT finance_financial_document_artifacts_version_unique UNIQUE (institution_id,document_id,render_version,template_version),
  CONSTRAINT finance_financial_document_artifacts_storage_unique UNIQUE (institution_id,storage_reference),
  CONSTRAINT finance_financial_document_artifacts_tenant_unique UNIQUE (institution_id,id)
);

CREATE INDEX idx_finance_financial_document_artifacts_document
  ON finance_financial_document_artifacts(institution_id,document_id,generated_at DESC);

CREATE OR REPLACE FUNCTION trg_finance_financial_document_artifacts_immutable_check()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Financial document artifact evidence is append-only and cannot be changed or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_finance_financial_document_artifacts_immutability
BEFORE UPDATE OR DELETE ON finance_financial_document_artifacts
FOR EACH ROW EXECUTE FUNCTION trg_finance_financial_document_artifacts_immutable_check();
