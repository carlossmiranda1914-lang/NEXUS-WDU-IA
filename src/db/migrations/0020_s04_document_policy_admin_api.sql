-- S04 Slice 4: administrative document-policy operations are auditable.
ALTER TABLE enrollment_document_policy_events
  DROP CONSTRAINT IF EXISTS enrollment_document_policy_events_event_type_check,
  ADD CONSTRAINT enrollment_document_policy_events_event_type_check
    CHECK (event_type IN ('policy_published','draft_created','requirement_added','requirement_changed','requirement_removed'));

CREATE UNIQUE INDEX enrollment_document_policies_one_draft_per_offer
  ON enrollment_document_policies (institution_id, offer_id)
  WHERE status = 'draft';

CREATE OR REPLACE FUNCTION audit_enrollment_document_requirement_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p enrollment_document_policies%ROWTYPE; requirement_id uuid := COALESCE(NEW.id, OLD.id);
BEGIN
  SELECT * INTO p FROM enrollment_document_policies WHERE id = COALESCE(NEW.policy_id, OLD.policy_id);
  INSERT INTO enrollment_document_policy_events(institution_id,policy_id,offer_id,actor_person_id,event_type,metadata)
  VALUES(p.institution_id,p.id,p.offer_id,p.created_by,
    CASE TG_OP WHEN 'INSERT' THEN 'requirement_added' WHEN 'UPDATE' THEN 'requirement_changed' ELSE 'requirement_removed' END,
    jsonb_build_object('version',p.version,'requirementId',requirement_id));
  RETURN COALESCE(NEW,OLD);
END $$;

CREATE TRIGGER enrollment_document_requirements_admin_audit
  AFTER INSERT OR UPDATE OR DELETE ON enrollment_document_requirements
  FOR EACH ROW EXECUTE FUNCTION audit_enrollment_document_requirement_change();
