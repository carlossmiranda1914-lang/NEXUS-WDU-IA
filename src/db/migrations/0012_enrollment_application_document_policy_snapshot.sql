ALTER TABLE enrollment_applications
  ADD COLUMN document_policy_id UUID REFERENCES enrollment_document_policies(id) ON DELETE RESTRICT,
  ADD COLUMN document_policy_captured_at TIMESTAMPTZ;

CREATE INDEX enrollment_applications_document_policy_idx
  ON enrollment_applications (institution_id, document_policy_id);
