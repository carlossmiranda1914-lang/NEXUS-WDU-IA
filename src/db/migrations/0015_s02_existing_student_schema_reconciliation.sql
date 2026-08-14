-- Operational repair for databases provisioned before migration 0007 was applied.
-- Keep migration 0007 immutable; this forward-only migration is safe on both
-- drifted operational schemas and clean schemas that already contain the column.
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS birth_date DATE;
