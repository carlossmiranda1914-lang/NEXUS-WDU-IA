-- DOCUMENTS-FOUNDATION-I7: Outbox and Operational Event Integration
-- Mission: DOCUMENTS-FOUNDATION-I7
-- Provides durable same-commit outbox, concurrency-safe claiming with lease recovery,
-- retry metadata, dead-letter state, and consumer deduplication ledger.

CREATE TABLE IF NOT EXISTS document_outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (length(trim(event_type)) BETWEEN 3 AND 128),
  schema_version TEXT NOT NULL CHECK (schema_version ~ '^[0-9]+\.[0-9]+$'),
  aggregate_type TEXT NOT NULL CHECK (
    aggregate_type IN (
      'document',
      'document_version',
      'document_association',
      'document_access_grant',
      'document_retention',
      'document_hold',
      'document_deletion'
    )
  ),
  aggregate_id UUID NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  actor_kind TEXT NOT NULL DEFAULT 'person' CHECK (actor_kind IN ('person', 'system')),
  correlation_id TEXT CHECK (correlation_id IS NULL OR length(trim(correlation_id)) BETWEEN 4 AND 128),
  causation_id TEXT CHECK (causation_id IS NULL OR length(trim(causation_id)) BETWEEN 4 AND 128),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'published', 'dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL CHECK (max_attempts > 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  claim_expires_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  published_at TIMESTAMPTZ,
  dead_lettered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_outbox_events_claim_pair CHECK (
    (claimed_at IS NULL AND claim_expires_at IS NULL)
    OR (claimed_at IS NOT NULL AND claim_expires_at IS NOT NULL)
  ),
  CONSTRAINT document_outbox_events_claim_expiry CHECK (
    claim_expires_at IS NULL OR claim_expires_at > claimed_at
  ),
  CONSTRAINT document_outbox_events_published_check CHECK (
    (status = 'published' AND published_at IS NOT NULL)
    OR (status != 'published' AND published_at IS NULL)
  ),
  CONSTRAINT document_outbox_events_dead_letter_check CHECK (
    (status = 'dead_letter' AND dead_lettered_at IS NOT NULL)
    OR (status != 'dead_letter' AND dead_lettered_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS document_outbox_events_claim_idx
  ON document_outbox_events (institution_id, status, next_attempt_at, created_at)
  WHERE status IN ('pending', 'claimed');

CREATE INDEX IF NOT EXISTS document_outbox_events_tenant_occurred_idx
  ON document_outbox_events (institution_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS document_outbox_events_aggregate_idx
  ON document_outbox_events (institution_id, aggregate_type, aggregate_id);

CREATE INDEX IF NOT EXISTS document_outbox_events_correlation_idx
  ON document_outbox_events (institution_id, correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS document_event_consumer_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  consumer_id TEXT NOT NULL CHECK (length(trim(consumer_id)) BETWEEN 3 AND 128),
  event_id UUID NOT NULL REFERENCES document_outbox_events(id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'skipped', 'failed')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  CONSTRAINT document_event_consumer_ledger_unique
    UNIQUE (institution_id, consumer_id, event_id)
);

CREATE INDEX IF NOT EXISTS document_event_consumer_ledger_event_idx
  ON document_event_consumer_ledger (institution_id, event_id);
