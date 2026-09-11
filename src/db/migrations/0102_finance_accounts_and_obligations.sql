-- NEXUS EDU IA — MIGRATION 0033
-- FINANCE-F2-01: Financial Account + Financial Obligation Core

CREATE TABLE IF NOT EXISTS finance_financial_account_counters (
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (institution_id)
);

CREATE TABLE IF NOT EXISTS finance_financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  account_number VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_finance_financial_accounts_number UNIQUE (institution_id, account_number)
);

CREATE TABLE IF NOT EXISTS finance_financial_account_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  financial_account_id UUID NOT NULL REFERENCES finance_financial_accounts(id) ON DELETE RESTRICT,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  role VARCHAR(50) NOT NULL DEFAULT 'primary_debtor',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_finance_account_party_role UNIQUE (financial_account_id, person_id, role)
);

CREATE TABLE IF NOT EXISTS finance_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  financial_account_id UUID NOT NULL REFERENCES finance_financial_accounts(id) ON DELETE RESTRICT,
  beneficiary_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  fee_catalogue_item_id UUID NOT NULL REFERENCES finance_fee_catalogue_items(id) ON DELETE RESTRICT,
  fee_catalogue_version INTEGER NOT NULL,
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('manual_finance', 'enrollment', 'academic_process', 'service_request')),
  source_ref VARCHAR(255) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cancelled')),
  notes TEXT,
  financial_profile_version INTEGER NOT NULL,
  created_by_person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_finance_obligations_idempotency UNIQUE (institution_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_finance_financial_accounts_inst ON finance_financial_accounts(institution_id);
CREATE INDEX IF NOT EXISTS idx_finance_account_parties_inst_acc ON finance_financial_account_parties(institution_id, financial_account_id);
CREATE INDEX IF NOT EXISTS idx_finance_obligations_inst_acc ON finance_obligations(institution_id, financial_account_id);
CREATE INDEX IF NOT EXISTS idx_finance_obligations_inst_fee ON finance_obligations(institution_id, fee_catalogue_item_id);
