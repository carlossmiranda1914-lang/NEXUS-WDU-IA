# FND-01 — DoR Evidence Pack

**Mission:** FND-01 — Schema Authority  
**Review date:** 2026-08-19  
**Implementation status:** BLOCKED — evidence collection only  
**Frozen implementation reference:** `689d1dd8919a25e91911ae118c5aad9ff69c5862` / PR #65  
**Comparison baseline:** `main`

## 1. Scope of this evidence pack

This document closes the investigative portion of the FND-01 Definition of Ready without changing application/runtime code. It distinguishes proved facts, bounded inference and unresolved blockers.

## 2. Runtime DDL inventory

### 2.1 Authoritative runtime caller

`server.ts` imports `initializeDatabase()` from `src/db/init.ts` and awaits it during `startServer()` before declaring the database ready for operational use.

### 2.2 Runtime schema mutations in `src/db/init.ts`

The frozen checkpoint and `main` both contain the same class of runtime schema authority:

**CREATE TABLE IF NOT EXISTS** for legacy/operational tables:
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

**ALTER TABLE / ADD COLUMN**:
- `users.phone`
- `users.department`
- `users.status`
- `users.last_access`
- `school_tasks.is_deleted`
- `school_tasks.deleted_at`
- `school_tasks.deleted_by`
- `school_tasks.started_at`
- `school_tasks.first_response_at`
- `school_tasks.sla_deadline`
- `school_tasks.sla_status`

**ALTER COLUMN TYPE**:
- `school_tasks.created_at`
- `school_tasks.updated_at`
- `school_tasks.completed_at`
- `school_tasks.due_date`
- `school_tasks.limit_date`

**CREATE INDEX IF NOT EXISTS** for School Tasks:
- department/status
- status/department
- assigned/status
- created_at
- completed_at
- assigned_to
- reference_id/reference_type
- due_date

### 2.3 Failure semantics

Several ALTER operations catch errors and continue. The top-level `initializeDatabase()` also catches any failure and only logs it rather than rethrowing. After the awaited call returns, `server.ts` logs that the database is ready for operational use. Therefore false-readiness is a proved behavior class, not a theoretical risk.

### 2.4 Search boundary

Repository code search shows the application runtime DDL authority centered in `src/db/init.ts`. Other DDL hits are primarily numbered SQL migrations, migration/application scripts, schema-contract verification, documentation or UI/example strings. Before implementation, the change branch must repeat this search and treat any newly discovered runtime DDL path as a blocker.

## 3. Migration inventory and order

### 3.1 Canonical candidate

`src/db/migrations/` contains ordered `NNNN_*.sql` migrations. The frozen checkpoint extends the chain through the later Enrollment/document-policy migrations added by PR #65.

### 3.2 Mechanical order

`scripts/verify-migrations-isolated.ts` discovers files by `/^\d{4}_.+\.sql$/`, sorts them lexically, applies each in its own transaction in an isolated PostgreSQL schema, rolls back the failing migration and exits non-zero on error.

### 3.3 Existing scripts

`package.json` exposes isolated verification and multiple tranche-specific migration commands. This proves migration discipline exists, but also proves execution authority is fragmented: enrollment, S02, S03 and audit-related scripts coexist rather than delegating to one documented all-environment runner.

### 3.4 Preflight

`nexus-preflight.ts` verifies that the migration directory exists, that numbered migration files are ordered without ordinal gaps, and can inspect a configured PostgreSQL database read-only for critical schema requirements. It is a useful readiness primitive but is not itself the migration executor.

## 4. Dependency map for runtime self-healing

### 4.1 Direct dependency

`server.ts → initializeDatabase()` is the only proved direct application startup dependency found in repository search.

### 4.2 Indirect operational dependency

The runtime DDL provisions legacy tables used broadly by legacy endpoints/components and provisions/repairs `school_tasks` columns/indexes. Removing it without replacement can expose environments that were bootstrapped historically by startup rather than by migrations.

### 4.3 High-risk dependency groups

Until proven otherwise, assume these groups can depend on startup-created legacy schema:

- legacy user/profile administration → `users`;
- legacy student APIs/BI/AI → `students`;
- teacher administration → `teachers`;
- legacy finance → `invoices`;
- communication → `announcements`, `chat_messages`;
- legacy automation → `automations`;
- general-document/OCR paths → `uploaded_documents`;
- manual audit/log consumers → `operational_logs`;
- approvals → `approvals`;
- School Tasks compatibility → `school_tasks` and its indexes/type upgrades.

