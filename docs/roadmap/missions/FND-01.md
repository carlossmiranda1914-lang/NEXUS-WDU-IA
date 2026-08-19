# FND-01 — Schema Authority

**State:** BLOCKED — narrowed DoR blockers; implementation is not authorized.

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

## DoR evidence

Detailed evidence, dependency mapping, recovery design and regression-test specification are recorded in `docs/roadmap/missions/FND-01_DOR_EVIDENCE.md`.

### COMPROVADO

1. `server.ts` directly awaits `initializeDatabase()` during startup and then declares the database operationally ready.
2. `src/db/init.ts` is a competing runtime schema authority: it creates legacy tables, adds columns, changes School Tasks column types and creates indexes.
3. Internal DDL failures and the top-level initialization failure can be caught/logged without propagation, establishing the false-readiness defect class.
4. `src/db/migrations/` is an ordered numbered migration chain and `scripts/verify-migrations-isolated.ts` applies the chain lexically and transactionally in an isolated PostgreSQL schema.
5. `nexus-preflight.ts` already supplies read-only repository/migration/database checks useful for the future fail-closed gate.
6. A recovery model is now defined: inspect and back up first; classify divergence; prefer additive/compensating forward migrations; block on ambiguous data or destructive transformation.
7. Pre-change/future regression scenarios T01–T07 are specified, including failure propagation, no false readiness, clean migration-only bootstrap, missing-schema fail-closed, restart idempotency, legacy-schema coverage and local-only memory fallback.

### DEPENDENCY RISK MAP

Runtime self-healing directly affects startup and can indirectly support legacy users, students, teachers, invoices, communications, automations, uploaded documents, operational logs, approvals and School Tasks. This is now bounded by table/object, but repository evidence alone cannot prove which deployed environments were historically bootstrapped by startup DDL.

## Required evidence before implementation

1. exact runtime DDL inventory — **SUBSTANTIALLY PROVEN; repeat search on implementation branch before change**;
2. exact migration inventory/order — **PROVEN mechanically; canonical execution runner still target-state**;
3. dependencies that currently rely on runtime self-healing — **BOUNDED IN CODE, ENVIRONMENT USAGE STILL UNPROVEN**;
4. rollback/recovery plan — **DEFINED**;
5. tests that reproduce current false-readiness behavior — **SPECIFIED; executable red test not yet created because implementation remains frozen**.

## Remaining DoR blockers

1. **Schema coverage reconciliation:** map every table/column/index currently created or repaired by `src/db/init.ts` to an existing numbered migration or an explicit intentional deprecation. Any uncovered runtime-created object requires a versioned migration before its startup DDL can be removed.
2. **Environment migration-path confirmation:** establish how development, CI, staging and production currently receive schema changes, including whether any environment relies on startup self-healing or tranche-specific scripts.
3. **Canonical runner decision:** authorize one complete ordered migration executor for all persistent environments; wrappers may differ only in target/credentials/gates.

## Decision

**BLOCKED — narrowed blockers.** The broad evidence gaps from the first DoR pass have been reduced to schema-coverage reconciliation and deployment/environment authority confirmation. No runtime/schema code change is authorized yet.

The next safe activity is documentation/evidence only: produce the object-by-object runtime-DDL ↔ migration coverage matrix and confirm the migration path for each environment. Then repeat DoR. If coverage reveals unmodeled production data, undocumented migration dependency or unrelated domain redesign, stop and escalate.

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
