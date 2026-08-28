# ENROLLMENT-02 Canonical Process Authority & Atomic Activation — Implementation Plan

> Execute tasks in order. Each production change begins after its named failing test is observed. The authority is `docs/roadmap/missions/ENROLLMENT-02.md`.

**Goal:** Make `Enrollment.active` a canonical, atomic and auditable fact; enforce process ownership and factual system reconciliation.

**Architecture:** A dedicated Activation command locks the institution-scoped Enrollment and StudentProfile, validates current readiness and versions, records an idempotent command and factual event in one PostgreSQL transaction. The generic transition cannot target active. Process ownership is policy-driven, while process reads become side-effect free and explicit system reconciliation records a system actor.

**Tech:** TypeScript, Express, PostgreSQL/pg, Node test runner, numbered migration runner.

## Global constraints

- Never alter migrations `0001`–`0020`; next migration is additive and forward-only.
- All PostgreSQL writes/tests use only the approved disposable target with `TEST_DATABASE_LOCAL_AUTHORIZED=true`.
- Context determines institution; browser payload never chooses a tenant, actor, StudentProfile or assignee institution.
- No object storage, Finance, capacity, Academic Core, Student 360, custom roles or UI redesign.
- Error contracts are stable and safe; no SQL, stack, PII or foreign identifiers.

## Task 1 — Establish lifecycle/audit/idempotency authority

**Files:** create `src/db/migrations/0021_enrollment_process_activation_authority.sql`; create `tests/enrollment-activation-migration-postgres.test.ts`; extend migration-isolation expectations only if the runner has an explicit migration-count assertion.

**Interface produced:** `enrollment_applications.lifecycle_version`; activation command ledger; `enrollment_events.actor_kind`, optional `actor_person_id`, `correlation_id`, and consistency constraints.

- [ ] Write a PostgreSQL migration test that applies all migrations in an isolated schema and asserts exact columns, constraints, ledger uniqueness and historic human-event compatibility.
- [ ] Run `TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/enrollment-activation-migration-postgres.test.ts`; verify RED because `0021` is absent.
- [ ] Add only the additive migration, with safe defaults/backfill, `CHECK (> 0)`, actor-kind constraint, ledger constraints/indexes and no runtime DDL.
- [ ] Verify GREEN with the test plus `TEST_DATABASE_LOCAL_AUTHORIZED=true npm run test:migrations:isolated` (or its canonical equivalent).
- [ ] Commit: `feat(enrollment): add canonical activation authority`.

## Task 2 — Reject generic activation and expose lifecycle authority

**Files:** modify `src/modules/enrollments/enrollment-policy.ts`, `src/modules/enrollments/enrollment.controller.ts`; create `tests/enrollment-activation-transition-http.test.ts`; extend `tests/secretariat-s03-process-contract.test.ts` if its contract is the authoritative generic-route characterization.

**Interface produced:** generic transition returns `409 { code: 'ACTIVE_REQUIRES_CANONICAL_ACTIVATION', message }` for `targetState: 'active'`; all other valid transitions retain their existing behavior.

- [ ] Write HTTP/Express test proving a leadership context cannot move `validated → active` via generic transition, with zero Enrollment/StudentProfile/event mutation; prove `draft → under_review → awaiting_documents → validated` remains valid.
- [ ] Run the test and observe RED under current generic update implementation.
- [ ] Add the smallest policy/controller error mapping; do not add activation logic to the generic controller.
- [ ] Verify GREEN and run relevant S02/S03 transition regressions.
- [ ] Commit: `feat(enrollment): reserve active for canonical activation`.

## Task 3 — Implement dedicated activation command, idempotency and transaction boundary

**Files:** create `src/modules/enrollments/enrollment-activation-api.ts`; create `src/modules/enrollments/enrollment-activation.controller.ts` or register a bounded route in the existing Enrollment controller; create `tests/enrollment-activation-postgres.test.ts`; create `tests/enrollment-activation-http-operational.test.ts`.

**Interface produced:** `activateEnrollment(pool, context, enrollmentId, { expectedLifecycleVersion, expectedRegistrationVersion, idempotencyKey, correlationId? })`, plus `POST /api/enrollments/:id/activate`.

