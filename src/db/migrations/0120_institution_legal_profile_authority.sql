CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE institution_legal_profiles
  ADD CONSTRAINT institution_legal_profiles_no_effective_overlap
  EXCLUDE USING gist (institution_id WITH =, tstzrange(effective_from, COALESCE(effective_to, 'infinity'::timestamptz), '[)') WITH &&);

CREATE OR REPLACE FUNCTION protect_institution_legal_profile_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'institution legal profiles are append-only'; END IF;
  IF OLD.effective_to IS NOT NULL THEN RAISE EXCEPTION 'historical institution legal profiles are immutable'; END IF;
  IF NEW.institution_id IS DISTINCT FROM OLD.institution_id OR NEW.version IS DISTINCT FROM OLD.version OR NEW.legal_name IS DISTINCT FROM OLD.legal_name OR NEW.tax_identifier IS DISTINCT FROM OLD.tax_identifier OR NEW.registered_address IS DISTINCT FROM OLD.registered_address OR NEW.legal_email IS DISTINCT FROM OLD.legal_email OR NEW.legal_phone IS DISTINCT FROM OLD.legal_phone OR NEW.logo_asset_reference IS DISTINCT FROM OLD.logo_asset_reference OR NEW.effective_from IS DISTINCT FROM OLD.effective_from OR NEW.effective_to IS NULL THEN RAISE EXCEPTION 'only closing the current institution legal profile is permitted'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER institution_legal_profiles_history_guard BEFORE UPDATE OR DELETE ON institution_legal_profiles
FOR EACH ROW EXECUTE FUNCTION protect_institution_legal_profile_history();
