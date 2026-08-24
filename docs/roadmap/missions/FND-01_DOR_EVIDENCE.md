# FND-01 — DoR Evidence Pack

**Mission:** FND-01 — Schema Authority  
**Review date:** 2026-08-20  
**Implementation status:** DONE — validated 2026-08-24  
**Frozen implementation reference:** `689d1dd8919a25e91911ae118c5aad9ff69c5862` / PR #65  
**Comparison baseline:** `main`

## 1. Evidence rule

This pack records facts needed to decide whether FND-01 may enter implementation. `PROVEN` means repository evidence supports the statement. `DECIDED` means canonical architecture/roadmap has enough evidence to choose a target. `PROJECT-DECLARED` means the project owner has explicitly supplied the operational fact. No executor may replace any of these with inference.

## Execution evidence — 2026-08-24

CP0–CP6 completed on the approved local FND-01 branch. The focused PostgreSQL suite proved migration ordering, ledger/checksum behavior, migration-only clean bootstrap, tenant-isolated School Tasks persistence, snapshot rollback, fail-closed ownership reconciliation, validation-only startup, and production memory-fallback denial. The approved disposable target was reset as a whole and rebuilt by the canonical migration runner after contamination was detected; no ownership was invented and no selective business-row cleanup was performed.

## 2. Runtime schema authority — PROVEN

`server.ts` imports and awaits `initializeDatabase()` before declaring the DB operationally ready. `src/db/init.ts` performs persistent runtime DDL and catches multiple errors, including a top-level failure path that logs rather than reliably failing startup. This establishes both competing schema authority and false-readiness risk.

### Runtime-created tables
- `users`
- `students`
- `teachers`
- `invoices`
- `announcements`
- `chat_messages`
- `automations`
- `uploaded_documents`
- `operational_logs`
- `approvals`
- `school_tasks`

### Runtime alterations
`users`: phone, department, status, last_access.

`school_tasks`: soft-delete, SLA/response fields, temporal type conversions and operational indexes.

## 3. Local fallback boundary — PROVEN

`src/db/index.ts` contains an explicit in-memory emulator/fallback for local operation. It includes `school_tasks` and `task_versions` arrays but does not represent persistent PostgreSQL schema evolution. When persistent DB mode is configured, query failures are propagated. Therefore it is not classified as a competing persistent DDL authority.

## 4. Numbered migration chain — PROVEN

`src/db/migrations/` contains the ordered `NNNN_*.sql` chain. `scripts/verify-migrations-isolated.ts` discovers numbered files, sorts them lexically and applies each transactionally in a disposable PostgreSQL schema, failing non-zero on error.

This is strong verification infrastructure, but not yet the complete all-environment migration authority.

## 5. CI/test fragmentation — PROVEN

The Secretariat CI starts PostgreSQL, runs preflight, executes `test:database:setup`, domain regressions, isolated migrations, TypeScript and production build.

The test DB setup applies numbered migrations and still provisions additional legacy/test schema. Therefore current CI proves that migrations execute, but does **not** prove that migrations alone produce the complete schema required by the active application.

## 6. Runtime DDL ↔ migration coverage matrix

