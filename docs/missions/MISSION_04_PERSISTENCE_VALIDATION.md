# Mission 04 — PostgreSQL Persistence Validation

## Objective

Prove that the official PostgreSQL schema required by the institutional model
exists, and ensure database mutation tests cannot run against production by
mistake.

## Evidence recorded on 2026-08-11

- The official database was checked in a `BEGIN READ ONLY` transaction.
- The seven required vNext tables were confirmed: institutions, people,
  identities, memberships, student_profiles, guardian_relationships, and
  institution_resource_ownership.
- The expected institutional columns were confirmed for every table.
- `DATABASE_URL` is treated as persistent storage and disables memory fallback.
- Database mutation tests now require both a separate `TEST_DATABASE_URL` and
  the explicit `TEST_DATABASE_CONFIRMATION=NEXUS_TEST_DATABASE` value.
- A test URL equal to `DATABASE_URL` is refused.
- Without a dedicated test database, mutation tests report an explicit safe
  skip instead of attempting localhost or production.
- The dedicated `NEXUS.EDU.AI-TEST` database was initialized with all four
  vNext migrations and the legacy tables required by the existing test suites.
- Real mutation tests passed on the test database: 7/7 school-task integrity
  tests and 5/5 authentication persistence tests.

## Validation commands

- `npm run lint`
- `npm run test:integrity`
- `npm run test:auth`
- `npm run test:schema`
- targeted node tests for runtime policy, test database guard, institutional
  context, ownership, and WebSocket isolation
- `npm run build`

## Operational rule

Keep `NEXUS.EDU.AI-TEST` for the duration of development. It contains only
synthetic test records and is the only approved target for mutation suites.
