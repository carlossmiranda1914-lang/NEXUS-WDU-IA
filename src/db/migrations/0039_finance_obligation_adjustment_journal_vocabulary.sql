-- FINANCE-F5-01 P1: approved Adjustment Journal vocabulary.
ALTER TABLE finance_journal_transactions DROP CONSTRAINT finance_journal_transactions_journal_type_check;
ALTER TABLE finance_journal_entries DROP CONSTRAINT finance_journal_entries_position_type_check;
UPDATE finance_journal_transactions SET journal_type='obligation_adjustment' WHERE journal_type IN ('obligation_due_increased','obligation_due_decreased');
UPDATE finance_journal_entries SET position_type=CASE position_type WHEN 'due_increased_value' THEN 'obligation_due_increased' WHEN 'due_decreased_value' THEN 'obligation_due_decreased' ELSE position_type END WHERE position_type IN ('due_increased_value','due_decreased_value');
ALTER TABLE finance_journal_transactions ADD CONSTRAINT finance_journal_transactions_journal_type_check CHECK (journal_type IN ('foundation_value_received','foundation_reversal','payment_allocation','allocation_reversal','obligation_adjustment'));
ALTER TABLE finance_journal_entries ADD CONSTRAINT finance_journal_entries_position_type_check CHECK (position_type IN ('received_value','reversed_value','allocated_value','released_value','obligation_due_increased','obligation_due_decreased'));
