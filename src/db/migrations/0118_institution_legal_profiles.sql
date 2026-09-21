CREATE TABLE institution_legal_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  legal_name TEXT NOT NULL,
  tax_identifier TEXT,
  registered_address JSONB NOT NULL,
  legal_email TEXT,
  legal_phone TEXT,
  logo_asset_reference TEXT,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT institution_legal_profiles_version_unique UNIQUE (institution_id, version),
  CONSTRAINT institution_legal_profiles_effective_range CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX institution_legal_profiles_effective_lookup_idx
  ON institution_legal_profiles (institution_id, effective_from DESC);
