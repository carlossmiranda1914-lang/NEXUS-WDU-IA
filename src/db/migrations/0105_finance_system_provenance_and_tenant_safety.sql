-- NEXUS EDU IA — MIGRATION 0036
-- FINANCE-F3-01: System/Provider Actor Provenance & Payment Tenant Safety

-- 1. Support system and provider provenance on Journal transactions
ALTER TABLE finance_journal_transactions
  ALTER COLUMN actor_person_id DROP NOT NULL;

ALTER TABLE finance_journal_transactions
  ADD COLUMN IF NOT EXISTS actor_kind VARCHAR(20) NOT NULL DEFAULT 'human' CHECK (actor_kind IN ('human', 'system', 'provider'));

ALTER TABLE finance_journal_transactions
  DROP CONSTRAINT IF EXISTS finance_journal_transactions_actor_provenance;

ALTER TABLE finance_journal_transactions
  ADD CONSTRAINT finance_journal_transactions_actor_provenance CHECK (
    (actor_kind = 'human' AND actor_person_id IS NOT NULL) OR
    (actor_kind IN ('system', 'provider') AND actor_person_id IS NULL)
  );

-- 2. Support system and provider provenance on Payments
ALTER TABLE finance_payments
  ALTER COLUMN actor_person_id DROP NOT NULL;

ALTER TABLE finance_payments
  ADD COLUMN IF NOT EXISTS actor_kind VARCHAR(20) NOT NULL DEFAULT 'human' CHECK (actor_kind IN ('human', 'system', 'provider'));

ALTER TABLE finance_payments
  DROP CONSTRAINT IF EXISTS finance_payments_actor_provenance;

ALTER TABLE finance_payments
  ADD CONSTRAINT finance_payments_actor_provenance CHECK (
    (actor_kind = 'human' AND actor_person_id IS NOT NULL) OR
    (actor_kind IN ('system', 'provider') AND actor_person_id IS NULL)
  );
