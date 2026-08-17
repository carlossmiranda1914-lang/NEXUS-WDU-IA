ALTER TABLE enrollment_applications
  ADD CONSTRAINT enrollment_applications_institution_id_id_unique
  UNIQUE (institution_id, id);

CREATE TABLE enrollment_processes (
  enrollment_application_id UUID PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  current_stage TEXT NOT NULL CHECK (current_stage IN ('P01', 'P02', 'P03', 'P04', 'P05', 'P06')),
  assigned_to_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_progress_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_at TIMESTAMPTZ,
  blocked_reason_code TEXT,
  projection_fingerprint TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT enrollment_processes_application_institution_fk
    FOREIGN KEY (institution_id, enrollment_application_id)
    REFERENCES enrollment_applications(institution_id, id) ON DELETE CASCADE,
  CONSTRAINT enrollment_processes_block_consistent CHECK (
    (blocked_at IS NULL AND blocked_reason_code IS NULL)
    OR (blocked_at IS NOT NULL AND blocked_reason_code IS NOT NULL)
  )
);

CREATE UNIQUE INDEX enrollment_processes_institution_application_unique
  ON enrollment_processes (institution_id, enrollment_application_id);
CREATE INDEX enrollment_processes_institution_stage_idx
  ON enrollment_processes (institution_id, current_stage, updated_at DESC);
CREATE INDEX enrollment_processes_assignee_idx
  ON enrollment_processes (institution_id, assigned_to_person_id)
  WHERE assigned_to_person_id IS NOT NULL;

INSERT INTO enrollment_processes (
  enrollment_application_id,
  institution_id,
  current_stage,
  started_at,
  last_progress_at,
  blocked_at,
  blocked_reason_code,
  projection_fingerprint,
  created_at,
  updated_at
)
SELECT
  id,
  institution_id,
  CASE WHEN status IN ('validated', 'active') THEN 'P06' ELSE 'P02' END,
  created_at,
  updated_at,
  CASE WHEN status IN ('blocked', 'cancelled') THEN updated_at ELSE NULL END,
  CASE WHEN status = 'blocked' THEN 'ENROLLMENT_BLOCKED'
       WHEN status = 'cancelled' THEN 'ENROLLMENT_CANCELLED'
       ELSE NULL END,
  'migration:pending-reconciliation',
  created_at,
  updated_at
FROM enrollment_applications;