| Runtime/required object | Numbered migration coverage | Classification | FND-01 treatment |
|---|---|---|---|
| `users` + runtime columns | not proven in numbered chain | UNCOVERED / TRANSITIONAL | compatibility migration; remains legacy authority only until FND-02/IAM replacement |
| `students` | not proven | UNCOVERED / TRANSITIONAL | compatibility migration; never promote aggregate as vNext Student model |
| `teachers` | not proven | UNCOVERED / TRANSITIONAL | compatibility migration pending Academic Core replacement |
| `invoices` | not proven | UNCOVERED / TRANSITIONAL | compatibility migration pending Finance replacement |
| `announcements` | not proven | UNCOVERED / TRANSITIONAL | compatibility migration pending Communication authority |
| `chat_messages` | not proven | UNCOVERED / TRANSITIONAL | compatibility migration; tenant/concurrency repair belongs to later mission unless required for schema correctness |
| `automations` | not proven | UNCOVERED / TRANSITIONAL/PROTOTYPE | minimal compatibility only while active callers remain |
| `uploaded_documents` | not proven | UNCOVERED / TRANSITIONAL | compatibility migration; do not confuse with vNext document domain |
| `operational_logs` | `0005_vnext_audit_observability.sql` | COVERED | remove redundant startup ownership after canonical runner is proven |
| `approvals` | not proven | UNCOVERED / TRANSITIONAL | compatibility migration while callers remain |
| `school_tasks` base + runtime upgrades | no complete numbered coverage proven | CRITICAL RECONCILIATION | explicit canonical reconciliation migration |
| School Tasks indexes/types | no complete numbered coverage proven | CRITICAL RECONCILIATION | include only indexes/types justified by active repository/query contract |
| `task_versions` | no numbered coverage proven | REQUIRED / MISSING | include in School Tasks reconciliation; it is actively read/written by repository |

## 7. School Tasks / Task Versions contract — PROVEN ENOUGH FOR IMPLEMENTATION

The tenant-safe repository imports both `schoolTasks` and `taskVersions`. It scopes Task reads/writes by tenant, writes `tenantId`, `schoolId` and `organizationId`, performs soft-delete/restore, records SLA-related state and creates version snapshots on create/update/delete/restore.

Therefore a runtime-complete persistent schema for this module must include:

### `school_tasks`
- active business columns consumed by repository;
- soft-delete fields;
- SLA/start/response fields;
- timestamp types compatible with repository values;
- `tenant_id`, `school_id`, `organization_id`;
- indexes required by real repository/query patterns;
- explicit reconciliation/preflight for existing data before introducing stronger tenant constraints.

### `task_versions`
- task id;
- monotonically usable version number per task;
- JSON snapshot;
- actor and changed timestamp;
- action;
- request/correlation metadata;
- IP/user-agent metadata where retained;
- diff payload;
- index/uniqueness decisions justified by repository behavior.

Any existing data that cannot be mapped safely to tenant context must BLOCK a restrictive migration rather than receive invented ownership.

## 8. Legacy transition policy — DECIDED

FND-01 is not allowed to solve legacy domain replacement. For still-consumed legacy schema that lacks numbered migration coverage, create explicit **compatibility migrations** whose purpose is to make migrations reproduce the current supported schema without pretending those tables are the future domain model.

`docs/audit/LEGACY_REPLACEMENT_MAP.md` remains authoritative for eventual retirement.

## 9. Canonical runner contract — DECIDED

Target repository command: `nexus:migrate` (exact implementation file may vary).

Required behavior:
1. discover only valid ordered `NNNN_*.sql` files;
2. deterministic order;
3. migration ledger;
4. checksum persisted and verified for every applied migration;
5. one transaction per migration unless a reviewed migration explicitly documents why not;
6. pending-only application;
7. non-zero failure on SQL error, checksum mismatch or invalid ordering;
8. no rewriting/apparently reapplying historical migrations;
9. reusable engine for dev, CI/test, staging and production;
10. environment wrappers may add credentials, preflight, backup/change approval, but cannot change migration semantics/order.

Tranche-specific scripts must become delegates or explicitly historical/special-purpose; they cannot remain independent schema authorities.

## 10. Recovery contract — DECIDED

Before migration against a shared DB:
1. identify target environment/database;
2. run read-only preflight/schema fingerprint;
3. compare actual schema/data preconditions with migration target;
4. confirm backup/restore mechanism for the environment;
5. apply forward migration only when preconditions are satisfied.

Divergence classes:
- ALIGNED → proceed;
- MISSING ADDITIVE OBJECT → versioned forward migration;
- TYPE/INDEX DRIFT → explicit reconciliation with preconditions;
- AMBIGUOUS OWNERSHIP/DATA → BLOCK;
- DESTRUCTIVE TRANSFORMATION → BLOCK and separate approved plan.

