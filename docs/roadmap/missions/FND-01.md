# FND-01 — Schema Authority

**State:** BLOCKED — EXTERNAL EVIDENCE ONLY. Internal code/architecture investigation and repository/document consistency audit are complete; implementation is not authorized.

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

## Internal investigation — CLOSED

### Proven
1. `server.ts` awaits `initializeDatabase()` before announcing DB operational readiness.
2. `src/db/init.ts` mutates persistent schema at runtime and can swallow initialization/DDL failures.
3. `src/db/migrations/` is the ordered migration-history candidate, but does not currently produce the complete runtime-required schema by itself.
4. CI/test setup applies migrations and then injects additional legacy schema; therefore `migrations = complete schema` is false today.
5. `operational_logs` is covered by numbered migration `0005`; equivalent startup DDL is redundant authority.
6. Most runtime-created legacy tables are not covered by numbered migrations.
7. `school_tasks` is operational and must not be treated as disposable legacy.
8. `task_versions` is a real persistent dependency: it is declared in Drizzle and written/read by the School Tasks repository.
9. The local in-memory path in `src/db/index.ts` is an explicit fallback/emulator, not a second PostgreSQL DDL authority.
10. Development and CI/test schema paths are evidenced in-repository; staging and production migration paths are not.

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
- local in-memory fallback cannot activate as production persistence.

## Environment truth audit — CLOSED AS UNKNOWN

Evidence checked before final DoR:

- repository deployment/configuration/search surface;
- GitHub CI/workflow evidence available in the repository;
- `.env.example` environment contract;
- canonical repository architecture/project-state documents;
- connected Google Drive Nexus architecture/planning material, including the TO-BE document's deploy/environment guidance;
- project notes supplied with the repository context.

The evidence supports only these classifications:

- **Development:** PROVEN — local `npm run dev` / server startup path exists and currently invokes runtime DB initialization.
- **CI/Test:** PROVEN — PostgreSQL + migration/test setup path exists and is currently schema-authority fragmented.
- **Staging:** UNKNOWN / NOT PROVEN.
- **Production:** UNKNOWN / NOT PROVEN.

The Drive TO-BE architecture defines target deploy/environment principles but does not prove a provisioned staging/production platform, database, migration command, start command, historical dependence on `initializeDatabase()`, or backup/restore owner. Repository search likewise does not prove those facts.

`UNKNOWN` must not be reinterpreted as `NOT YET PROVISIONED` or `PROVISIONED` by Codex or by inference.

## Remaining DoR blocker — external evidence only

Before changing runtime/schema code, obtain one factual classification for each shared environment.

### If PROVISIONED
Record:
- hosting/deployment target;
- database target/class;
- start/deploy command;
- migration command/process, if any;
- whether `initializeDatabase()` has historically created/repaired schema there;
- backup/restore mechanism and owner;
- whether deployment can execute migration explicitly before application traffic/start.

### If NOT YET PROVISIONED
Record that fact explicitly and approve the future contract:

`read-only preflight → backup/change gate when data exists → nexus:migrate → ledger/checksum verification → schema validation → application start → health/readiness`

Do not invent an environment dependency.

## DoR decision

**BLOCKED — EXTERNAL EVIDENCE ONLY.**

The code/architecture investigation, schema-transition policy, School Tasks/Task Versions contract, recovery model, regression contract, canonical-runner direction and documentation-consistency review are sufficiently specified. No further repository or Drive archaeology is required for DoR.

Implementation remains unauthorized until staging and production are factually classified as `PROVISIONED` with the required migration/recovery facts or explicitly `NOT YET PROVISIONED` with the future deployment contract approved.

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
- staging/production deployment contract is documented and consistent with the same migration authority;
- evidence pack and `PROJECT_STATE.md` are updated truthfully.

## Stop rules
Stop immediately if implementation discovers unmodeled production data, a deployed environment that relies on undocumented self-healing, a destructive conversion not covered by the recovery plan, a schema consumer absent from the reconciliation inventory, or a requirement to redesign an unrelated domain. Report evidence and return the mission to BLOCKED rather than widening scope.
