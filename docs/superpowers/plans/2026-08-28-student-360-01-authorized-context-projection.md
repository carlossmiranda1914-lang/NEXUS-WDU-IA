# STUDENT-360-01 — Executable TDD Plan

**Mission:** `STUDENT-360-01`  
**Baseline:** `main @ c093fab221489e273aead35312ac8339a6e32718`  
**Invariant:** one tenant-safe, backend-authorized, read-only Student Context projection; no new source of truth.

## Objective 1 — Projection contract + authorization matrix

Create pure projection-policy and safe response contracts. Prove InstitutionalContext-only authority, A→B non-disclosure, allow rules for admin/director/secretariat/self/parent, deny teacher/financial, unavailable-domain constants and no-write surface.

## Objective 2 — Current student context

Implement the single backend query boundary for active StudentProfile, Enrollment, AcademicYear, Program/Level/Class/subject context and active Placement. Prove same-tenant PostgreSQL and query shape without N+1.

## Objective 3 — Historical context

Add cursor/limit-bounded Enrollment and Placement history. Prove current/history semantic separation, stable ordering, no unrestricted all-row response and A→B denial.

## Objective 4 — Unavailable-domain semantics + PII/tenant hardening

Add factual document metadata only; Finance, Assessment, Attendance and physical Documents return `not_yet_authoritative`. Prove no identifiers/contact/evidence references leak, including error paths.

## Objective 5 — HTTP operational + performance/read model validation

Expose the single authenticated HTTP boundary, run `requireAuth` + InstitutionalContext PostgreSQL integration, query-count/N+1 tests, pagination tests and safe response validation. No UI or cache unless evidence expands scope through a new decision.

## Objective 6 — AC01–AC12 + quality gate + PR

Execute the full AC matrix, related IAM/Enrollment/Academic/Documents regressions, migration/static/build/secret/diff gates and authoritative quality gate; write evidence/PROJECT_STATE updates, commit, push and open PR.

Every objective follows `RED → minimal implementation → GREEN → PostgreSQL → HTTP → regression → commit → push`. Stop rather than add Finance, Assessment, Attendance, physical storage, a Student write model or materialized projection.
