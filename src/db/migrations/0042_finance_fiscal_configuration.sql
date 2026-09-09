-- NEXUS EDU IA — MIGRATION 0042
-- FINANCE-F7-02: institution-scoped documentary/fiscal configuration.
-- Jurisdiction remains owned by finance_profile_versions; this table stores
-- only versioned operational configuration selected by that profile.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE finance_fiscal_configuration_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  adapter_key TEXT NOT NULL CHECK (adapter_key ~ '^[a-z][a-z0-9_]*$'),
  operational_configuration JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(operational_configuration) = 'object'),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finance_fiscal_configuration_versions_interval CHECK (
    effective_to IS NULL OR effective_from < effective_to
  ),
  CONSTRAINT finance_fiscal_configuration_versions_institution_version_unique
    UNIQUE (institution_id, version),
  CONSTRAINT finance_fiscal_configuration_versions_institution_id_unique
    UNIQUE (institution_id, id),
  CONSTRAINT finance_fiscal_configuration_versions_no_effective_overlap
    EXCLUDE USING gist (
      institution_id WITH =,
      tstzrange(effective_from, effective_to, '[)') WITH &&
    )
);

CREATE INDEX idx_finance_fiscal_configuration_versions_effective
  ON finance_fiscal_configuration_versions (institution_id, effective_from DESC);
