# FND-01 — Schema Authority

**State:** BLOCKED — DoR evidence incomplete; implementation is not authorized.

## Objective
Make versioned PostgreSQL migrations the single schema-evolution authority and ensure unsafe initialization fails closed.

## Origin
AUD-DB-001, AUD-DB-002. Supports Architecture TO-BE §7.

## Preserve
- existing numbered migration history;
- migration preflight/clean-DB proof patterns;
- DB constraints that encode tenant/domain invariants.

## IN
- inventory every runtime `CREATE/ALTER/DROP` path;
- classify bootstrap/reference-data vs schema evolution;
- define the migration-only target;
- define startup validation and failure behavior;
- CI proof for clean migration and startup failure.

## OUT
No finance, academic, UX or broad repository refactor. Do not redesign existing vNext domain schemas unless required to remove duplicate schema authority.

## DoR review — 2026-08-19

### COMPROVADO

1. **Competing runtime schema authority exists.** `src/db/init.ts` executes runtime `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN`, type-changing `ALTER COLUMN` statements and index creation for legacy operational tables.
2. **Unsafe initialization errors can be swallowed.** `initializeDatabase()` catches its top-level failure and logs it without rethrowing; several internal schema changes are also individually caught and execution continues.
3. **False-success language exists.** The initialization path writes/logs language indicating the database was successfully self-healed/provisioned after the runtime DDL path.
4. **A numbered migration chain exists.** `src/db/migrations/` contains ordered `NNNN_*.sql` files and is the correct candidate for canonical schema evolution.
5. **A clean isolated migration verifier exists.** `scripts/verify-migrations-isolated.ts` discovers numbered migration files, sorts them, applies each transactionally in an isolated PostgreSQL schema and fails on migration error.
6. **Migration verification is scriptable.** `package.json` exposes `test:migrations:isolated` and related database/migration scripts.

### PARCIAL / INFERIDO

1. The migration order is mechanically defined by lexical sorting of `NNNN_*.sql`, but there is not yet one proven, documented production migration runner that owns every environment. Several tranche-specific migration scripts coexist.
2. Runtime DDL appears primarily to protect legacy tables and School Tasks compatibility, but the complete set of callers/environments that still depend on that self-healing behavior has not yet been proven.
3. Existing CI references isolated migration verification, but FND-01 has not yet proven the future startup-failure behavior or the complete migration-only deployment path.

### BLOQUEADORES DoR

The following required evidence is still missing and must be produced before implementation begins:

1. **Exact dependency map for runtime self-healing.** Identify every environment, startup path, script, test and operational module that assumes `initializeDatabase()` will create/upgrade tables or indexes.
2. **Rollback/recovery plan.** Define what happens if removing runtime DDL reveals an already-divergent database, a partially applied legacy schema, missing indexes/columns or migration drift. Include data-preservation and no-destructive-default rules.
3. **Reproduction tests for current failure semantics.** Add a pre-change test specification (and, when implementation is authorized, executable regression tests) proving the current behavior where schema initialization failure can be logged without failing startup/readiness.
4. **Migration execution authority for real environments.** Decide and document the one supported mechanism that applies the ordered migration chain in development, CI, staging and production; tranche-specific scripts must either delegate to it or be explicitly historical/special-purpose.
5. **Runtime DDL inventory completion.** The inventory must cover `src/db/init.ts` and any other application/runtime path that performs DDL, not only migration files and test scripts.

## Required evidence before implementation

1. exact runtime DDL inventory — **PARTIAL**;
2. exact migration inventory/order — **SUBSTANTIALLY PROVEN, execution authority still incomplete**;
3. dependencies that currently rely on runtime self-healing — **MISSING / BLOCKER**;
4. rollback/recovery plan — **MISSING / BLOCKER**;
5. tests that reproduce current false-readiness behavior — **MISSING / BLOCKER**.

## Decision

**BLOCKED.** FND-01 is not READY and no runtime/schema code change is authorized from this Mission Pack yet.

The next activity is evidence collection only: dependency mapping, recovery design, runtime DDL inventory completion, and pre-change failure-test specification. If any of those reveal unmodeled production-data dependencies or require unrelated domain redesign, stop and escalate rather than widening the mission.

## Acceptance / DONE
- a clean DB reaches target only through migrations;
- app startup performs no competing business-schema evolution;
- missing/invalid required schema fails startup visibly;
- no catch converts unsafe DB initialization into operational readiness;
- existing vNext migration tests pass;
- CI gates the behavior;
- documentation states the single authority.

## Stop rules
Stop if removing runtime DDL would destroy unmodeled production data, reveal an undocumented migration dependency, or require unrelated domain redesign. Report the dependency instead of expanding scope.
