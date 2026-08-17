ALTER TABLE enrollment_applications DROP CONSTRAINT IF EXISTS enrollment_applications_status_check;
ALTER TABLE enrollment_applications ADD CONSTRAINT enrollment_applications_status_check CHECK (status IN ('draft','under_review','awaiting_documents','validated','blocked','active','transferred_out','cancelled'));
ALTER TABLE enrollment_events DROP CONSTRAINT IF EXISTS enrollment_events_statuses_valid;
ALTER TABLE enrollment_events ADD CONSTRAINT enrollment_events_statuses_valid CHECK ((from_status IS NULL OR from_status IN ('draft','under_review','awaiting_documents','validated','blocked','active','transferred_out','cancelled')) AND (to_status IS NULL OR to_status IN ('draft','under_review','awaiting_documents','validated','blocked','active','transferred_out','cancelled')));
DROP INDEX IF EXISTS enrollment_applications_active_unique;
CREATE UNIQUE INDEX enrollment_applications_active_unique ON enrollment_applications (institution_id, student_person_id, academic_year_id) WHERE status NOT IN ('cancelled','transferred_out');

CREATE TABLE transfer_out_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  enrollment_application_id UUID NOT NULL,
  destination_name TEXT NOT NULL CHECK (char_length(destination_name) BETWEEN 2 AND 160),
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 2 AND 500),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','awaiting_resolution','approved','rejected','withdrawn')),
  academic_clearance BOOLEAN,
  financial_clearance BOOLEAN,
  attestation_note TEXT,
  decided_by UUID REFERENCES people(id) ON DELETE RESTRICT,
  decided_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  updated_by UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transfer_out_enrollment_institution_fk FOREIGN KEY (institution_id, enrollment_application_id) REFERENCES enrollment_applications(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT transfer_out_decision_consistent CHECK ((status IN ('approved','rejected') AND decided_by IS NOT NULL AND decided_at IS NOT NULL) OR (status NOT IN ('approved','rejected') AND decided_by IS NULL AND decided_at IS NULL))
);
CREATE UNIQUE INDEX transfer_out_open_per_enrollment ON transfer_out_requests (institution_id, enrollment_application_id) WHERE status IN ('draft','submitted','awaiting_resolution');
