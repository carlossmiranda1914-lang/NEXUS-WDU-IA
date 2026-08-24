# FND-01 — Schema Authority

**State:** DONE — validated 2026-08-24.

## Implementation evidence — 2026-08-24

- CP0–CP6 passed on `codex/fnd-01-schema-authority` through `dd6a762`.
- Migrations `0017` and `0018` complete the legacy compatibility and tenant-safe School Tasks reconciliation contract.
- Runtime startup is validation-only; schema mutation is owned by the canonical runner.
- PostgreSQL evidence covers checksum/ledger rollback, migration-only bootstrap, tenant-scoped School Tasks snapshots, fail-closed ambiguous ownership, startup validation, and in-memory fallback boundary.
- The disposable test target was reset only after its identity/safety gate passed, then rebuilt through migrations `0001`–`0018`.

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

Implementation must prove:
- T01 initialization failure propagation;
- T02 no false readiness after DB failure;
- T03 clean DB reaches runtime-complete target through migrations only;
- T04 missing required schema fails closed rather than self-healing silently;
- T05 restart does not mutate schema;
- T06 every persistent object consumed by the supported application path is migration-covered or explicitly deprecated;
- T07 local in-memory fallback cannot activate as production persistence;
- T08 migration checksum mismatch is rejected;
- T09 clean migration target supports tenant-safe School Tasks + Task Versions persistence without test-only DDL.

## Locked execution checkpoints

The implementation order below is part of the Mission contract. Codex may adapt a local test filename or internal helper when repository evidence requires it, but it may not reorder the architectural sequence in a way that removes proof before authority is changed.

### CP0 — Baseline, branch and preflight
**Purpose:** prove that the implementation starts from the accepted canonical baseline and that the AS-IS assumptions still hold.

Required before any production-code edit:
1. use a dedicated FND-01 implementation branch created from the accepted documentation baseline;
2. inspect branch/HEAD/working tree and preserve unrelated changes;
3. read the canonical chain required by `AGENTS.md`, the Codex adapter, this Mission Pack and its DoR evidence;
4. run `npm run nexus:preflight`;
5. when a PostgreSQL test target is configured, run the applicable read-only DB preflight before schema mutation/testing;
6. re-check targeted AS-IS symbols: `server.ts`, `src/db/init.ts`, migration chain, `scripts/setup-test-database.ts`, isolated migration verifier, School Tasks schema/repository and CI workflow.

**STOP:** stale Mission assumption, conflicting baseline, unexplained local changes, destructive/shared DB risk, or missing required test DB without an approved disposable alternative.

**Checkpoint output:** mandatory Codex execution header + concise AS-IS confirmation. No broad redesign proposal.

### CP1 — Prove the startup defect before fixing it
**Purpose:** establish red evidence for the highest-risk root cause before changing schema authority.

Implement focused executable proof for:
- **T01** — initialization failure currently does not propagate safely;
- **T02** — server/startup can proceed to readiness semantics after DB initialization failure.

Prefer focused tests around the startup/initialization contract. Do not redesign the server solely to make the test convenient; introduce the smallest test seam only if necessary and architecture-preserving.

**Gate:** at least one focused test/evidence must demonstrate the current defect before the corresponding fix. If the exact runtime defect cannot be reproduced safely, record why and use an explicit contract test that proves the unsafe control flow.

### CP2 — Establish the canonical migration engine before moving DDL
**Purpose:** create the authority that runtime DDL will move into.

Implement/prove the canonical migration engine contract first:
- deterministic `NNNN_*.sql` discovery/order;
- pending-only execution;
- migration ledger;
- content checksum recording/verification;
- transaction/failure semantics;
- non-zero failure on checksum/order/SQL error;
- repository command target `nexus:migrate` or an equivalently named command explicitly documented in this Mission evidence.

Prove **T08** before relying on the runner for later checkpoints.

**Do not** remove runtime DDL yet.

### CP3 — Close legacy compatibility migration coverage
**Purpose:** make the numbered migration chain reproduce still-supported legacy schema without promoting legacy domains to vNext architecture.

