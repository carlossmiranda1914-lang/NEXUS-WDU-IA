-- NEXUS EDU IA — MIGRATION 0044
-- FINANCE-F7-02: immutable documentary provenance for the effective fiscal policy.
ALTER TABLE finance_financial_documents
  ADD COLUMN fiscal_configuration_id UUID,
  ADD COLUMN fiscal_adapter_key TEXT,
  ADD CONSTRAINT finance_financial_documents_fiscal_configuration_tenant_fk
    FOREIGN KEY (institution_id, fiscal_configuration_id)
    REFERENCES finance_fiscal_configuration_versions(institution_id, id) ON DELETE RESTRICT;

CREATE INDEX idx_finance_financial_documents_fiscal_configuration
  ON finance_financial_documents (institution_id, fiscal_configuration_id)
  WHERE fiscal_configuration_id IS NOT NULL;
