-- NEXUS EDU IA — MIGRATION 0034
-- FINANCE-F2-01 P1 Remediation: Exact Money Envelope & Composite Tenant-Safe FKs

-- 1. Financial Accounts composite tenant uniqueness
ALTER TABLE finance_financial_accounts
  ADD CONSTRAINT uq_finance_financial_accounts_institution_id UNIQUE (institution_id, id);

-- 2. Financial Account Parties composite tenant-safe FK
ALTER TABLE finance_financial_account_parties
  DROP CONSTRAINT IF EXISTS finance_financial_account_parties_financial_account_id_fkey,
  ADD CONSTRAINT fk_finance_financial_account_parties_account_tenant
    FOREIGN KEY (institution_id, financial_account_id)
    REFERENCES finance_financial_accounts(institution_id, id) ON DELETE RESTRICT;

-- 3. Financial Obligations exact Money envelope
ALTER TABLE finance_obligations
  ALTER COLUMN amount TYPE NUMERIC USING amount::NUMERIC;

ALTER TABLE finance_obligations
  ADD CONSTRAINT finance_obligations_amount_exact_envelope CHECK (
    scale(amount) <= 12 AND abs(amount) < 1000000000000000000::NUMERIC AND amount > 0
  );

-- 4. Financial Obligations composite tenant-safe FKs
ALTER TABLE finance_obligations
  DROP CONSTRAINT IF EXISTS finance_obligations_financial_account_id_fkey,
  DROP CONSTRAINT IF EXISTS finance_obligations_fee_catalogue_item_id_fkey;

ALTER TABLE finance_obligations
  ADD CONSTRAINT fk_finance_obligations_account_tenant
    FOREIGN KEY (institution_id, financial_account_id)
    REFERENCES finance_financial_accounts(institution_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_finance_obligations_fee_item_tenant
    FOREIGN KEY (institution_id, fee_catalogue_item_id)
    REFERENCES finance_fee_catalogue_items(institution_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_finance_obligations_fee_version_tenant
    FOREIGN KEY (institution_id, fee_catalogue_item_id, fee_catalogue_version)
    REFERENCES finance_fee_catalogue_versions(institution_id, item_id, version) ON DELETE RESTRICT;

-- 5. Delete any transient test rows if needed and restrict status to 'open' only
DELETE FROM finance_obligations WHERE status != 'open';

ALTER TABLE finance_obligations
  DROP CONSTRAINT IF EXISTS finance_obligations_status_check;

ALTER TABLE finance_obligations
  ADD CONSTRAINT finance_obligations_status_check CHECK (status = 'open');
