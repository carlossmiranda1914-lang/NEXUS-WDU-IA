# FND-01 — Schema Authority

**State:** READY — awaiting explicit implementation authorization.

## Objective
Make versioned PostgreSQL migrations the single schema-evolution authority and ensure unsafe initialization fails closed.

## Origin
AUD-DB-001, AUD-DB-002. Supports `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md` §7.

## Preserve
- numbered migration history;
- clean-schema/isolation verification patterns;
- `nexus:preflight` read-only discipline;
- vNext database invariants and tenant constraints;
- the tenant-safe School Tasks repository/service behavior, but not its current bootstrap mechanism.

## IN
- canonical migration engine/ledger/checksum contract;
- compatibility migrations for still-consumed legacy schema;
- canonical reconciliation migration for School Tasks + Task Versions;
- removal of runtime business-schema mutation only after coverage is proven;
- fail-closed startup validation;
- CI proof of migration-only clean bootstrap;
- retirement/delegation of tranche-specific migration authorities.

## OUT
- Finance redesign;
- Academic Core redesign;
- IAM replacement itself;
- legacy capability removal that belongs to FND-02 or later missions;
- broad repository refactor;
- destructive data cleanup without a separate approved migration/recovery plan.

## Canonical DoR evidence
See `docs/roadmap/missions/FND-01_DOR_EVIDENCE.md`.

## Proven AS-IS
1. `server.ts` awaits `initializeDatabase()` before announcing DB operational readiness.
2. `src/db/init.ts` mutates persistent schema at runtime and can swallow initialization/DDL failures.
3. `src/db/migrations/` is the ordered migration-history candidate, but does not currently produce the complete runtime-required schema by itself.
4. CI/test setup applies migrations and then injects additional legacy schema; therefore `migrations = complete schema` is false today.
5. `operational_logs` is covered by numbered migration `0005`; equivalent startup DDL is redundant authority.
6. Most runtime-created legacy tables are not covered by numbered migrations.
7. `school_tasks` is operational and must not be treated as disposable legacy.
8. `task_versions` is a real persistent dependency: it is declared in Drizzle and written/read by the School Tasks repository.
9. The local in-memory path in `src/db/index.ts` is an explicit fallback/emulator, not a second PostgreSQL DDL authority.
10. Development and CI/test schema paths are evidenced in-repository.
11. Staging and Production are project-declared `NOT YET PROVISIONED` as of 2026-08-20.

## Schema transition decisions

### Compatibility migrations — transitional, not canonical domain endorsement
The following currently consumed legacy objects must receive explicit compatibility coverage before hidden startup creation can disappear: `users`, `students`, `teachers`, `invoices`, `announcements`, `chat_messages`, `automations`, `uploaded_documents`, `approvals` and any other still-consumed runtime object proved uncovered during implementation preflight.

These migrations preserve present compatibility only. They do not override `docs/audit/LEGACY_REPLACEMENT_MAP.md` or convert legacy domain models into vNext architecture.

### Already covered
`operational_logs` is migration-covered; startup creation becomes removable once the canonical migration runner and startup validation are proven.

### Canonical reconciliation
`school_tasks` and `task_versions` require an explicit versioned reconciliation contract covering the schema actually consumed by the tenant-safe repository, including tenant context, soft-delete, SLA fields, temporal types, version snapshots and required indexes/constraints.

## Canonical migration runner decision

FND-01 will converge to one complete migration engine exposed as the repository's canonical migration command (target name: `nexus:migrate`). It must:

1. discover only ordered `NNNN_*.sql` migrations;
2. apply pending migrations in deterministic order;
3. use one transaction per migration;
4. maintain a migration ledger;
5. record and verify a checksum for applied migration content;
6. fail non-zero on any mismatch/failure;
7. never edit history to hide an applied migration;
8. be reused by development, CI/test, staging and production wrappers;
9. make tranche-specific migration scripts delegates or historical/special-purpose tools rather than competing authorities.

## Approved future shared-environment deployment contract

Staging and Production are not yet provisioned. When either is created, its first approved deployment path must be:

`read-only preflight → identify target DB → backup/change gate when data exists → nexus:migrate → ledger/checksum verification → schema validation → application start → health/readiness`

No shared environment may rely on runtime business-schema self-healing or in-memory production persistence.

## Recovery rule

Before corrective migration in a shared environment: identify target DB, run read-only schema fingerprint/preflight, compare actual schema to target, and use the environment's approved backup mechanism. Prefer additive/compensating forward migrations. Ambiguous data or destructive transformation = STOP and separate approved recovery/migration plan.

## Regression contract

Implementation must begin with executable red tests/specs for:
- initialization failure propagation;
- no false readiness after DB failure;
- clean DB reaches runtime-complete target through migrations only;
- missing required schema fails closed rather than self-healing silently;
- restart does not mutate schema;
- every persistent object consumed by the active application is migration-covered or explicitly deprecated;
- local in-memory fallback cannot activate as production persistence;
- migration checksum mismatch is rejected;
- clean migration target supports tenant-safe School Tasks + Task Versions persistence without test-only DDL.

## DoR decision

**READY — awaiting explicit implementation authorization.**

Planning/readiness is closed. The mission is sufficiently specified to implement without inventing architecture, product scope, schema authority, environment behavior or acceptance criteria.

READY does not authorize code automatically. Before the first edit, the implementation agent must re-verify the AS-IS against the chosen implementation baseline, run required preflight, confirm the Mission Pack is still current, produce the mandatory execution header from `docs/operations/CODEX_EXECUTION_ADAPTER.md`, and stop if new evidence contradicts any READY assumption.

## Acceptance / DONE
- complete persistent schema needed by the supported application path is produced by versioned migrations;
- one canonical migration engine owns ordering, ledger and checksum verification;
- test setup contains no hidden business-schema DDL authority;
- startup performs validation only and cannot mutate business schema;
- unsafe/missing schema causes visible startup failure;
- legacy compatibility migrations are explicitly transitional;
- School Tasks + Task Versions schema is migration-owned and repository-compatible;
- focused red→green startup/schema tests pass;
- migration isolation, relevant PostgreSQL regressions, TypeScript and build pass;
- CI invokes the canonical path and gates failures;
- future staging/production deployment contract remains consistent with the same migration authority;
- evidence pack and `PROJECT_STATE.md` are updated truthfully.

## Stop rules
Stop immediately if implementation discovers unmodeled production/shared data, an environment that contradicts the `NOT YET PROVISIONED` declaration, a deployed path that relies on undocumented self-healing, a destructive conversion not covered by the recovery plan, a schema consumer absent from the reconciliation inventory, or a requirement to redesign an unrelated domain. Return the mission to `BLOCKED` rather than widening scope.
