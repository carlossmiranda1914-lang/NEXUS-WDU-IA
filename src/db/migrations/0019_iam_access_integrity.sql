-- IAM-01: additive institutional-access integrity. No legacy authority is restored.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM memberships
     WHERE status = 'active'
     GROUP BY person_id, institution_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'IAM-01 reconciliation required: duplicate active memberships per person and institution';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM memberships
     WHERE status IN ('pending', 'active', 'suspended')
     GROUP BY person_id, institution_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'IAM-01 reconciliation required: ambiguous non-terminal memberships per person and institution';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM memberships
     WHERE (status = 'active' AND approved_at IS NULL)
        OR (status = 'suspended' AND suspended_at IS NULL)
        OR (status = 'revoked' AND revoked_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'IAM-01 reconciliation required: membership lifecycle timestamps are incompatible';
  END IF;
END $$;

ALTER TABLE memberships
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT memberships_version_positive CHECK (version > 0),
  ADD CONSTRAINT memberships_institution_id_id_unique UNIQUE (institution_id, id);

CREATE UNIQUE INDEX memberships_one_active_per_person_institution_unique
  ON memberships (person_id, institution_id)
  WHERE status = 'active';

CREATE TABLE iam_access_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('access_request', 'institution_invitation')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'accepted', 'cancelled', 'expired', 'consumed')),
  authorized_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  authorized_identity_id UUID REFERENCES identities(id) ON DELETE RESTRICT,
  created_by_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  code_hash TEXT NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  code_issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  code_expires_at TIMESTAMPTZ NOT NULL,
  code_rotated_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  failed_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempt_count BETWEEN 0 AND 5),
  attempt_window_started_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  idempotency_scope TEXT NOT NULL CHECK (length(btrim(idempotency_scope)) BETWEEN 8 AND 160),
  idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 8 AND 160),
  request_fingerprint TEXT NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT iam_access_intents_target_unambiguous CHECK (
    num_nonnulls(authorized_person_id, authorized_identity_id) <= 1
  ),
  CONSTRAINT iam_access_intents_code_ttl CHECK (
    code_expires_at = code_issued_at + INTERVAL '72 hours'
  ),
  CONSTRAINT iam_access_intents_consumption_consistent CHECK (
    (status = 'consumed' AND consumed_at IS NOT NULL)
    OR (status <> 'consumed' AND consumed_at IS NULL)
  ),
  CONSTRAINT iam_access_intents_lock_consistent CHECK (
    locked_until IS NULL
    OR (attempt_window_started_at IS NOT NULL AND locked_until >= attempt_window_started_at + INTERVAL '15 minutes')
  ),
  CONSTRAINT iam_access_intents_institution_id_id_unique UNIQUE (institution_id, id),
  CONSTRAINT iam_access_intents_idempotency_unique
    UNIQUE (institution_id, kind, idempotency_scope, idempotency_key)
);

CREATE INDEX iam_access_intents_institution_status_expiry_idx
  ON iam_access_intents (institution_id, status, code_expires_at);

CREATE TABLE iam_command_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  operation TEXT NOT NULL CHECK (length(btrim(operation)) BETWEEN 3 AND 120),
  actor_scope TEXT NOT NULL CHECK (length(btrim(actor_scope)) BETWEEN 8 AND 160),
  actor_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 8 AND 160),
  request_fingerprint TEXT NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  result_code TEXT,
  access_intent_id UUID,
  membership_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT iam_command_ledger_completion_consistent CHECK (
    (status = 'pending' AND result_code IS NULL)
    OR (status = 'completed' AND result_code IS NOT NULL)
  ),
  CONSTRAINT iam_command_ledger_idempotency_unique
    UNIQUE (institution_id, operation, actor_scope, idempotency_key),
  CONSTRAINT iam_command_ledger_intent_tenant_fk
    FOREIGN KEY (institution_id, access_intent_id)
    REFERENCES iam_access_intents(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT iam_command_ledger_membership_tenant_fk
    FOREIGN KEY (institution_id, membership_id)
    REFERENCES memberships(institution_id, id) ON DELETE RESTRICT
);

CREATE INDEX iam_command_ledger_institution_created_idx
  ON iam_command_ledger (institution_id, created_at DESC);

CREATE TABLE iam_membership_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  membership_id UUID,
  access_intent_id UUID,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('person', 'system')),
  actor_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN (
    'IAM_ACCESS_REQUEST_RECORDED', 'IAM_INVITATION_CREATED', 'IAM_INVITATION_ACCEPTED',
    'IAM_ACCESS_REQUEST_APPROVED', 'IAM_MEMBERSHIP_ACTIVATED', 'IAM_MEMBERSHIP_SUSPENDED',
    'IAM_MEMBERSHIP_REACTIVATED', 'IAM_MEMBERSHIP_REVOKED', 'IAM_MEMBERSHIP_ROLE_CHANGED',
    'IAM_INSTITUTION_ADMIN_BOOTSTRAPPED'
  )),
  previous_status TEXT CHECK (previous_status IS NULL OR previous_status IN ('pending', 'active', 'suspended', 'revoked')),
  new_status TEXT CHECK (new_status IS NULL OR new_status IN ('pending', 'active', 'suspended', 'revoked')),
  result TEXT NOT NULL CHECK (result IN ('succeeded', 'rejected', 'conflict')),
  reason_code TEXT,
  request_id TEXT,
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT iam_membership_events_actor_consistent CHECK (
    (actor_type = 'person' AND actor_person_id IS NOT NULL)
    OR (actor_type = 'system' AND actor_person_id IS NULL)
  ),
  CONSTRAINT iam_membership_events_membership_tenant_fk
    FOREIGN KEY (institution_id, membership_id)
    REFERENCES memberships(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT iam_membership_events_intent_tenant_fk
    FOREIGN KEY (institution_id, access_intent_id)
    REFERENCES iam_access_intents(institution_id, id) ON DELETE RESTRICT
);

CREATE INDEX iam_membership_events_institution_target_created_idx
  ON iam_membership_events (institution_id, membership_id, created_at DESC);
CREATE INDEX iam_membership_events_intent_created_idx
  ON iam_membership_events (institution_id, access_intent_id, created_at DESC)
  WHERE access_intent_id IS NOT NULL;

CREATE FUNCTION iam_membership_events_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'IAM membership events are immutable';
END;
$$;

CREATE TRIGGER iam_membership_events_immutable
  BEFORE UPDATE OR DELETE ON iam_membership_events
  FOR EACH ROW EXECUTE FUNCTION iam_membership_events_reject_mutation();
