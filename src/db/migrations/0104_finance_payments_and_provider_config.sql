-- NEXUS EDU IA — MIGRATION 0035
-- FINANCE-F3-01: Payment Core + Provider Adapter Foundation Persistence Authority

-- 1. Institutional sequence counter for Payment operational references (e.g. PAG-000001)
CREATE TABLE IF NOT EXISTS finance_payment_counters (
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (institution_id)
);

-- 2. Canonical incoming Payment table
CREATE TABLE IF NOT EXISTS finance_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  payment_reference VARCHAR(32) NOT NULL,
  journal_transaction_id UUID NOT NULL,
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('manual_offline', 'provider')),
  method VARCHAR(50) NOT NULL,
  amount NUMERIC(30, 12) NOT NULL,
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status = 'confirmed'),
  allocation_status VARCHAR(20) NOT NULL DEFAULT 'unapplied' CHECK (allocation_status = 'unapplied'),
  financial_account_id UUID,
  payer_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  provider_key VARCHAR(50),
  provider_event_id VARCHAR(255),
  provider_transaction_ref VARCHAR(255),
  provider_occurred_at TIMESTAMPTZ,
  manual_evidence_ref VARCHAR(255),
  notes TEXT,
  effective_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  financial_profile_version INTEGER NOT NULL CHECK (financial_profile_version > 0),
  actor_person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  CONSTRAINT uq_finance_payments_institution_id UNIQUE (institution_id, id),
  CONSTRAINT uq_finance_payments_institution_reference UNIQUE (institution_id, payment_reference),
  CONSTRAINT fk_finance_payments_journal_tenant FOREIGN KEY (institution_id, journal_transaction_id)
    REFERENCES finance_journal_transactions(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_finance_payments_financial_account_tenant FOREIGN KEY (institution_id, financial_account_id)
    REFERENCES finance_financial_accounts(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT finance_payments_amount_exact_envelope CHECK (
    scale(amount) <= 12 AND abs(amount) < 1000000000000000000::NUMERIC AND amount > 0
  ),
  CONSTRAINT chk_finance_payments_source_invariants CHECK (
    (source_type = 'manual_offline' AND provider_key IS NULL AND provider_event_id IS NULL AND provider_transaction_ref IS NULL AND provider_occurred_at IS NULL AND method IN ('cash', 'bank_transfer', 'external_reference'))
    OR
    (source_type = 'provider' AND provider_key IS NOT NULL AND provider_event_id IS NOT NULL AND provider_transaction_ref IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_payments_provider_event
  ON finance_payments (institution_id, provider_key, provider_event_id)
  WHERE provider_key IS NOT NULL AND provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_payments_inst_acc ON finance_payments(institution_id, financial_account_id);
CREATE INDEX IF NOT EXISTS idx_finance_payments_inst_status ON finance_payments(institution_id, status);
CREATE INDEX IF NOT EXISTS idx_finance_payments_inst_created ON finance_payments(institution_id, created_at);

-- 3. Payment Immutability Trigger
CREATE OR REPLACE FUNCTION trg_finance_payments_immutable_check()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Confirmed finance payments are immutable and cannot be deleted.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.amount != NEW.amount OR
       OLD.currency != NEW.currency OR
       OLD.source_type != NEW.source_type OR
       OLD.method != NEW.method OR
       OLD.status != NEW.status OR
       OLD.allocation_status != NEW.allocation_status OR
       OLD.institution_id != NEW.institution_id OR
       OLD.journal_transaction_id != NEW.journal_transaction_id OR
       OLD.financial_account_id IS DISTINCT FROM NEW.financial_account_id OR
       OLD.payer_person_id IS DISTINCT FROM NEW.payer_person_id OR
       OLD.provider_key IS DISTINCT FROM NEW.provider_key OR
       OLD.provider_event_id IS DISTINCT FROM NEW.provider_event_id OR
       OLD.provider_transaction_ref IS DISTINCT FROM NEW.provider_transaction_ref OR
       OLD.effective_at != NEW.effective_at OR
       OLD.confirmed_at != NEW.confirmed_at OR
       OLD.financial_profile_version != NEW.financial_profile_version OR
       OLD.actor_person_id != NEW.actor_person_id THEN
      RAISE EXCEPTION 'Confirmed economic attributes of finance payments are immutable.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_payments_immutability ON finance_payments;
CREATE TRIGGER trg_finance_payments_immutability
BEFORE UPDATE OR DELETE ON finance_payments
FOR EACH ROW
EXECUTE FUNCTION trg_finance_payments_immutable_check();

-- 4. Institution Payment Provider Configuration
CREATE TABLE IF NOT EXISTS finance_payment_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  provider_key VARCHAR(50) NOT NULL CHECK (provider_key IN ('adyen', 'emis_multicaixa')),
  environment VARCHAR(20) NOT NULL CHECK (environment IN ('test', 'live')),
  status VARCHAR(20) NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'onboarding')),
  merchant_account_ref VARCHAR(255) NOT NULL,
  supported_currencies JSONB NOT NULL CHECK (jsonb_typeof(supported_currencies) = 'array'),
  enabled_methods JSONB NOT NULL CHECK (jsonb_typeof(enabled_methods) = 'array'),
  operational_availability VARCHAR(30) NOT NULL DEFAULT 'available' CHECK (operational_availability IN ('available', 'maintenance', 'degraded', 'unavailable')),
  secret_reference_id VARCHAR(255) NOT NULL,
  webhook_endpoint_ref VARCHAR(255),
  configuration_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(configuration_metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_finance_provider_configs_inst_provider UNIQUE (institution_id, provider_key),
  CONSTRAINT uq_finance_provider_configs_institution_id UNIQUE (institution_id, id)
);

CREATE INDEX IF NOT EXISTS idx_finance_provider_configs_inst ON finance_payment_provider_configs(institution_id);