For each still-consumed uncovered legacy object listed in this Mission:
1. confirm active consumption against the implementation baseline;
2. add only the compatibility schema required by those active callers;
3. mark/document the migration purpose as transitional where practical;
4. do not redesign the legacy domain or add future-domain features;
5. include every runtime-required object or explicitly deprecate/disable its active consumer through an approved in-scope decision.

Prove **T03/T06 incrementally** against a disposable PostgreSQL target.

**STOP:** ambiguous existing data requiring destructive conversion, unknown tenant ownership, or evidence that compatibility would silently create a new canonical domain.

### CP4 — Reconcile School Tasks + Task Versions
**Purpose:** preserve the tenant-safe operational gold while removing hidden bootstrap authority.

Create explicit versioned coverage for the schema actually consumed by the active School Tasks repository, including `school_tasks`, `task_versions`, tenant context, soft-delete/SLA fields, compatible temporal types, snapshot/version behavior and justified constraints/indexes.

Prove **T09** on a clean migration-only disposable target: tenant-safe task persistence plus version snapshot behavior must work without test-only business DDL.

Do not invent ownership for unmappable existing records. Ambiguous tenant data = `BLOCKED`.

### CP5 — Remove duplicate bootstrap authorities and fail closed
**Purpose:** change authority only after migration coverage is proven.

Only after CP2–CP4 are green:
1. remove/retire business-schema CREATE/ALTER/INDEX responsibility from runtime startup;
2. replace it with validation-only startup behavior;
3. remove business-schema DDL from test setup once the canonical migrations provide the complete supported test schema;
4. delegate/retire tranche-specific migration scripts so they no longer act as independent authorities;
5. preserve explicit local in-memory fallback only within its permitted local boundary.

Then prove:
- **T01** green — DB initialization/startup failure propagates;
- **T02** green — no false readiness;
- **T04** — missing schema fails closed;
- **T05** — repeated startup is schema read-only;
- **T07** — production/persistent mode cannot silently fall back to memory.

### CP6 — Mission validation and evidence
**Purpose:** prove the complete FND-01 invariant before DONE.

Run in widening order, avoiding repeated expensive gates on unchanged HEAD:
1. focused FND-01 tests T01–T09;
2. migration-only clean bootstrap / isolated migration verification;
3. affected PostgreSQL/School Tasks regressions;
4. other relevant persistence/enrollment regressions required by the final diff;
5. `npm run lint`;
6. `npm run build`;
7. CI-required gates on the final candidate HEAD;
8. `git diff --check` and complete diff review;
9. AC→evidence matrix and recovery/residual-risk report;
10. update `PROJECT_STATE.md` only to factual implemented state.

Mission moves to `VALIDATING` when implementation scope is closed and CP6 begins. It moves to `DONE` only when every mandatory criterion/evidence is PASS and P0/P1 residual risk is zero under the canonical DoD.

## Resource/checkpoint discipline

To protect limited Codex credits without weakening quality:
- CP0–CP5 are resumable checkpoints; do not intentionally stop mid-migration or with a shared/disposable DB in an unexplained partial state;
- after completing a checkpoint, leave a compact handoff with HEAD, tests PASS/FAIL, files changed and next checkpoint;
- if token/context budget becomes low, finish or safely roll back the current micro-loop and hand off; do not widen scope or skip evidence to reach the next checkpoint;
- do not run CP6 global gates repeatedly during CP1–CP5 unless a focused change specifically requires them;
- if the same approach fails twice without new evidence, follow the adapter retry rule instead of consuming credits on variants of the same attempt.

## Dry-run result — 2026-08-20

A no-code execution simulation confirmed that product/architecture/scope decisions are sufficiently specified. The dry run identified one operational ambiguity: the internal order of FND-01 could previously be chosen by the executor. The locked checkpoints above close that ambiguity while preserving implementation freedom only at local code/test-detail level.

No production/runtime/schema code was changed by the dry run.

## DoR decision

**READY — awaiting explicit implementation authorization.**

Planning/readiness is closed. The mission is sufficiently specified to implement without inventing architecture, product scope, schema authority, environment behavior, execution order or acceptance criteria.

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
