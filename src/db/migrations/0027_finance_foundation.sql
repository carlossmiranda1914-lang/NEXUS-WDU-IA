-- FINANCE-FOUNDATION-03: append-only persistence structure only. Economic
-- command, Journal lifecycle behavior and projection rebuilding remain later tasks.
CREATE TABLE finance_profile_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  primary_jurisdiction TEXT NOT NULL,
  functional_currency TEXT NOT NULL CHECK (functional_currency ~ '^[A-Z]{3}$'),
  financial_timezone TEXT NOT NULL,
  monetary_policy_version TEXT NOT NULL,
  enabled_currencies JSONB NOT NULL CHECK (jsonb_typeof(enabled_currencies) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finance_profile_versions_effective_interval CHECK (effective_to IS NULL OR effective_from < effective_to),
  CONSTRAINT finance_profile_versions_institution_version_unique UNIQUE (institution_id, version),
  CONSTRAINT finance_profile_versions_institution_id_unique UNIQUE (institution_id, id)
);

CREATE TABLE finance_journal_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('prepared', 'confirmed')),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  amount NUMERIC(30,12) NOT NULL,
  exchange_rate NUMERIC(30,18),
  reverses_transaction_id UUID,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finance_journal_transactions_confirmation_consistent CHECK (
    (status = 'confirmed' AND confirmed_at IS NOT NULL) OR (status = 'prepared' AND confirmed_at IS NULL)
  ),
  CONSTRAINT finance_journal_transactions_institution_id_unique UNIQUE (institution_id, id),
  CONSTRAINT finance_journal_transactions_reversal_tenant_fk FOREIGN KEY (institution_id, reverses_transaction_id)
    REFERENCES finance_journal_transactions(institution_id, id) ON DELETE RESTRICT
);

CREATE TABLE finance_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  transaction_id UUID NOT NULL,
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  amount NUMERIC(30,12) NOT NULL,
  position_type TEXT NOT NULL CHECK (position_type IN ('received_value', 'reversed_value')),
  source_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finance_journal_entries_transaction_tenant_fk FOREIGN KEY (institution_id, transaction_id)
    REFERENCES finance_journal_transactions(institution_id, id) ON DELETE RESTRICT
);

CREATE TABLE finance_command_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  operation_namespace TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  result_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finance_command_results_idempotency_unique UNIQUE (institution_id, operation_namespace, idempotency_key)
);

CREATE TABLE finance_audit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  transaction_id UUID,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finance_audit_records_transaction_tenant_fk FOREIGN KEY (institution_id, transaction_id)
    REFERENCES finance_journal_transactions(institution_id, id) ON DELETE RESTRICT
);

CREATE TABLE finance_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  transaction_id UUID,
  topic TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT finance_outbox_transaction_tenant_fk FOREIGN KEY (institution_id, transaction_id)
    REFERENCES finance_journal_transactions(institution_id, id) ON DELETE RESTRICT
);

CREATE TABLE finance_position_projection (
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  amount NUMERIC(30,12) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, currency)
);
