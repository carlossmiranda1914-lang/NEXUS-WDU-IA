CREATE TABLE finance_fee_catalogue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','inactive')) DEFAULT 'active',
  current_version INTEGER NOT NULL CHECK (current_version > 0),
  created_by_person_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finance_fee_catalogue_items_institution_code_unique UNIQUE (institution_id, code),
  CONSTRAINT finance_fee_catalogue_items_institution_id_unique UNIQUE (institution_id, id)
);

CREATE TABLE finance_fee_catalogue_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  item_id UUID NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (scale(amount) <= 12 AND abs(amount) < 1000000000000000000::NUMERIC AND amount > 0),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  created_by_person_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finance_fee_catalogue_versions_item_tenant_fk FOREIGN KEY (institution_id, item_id)
    REFERENCES finance_fee_catalogue_items(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT finance_fee_catalogue_versions_item_version_unique UNIQUE (institution_id, item_id, version),
  CONSTRAINT finance_fee_catalogue_versions_effective_interval CHECK (effective_to IS NULL OR effective_from < effective_to)
);
