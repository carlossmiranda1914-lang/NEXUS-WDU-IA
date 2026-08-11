-- Ownership bridge for legacy resources during the progressive migration.
-- A resource without a reviewed institutional mapping is intentionally
-- invisible to institutional APIs.
CREATE TABLE institution_resource_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT institution_resource_ownership_resource_unique
    UNIQUE (resource_type, resource_id)
);

CREATE INDEX institution_resource_ownership_scope_idx
  ON institution_resource_ownership (institution_id, resource_type);
