-- FINANCE-F6-01: Institutional Discount Policy & Contextual Obligation Concession v1

-- 0. Extend Journal Vocabulary Check Constraints
ALTER TABLE finance_journal_transactions DROP CONSTRAINT finance_journal_transactions_journal_type_check;
ALTER TABLE finance_journal_entries DROP CONSTRAINT finance_journal_entries_position_type_check;

ALTER TABLE finance_journal_transactions ADD CONSTRAINT finance_journal_transactions_journal_type_check CHECK (
  journal_type IN (
    'foundation_value_received',
    'foundation_reversal',
    'payment_allocation',
    'allocation_reversal',
    'obligation_adjustment',
    'obligation_discount'
  )
);

ALTER TABLE finance_journal_entries ADD CONSTRAINT finance_journal_entries_position_type_check CHECK (
  position_type IN (
    'received_value',
    'reversed_value',
    'allocated_value',
    'released_value',
    'obligation_due_increased',
    'obligation_due_decreased',
    'obligation_discount_applied',
    'obligation_discount_revoked'
  )
);

-- 1. Stable Policy Identity
CREATE TABLE finance_discount_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  code VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_finance_discount_policies_tenant_id UNIQUE (institution_id, id),
  CONSTRAINT uq_finance_discount_policies_code UNIQUE (institution_id, code)
);

-- 2. Immutable Policy Versions
CREATE TABLE finance_discount_policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  policy_id UUID NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  calculation_mode VARCHAR(32) NOT NULL CHECK (calculation_mode IN ('percentage', 'fixed_amount')),
  value NUMERIC(30, 12) NOT NULL CHECK (value > 0),
  currency VARCHAR(3) CHECK (currency IS NULL OR length(currency) = 3),
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  actor_person_id UUID,
  CONSTRAINT uq_discount_policy_versions_tenant_id UNIQUE (institution_id, id),
  CONSTRAINT uq_discount_policy_version_seq UNIQUE (institution_id, policy_id, version),
  CONSTRAINT fk_policy_versions_policy FOREIGN KEY (institution_id, policy_id)
    REFERENCES finance_discount_policies(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_discount_policy_mode_currency CHECK (
    (calculation_mode = 'percentage' AND currency IS NULL AND value <= 100) OR
    (calculation_mode = 'fixed_amount' AND currency IS NOT NULL)
  ),
  CONSTRAINT chk_discount_policy_effective_window CHECK (
    effective_from IS NULL OR effective_to IS NULL OR effective_from <= effective_to
  )
);

-- 3. Obligation Applied Discounts (Append-Only Fact)
CREATE TABLE finance_obligation_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  financial_account_id UUID NOT NULL,
  obligation_id UUID NOT NULL,
  policy_id UUID NOT NULL,
  policy_version_id UUID NOT NULL,
  policy_code VARCHAR(64) NOT NULL,
  policy_name VARCHAR(255) NOT NULL,
  policy_version INTEGER NOT NULL,
  calculation_mode VARCHAR(32) NOT NULL CHECK (calculation_mode IN ('percentage', 'fixed_amount')),
  policy_value NUMERIC(30, 12) NOT NULL,
  amount NUMERIC(30, 12) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  journal_transaction_id UUID NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  actor_kind VARCHAR(32) NOT NULL DEFAULT 'human',
  actor_person_id UUID,
  CONSTRAINT uq_obligation_discounts_tenant_id UNIQUE (institution_id, id),
  CONSTRAINT fk_obligation_discounts_policy FOREIGN KEY (institution_id, policy_id)
    REFERENCES finance_discount_policies(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_obligation_discounts_policy_version FOREIGN KEY (institution_id, policy_version_id)
    REFERENCES finance_discount_policy_versions(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_obligation_discounts_account FOREIGN KEY (institution_id, financial_account_id)
    REFERENCES finance_financial_accounts(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_obligation_discounts_obligation FOREIGN KEY (institution_id, obligation_id)
    REFERENCES finance_obligations(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_obligation_discounts_journal FOREIGN KEY (institution_id, journal_transaction_id)
    REFERENCES finance_journal_transactions(institution_id, id) ON DELETE RESTRICT
);

-- 4. Obligation Discount Revocations (Append-Only Compensating Fact)
CREATE TABLE finance_obligation_discount_revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  financial_account_id UUID NOT NULL,
  obligation_id UUID NOT NULL,
  original_discount_id UUID NOT NULL,
  amount NUMERIC(30, 12) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  journal_transaction_id UUID NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  actor_kind VARCHAR(32) NOT NULL DEFAULT 'human',
  actor_person_id UUID,
  CONSTRAINT uq_discount_single_revocation UNIQUE (institution_id, original_discount_id),
  CONSTRAINT fk_discount_revocations_discount FOREIGN KEY (institution_id, original_discount_id)
    REFERENCES finance_obligation_discounts(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_discount_revocations_account FOREIGN KEY (institution_id, financial_account_id)
    REFERENCES finance_financial_accounts(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_discount_revocations_obligation FOREIGN KEY (institution_id, obligation_id)
    REFERENCES finance_obligations(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_discount_revocations_journal FOREIGN KEY (institution_id, journal_transaction_id)
    REFERENCES finance_journal_transactions(institution_id, id) ON DELETE RESTRICT
);

-- Indexes for efficient lookups
CREATE INDEX idx_discount_policies_tenant ON finance_discount_policies(institution_id, status);
CREATE INDEX idx_discount_policy_versions_tenant ON finance_discount_policy_versions(institution_id, policy_id, version);
CREATE INDEX idx_obligation_discounts_lookup ON finance_obligation_discounts(institution_id, obligation_id);
CREATE INDEX idx_obligation_discounts_account ON finance_obligation_discounts(institution_id, financial_account_id);
CREATE INDEX idx_discount_revocations_lookup ON finance_obligation_discount_revocations(institution_id, obligation_id);
