ALTER TABLE people
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS national_id_number TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IS NULL OR gender IN ('female', 'male', 'other', 'unspecified')),
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS address_line TEXT,
  ADD COLUMN IF NOT EXISTS municipality TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT;

ALTER TABLE guardian_relationships
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS financial_responsible BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE enrollment_applications
  ADD COLUMN IF NOT EXISTS previous_school TEXT,
  ADD COLUMN IF NOT EXISTS enrollment_notes TEXT;

CREATE INDEX IF NOT EXISTS people_national_id_lookup_idx
  ON people (lower(national_id_number))
  WHERE national_id_number IS NOT NULL AND btrim(national_id_number) <> '';

CREATE INDEX IF NOT EXISTS people_email_lookup_idx
  ON people (lower(email))
  WHERE email IS NOT NULL AND btrim(email) <> '';

CREATE INDEX IF NOT EXISTS people_whatsapp_lookup_idx
  ON people (whatsapp)
  WHERE whatsapp IS NOT NULL AND btrim(whatsapp) <> '';

CREATE INDEX IF NOT EXISTS guardian_relationships_primary_idx
  ON guardian_relationships (institution_id, student_person_id)
  WHERE status = 'active' AND is_primary = true;
