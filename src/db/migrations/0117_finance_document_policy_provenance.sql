-- NEXUS EDU IA — MIGRATION 0048
-- FINANCE-F7-05: issued documents retain the evaluated policy evidence and
-- extension data used at issuance. These columns are covered by issued-fact immutability.
ALTER TABLE finance_financial_documents
  ADD COLUMN fiscal_policy_version TEXT,
  ADD COLUMN fiscal_policy_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN jurisdiction_extension_data JSONB NOT NULL DEFAULT '{}'::jsonb;
