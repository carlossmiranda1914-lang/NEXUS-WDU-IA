# FINANCE-FOUNDATION-03 — Canonical Finance Persistence Schema

**State:** READY_FOR_EXECUTION
**Branch:** `codex/finance-foundation-01`
**Predecessor accepted HEAD:** `49e5c06e9b5603cc814bffa047d9f009c2a10549`
**Spec:** `docs/superpowers/specs/2026-09-03-finance-foundation-implementation-design.md`
**Plan:** `docs/superpowers/plans/2026-09-03-finance-foundation-implementation.md`
**Execution record:** `.superpowers/sdd/2026-09-03-finance-foundation/progress.md`

## Mission

Implement only Task 3 from the approved Finance Foundation plan: the canonical PostgreSQL persistence schema required by later Journal/command work.

Tasks 1 and 2 are accepted predecessors. Do not start Journal/repository behavior (Task 4) in this mission.

## Required method

Use strict TDD/stateful proof:

1. Preflight the existing migration chain and determine the next free migration number. Use `0030_finance_foundation.sql` only if `0030` is actually free in the worktree at execution time.
2. Read the canonical migration runner and the existing approved disposable PostgreSQL safety pattern.
3. Write `tests/finance-foundation-schema-postgres.test.ts` first.
4. Execute it against the approved disposable PostgreSQL target and observe the expected RED because Finance schema is absent.
5. Add exactly one append-only Finance foundation migration through the canonical migration chain.
6. Run clean bootstrap, schema negatives, migration checksum/history regression and diff gates.
7. Commit and push only after all required PostgreSQL proofs pass.
8. Stop before Task 4.

## Authorized files

Create:

- `src/db/migrations/<NEXT_FREE>_finance_foundation.sql`
- `tests/finance-foundation-schema-postgres.test.ts`

May modify:

- `package.json` only to add the approved incremental Finance test aliases required by Task 3;
- `.superpowers/sdd/2026-09-03-finance-foundation/progress.md`.

Read-only unless a proved blocker requires adjudication:

- `src/db/migration-runner.ts`
- existing DB safety helpers / PostgreSQL test patterns
- Task 1–2 Finance files

## Required schema authority

Create these institution-scoped foundation tables:

```text
finance_profile_versions
finance_journal_transactions
finance_journal_entries
finance_command_results
finance_audit_records
finance_outbox
finance_position_projection
```

This is foundation persistence only. It does not authorize Journal command behavior, Payment, Allocation, Reconciliation, provider, fiscal/reporting or UI work.

## Structural invariants

- Use the repository's existing identity convention discovered during preflight; do not invent a parallel ID strategy.
- Authoritative monetary amounts use exact PostgreSQL `NUMERIC(30,12)`.
- Authoritative rates use exact PostgreSQL `NUMERIC(30,18)` where present.
- Never use `REAL`, `FLOAT` or `DOUBLE PRECISION` for authoritative Finance money/rate fields.
- Journal/entry currency uses canonical uppercase three-letter code structural CHECK.
- Tenant-safe child relationships must include institution ownership; where a child references a parent, the database must be able to reject a cross-institution parent link.
- Provide composite `(institution_id, id)` uniqueness wherever required to support tenant-safe foreign keys.
- `finance_journal_entries` parent relation includes `institution_id`.
- Idempotency uniqueness includes `(institution_id, operation_namespace, idempotency_key)`.
- `request_fingerprint` is NOT NULL.
- Confirmed Journal transaction requires `confirmed_at`; non-confirmed state may not carry `confirmed_at`.
- Reversal/causal fields have structural checks and same-institution target relationship where represented.
- Confirmed Journal facts do not use `deleted_at` as correction authority.
- Outbox relation preserves institution ownership and Journal linkage where applicable.
- No runtime business DDL is introduced.

## Mandatory RED/PostgreSQL behaviors

Before migration implementation, the test must fail because the Finance tables are absent.

After migration, prove at minimum on real disposable PostgreSQL:

```text
clean migration chain bootstrap
=> PASS

expected Finance tables + exact numeric column types
=> PASS

orphan Journal entry
=> rejected

Journal entry with local institution + foreign parent transaction
=> rejected

invalid lowercase/non-three-letter currency where structural check applies
=> rejected

duplicate scoped idempotency identity
=> rejected

same idempotency key in different institution scope
=> allowed when all other required references are valid

NULL request_fingerprint
=> rejected

out-of-envelope authoritative amount/rate
=> rejected by PostgreSQL numeric envelope / constraints

invalid lifecycle timestamp combination
=> rejected

valid same-tenant minimal structural fixture
=> accepted
```

Do not claim tenant safety from source inspection alone; execute the negative insert/update attempts against PostgreSQL.

## Canonical migration rules

- Extend only the existing migration chain.
- Never modify, renumber or rewrite an already-applied/historical migration.
- Do not create a Finance-specific migration runner.
- Do not add setup scripts that issue Finance DDL outside the canonical migration path.
- If the planned migration number is occupied, choose the next free number and record the decision in `progress.md`; this is not an architecture change.
- If migration-runner behavior itself is broken, STOP before modifying it and report evidence.

## Required commands

Preflight:

```bash
git status --short
git ls-files "src/db/migrations/*.sql"
```

RED:

```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-foundation-schema-postgres.test.ts
```

GREEN / proof:

```bash
npm run test:migrations:isolated
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-foundation-schema-postgres.test.ts
npm run test:fnd01:cp2:local
npm run lint
npm run build
git diff --check
```

Use the repository's approved local PostgreSQL target/safety preflight. Do not bypass `TEST_DATABASE_LOCAL_AUTHORIZED` policy and do not print credentials.

## STOP conditions

STOP and report without workaround if:

- no approved disposable PostgreSQL target can be safely authorized;
- the canonical migration chain cannot bootstrap before Finance changes;
- next migration ordering is ambiguous;
- a historical migration appears modified or checksum-invalid;
- tenant-safe ownership cannot be expressed without ambiguous legacy ownership;
- exact Money/Rate persistence would require floating-point storage;
- a required invariant would require building Task 4 Journal behavior rather than schema structure;
- implementation requires runtime DDL or a second migration authority;
- a baseline PostgreSQL/migration gate fails for reasons unrelated to Task 3 and cannot be classified safely.

## DONE definition

`FINANCE-FOUNDATION-03` is DONE only when:

- migration number was preflighted and recorded;
- a valid PostgreSQL RED was observed and recorded;
- the Finance foundation migration is append-only and canonical;
- all required tables/constraints/types exist;
- real PostgreSQL negative integrity tests pass;
- clean isolated migration bootstrap passes;
- migration checksum/history regression passes;
- `npm run lint` PASS;
- `npm run build` PASS;
- `git diff --check` PASS;
- worktree is clean after commit;
- exact commit SHA is pushed and recorded;
- Task 4 has not started.
