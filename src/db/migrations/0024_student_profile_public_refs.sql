-- STUDENT-EXPERIENCE-01 P0: public routing handles for Student Context.
-- They are opaque, random identifiers only; they do not replace StudentProfile
-- or Person authority and must never encode an internal identifier or PII.
ALTER TABLE student_profiles ADD COLUMN public_ref TEXT;

UPDATE student_profiles
   SET public_ref = 'stu_' || translate(rtrim(encode(public.gen_random_bytes(16), 'base64'), '='), '+/', '-_')
 WHERE public_ref IS NULL;

ALTER TABLE student_profiles
  ALTER COLUMN public_ref SET DEFAULT ('stu_' || translate(rtrim(encode(public.gen_random_bytes(16), 'base64'), '='), '+/', '-_')),
  ALTER COLUMN public_ref SET NOT NULL,
  ADD CONSTRAINT student_profiles_public_ref_format_check CHECK (public_ref ~ '^stu_[A-Za-z0-9_-]{22}$');

CREATE UNIQUE INDEX student_profiles_institution_public_ref_unique
  ON student_profiles (institution_id, public_ref);