Never re-enable hidden startup self-healing as rollback. Application rollback and database rollback are separate compatibility decisions.

## 11. Required regression suite — SPECIFIED

### T01 Initialization failure propagation
Demonstrate current defect with a failing mandatory schema/startup condition; future behavior must reject/fail startup.

### T02 No false readiness
A DB-init/schema validation failure must prevent operational-ready logging/listening.

### T03 Migration-only clean bootstrap
A clean persistent target receives only the canonical migration chain and becomes runtime-complete for the supported application surface.

### T04 Missing schema fails closed
Remove a required migrated object; startup validation must fail rather than create it.

### T05 Restart is schema read-only
Repeated startup after migration cannot create/alter/drop business schema.

### T06 Runtime-complete coverage
Every persistent table/column/index required by active authoritative paths is either migration-covered or explicitly deprecated/disabled.

### T07 Local fallback isolation
Persistent/production mode cannot silently degrade into in-memory institutional persistence.

### T08 Migration checksum integrity
Editing an already-recorded migration must be detected as checksum mismatch and fail.

### T09 School Tasks migration contract
Clean migration target supports tenant-safe task CRUD + version snapshot persistence without test-only bootstrap DDL.

## 12. Environment truth — CLOSED

Evidence search in repository, CI, configuration, connected Nexus Drive material and supplied project notes did not prove provisioned shared environments. On 2026-08-20, the project owner explicitly instructed the planning gate to be closed on the basis that the Nexus staging and production environments are **not yet provisioned**. This explicit project declaration closes the prior UNKNOWN-EXTERNAL state; it is not an inference from missing files.

### Development — PROVEN
`npm run dev` starts `tsx server.ts`, which currently invokes runtime initialization/self-healing.

### CI/Test — PROVEN
GitHub Actions uses PostgreSQL and `test:database:setup`; current schema authority is fragmented between numbered migrations and additional setup DDL.

### Staging — PROJECT-DECLARED: NOT YET PROVISIONED
No shared staging environment is part of the current implementation baseline.

### Production — PROJECT-DECLARED: NOT YET PROVISIONED
No shared production environment is part of the current implementation baseline.

If either environment is provisioned later, its first approved deployment contract must comply with §13 before application traffic is considered healthy.

## 13. Approved future deployment contract

For any future staging/production environment:

`read-only preflight → identify target DB → backup/change gate when data exists → nexus:migrate → migration-ledger/checksum verification → schema validation → application start → health/readiness`

Mandatory rules:
- no runtime business-schema self-healing;
- no production/staging in-memory persistence fallback;
- no application traffic after failed migration/schema validation;
- explicit database ownership/credentials per environment;
- documented backup/restore owner before destructive or reconciliation-sensitive migrations;
- application rollback and database rollback remain separate compatibility decisions;
- a newly provisioned environment is not considered operational until this contract is proven.

## 14. Final DoR review

All FND-01 DoR blockers are now closed at planning level:

- objective/scope: PASS;
- canonical product/architecture traceability: PASS;
- AS-IS defect evidence: PASS;
- runtime DDL inventory: PASS;
- migration coverage/gap classification: PASS;
- School Tasks/Task Versions contract: PASS;
- legacy transition policy: PASS;
- canonical migration runner contract: PASS;
- recovery/rollback rules: PASS;
- regression/evidence plan: PASS;
- development/CI path: PASS;
- staging/production truth: PASS via explicit project declaration `NOT YET PROVISIONED`;
- future shared-environment deployment contract: APPROVED.

## 15. Final DoR decision

**READY — awaiting explicit implementation authorization.**

READY means the mission is sufficiently specified to implement without inventing product, architecture, schema authority, environment behavior or acceptance criteria. READY does **not** authorize implementation automatically and does not authorize commit, push, merge or deployment.

If implementation preflight discovers evidence that contradicts the project declaration (for example, a real shared environment or unmodeled database/data dependency), FND-01 immediately returns to `BLOCKED` and the executor must stop.
