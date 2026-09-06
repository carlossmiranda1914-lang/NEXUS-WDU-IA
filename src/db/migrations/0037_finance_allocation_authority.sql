-- NEXUS EDU IA — MIGRATION 0037
-- FINANCE-F4-01: Canonical immutable Allocation and Allocation Reversal authority.

-- A composite tenant FK must reference an explicit matching unique constraint.
-- `id` remains the global primary key; this constraint authorizes the tenant pair
-- used by Allocation without weakening the tenant boundary.
ALTER TABLE finance_obligations
  ADD CONSTRAINT uq_finance_obligations_institution_id UNIQUE (institution_id, id);

CREATE TABLE IF NOT EXISTS finance_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  financial_account_id UUID NOT NULL,
  payment_id UUID NOT NULL,
  obligation_id UUID NOT NULL,
  amount NUMERIC(30, 12) NOT NULL,
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  journal_transaction_id UUID NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_kind VARCHAR(20) NOT NULL DEFAULT 'human' CHECK (actor_kind IN ('human', 'system', 'provider')),
  actor_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  CONSTRAINT uq_finance_allocations_institution_id UNIQUE (institution_id, id),
  CONSTRAINT fk_finance_allocations_account_tenant FOREIGN KEY (institution_id, financial_account_id)
    REFERENCES finance_financial_accounts(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_finance_allocations_payment_tenant FOREIGN KEY (institution_id, payment_id)
    REFERENCES finance_payments(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_finance_allocations_obligation_tenant FOREIGN KEY (institution_id, obligation_id)
    REFERENCES finance_obligations(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_finance_allocations_journal_tenant FOREIGN KEY (institution_id, journal_transaction_id)
    REFERENCES finance_journal_transactions(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT finance_allocations_amount_exact_envelope CHECK (
    scale(amount) <= 12 AND abs(amount) < 1000000000000000000::NUMERIC AND amount > 0
  ),
  CONSTRAINT finance_allocations_actor_provenance CHECK (
    (actor_kind = 'human' AND actor_person_id IS NOT NULL) OR
    (actor_kind IN ('system', 'provider') AND actor_person_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_allocations_inst_payment ON finance_allocations(institution_id, payment_id);
CREATE INDEX IF NOT EXISTS idx_finance_allocations_inst_obligation ON finance_allocations(institution_id, obligation_id);
CREATE INDEX IF NOT EXISTS idx_finance_allocations_inst_account ON finance_allocations(institution_id, financial_account_id);

CREATE TABLE IF NOT EXISTS finance_allocation_reversals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  original_allocation_id UUID NOT NULL,
  amount NUMERIC(30, 12) NOT NULL,
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  journal_transaction_id UUID NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_kind VARCHAR(20) NOT NULL DEFAULT 'human' CHECK (actor_kind IN ('human', 'system', 'provider')),
  actor_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  CONSTRAINT fk_finance_allocation_reversals_original_tenant FOREIGN KEY (institution_id, original_allocation_id)
    REFERENCES finance_allocations(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_finance_allocation_reversals_journal_tenant FOREIGN KEY (institution_id, journal_transaction_id)
    REFERENCES finance_journal_transactions(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT finance_allocation_reversals_amount_exact_envelope CHECK (
    scale(amount) <= 12 AND abs(amount) < 1000000000000000000::NUMERIC AND amount > 0
  ),
  CONSTRAINT finance_allocation_reversals_actor_provenance CHECK (
    (actor_kind = 'human' AND actor_person_id IS NOT NULL) OR
    (actor_kind IN ('system', 'provider') AND actor_person_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_allocation_reversals_inst_original
  ON finance_allocation_reversals(institution_id, original_allocation_id);

CREATE OR REPLACE FUNCTION trg_finance_allocations_immutable_check()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Confirmed finance allocations are immutable and cannot be %.', lower(TG_OP);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_allocations_immutability ON finance_allocations;
CREATE TRIGGER trg_finance_allocations_immutability
BEFORE UPDATE OR DELETE ON finance_allocations
FOR EACH ROW EXECUTE FUNCTION trg_finance_allocations_immutable_check();

CREATE OR REPLACE FUNCTION trg_finance_allocation_reversals_immutable_check()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Confirmed finance allocation reversals are immutable and cannot be %.', lower(TG_OP);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_allocation_reversals_immutability ON finance_allocation_reversals;
CREATE TRIGGER trg_finance_allocation_reversals_immutability
BEFORE UPDATE OR DELETE ON finance_allocation_reversals
FOR EACH ROW EXECUTE FUNCTION trg_finance_allocation_reversals_immutable_check();