- [ ] Write PostgreSQL red tests for: validated happy path; wrong state; missing/inactive StudentProfile; registration/document readiness failure; A/B concurrent v1 attempt; failure after StudentProfile update; duplicate same key replay; same key/different fingerprint conflict; different key after active; no duplicate event/handoff; institution-scoped ledger.
- [ ] Run `TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/enrollment-activation-postgres.test.ts`; observe RED due to absent command.
- [ ] Implement server-derived tenant lookup and deterministic locks: ledger → Enrollment → StudentProfile; verify lifecycle and registration versions/readiness; update StudentProfile then Enrollment; write factual activation event, ledger and durable handoff/event authority in one transaction; rollback on every failure.
- [ ] Write and run Express operational red/green tests for `auth → InstitutionalContext → controller → command → PostgreSQL → response`, including safe 403/404/409 bodies and a client characterization of one transport call on stale 409.
- [ ] Commit: `test(enrollment): prove atomic activation lifecycle`.

## Task 4 — Enforce assignment policy and factual audit contract

**Files:** modify `src/modules/enrollments/enrollment-process-policy.ts`, `src/modules/enrollments/enrollment-process-api.ts`, `src/modules/enrollments/enrollment-process.controller.ts`; create/extend `tests/enrollment-process-assignment-policy.test.ts` and `tests/enrollment-process-assignment-postgres.test.ts`.

**Interface produced:** explicit `canAssignEnrollmentProcess(role)` and `canReceiveEnrollmentProcessAssignment(role)`; assignment validates same institution, active membership, allowed assignee role and expected version; human events use `actor_kind='human'`.

- [ ] Write red tests for allowed admin/director/secretariat actor/assignee and forbidden financial/teacher/student/parent, inactive membership, absent target, stale version and cross-tenant probe without details.
- [ ] Run policy and PostgreSQL tests; observe current active-membership-only behavior fail expectations.
- [ ] Implement the minimal policy/repository query/event write. Do not infer Platform Admin.
- [ ] Verify GREEN; run S03 process PostgreSQL and tenant/context regression suites.
- [ ] Commit: `feat(enrollment): enforce process assignment policy`.

## Task 5 — System reconciliation and progress semantics

**Files:** modify `src/modules/enrollments/enrollment-process-api.ts`, `src/modules/enrollments/enrollment-process-policy.ts`; create `tests/enrollment-process-reconciliation-postgres.test.ts`; extend process contract tests.

**Interface produced:** side-effect-free `loadEnrollmentProcess`; explicit system reconciliation command/handler with `actor_kind='system'`, null human actor, server-defined cause/correlation; helpers defining which events update `last_progress_at`.

- [ ] Write red PostgreSQL temporal tests showing: plain read has no event/write; reconciliation event is system; it does not advance progress; transition/document/assignment/activation do advance it; stale/replay/rejected commands do not.
- [ ] Run targeted test; observe current `GET` writes `process_reconciled` with reader actor and advances timestamp.
- [ ] Extract explicit reconciliation boundary, reuse deterministic fingerprint, and update progress only through the approved event classes.
- [ ] Verify GREEN and run S02/S03 process/document regressions.
- [ ] Commit: `feat(enrollment): record factual system reconciliation`.

## Task 6 — HTTP/tenant/security hardening and closeout evidence

**Files:** extend activation/process HTTP operational tests; update `docs/roadmap/missions/ENROLLMENT-02.md`, `docs/roadmap/missions/ENROLLMENT-02_DOR_EVIDENCE.md`, and `docs/operations/PROJECT_STATE.md` only with fresh factual results.

**Interface proven:** safe activation and assignment responses, no auto-retry, no false audit actor, no PII/SQL/stack leakage, and exactly-once activation handoff semantics.

- [ ] Map AC01–AC12 individually to executed tests/commands/results/commit evidence. No AC passes by code inspection.
- [ ] Run targeted ENROLLMENT-02, PostgreSQL, HTTP operational, S02/S03, ENROLLMENT-01, Person Resolution, intake, tenant/context, IAM/context, migration isolation, lint, build, secret scan, `git diff --check`, then `TEST_DATABASE_LOCAL_AUTHORIZED=true npm run quality-gate` with deterministic exit capture.
- [ ] Diagnose/fix/rerun every normal engineering failure; preserve only pre-existing residual warnings explicitly proven unrelated.
- [ ] Commit factual closeout evidence only after `exit=0` and `quality-gate: PASS`; push and create a dedicated PR. Do not start ENROLLMENT-03.
