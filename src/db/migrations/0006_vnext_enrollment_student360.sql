CREATE TABLE academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT academic_years_dates_valid CHECK (ends_on > starts_on),
  CONSTRAINT academic_years_institution_name_unique UNIQUE (institution_id, name)
);

CREATE TABLE enrollment_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT enrollment_offers_institution_code_unique UNIQUE (institution_id, code)
);

CREATE TABLE enrollment_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  student_person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  guardian_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  offer_id UUID NOT NULL REFERENCES enrollment_offers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'awaiting_documents', 'validated', 'blocked', 'active', 'cancelled')),
  created_by UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  updated_by UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE enrollment_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  enrollment_application_id UUID NOT NULL REFERENCES enrollment_applications(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'verified', 'rejected')),
  evidence_reference TEXT,
  verified_by UUID REFERENCES people(id) ON DELETE RESTRICT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT enrollment_documents_application_type_unique UNIQUE (enrollment_application_id, document_type)
);

CREATE TABLE enrollment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  enrollment_application_id UUID NOT NULL REFERENCES enrollment_applications(id) ON DELETE CASCADE,
  actor_person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT enrollment_events_statuses_valid CHECK (
    (from_status IS NULL OR from_status IN ('draft', 'under_review', 'awaiting_documents', 'validated', 'blocked', 'active', 'cancelled'))
    AND (to_status IS NULL OR to_status IN ('draft', 'under_review', 'awaiting_documents', 'validated', 'blocked', 'active', 'cancelled'))
  )
);

CREATE UNIQUE INDEX enrollment_applications_active_unique
  ON enrollment_applications (institution_id, student_person_id, academic_year_id)
  WHERE status <> 'cancelled';
CREATE INDEX enrollment_applications_institution_status_idx ON enrollment_applications (institution_id, status);
CREATE INDEX enrollment_documents_institution_application_idx ON enrollment_documents (institution_id, enrollment_application_id);
CREATE INDEX enrollment_events_application_created_idx ON enrollment_events (enrollment_application_id, created_at);
