-- Nexus vNext foundation. This migration is additive: it does not alter,
-- backfill, or authorize any legacy user or resource.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT identities_provider_subject_unique UNIQUE (provider, provider_subject)
);

CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN (
    'institution_admin', 'director', 'secretariat', 'financial', 'teacher', 'student', 'parent'
  )),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'revoked')),
  approved_by UUID REFERENCES people(id) ON DELETE RESTRICT,
  approved_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT memberships_person_institution_role_unique UNIQUE (person_id, institution_id, role)
);

CREATE INDEX identities_person_id_idx ON identities(person_id);
CREATE INDEX memberships_person_id_idx ON memberships(person_id);
CREATE INDEX memberships_institution_id_idx ON memberships(institution_id);
CREATE INDEX memberships_active_context_idx ON memberships(person_id, institution_id)
  WHERE status = 'active';

-- No INSERT, UPDATE, DELETE, role assignment, or backfill belongs in this migration.
