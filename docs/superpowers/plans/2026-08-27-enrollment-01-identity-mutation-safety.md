# ENROLLMENT-01 Identity Mutation Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent stale writes and unsafe global Person mutations during Enrollment registration edits.

**Architecture:** Add monotonic versions to the Application registration aggregate and each mutable global Person. The write compares expected versions under deterministic PostgreSQL locks and invokes the existing Person Resolution boundary within one transaction.

**Tech Stack:** TypeScript, PostgreSQL/pg, Express, Node test runner, vNext migration runner.

**Spec:** `docs/roadmap/missions/ENROLLMENT-01.md`

## Global constraints

- Database writes require `TEST_DATABASE_LOCAL_AUTHORIZED=true` and the approved disposable target.
- Add migration `0020_enrollment_registration_concurrency_versions.sql`; never edit applied migrations or execute runtime DDL.
- Add `people.version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0)` and `enrollment_applications.registration_version BIGINT NOT NULL DEFAULT 1 CHECK (registration_version > 0)`.
- The browser echoes versions only. It never sends target Person or institution IDs.
- `STALE_VERSION` is a safe HTTP 409. No retry, version replacement, client match decision, PII audit metadata, or IAM change.

### Task 1: Establish version authority

**Files:** Create `src/db/migrations/0020_enrollment_registration_concurrency_versions.sql`; modify `src/db/schema.ts` only if it maps these tables; create `tests/enrollment-registration-concurrency-postgres.test.ts`.

**Interface produced:** database fields `people.version` and `enrollment_applications.registration_version`, both bigint monotonic authorities initialized to `1`.

- [ ] **Write failing test:** In the PostgreSQL test, run all migrations, query `information_schema.columns`, and assert these exact two `(table_name, column_name, data_type)` records: `('enrollment_applications','registration_version','bigint')`, `('people','version','bigint')`.
- [ ] **Verify RED:** Run `TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/enrollment-registration-concurrency-postgres.test.ts`; expect absent columns.
- [ ] **Implement minimum:** create `0020` with exactly two additive `ALTER TABLE ... ADD COLUMN ... BIGINT NOT NULL DEFAULT 1 CHECK (... > 0)` statements; update the Drizzle mappings only where currently owned.
- [ ] **Verify GREEN:** Run `TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/enrollment-registration-concurrency-postgres.test.ts` and `npm run test:migrations:isolated`; expect both PASS.
- [ ] **Commit checkpoint:** stage migration/schema/test then commit `feat(enrollment): add registration concurrency versions`.

### Task 2: Return authoritative read versions

**Files:** Modify `src/modules/enrollments/enrollment-registration-api.ts` (`RegistrationRow`, `loadRow`, `mapRegistration`); create `tests/enrollment-registration-concurrency.test.ts`; create `tests/enrollment-registration-http-contract.test.ts`.

**Interface produced:**

```ts
type EnrollmentRegistration = {
  enrollmentId: string;
  registrationVersion: string;
  student: RegistrationPerson & { version: string };
  guardian: (RegistrationGuardian & { version: string }) | null;
  readiness: RegistrationReadiness;
};
```

- [ ] **Write failing test:** call `loadEnrollmentRegistration`; assert registration/student/guardian versions are `'1'` and `student` has no `personId`. HTTP GET asserts the same projection.
- [ ] **Verify RED:** Run `npx tsx tests/enrollment-registration-concurrency.test.ts`; expect version properties missing.
- [ ] **Implement minimum:** select Application registration version and Student/Guardian Person versions, serialize as decimal strings, retain Person IDs strictly inside SQL.
- [ ] **Verify GREEN:** Run both new tests; expect 200 plus versions and no global Person IDs.
- [ ] **Commit checkpoint:** commit API and tests as `feat(enrollment): expose registration write versions`.

### Task 3: Require versions and return safe 409

**Files:** Modify `src/modules/enrollments/enrollment-registration-api.ts` and `src/modules/enrollments/enrollment.controller.ts`; extend the Task-2 tests.

**Interface consumed:**

```ts
type SaveRegistrationBody = {
  expectedRegistrationVersion: string;
  student: RegistrationPerson & { expectedVersion: string };
  guardian: (RegistrationGuardian & { expectedVersion: string }) | null;
  previousSchool?: string | null;
  notes?: string | null;
};
```

**Interface produced:** `EnrollmentRegistrationApiError('STALE_VERSION', safeMessage)` maps to HTTP `{ code: 'STALE_VERSION', message: safeMessage }`, status 409.

