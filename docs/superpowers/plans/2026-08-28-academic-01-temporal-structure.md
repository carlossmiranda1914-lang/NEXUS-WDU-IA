# ACADEMIC-01 Temporal Academic Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the smallest tenant-safe, temporal Academic Core authority for structure, teacher assignment and student placement.

**Architecture:** Preserve AcademicYear and Enrollment activation as existing authorities. Add additive Academic Core records rooted in Institution + AcademicYear; commands derive tenant from InstitutionalContext and enforce versioned, audited transitions in PostgreSQL transactions. Read models expose current and historical authority without becoming Student 360.

**Tech Stack:** TypeScript, Express, PostgreSQL, node-postgres, existing migration runner and InstitutionalContext middleware.

**Spec:** `docs/roadmap/missions/ACADEMIC-01.md`

## Global Constraints

- Migration 0022 only; forward-only; do not rewrite `0001–0021`.
- No Attendance, Assessment, timetable, Student 360, Finance, physical Documents, messaging, automation or broad UI.
- Every command is institution-scoped by server-derived InstitutionalContext; never `users.role`.
- Versioned writes require `expectedVersion`; stale is safe `409 STALE_VERSION`, never auto-retry.

---

### Task 1: Migration 0022 and isolated constraints

**Files:** Create `src/db/migrations/0022_academic_temporal_authority.sql`; create `tests/academic-temporal-migration-postgres.test.ts`; modify `tests/fnd01-cp4-school-tasks-postgres.test.mts` only if its canonical migration-count assertion is still fixed.

**Interfaces:** Produces tables `academic_programs`, `academic_levels`, `academic_classes`, `academic_subjects`, `academic_subject_offerings`, `teacher_assignments`, `student_academic_placements`, `academic_events`; all mutable aggregates expose `version BIGINT`.

- [ ] Write failing migration-isolation tests asserting 22 ledger entries, composite tenant FKs, temporal uniqueness and version checks.
- [ ] Run `TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx --import ./scripts/nexus-test-db-safety.mjs tests/academic-temporal-migration-postgres.test.ts`; expect missing relations.
- [ ] Add only the additive schema, indexes and checks specified in the Mission Pack.
- [ ] Re-run the test and `npm run test:migrations:isolated`; expect PASS.
- [ ] Commit `feat(academic): add temporal academic authority schema`.

### Task 2: Structure commands and reads

**Files:** Create `src/modules/academic/academic-structure-api.ts`, `academic-structure-policy.ts`, `academic-structure.controller.ts`; create `tests/academic-structure-postgres.test.ts` and `tests/academic-structure-http-operational.test.ts`.

**Interfaces:** `createAcademicClass(pool, context, input)`, `updateAcademicClass(... expectedVersion)`, `listAcademicStructure(pool, context, { academicYearId, view: 'current'|'historical' })`.

- [ ] Write failing PostgreSQL tests for Class `(institution, year, program/level, code)` uniqueness, historical closure, stale update and A→B rejection.
- [ ] Implement deterministic locks and institution-scoped queries; return safe `STALE_VERSION`/`NOT_FOUND` errors.
- [ ] Write failing Express test through `requireAuth → InstitutionalContext → controller` for create/read/stale/cross-tenant.
- [ ] Implement route factory using the existing injected pool/auth pattern and safe error mapper.
- [ ] Run both tests; commit `feat(academic): add temporal structure authority`.

### Task 3: Subject availability and factual audit

**Files:** Modify `academic-structure-api.ts`; create `tests/academic-subject-offering-postgres.test.ts`.

**Interfaces:** `offerSubject(pool, context, { subjectId, academicYearId, classId?, expectedVersion, idempotencyKey })`; read returns current or historical availability.

- [ ] Write failing tests for subject absent in a different year, scoped uniqueness, tenant rejection and allowlisted audit metadata.
- [ ] Implement temporal offering transaction and `academic_events` factual event.
- [ ] Re-run test; commit `feat(academic): add temporal subject availability`.

### Task 4: Teacher assignment authority

**Files:** Create `src/modules/academic/teacher-assignment-api.ts`, `teacher-assignment.controller.ts`; create `tests/teacher-assignment-postgres.test.ts`, `tests/teacher-assignment-http-operational.test.ts`.

**Interfaces:** `assignTeacher(pool, context, { classId, subjectOfferingId, teacherPersonId, effectiveFrom, effectiveTo, expectedVersion, idempotencyKey })`, `replaceTeacher(...)`, `listTeacherAssignments(... view)`.

- [ ] Write failing PostgreSQL tests for active same-institution `teacher` Membership, forbidden/inactive/cross-tenant teacher, overlap rejection, A/B concurrent assignment, stale 409, replacement and historical preservation.
- [ ] Implement locks `Class → SubjectOffering → Membership → active Assignment`, version CAS, bounded dates and factual events.
- [ ] Write failing Express tests for safe 409/403/404 responses without SQL, stack or foreign identifiers.
- [ ] Implement controller factory and mapper; rerun tests.
- [ ] Commit `feat(academic): add teacher assignment authority`.

### Task 5: Student academic placement

**Files:** Create `src/modules/academic/student-placement-api.ts`, `student-placement.controller.ts`; create `tests/student-academic-placement-postgres.test.ts` and `tests/student-academic-placement-http-operational.test.ts`.

**Interfaces:** `placeStudent(pool, context, { studentPersonId, classId, expectedVersion, idempotencyKey })`, `listClassRoster(... view)`.

- [ ] Write failing tests requiring same-institution `Enrollment.active` and `StudentProfile.active`, rejecting non-active/A→B, preserving ended history and rolling back audit on failure.
- [ ] Implement one transaction that only consumes those authorities; it must not mutate Enrollment activation.
- [ ] Write real HTTP test for authorized placement and safe negative responses.
- [ ] Run PostgreSQL/HTTP tests; commit `feat(academic): add student academic placement`.

### Task 6: Proof, evidence and integration gates

**Files:** Modify `docs/roadmap/missions/ACADEMIC-01.md`, `ACADEMIC-01_DOR_EVIDENCE.md`, `docs/operations/PROJECT_STATE.md` only after all ACs pass; create/modify targeted tests only for uncovered ACs.

- [ ] Execute each AC01–AC12 with named executable test and record command/result/commit in the Mission Pack.
- [ ] Run migration isolation, all Academic PostgreSQL/HTTP, IAM/context, ENROLLMENT-01/02, tenant/context, lint, build, secret scan, `git diff --check` and deterministic `npm run quality-gate` with approved test DB.
- [ ] Require `exit=0` and `quality-gate: PASS`; do not write PASS from inspection.
- [ ] Commit `docs(academic): close temporal authority evidence`, push, open a PR against main.