This is a dependency-risk map, not proof that every deployed environment lacks a corresponding migration. FND-01 implementation must inspect the actual migration coverage for each object before removing runtime DDL.

## 5. Recovery / rollback design

FND-01 must not use destructive rollback as the default.

### 5.1 Before change

1. Capture target database identity and schema fingerprint.
2. Run read-only preflight and schema-contract inspection.
3. Inventory required legacy tables/columns/indexes currently created by startup.
4. Compare deployed schema with the complete migration target.
5. Back up database using the environment's approved database backup mechanism before any corrective migration in staging/production.
6. Do not infer that `CREATE TABLE IF NOT EXISTS` parity means schema parity; compare columns, types, constraints and indexes explicitly.

### 5.2 Divergent database classification

- **Aligned:** migration target already satisfied → startup DDL can later be removed after tests.
- **Missing additive object:** create a versioned forward migration.
- **Type/index drift:** create an explicit reconciliation migration with preflight checks.
- **Conflicting/ambiguous data:** BLOCK; produce reconciliation report before mutation.
- **Destructive transformation required:** BLOCK; separate migration plan with backup/restore proof and explicit approval.

### 5.3 Roll-forward principle

Once a versioned migration is applied to a shared environment, recovery should normally be a compensating forward migration rather than rewriting migration history or re-enabling hidden startup self-healing.

### 5.4 Application rollback

If application deployment must be rolled back, the previous application version may only be restored if it is compatible with the already-applied schema. Schema and application rollback are separate decisions.

## 6. Pre-change regression test specification

These tests are specifications only in this documentation phase. Executable tests become the first authorized implementation step if FND-01 later becomes READY.

### T01 — initialization failure must propagate

Arrange a configured PostgreSQL path where the first mandatory startup schema operation fails. Assert current behavior demonstrates the defect: `initializeDatabase()` resolves/logs rather than rejecting. After fix, assert rejection propagates.

### T02 — server must not announce readiness after DB-init failure

Inject/force an initialization failure before route serving/listen readiness. Assert the future server does not log/emit operational readiness and exits/fails startup.

### T03 — clean database reaches target through ordered migrations only

Create isolated clean schema/database, apply canonical migration runner, verify schema contract, start application with runtime DDL disabled/removed, assert startup succeeds.

### T04 — missing required schema fails closed

Start against a database missing a required migrated object. Assert startup/preflight fails explicitly rather than creating the object silently.

### T05 — already migrated database is idempotently usable

Apply migrations, restart application repeatedly, assert no schema mutation is attempted at startup and application remains operational.

### T06 — legacy compatibility schema covered by migrations

For every table/column/index currently provisioned by `src/db/init.ts`, assert the canonical migration chain creates or intentionally deprecates it. Any uncovered object blocks removal of its startup DDL.

### T07 — local in-memory fallback remains explicitly local-only

Assert explicit local fallback behavior remains separate from persistent DB schema migration authority and cannot activate in production.

## 7. Target migration execution authority

The mission should converge on one command/library responsible for applying the complete ordered migration chain. Environment wrappers may supply credentials/target DB, but must delegate to the same migration engine/order.

Target contract:

- development persistent DB → canonical runner;
- CI/test DB → same runner against disposable/isolated target;
- staging → same runner with preflight + backup/recovery gate;
- production → same runner with preflight + backup/change approval;
- tranche-specific scripts → remove, archive or rewrite as thin delegates when safe.

The exact command/file name is an implementation choice; the authority model is not.

## 8. DoR decision

### Proven enough

- problem exists;
- direct startup call is identified;
- runtime DDL surface in `src/db/init.ts` is catalogued;
- ordered migration verification mechanism exists;
- failure-test scenarios are specified;
- recovery principles and divergence handling are specified.

### Still blocking implementation authorization

1. Migration coverage must be reconciled object-by-object against every legacy table/column/index currently created by startup, especially School Tasks.
2. Actual environment/deployment usage of tranche-specific migration scripts versus startup self-healing is not proven from repository evidence alone.
3. No executable red regression test has yet captured the false-readiness behavior; by policy this should be the first code-level step once authorization is granted.
4. The canonical all-environment migration runner is a target contract, not an existing proved authority.

**Decision: BLOCKED — narrowed blockers.**

Do not remove `initializeDatabase()` DDL yet. The next safe activity is a schema-coverage reconciliation matrix comparing runtime-created objects against the frozen checkpoint migration chain, followed by environment migration-path confirmation. Only then repeat DoR.
