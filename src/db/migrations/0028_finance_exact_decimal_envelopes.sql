-- FINANCE-FOUNDATION-03 P1: NUMERIC(p,s) silently rounds excess fractional
-- input. Preserve the values exactly and reject values outside F2 envelopes.
ALTER TABLE finance_journal_transactions
  ALTER COLUMN amount TYPE NUMERIC USING amount::NUMERIC,
  ALTER COLUMN exchange_rate TYPE NUMERIC USING exchange_rate::NUMERIC;

ALTER TABLE finance_journal_entries
  ALTER COLUMN amount TYPE NUMERIC USING amount::NUMERIC;

ALTER TABLE finance_position_projection
  ALTER COLUMN amount TYPE NUMERIC USING amount::NUMERIC;

ALTER TABLE finance_journal_transactions
  ADD CONSTRAINT finance_journal_transactions_amount_exact_envelope CHECK (
    scale(amount) <= 12 AND abs(amount) < 1000000000000000000::NUMERIC
  ),
  ADD CONSTRAINT finance_journal_transactions_rate_exact_envelope CHECK (
    exchange_rate IS NULL OR (scale(exchange_rate) <= 18 AND abs(exchange_rate) < 1000000000000::NUMERIC)
  );

ALTER TABLE finance_journal_entries
  ADD CONSTRAINT finance_journal_entries_amount_exact_envelope CHECK (
    scale(amount) <= 12 AND abs(amount) < 1000000000000000000::NUMERIC
  );

ALTER TABLE finance_position_projection
  ADD CONSTRAINT finance_position_projection_amount_exact_envelope CHECK (
    scale(amount) <= 12 AND abs(amount) < 1000000000000000000::NUMERIC
  );
