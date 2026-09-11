-- NEXUS EDU IA — MIGRATION 0043
-- FINANCE-F7-02: series configuration only; sequence allocation remains F7-01.
ALTER TABLE finance_financial_document_series
  ADD COLUMN document_type TEXT NOT NULL DEFAULT 'receipt',
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  ADD COLUMN effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN effective_to TIMESTAMPTZ,
  ADD COLUMN fiscal_configuration_id UUID,
  ADD CONSTRAINT finance_financial_document_series_effective_interval
    CHECK (effective_to IS NULL OR effective_from < effective_to),
  ADD CONSTRAINT finance_financial_document_series_fiscal_configuration_tenant_fk
    FOREIGN KEY (institution_id, fiscal_configuration_id)
    REFERENCES finance_fiscal_configuration_versions(institution_id, id) ON DELETE RESTRICT;

CREATE INDEX idx_finance_financial_document_series_effective
  ON finance_financial_document_series (institution_id, document_type, status, effective_from DESC);
