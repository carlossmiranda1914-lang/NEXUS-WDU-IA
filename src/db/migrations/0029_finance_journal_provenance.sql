-- FINANCE-FOUNDATION-04: minimum immutable Journal provenance required for confirmation.
ALTER TABLE finance_journal_transactions
  ADD COLUMN command_id TEXT NOT NULL,
  ADD COLUMN journal_type TEXT NOT NULL CHECK (journal_type IN ('foundation_value_received', 'foundation_reversal')),
  ADD COLUMN actor_person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  ADD COLUMN financial_profile_version INTEGER NOT NULL,
  ADD COLUMN reason TEXT,
  ADD CONSTRAINT finance_journal_transactions_profile_tenant_fk
    FOREIGN KEY (institution_id, financial_profile_version)
    REFERENCES finance_profile_versions(institution_id, version)
    ON DELETE RESTRICT;
