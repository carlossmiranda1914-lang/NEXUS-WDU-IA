-- Public navigation may correlate an identity-review case, but must never use
-- the decision primary key (or a Person identifier) as its handle.
ALTER TABLE identity_resolution_decisions
  ADD COLUMN public_ref TEXT NOT NULL DEFAULT encode(public.gen_random_bytes(18), 'hex');

ALTER TABLE identity_resolution_decisions
  ADD CONSTRAINT identity_resolution_decisions_public_ref_unique UNIQUE (public_ref);

CREATE INDEX identity_resolution_decisions_public_queue_idx
  ON identity_resolution_decisions (institution_id, status, public_ref);
