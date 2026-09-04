CREATE TABLE finance_fee_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  canonical_key TEXT,
  source TEXT NOT NULL CHECK (source IN ('nexus_base', 'institution_custom')),
  display_name TEXT NOT NULL,
  code_prefix TEXT NOT NULL CHECK (code_prefix ~ '^[A-Z0-9]{2,8}$' AND code_prefix = UPPER(code_prefix)),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finance_fee_types_institution_prefix_unique UNIQUE (institution_id, code_prefix),
  CONSTRAINT finance_fee_types_institution_id_unique UNIQUE (institution_id, id)
);

CREATE TABLE finance_fee_code_counters (
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  fee_type_id UUID NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
  PRIMARY KEY (institution_id, fee_type_id),
  CONSTRAINT finance_fee_code_counters_type_fk FOREIGN KEY (institution_id, fee_type_id)
    REFERENCES finance_fee_types(institution_id, id) ON DELETE RESTRICT
);

-- Seed Nexus baseline classifications for all existing institutions
INSERT INTO finance_fee_types (institution_id, canonical_key, source, display_name, code_prefix, status)
SELECT i.id, b.canonical_key, 'nexus_base', b.display_name, b.code_prefix, 'active'
FROM institutions i
CROSS JOIN (VALUES
  ('tuition', 'Propina / Mensalidade', 'PROP'),
  ('enrollment', 'Matrícula / Inscrição', 'MATR'),
  ('examination', 'Exames / Avaliação', 'EXAM'),
  ('document', 'Certificados / Documentos', 'DOC'),
  ('transport', 'Transporte Escolar', 'TRAN'),
  ('meals', 'Refeições / Cantina', 'ALIM'),
  ('activity', 'Atividades Extracurriculares', 'ACT'),
  ('service', 'Serviços Administrativos', 'SERV'),
  ('penalty', 'Multas / Juros Administrativos', 'MULT'),
  ('other', 'Outros Emolumentos', 'DIV')
) AS b(canonical_key, display_name, code_prefix)
ON CONFLICT (institution_id, code_prefix) DO NOTHING;

-- Add fee_type_id to fee catalogue versions and items
ALTER TABLE finance_fee_catalogue_items ADD COLUMN fee_type_id UUID;
ALTER TABLE finance_fee_catalogue_versions ADD COLUMN fee_type_id UUID;

-- ============================================================
-- LEGACY RECONCILIATION: FAIL-CLOSED
--
-- Step 1: Detect any distinct legacy kind values that are NOT
--         in the explicit mapping. If any exist, FAIL the
--         migration with a clear adjudication error.
--         This prevents silent data loss via a catch-all fallback.
-- ============================================================
DO $$
DECLARE
  v_unsupported_kinds TEXT;
BEGIN
  -- Explicit recognized mapping set (deterministic, no catch-all)
  SELECT STRING_AGG(DISTINCT LOWER(TRIM(kind)), ', ' ORDER BY LOWER(TRIM(kind)))
  INTO v_unsupported_kinds
  FROM finance_fee_catalogue_versions
  WHERE kind IS NOT NULL
    AND LOWER(TRIM(kind)) NOT IN (
      'tuition',
      'enrollment',
      'examination',
      'document',
      'transport',
      'meals',
      'activity',
      'service',
      'fee',
      'emolument',
      'penalty',
      'other'
    );

  IF v_unsupported_kinds IS NOT NULL THEN
    RAISE EXCEPTION
      'MIGRATION 0032 BLOCKED: legacy kind values require adjudication before '
      'NOT NULL/FK authority can be applied. '
      'Distinct unsupported kind values found: [%]. '
      'Add an explicit mapping for each value or reclassify the data.',
      v_unsupported_kinds;
  END IF;
END;
$$;

-- ============================================================
-- Step 2: Apply explicit deterministic mapping.
--         NO ELSE fallback. Only recognized values are mapped.
--         Unrecognized values (guarded above) cannot reach here.
-- ============================================================
UPDATE finance_fee_catalogue_versions v
SET fee_type_id = (
  SELECT ft.id
  FROM finance_fee_types ft
  WHERE ft.institution_id = v.institution_id
    AND ft.canonical_key = CASE LOWER(TRIM(v.kind))
      WHEN 'tuition'     THEN 'tuition'
      WHEN 'enrollment'  THEN 'enrollment'
      WHEN 'examination' THEN 'examination'
      WHEN 'document'    THEN 'document'
      WHEN 'transport'   THEN 'transport'
      WHEN 'meals'       THEN 'meals'
      WHEN 'activity'    THEN 'activity'
      WHEN 'service'     THEN 'service'
      WHEN 'fee'         THEN 'service'
      WHEN 'emolument'   THEN 'service'
      WHEN 'penalty'     THEN 'penalty'
      WHEN 'other'       THEN 'other'
    END
  LIMIT 1
)
WHERE v.kind IS NOT NULL;

