-- Append-only evidence and deterministic server re-resolution history for an
-- existing identity decision.  The current decision remains the only intake
-- authority; revisions never expose candidate identities to the browser.
ALTER TABLE identity_resolution_decisions
  ADD COLUMN enrollment_offer_id UUID REFERENCES enrollment_offers(id) ON DELETE RESTRICT,
  ADD COLUMN initial_identity_inputs JSONB;

ALTER TABLE identity_resolution_decisions
  ADD CONSTRAINT identity_resolution_decisions_intake_binding_json CHECK (
    initial_identity_inputs IS NULL OR jsonb_typeof(initial_identity_inputs) = 'object'
  );

CREATE TABLE identity_resolution_decision_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES identity_resolution_decisions(id) ON DELETE RESTRICT,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  previous_case_key TEXT NOT NULL,
  derived_case_key TEXT NOT NULL,
  submission_fingerprint TEXT NOT NULL,
  submitted_by_person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  request_id TEXT,
  correlation_id TEXT,
  submitted_identity_inputs JSONB NOT NULL,
  evidence_metadata JSONB NOT NULL,
  resolution_status TEXT NOT NULL,
  resolution_match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  resolution_candidate_count INTEGER NOT NULL CHECK (resolution_candidate_count >= 0),
  resolved_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT identity_resolution_decision_revisions_unique_revision UNIQUE (decision_id, revision_number),
  CONSTRAINT identity_resolution_decision_revisions_replay UNIQUE (decision_id, submission_fingerprint),
  CONSTRAINT identity_resolution_decision_revisions_json CHECK (
    jsonb_typeof(submitted_identity_inputs) = 'object'
    AND jsonb_typeof(evidence_metadata) = 'array'
    AND jsonb_typeof(resolution_match_reasons) = 'array'
  )
);

CREATE INDEX identity_resolution_decision_revisions_decision_idx
  ON identity_resolution_decision_revisions (decision_id, revision_number);
