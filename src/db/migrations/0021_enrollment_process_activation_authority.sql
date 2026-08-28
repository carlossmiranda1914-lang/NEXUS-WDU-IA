ALTER TABLE enrollment_applications
  ADD COLUMN lifecycle_version BIGINT NOT NULL DEFAULT 1,
  ADD CONSTRAINT enrollment_applications_lifecycle_version_valid CHECK (lifecycle_version > 0);

ALTER TABLE enrollment_events
  ADD COLUMN actor_kind TEXT NOT NULL DEFAULT 'human',
  ADD COLUMN correlation_id TEXT,
  ADD COLUMN system_cause TEXT;

ALTER TABLE enrollment_events
  ALTER COLUMN actor_person_id DROP NOT NULL;

ALTER TABLE enrollment_events
  ADD CONSTRAINT enrollment_events_actor_kind_valid
    CHECK (actor_kind IN ('human', 'system')),
  ADD CONSTRAINT enrollment_events_actor_consistent
    CHECK (
      (actor_kind = 'human' AND actor_person_id IS NOT NULL AND system_cause IS NULL)
      OR (actor_kind = 'system' AND actor_person_id IS NULL AND system_cause IS NOT NULL)
    );

CREATE TABLE enrollment_activation_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  enrollment_application_id UUID NOT NULL REFERENCES enrollment_applications(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed')),
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT enrollment_activation_commands_key_unique
    UNIQUE (institution_id, idempotency_key),
  CONSTRAINT enrollment_activation_commands_fingerprint_nonempty
    CHECK (length(trim(request_fingerprint)) > 0),
  CONSTRAINT enrollment_activation_commands_key_nonempty
    CHECK (length(trim(idempotency_key)) > 0)
);

CREATE INDEX enrollment_activation_commands_enrollment_idx
  ON enrollment_activation_commands (institution_id, enrollment_application_id, completed_at DESC);
