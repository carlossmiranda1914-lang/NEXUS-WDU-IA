# FND-01 — Schema Authority

**State:** PREPARATION — implementation not yet authorized.

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

## Required evidence before implementation
1. exact runtime DDL inventory;
2. exact migration inventory/order;
3. dependencies that currently rely on runtime self-healing;
4. rollback/recovery plan;
5. tests that reproduce current false-readiness behavior.

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
