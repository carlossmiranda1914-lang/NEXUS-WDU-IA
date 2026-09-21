-- NEXUS EDU IA — MIGRATION 0038
-- FINANCE-F5-01: Immutable obligation-linked due adjustments.

ALTER TABLE finance_journal_transactions
  DROP CONSTRAINT finance_journal_transactions_journal_type_check;
ALTER TABLE finance_journal_transactions
  ADD CONSTRAINT finance_journal_transactions_journal_type_check CHECK (
    journal_type IN (
      'foundation_value_received', 'foundation_reversal',
      'payment_allocation', 'allocation_reversal',
      'obligation_due_increased', 'obligation_due_decreased'
    )
  );

ALTER TABLE finance_journal_entries
  DROP CONSTRAINT finance_journal_entries_position_type_check;
ALTER TABLE finance_journal_entries
  ADD CONSTRAINT finance_journal_entries_position_type_check CHECK (
    position_type IN (
      'received_value', 'reversed_value', 'allocated_value', 'released_value',
      'due_increased_value', 'due_decreased_value'
    )
  );

CREATE TABLE IF NOT EXISTS finance_obligation_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  financial_account_id UUID NOT NULL,
  obligation_id UUID NOT NULL,
  direction VARCHAR(16) NOT NULL CHECK (direction IN ('increase', 'decrease')),
  amount NUMERIC(30, 12) NOT NULL,
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  reason VARCHAR(500) NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  compensates_adjustment_id UUID,
  journal_transaction_id UUID NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_kind VARCHAR(20) NOT NULL DEFAULT 'human' CHECK (actor_kind IN ('human', 'system', 'provider')),
  actor_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  CONSTRAINT uq_finance_obligation_adjustments_institution_id UNIQUE (institution_id, id),
  CONSTRAINT fk_finance_obligation_adjustments_account_tenant FOREIGN KEY (institution_id, financial_account_id)
    REFERENCES finance_financial_accounts(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_finance_obligation_adjustments_obligation_tenant FOREIGN KEY (institution_id, obligation_id)
    REFERENCES finance_obligations(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_finance_obligation_adjustments_journal_tenant FOREIGN KEY (institution_id, journal_transaction_id)
    REFERENCES finance_journal_transactions(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_finance_obligation_adjustments_compensation_tenant FOREIGN KEY (institution_id, compensates_adjustment_id)
    REFERENCES finance_obligation_adjustments(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT finance_obligation_adjustments_amount_exact_envelope CHECK (
    scale(amount) <= 12 AND abs(amount) < 1000000000000000000::NUMERIC AND amount > 0
  ),
  CONSTRAINT finance_obligation_adjustments_actor_provenance CHECK (
    (actor_kind = 'human' AND actor_person_id IS NOT NULL) OR
    (actor_kind IN ('system', 'provider') AND actor_person_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_obligation_adjustments_inst_obligation
  ON finance_obligation_adjustments(institution_id, obligation_id, recorded_at, id);
CREATE INDEX IF NOT EXISTS idx_finance_obligation_adjustments_inst_compensation
  ON finance_obligation_adjustments(institution_id, compensates_adjustment_id)
  WHERE compensates_adjustment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION trg_finance_obligation_adjustments_immutable_check()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Confirmed finance obligation adjustments are immutable and cannot be %.', lower(TG_OP);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_obligation_adjustments_immutability ON finance_obligation_adjustments;
CREATE TRIGGER trg_finance_obligation_adjustments_immutability
BEFORE UPDATE OR DELETE ON finance_obligation_adjustments
FOR EACH ROW EXECUTE FUNCTION trg_finance_obligation_adjustments_immutable_check();
