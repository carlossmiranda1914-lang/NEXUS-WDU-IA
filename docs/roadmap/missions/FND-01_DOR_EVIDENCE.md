# FND-01 — DoR Evidence Pack

**Mission:** FND-01 — Schema Authority  
**Review date:** 2026-08-20  
**Implementation status:** BLOCKED — EXTERNAL EVIDENCE ONLY  
**Frozen implementation reference:** `689d1dd8919a25e91911ae118c5aad9ff69c5862` / PR #65  
**Comparison baseline:** `main`

## 1. Evidence rule

This pack records facts needed to decide whether FND-01 may enter implementation. `PROVEN` means repository evidence supports the statement. `DECIDED` means canonical architecture/roadmap has enough evidence to choose a target. `UNKNOWN-EXTERNAL` means the repository cannot prove it and implementation must not guess.

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

## 12. Environment evidence

### Development — PROVEN
`npm run dev` starts `tsx server.ts`, which currently invokes runtime initialization/self-healing.

### CI/test — PROVEN
GitHub Actions uses PostgreSQL and `test:database:setup`; current schema authority is fragmented between numbered migrations and additional setup DDL.

### Staging — UNKNOWN-EXTERNAL
No repository deployment configuration or authoritative documentation proves hosting target, migration command, startup command or backup/recovery path.

### Production — UNKNOWN-EXTERNAL
Same status as staging. Do not assume an environment exists or how it is provisioned.

## 13. Final DoR blocker

Obtain and record one of the following for both staging and production:

### Case A — environment exists
- platform/target;
- database target class;
- current start/deploy command;
- current migration/provisioning process;
- evidence whether `initializeDatabase()` has historically repaired/created schema;
- backup/restore mechanism and owner;
- ability to run canonical migrations before traffic/start.

### Case B — environment does not yet exist
Record `NOT YET PROVISIONED` as fact and approve the future contract:
`preflight → backup/change gate when data exists → nexus:migrate → schema validation → application start`.

No implementation may invent Case A details.

## 14. Final DoR decision

**BLOCKED — EXTERNAL EVIDENCE ONLY.**

Internal repository investigation is closed. The remaining blocker is not a code-design question; it is missing operational truth about shared environments. Once that fact is supplied or environments are explicitly declared not yet provisioned, FND-01 can undergo a short final DoR check rather than another broad audit.