- [ ] **Write failing test:** A writes expected `1/1/1`; B submits `1/1/1`; assert `STALE_VERSION`, database values/versions remain A's v2 result, and the HTTP body lacks SQL, stack, Person ID and foreign-match detail.
- [ ] **Verify RED:** run the PostgreSQL and HTTP contract tests; expect ignored expected versions or a non-409 response.
- [ ] **Implement minimum:** parse positive decimal integer strings strictly; lock Application by `id + institution_id`, compare registration version; lock server-derived Persons and compare their expected versions before any update; rollback via existing catch; map only `STALE_VERSION` to 409.
- [ ] **Verify GREEN:** rerun both tests; expect exactly one safe 409 and no partial write.
- [ ] **Commit checkpoint:** commit API/controller/tests as `feat(enrollment): reject stale registration writes`.

### Task 4: Deterministic locks and canonical identity re-resolution

**Files:** Modify `src/modules/enrollments/enrollment-registration-api.ts` and `src/modules/enrollments/enrollment-registration-policy.ts`; extend unit/PostgreSQL concurrency tests.

**Interface produced:** `type RegistrationFieldCategory = 'identity_material' | 'identity_supporting' | 'profile_only'` and `classifyRegistrationChanges(before, after): Set<RegistrationFieldCategory>`.

- [ ] **Write failing tests:** assert national ID is material while address is profile-only; attempt to submit another institution's national ID and assert `IDENTITY_COLLISION`, no foreign Person data/linkage; run inverse Student/Guardian updates concurrently and assert no deadlock.
- [ ] **Verify RED:** run the PostgreSQL concurrency test; expect no classification/resolution guard.
- [ ] **Implement minimum:** lock Application first, then unique server-derived Person IDs sorted by UUID, then `student_profiles` and affected `guardian_relationships`. Classify `nationalIdNumber` as material, name/birth date/contacts as supporting, and the remaining policy fields as profile-only. Use canonical Person Resolution only when its existing policy requires it. Ambiguity, collision or unsafe cross-context result fails closed; no parallel global finder is allowed.
- [ ] **Verify GREEN:** rerun PostgreSQL tests; expect no deadlock, no cross-tenant disclosure and no unsafe linkage.
- [ ] **Commit checkpoint:** commit API/policy/tests as `feat(enrollment): protect person mutation with stale-write guards`.

### Task 5: Atomic versions and factual audit

**Files:** Modify `src/modules/enrollments/enrollment-registration-api.ts`; extend `tests/enrollment-registration-concurrency-postgres.test.ts`.

**Interface produced:** success event metadata contains only `operation`, `result`, changed field categories, previous/new version maps and server-derived request/correlation IDs. Actor, institution and enrollment remain in existing columns; raw PII is absent.

- [ ] **Write failing test:** force audit insert failure after valid Student/Guardian/Application updates; assert all Person/Application versions remain `1`, relationship is unchanged, and zero success events exist. Add success test asserting changed rows increment once and event contains categories, never document/contact values.
- [ ] **Verify RED:** run PostgreSQL test; expect old no-version/event behavior to fail.
- [ ] **Implement minimum:** increment a Person version only when that Person changed; increment registration version when Application composition/metadata changes; insert success event after all writes; preserve transaction rollback for every error. Guardian reuse/substitution/update follows Task-4 locks.
- [ ] **Verify GREEN:** rerun PostgreSQL test; expect A v2, B v1 409 and complete audit-failure rollback.
- [ ] **Commit checkpoint:** commit API/tests as `test(enrollment): prove identity mutation concurrency`.

### Task 6: Prove regression and closeout

**Files:** Modify `docs/roadmap/missions/ENROLLMENT-01_DOR_EVIDENCE.md` with factual outputs only; extend the HTTP test.

- [ ] **Write failing no-retry test:** route a stale response through the existing client/handler; assert returned code `STALE_VERSION` and transport call count exactly one.
- [ ] **Verify RED and minimum mapping:** run `npx tsx tests/enrollment-registration-http-contract.test.ts`; ensure a 409 becomes an explicit conflict state with no second request.
- [ ] **Run full gates:** targeted unit/PostgreSQL/HTTP tests; `npm run test:enrollment-intake`; `npm run test:enrollment-intake-api`; `TEST_DATABASE_LOCAL_AUTHORIZED=true npm run test:enrollment-intake-api:postgres`; Person Resolution/access; identity decision; `npm run test:secretariat-s03`; `npm run test:fnd03`; lint; build; secret scan; `git diff --check`.
- [ ] **Review AC01–AC10:** associate each AC with executed output; inspect body parsing, audit PII and lock order. Any in-scope defect begins with a new failing test.
- [ ] **Commit checkpoint:** record evidence only after fresh gates with `docs(enrollment): record registration concurrency evidence`.

## Self-review

- Tasks 1–6 cover version authority, read/write contract, lost-update prevention, identity collision, tenant isolation, Guardian transitions, rollback, audit, regressions and no auto-retry.
- Each production task starts only after its named test is observed failing.
- `MERGE AUTHORIZATION REQUIRED` remains for integration into `main`; it neither authorizes nor requires a merge in this plan.
