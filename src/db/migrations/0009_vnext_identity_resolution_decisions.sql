CREATE TABLE identity_resolution_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  case_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('B', 'C')),
  proposed_action TEXT NOT NULL CHECK (proposed_action IN ('REUSE_PERSON', 'CREATE_PERSON', 'REVIEW_REQUIRED', 'REJECT_DECISION')),
  status TEXT NOT NULL CHECK (status IN ('pending_confirmation', 'pending_second_approval', 'needs_more_information', 'approved', 'rejected')),
  reason_code TEXT NOT NULL CHECK (reason_code IN (
    'MATCH_CONFIRMED_WITH_NEW_EVIDENCE',
    'MULTIPLE_CANDIDATES_RESOLVED',
    'CONFLICT_REQUIRES_REVIEW',
    'NEW_PERSON_APPROVED_DESPITE_CONFLICT',
    'IDENTIFIER_CONFLICT',
    'INSUFFICIENT_EVIDENCE'
  )),
  proposed_candidate_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  candidate_person_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  requested_by_person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  decided_by_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  approved_by_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  policy_version TEXT NOT NULL DEFAULT 'D05-v1',
  request_id TEXT,
  correlation_id TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  CONSTRAINT identity_resolution_decisions_case_unique UNIQUE (institution_id, case_key),
  CONSTRAINT identity_resolution_decisions_segregation CHECK (
    approved_by_person_id IS NULL OR approved_by_person_id <> requested_by_person_id
  ),
  CONSTRAINT identity_resolution_decisions_arrays CHECK (
    jsonb_typeof(candidate_person_ids) = 'array'
    AND jsonb_typeof(match_reasons) = 'array'
    AND jsonb_typeof(evidence_types) = 'array'
  )
);

CREATE INDEX identity_resolution_decisions_queue_idx
  ON identity_resolution_decisions (institution_id, status, created_at);
