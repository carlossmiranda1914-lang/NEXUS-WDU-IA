CREATE TABLE enrollment_document_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  offer_id UUID NOT NULL REFERENCES enrollment_offers(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  created_by UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  UNIQUE (offer_id, version)
);

CREATE UNIQUE INDEX enrollment_document_policies_one_active_per_offer
  ON enrollment_document_policies (offer_id)
  WHERE status = 'active';

CREATE TABLE enrollment_document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  policy_id UUID NOT NULL REFERENCES enrollment_document_policies(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (policy_id, document_type)
);

CREATE INDEX enrollment_document_requirements_policy_idx
  ON enrollment_document_requirements (policy_id, sort_order, document_type);
