-- FINANCE F7 TASK 9: structured factual debit-event basis on existing adjustments.
-- Historical NULL values deliberately retain the compatible `general` interpretation.

ALTER TABLE finance_obligation_adjustments
  ADD COLUMN basis_type text;

ALTER TABLE finance_obligation_adjustments
  ADD CONSTRAINT finance_obligation_adjustments_basis_type_check
  CHECK (basis_type IS NULL OR basis_type IN ('general', 'debit_event'));

ALTER TABLE finance_obligation_adjustments
  ADD CONSTRAINT finance_obligation_adjustments_debit_event_direction_check
  CHECK (basis_type IS DISTINCT FROM 'debit_event' OR direction = 'increase');
