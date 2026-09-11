-- NEXUS EDU IA — MIGRATION 0045
-- FINANCE-F7-03: an issued document keeps the historical identity of its series.
CREATE OR REPLACE FUNCTION trg_finance_document_series_used_identity_check()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.code IS DISTINCT FROM OLD.code OR NEW.document_type IS DISTINCT FROM OLD.document_type)
     AND EXISTS (
       SELECT 1
       FROM finance_financial_documents d
       WHERE d.institution_id = OLD.institution_id
         AND d.series_id = OLD.id
         AND d.status = 'issued'
     ) THEN
    RAISE EXCEPTION 'A used financial document series historical identity is immutable.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_finance_document_series_used_identity_immutable
BEFORE UPDATE ON finance_financial_document_series
FOR EACH ROW
EXECUTE FUNCTION trg_finance_document_series_used_identity_check();
