CREATE TABLE enrollment_intake_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  operation TEXT NOT NULL DEFAULT 'enrollment_intake',
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  enrollment_application_id UUID REFERENCES enrollment_applications(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT enrollment_intake_commands_key_nonempty CHECK (length(btrim(idempotency_key)) BETWEEN 8 AND 160),
  CONSTRAINT enrollment_intake_commands_fingerprint_valid CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT enrollment_intake_commands_completed_result CHECK (
    (status = 'pending' AND enrollment_application_id IS NULL)
    OR (status = 'completed' AND enrollment_application_id IS NOT NULL)
  ),
  CONSTRAINT enrollment_intake_commands_institution_operation_key_unique
    UNIQUE (institution_id, operation, idempotency_key)
);

CREATE INDEX enrollment_intake_commands_institution_created_idx
  ON enrollment_intake_commands (institution_id, created_at DESC);
