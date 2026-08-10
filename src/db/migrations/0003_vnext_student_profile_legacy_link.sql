-- Maps a vNext student profile to a record in the legacy SIS during the
-- transition. The official production base does not yet contain the legacy
-- students table, so this deliberately remains an application-level mapping.
-- Nullable by design: no reviewed mapping means no legacy-data access.
ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS legacy_student_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_profiles_legacy_student_id_unique'
  ) THEN
    ALTER TABLE student_profiles
      ADD CONSTRAINT student_profiles_legacy_student_id_unique UNIQUE (legacy_student_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS student_profiles_institution_legacy_student_idx
  ON student_profiles (institution_id, legacy_student_id)
  WHERE legacy_student_id IS NOT NULL;
