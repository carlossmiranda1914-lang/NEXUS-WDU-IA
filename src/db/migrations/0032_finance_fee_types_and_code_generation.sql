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

-- Reconcile legacy kind values to baseline fee_type_id
UPDATE finance_fee_catalogue_versions v
SET fee_type_id = COALESCE(
  (SELECT ft.id FROM finance_fee_types ft WHERE ft.institution_id = v.institution_id AND ft.canonical_key =
    CASE LOWER(TRIM(v.kind))
      WHEN 'tuition' THEN 'tuition'
      WHEN 'enrollment' THEN 'enrollment'
      WHEN 'examination' THEN 'examination'
      WHEN 'document' THEN 'document'
      WHEN 'transport' THEN 'transport'
      WHEN 'meals' THEN 'meals'
      WHEN 'activity' THEN 'activity'
      WHEN 'service' THEN 'service'
      WHEN 'fee' THEN 'service'
      WHEN 'emolument' THEN 'service'
      ELSE 'other'
    END
    LIMIT 1
  ),
  (SELECT ft.id FROM finance_fee_types ft WHERE ft.institution_id = v.institution_id AND ft.canonical_key = 'other' LIMIT 1)
);

UPDATE finance_fee_catalogue_items i
SET fee_type_id = COALESCE(
  (SELECT v.fee_type_id FROM finance_fee_catalogue_versions v WHERE v.institution_id = i.institution_id AND v.item_id = i.id AND v.version = i.current_version LIMIT 1),
  (SELECT ft.id FROM finance_fee_types ft WHERE ft.institution_id = i.institution_id LIMIT 1)
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
