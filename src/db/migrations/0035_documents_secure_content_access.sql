-- Migration: 0035_documents_secure_content_access.sql
-- Mission: DOCUMENTS-FOUNDATION-I5
-- Authority: Secure Content Access, Temporary Access Grants, Revocation & Multi-Tenant Boundaries

CREATE TABLE IF NOT EXISTS document_content_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  document_id UUID NOT NULL,
  version_id UUID NOT NULL,
  grantee_person_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('open', 'download')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'expired', 'revoked')),
  token_hash TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  revocation_reason TEXT NULL,
  revoked_by_person_id UUID NULL,
  correlation_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_doc_content_grants_inst_token UNIQUE (institution_id, token_hash),
  CONSTRAINT uq_doc_content_grants_inst_id UNIQUE (institution_id, id),
  CONSTRAINT fk_doc_content_grants_inst FOREIGN KEY (institution_id) REFERENCES institutions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_content_grants_inst_doc FOREIGN KEY (institution_id, document_id) REFERENCES documents (institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_content_grants_inst_doc_ver FOREIGN KEY (institution_id, document_id, version_id) REFERENCES document_versions (institution_id, document_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_content_grants_grantee FOREIGN KEY (grantee_person_id) REFERENCES people (id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_content_grants_revoked_by FOREIGN KEY (revoked_by_person_id) REFERENCES people (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_doc_content_grants_inst_ver_status ON document_content_access_grants (institution_id, version_id, status);
CREATE INDEX IF NOT EXISTS idx_doc_content_grants_inst_grantee_status ON document_content_access_grants (institution_id, grantee_person_id, status);
CREATE INDEX IF NOT EXISTS idx_doc_content_grants_expires ON document_content_access_grants (expires_at) WHERE status = 'active';