-- ============================================================
-- Step 3: Reconcile items from their current version.
--         No arbitrary LIMIT 1 fallback. Items that cannot
--         be resolved will cause NOT NULL enforcement to fail
--         with a clear constraint violation.
-- ============================================================
UPDATE finance_fee_catalogue_items i
SET fee_type_id = (
  SELECT v.fee_type_id
  FROM finance_fee_catalogue_versions v
  WHERE v.institution_id = i.institution_id
    AND v.item_id = i.id
    AND v.version = i.current_version
  LIMIT 1
);

-- Enforce NOT NULL and referential integrity constraints
ALTER TABLE finance_fee_catalogue_versions
  ALTER COLUMN fee_type_id SET NOT NULL,
  ADD CONSTRAINT finance_fee_catalogue_versions_fee_type_fk
    FOREIGN KEY (institution_id, fee_type_id) REFERENCES finance_fee_types(institution_id, id) ON DELETE RESTRICT;

ALTER TABLE finance_fee_catalogue_items
  ALTER COLUMN fee_type_id SET NOT NULL,
  ADD CONSTRAINT finance_fee_catalogue_items_fee_type_fk
    FOREIGN KEY (institution_id, fee_type_id) REFERENCES finance_fee_types(institution_id, id) ON DELETE RESTRICT;

-- Initialize code counters for existing items
INSERT INTO finance_fee_code_counters (institution_id, fee_type_id, last_sequence)
SELECT i.institution_id, i.fee_type_id, COUNT(*)::integer
FROM finance_fee_catalogue_items i
GROUP BY i.institution_id, i.fee_type_id
ON CONFLICT (institution_id, fee_type_id)
DO UPDATE SET last_sequence = EXCLUDED.last_sequence;

-- ============================================================
-- P1-02: PREFIX NAMESPACE IMMUTABILITY
--
-- Rule 1: After a Fee Type has generated at least one catalogue
--         code (last_sequence > 0 in finance_fee_code_counters),
--         its code_prefix is IMMUTABLE.
--
-- Rule 2: A prefix historically used by another Fee Type in
--         the same institution cannot be reused — even if that
--         other Fee Type is now inactive or deleted.
--         We enforce this via a separate audit table.
-- ============================================================

-- Audit table to permanently record prefix usage per institution
CREATE TABLE IF NOT EXISTS finance_fee_type_prefix_history (
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  code_prefix    TEXT NOT NULL,
  fee_type_id    UUID NOT NULL,
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, code_prefix, fee_type_id)
);

-- Populate prefix history for all existing fee types
INSERT INTO finance_fee_type_prefix_history (institution_id, code_prefix, fee_type_id)
SELECT institution_id, code_prefix, id
FROM finance_fee_types
ON CONFLICT DO NOTHING;

-- Trigger function: enforce prefix immutability and namespace exclusivity
CREATE OR REPLACE FUNCTION finance_fee_types_prefix_immutability_fn()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_codes_exist INTEGER;
  v_historical_owner UUID;
BEGIN
  -- Only act when code_prefix is being changed
  IF NEW.code_prefix = OLD.code_prefix THEN
    RETURN NEW;
  END IF;

  -- Rule 1: reject change if codes have already been generated for this type
  SELECT COALESCE(last_sequence, 0) INTO v_codes_exist
  FROM finance_fee_code_counters
  WHERE institution_id = OLD.institution_id
    AND fee_type_id = OLD.id;

  IF FOUND AND v_codes_exist > 0 THEN
    RAISE EXCEPTION
      'FEE_TYPE_PREFIX_IMMUTABLE: code_prefix cannot be changed after catalogue codes '
      'have been generated. Fee type % has % generated code(s) under prefix ''%''.',
      OLD.id, v_codes_exist, OLD.code_prefix;
  END IF;

  -- Rule 2: reject if the new prefix was historically used by any OTHER fee type
  SELECT fee_type_id INTO v_historical_owner
  FROM finance_fee_type_prefix_history
  WHERE institution_id = NEW.institution_id
    AND code_prefix = NEW.code_prefix
    AND fee_type_id <> OLD.id
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'FEE_TYPE_PREFIX_CONFLICT: prefix ''%'' was previously used by another fee type '
      '(%) in institution % and cannot be reused.',
      NEW.code_prefix, v_historical_owner, NEW.institution_id;
  END IF;

  -- Record new prefix in history before applying change
  INSERT INTO finance_fee_type_prefix_history (institution_id, code_prefix, fee_type_id)
  VALUES (NEW.institution_id, NEW.code_prefix, NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER finance_fee_types_prefix_immutability
  BEFORE UPDATE OF code_prefix ON finance_fee_types
  FOR EACH ROW EXECUTE FUNCTION finance_fee_types_prefix_immutability_fn();

-- Trigger function: record prefix on INSERT (for future history tracking)
CREATE OR REPLACE FUNCTION finance_fee_types_prefix_insert_fn()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO finance_fee_type_prefix_history (institution_id, code_prefix, fee_type_id)
  VALUES (NEW.institution_id, NEW.code_prefix, NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER finance_fee_types_prefix_insert
  AFTER INSERT ON finance_fee_types
  FOR EACH ROW EXECUTE FUNCTION finance_fee_types_prefix_insert_fn();
