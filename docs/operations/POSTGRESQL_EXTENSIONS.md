# PostgreSQL extensions

The Nexus migration ledger requires PostgreSQL support for the extensions declared by migrations. Migration `0120_institution_legal_profile_authority.sql` requires `btree_gist` so PostgreSQL can enforce tenant-scoped temporal exclusion for Institution Legal Profiles. Provisioning identities must be permitted to install this trusted extension before applying migrations.
