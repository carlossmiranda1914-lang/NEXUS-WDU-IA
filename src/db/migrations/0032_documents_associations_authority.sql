-- DOCUMENTS-FOUNDATION-I2: Canonical Document Associations & Business Decision References Authority
-- Institution-scoped document associations, version pinning, target domain/resource references, and factual append-only business decision references.

CREATE TABLE IF NOT EXISTS document_associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  document_id UUID NOT NULL,
  pinned_version_id UUID,
  target_domain TEXT NOT NULL CHECK (length(trim(target_domain)) BETWEEN 2 AND 64),
  target_resource_type TEXT NOT NULL CHECK (length(trim(target_resource_type)) BETWEEN 2 AND 64),
  target_resource_id TEXT NOT NULL CHECK (length(trim(target_resource_id)) BETWEEN 1 AND 128),
  purpose TEXT NOT NULL CHECK (length(trim(purpose)) BETWEEN 2 AND 128),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'withdrawn', 'closed')),
  created_by_person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_associations_institution_id_unique
    UNIQUE (institution_id, id),
  CONSTRAINT document_associations_institution_doc_id_unique
    UNIQUE (institution_id, document_id, id),
  CONSTRAINT document_associations_document_tenant_fk
    FOREIGN KEY (institution_id, document_id)
    REFERENCES documents(institution_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT document_associations_version_doc_tenant_fk
    FOREIGN KEY (institution_id, document_id, pinned_version_id)
    REFERENCES document_versions(institution_id, document_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS document_associations_target_idx
  ON document_associations (institution_id, target_domain, target_resource_type, target_resource_id);

CREATE INDEX IF NOT EXISTS document_associations_document_idx
  ON document_associations (institution_id, document_id);

CREATE INDEX IF NOT EXISTS document_associations_created_idx
  ON document_associations (institution_id, created_at DESC);

CREATE TABLE IF NOT EXISTS document_business_decision_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  association_id UUID NOT NULL,
  document_id UUID NOT NULL,
  version_id UUID NOT NULL,
  authority_domain TEXT NOT NULL CHECK (length(trim(authority_domain)) BETWEEN 2 AND 64),
  decision_type TEXT NOT NULL CHECK (length(trim(decision_type)) BETWEEN 2 AND 64),
  decision_outcome TEXT NOT NULL CHECK (decision_outcome IN ('accepted', 'rejected', 'waived', 'inconclusive')),
  decision_reason TEXT CHECK (decision_reason IS NULL OR length(trim(decision_reason)) <= 512),
  external_reference TEXT NOT NULL CHECK (length(trim(external_reference)) BETWEEN 1 AND 128),
  decided_by_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  correlation_id TEXT CHECK (correlation_id IS NULL OR length(trim(correlation_id)) BETWEEN 4 AND 128),
  CONSTRAINT document_business_decision_references_association_tenant_fk
    FOREIGN KEY (institution_id, association_id)
    REFERENCES document_associations(institution_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT document_business_decision_references_version_doc_tenant_fk
    FOREIGN KEY (institution_id, document_id, version_id)
    REFERENCES document_versions(institution_id, document_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS document_decision_ref_association_idx
  ON document_business_decision_references (institution_id, association_id);

CREATE INDEX IF NOT EXISTS document_decision_ref_version_idx
  ON document_business_decision_references (institution_id, document_id, version_id);

CREATE INDEX IF NOT EXISTS document_decision_ref_observed_idx
  ON document_business_decision_references (institution_id, observed_at DESC);
