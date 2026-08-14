ALTER TABLE enrollment_documents
  ADD COLUMN required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN source_requirement_id UUID REFERENCES enrollment_document_requirements(id) ON DELETE SET NULL;

CREATE INDEX enrollment_documents_required_status_idx
  ON enrollment_documents (enrollment_application_id, required, status);
