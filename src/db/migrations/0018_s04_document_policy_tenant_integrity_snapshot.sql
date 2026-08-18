-- S04 Slice 1: tenant-safe document policies and immutable enrollment snapshots.
-- No file bytes are stored here; physical evidence remains in enrollment_document_files.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM enrollment_document_policies policy
      JOIN enrollment_offers offer ON offer.id = policy.offer_id
     WHERE policy.institution_id <> offer.institution_id
  ) THEN
    RAISE EXCEPTION 'Cannot apply 0018: enrollment_document_policies contains cross-institution offer references';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM enrollment_applications enrollment
      JOIN enrollment_document_policies policy ON policy.id = enrollment.document_policy_id
     WHERE enrollment.document_policy_id IS NOT NULL
       AND enrollment.institution_id <> policy.institution_id
  ) THEN
    RAISE EXCEPTION 'Cannot apply 0018: enrollment_applications contains cross-institution document policy references';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM enrollment_document_requirements requirement
      JOIN enrollment_document_policies policy ON policy.id = requirement.policy_id
     WHERE requirement.institution_id <> policy.institution_id
  ) THEN
    RAISE EXCEPTION 'Cannot apply 0018: enrollment_document_requirements contains cross-institution policy references';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM enrollment_documents snapshot
      JOIN enrollment_applications enrollment ON enrollment.id = snapshot.enrollment_application_id
     WHERE snapshot.institution_id <> enrollment.institution_id
  ) THEN
    RAISE EXCEPTION 'Cannot apply 0018: enrollment_documents contains cross-institution enrollment references';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM enrollment_documents snapshot
      JOIN enrollment_document_requirements requirement ON requirement.id = snapshot.source_requirement_id
     WHERE snapshot.source_requirement_id IS NOT NULL
       AND snapshot.institution_id <> requirement.institution_id
  ) THEN
    RAISE EXCEPTION 'Cannot apply 0018: enrollment_documents contains cross-institution source requirement references';
  END IF;
END $$;

ALTER TABLE enrollment_offers
  ADD CONSTRAINT enrollment_offers_institution_id_id_unique UNIQUE (institution_id, id);

ALTER TABLE enrollment_document_policies
  ADD CONSTRAINT enrollment_document_policies_institution_id_id_unique UNIQUE (institution_id, id);

ALTER TABLE enrollment_document_policies
  DROP CONSTRAINT IF EXISTS enrollment_document_policies_offer_id_fkey,
  ADD CONSTRAINT enrollment_document_policies_offer_institution_fk
    FOREIGN KEY (institution_id, offer_id)
    REFERENCES enrollment_offers(institution_id, id) ON DELETE RESTRICT;

ALTER TABLE enrollment_document_requirements
  ADD CONSTRAINT enrollment_document_requirements_institution_id_id_unique UNIQUE (institution_id, id),
  DROP CONSTRAINT IF EXISTS enrollment_document_requirements_policy_id_fkey,
  ADD CONSTRAINT enrollment_document_requirements_policy_institution_fk
    FOREIGN KEY (institution_id, policy_id)
    REFERENCES enrollment_document_policies(institution_id, id) ON DELETE CASCADE;

ALTER TABLE enrollment_applications
  DROP CONSTRAINT IF EXISTS enrollment_applications_document_policy_id_fkey,
  ADD CONSTRAINT enrollment_applications_document_policy_institution_fk
    FOREIGN KEY (institution_id, document_policy_id)
    REFERENCES enrollment_document_policies(institution_id, id) ON DELETE RESTRICT;

ALTER TABLE enrollment_documents
  DROP CONSTRAINT IF EXISTS enrollment_documents_enrollment_application_id_fkey,
  ADD CONSTRAINT enrollment_documents_application_institution_fk
    FOREIGN KEY (institution_id, enrollment_application_id)
    REFERENCES enrollment_applications(institution_id, id) ON DELETE CASCADE;

ALTER TABLE enrollment_document_requirements
  ADD COLUMN requirement_code TEXT,
  ADD COLUMN requirement_label TEXT,
  ADD COLUMN requirement_type TEXT NOT NULL DEFAULT 'document'
    CHECK (requirement_type = 'document');

-- Existing requirements did not have an authored code/label. These values are
-- deterministic, traceable and deliberately do not invent a business meaning.
UPDATE enrollment_document_requirements
   SET requirement_code = COALESCE(requirement_code, 'legacy-document:' || id::text),
       requirement_label = COALESCE(requirement_label, document_type)
 WHERE requirement_code IS NULL OR requirement_label IS NULL;

ALTER TABLE enrollment_document_requirements
  ALTER COLUMN requirement_code SET NOT NULL,
  ALTER COLUMN requirement_label SET NOT NULL,
  ADD CONSTRAINT enrollment_document_requirements_policy_code_unique
    UNIQUE (policy_id, requirement_code);

ALTER TABLE enrollment_documents
  ADD COLUMN requirement_code TEXT,
  ADD COLUMN requirement_label TEXT,
  ADD COLUMN requirement_type TEXT;

-- Only versioned-policy documents can be backfilled safely. Legacy documents
-- remain explicitly non-snapshotted rather than receiving invented metadata.
UPDATE enrollment_documents snapshot
   SET requirement_code = requirement.requirement_code,
       requirement_label = requirement.requirement_label,
       requirement_type = requirement.requirement_type
  FROM enrollment_document_requirements requirement
 WHERE snapshot.source_requirement_id = requirement.id
   AND (snapshot.requirement_code IS NULL
        OR snapshot.requirement_label IS NULL
        OR snapshot.requirement_type IS NULL);

ALTER TABLE enrollment_documents
  ADD CONSTRAINT enrollment_documents_versioned_snapshot_complete CHECK (
    source_requirement_id IS NULL
    OR (
      requirement_code IS NOT NULL
      AND requirement_label IS NOT NULL
      AND requirement_type = 'document'
    )
  ),
  ADD CONSTRAINT enrollment_documents_requirement_type_valid CHECK (
    requirement_type IS NULL OR requirement_type = 'document'
  ),
  DROP CONSTRAINT IF EXISTS enrollment_documents_source_requirement_id_fkey,
  ADD CONSTRAINT enrollment_documents_source_requirement_institution_fk
    FOREIGN KEY (institution_id, source_requirement_id)
    REFERENCES enrollment_document_requirements(institution_id, id) ON DELETE SET NULL (source_requirement_id);
