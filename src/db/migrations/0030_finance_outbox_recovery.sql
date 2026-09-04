-- FINANCE-FOUNDATION-07: durable lease and failure provenance for outbox recovery.
ALTER TABLE finance_outbox
  ADD COLUMN claimed_at TIMESTAMPTZ NULL,
  ADD COLUMN claim_expires_at TIMESTAMPTZ NULL,
  ADD COLUMN last_error_code TEXT NULL,
  ADD CONSTRAINT finance_outbox_claim_pair_check CHECK (
    (claimed_at IS NULL AND claim_expires_at IS NULL)
    OR (claimed_at IS NOT NULL AND claim_expires_at IS NOT NULL)
  ),
  ADD CONSTRAINT finance_outbox_claim_expiry_check CHECK (
    claim_expires_at IS NULL OR claim_expires_at > claimed_at
  );
