CREATE TABLE student_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  student_number TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'graduated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT student_profiles_institution_person_unique UNIQUE (institution_id, person_id)
);

CREATE TABLE guardian_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  guardian_person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  student_person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  relationship TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guardian_relationships_institution_guardian_student_unique
    UNIQUE (institution_id, guardian_person_id, student_person_id),
  CONSTRAINT guardian_relationships_distinct_people CHECK (guardian_person_id <> student_person_id)
);

CREATE INDEX guardian_relationships_active_guardian_idx
  ON guardian_relationships (institution_id, guardian_person_id)
  WHERE status = 'active';
