-- S04 Slice 2: transactional publication and immutable active policy content.

CREATE TABLE enrollment_document_policy_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  policy_id UUID NOT NULL,
  offer_id UUID NOT NULL,
  previous_policy_id UUID,
  actor_person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type = 'policy_published'),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT enrollment_document_policy_events_policy_fk
    FOREIGN KEY (institution_id, policy_id)
    REFERENCES enrollment_document_policies(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT enrollment_document_policy_events_offer_fk
    FOREIGN KEY (institution_id, offer_id)
    REFERENCES enrollment_offers(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT enrollment_document_policy_events_previous_policy_fk
    FOREIGN KEY (institution_id, previous_policy_id)
    REFERENCES enrollment_document_policies(institution_id, id) ON DELETE RESTRICT
);

CREATE INDEX enrollment_document_policy_events_policy_created_idx
  ON enrollment_document_policy_events (institution_id, policy_id, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_active_enrollment_document_requirement_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_policy_id UUID := COALESCE(NEW.policy_id, OLD.policy_id);
BEGIN
  IF EXISTS (
    SELECT 1 FROM enrollment_document_policies
     WHERE id = target_policy_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Active enrollment document policy requirements are immutable'
      USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER enrollment_document_requirements_active_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON enrollment_document_requirements
  FOR EACH ROW EXECUTE FUNCTION prevent_active_enrollment_document_requirement_mutation();
