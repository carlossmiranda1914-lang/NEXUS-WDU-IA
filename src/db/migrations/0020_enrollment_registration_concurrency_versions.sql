-- ENROLLMENT-01: explicit monotonic authorities for registration and global Person mutations.
-- Additive only; existing rows begin at version 1 and no runtime migration is permitted.
ALTER TABLE people
  ADD COLUMN version BIGINT NOT NULL DEFAULT 1
  CHECK (version > 0);

ALTER TABLE enrollment_applications
  ADD COLUMN registration_version BIGINT NOT NULL DEFAULT 1
  CHECK (registration_version > 0);
