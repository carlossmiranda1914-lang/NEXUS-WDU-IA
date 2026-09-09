-- Migration: 0034_documents_technical_verification.sql
-- Mission: DOCUMENTS-FOUNDATION-I4
-- Authority: Technical Verification Pipeline, Factual Assessments & Quarantine

CREATE TABLE IF NOT EXISTS document_technical_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  document_id UUID NOT NULL,
  version_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_verification', 'available', 'quarantined', 'inconclusive', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  completed_at TIMESTAMPTZ NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_retry_at TIMESTAMPTZ NULL,
  quarantine_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_doc_tech_verifications_inst_ver UNIQUE (institution_id, version_id),
  CONSTRAINT uq_doc_tech_verifications_inst_id UNIQUE (institution_id, id),
  CONSTRAINT uq_doc_tech_verifications_inst_doc_ver_id UNIQUE (institution_id, document_id, version_id, id),
  CONSTRAINT fk_doc_tech_verifications_inst FOREIGN KEY (institution_id) REFERENCES institutions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_tech_verifications_inst_doc FOREIGN KEY (institution_id, document_id) REFERENCES documents (institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_tech_verifications_inst_doc_ver FOREIGN KEY (institution_id, document_id, version_id) REFERENCES document_versions (institution_id, document_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS document_technical_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  document_id UUID NOT NULL,
  version_id UUID NOT NULL,
  verification_id UUID NOT NULL,
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('integrity', 'size', 'real_type', 'malware')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'pass', 'fail', 'inconclusive', 'error')),
  provider TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1 CHECK (attempt_number >= 1),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  facts JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_doc_tech_assessments_attempt UNIQUE (institution_id, verification_id, assessment_type, attempt_number),
  CONSTRAINT fk_doc_tech_assessments_inst FOREIGN KEY (institution_id) REFERENCES institutions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_tech_assessments_inst_doc FOREIGN KEY (institution_id, document_id) REFERENCES documents (institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_tech_assessments_inst_doc_ver FOREIGN KEY (institution_id, document_id, version_id) REFERENCES document_versions (institution_id, document_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_tech_assessments_verification FOREIGN KEY (institution_id, document_id, version_id, verification_id) REFERENCES document_technical_verifications (institution_id, document_id, version_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_doc_tech_verifications_inst_status ON document_technical_verifications (institution_id, status);
CREATE INDEX IF NOT EXISTS idx_doc_tech_assessments_inst_ver ON document_technical_assessments (institution_id, version_id);
CREATE INDEX IF NOT EXISTS idx_doc_tech_assessments_verification ON document_technical_assessments (institution_id, verification_id);
