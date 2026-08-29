# STUDENT-360-01 — Definition of Ready Evidence

**State:** READY — STUDENT-360-01  
**Audited baseline:** `main @ c093fab221489e273aead35312ac8339a6e32718`

| Source / authority | AS-IS fact | Projection treatment |
| --- | --- | --- |
| Person/Identity/Membership/InstitutionalContext | active Membership resolves server-side context; role set is `institution_admin`, `director`, `secretariat`, `financial`, `teacher`, `student`, `parent` | safe display projection only; no identity/admin mutation |
| StudentProfile | institution-scoped active lifecycle; canonical activation handoff | current student eligibility, no duplicate aggregate |
| Enrollment | application lifecycle/current and historical records are institution/year scoped | current + paginated history, safe lifecycle projection |
| AcademicYear/Program/Level/Class/Subject | ACADEMIC-01 canonical temporal/institution-scoped authority | current structure and applicable subject context |
| StudentAcademicPlacement | active/ended, versioned, tenant-safe history | current placement + historical placement |
| GuardianRelationship | active relationship powers existing parent authorized-student resolver | parent scope only; inactive/revoked relation denied |
| Enrollment Documents | canonical policy/status metadata, not physical storage | safe metadata only; no evidence reference/file/download |
| Finance/Assessment/Attendance/physical Documents | no final canonical authority | explicit `not_yet_authoritative`, no facts synthesized |

## Decisions closed before implementation

1. One backend aggregation boundary; browser does not fan out to authorities or choose tenant.
2. Student and parent are relationship-scoped; teacher and financial are denied until their distinct read policies exist.
3. “Guardian” and “finance” are not current role identifiers: the current equivalents are `parent` and `financial`; no alias is created.
4. Current and historical records are distinct semantic sections, not client filtering over an unrestricted result.
5. No persistence/migration/cache is authorized absent measured query evidence.

## DoR checklist

| Item | Evidence | Result |
| --- | --- | --- |
| Canonical sequence | Master Plan §4; roadmap Parts 4–6 | PASS |
| Domain boundary | Architecture §§4,8; ACADEMIC-01 downstream contract | PASS |
| Tenant/role source | `institutional-context.ts`, `authorized-students.ts` | PASS |
| Existing source ownership | Enrollment/Academic/Document authorities listed above | PASS |
| Unavailable domain treatment | AUDIT-01/FND-03/FND-04 product-truth fences | PASS |
| API/current-history/performance contract | `STUDENT-360-01.md` | PASS |
| AC/test/negative matrix | `STUDENT-360-01.md` AC01–AC12 | PASS |
| Scope and stop rules | `STUDENT-360-01.md` | PASS |

No external dependency is required to begin implementation of the bounded read-only projection. A later request for financial, assessment, attendance or physical-file facts is a stop condition, not an extension.

**READY — STUDENT-360-01**

## Objective 1 execution evidence

| Invariant | Executed proof | Result |
| --- | --- | --- |
| Single read-only backend boundary | `student-context-api.ts` is called only through `student-context.controller.ts`; production registration is in `server.ts` | PASS |
| Server-side tenant and authorization | `tests/student-context-objective1-postgres-http.test.ts` exercises `requireAuth → InstitutionalContext → boundary → PostgreSQL` | PASS |
| Same-tenant / cross-tenant / role denial | PostgreSQL and HTTP assertions cover administrator success, tenant B fail-closed, and teacher denial | PASS |
| No write side effects | PostgreSQL snapshots prove no Academic event, profile, enrollment, or placement mutation | PASS |
| Safe response | HTTP assertions prove no internal identifiers, SQL/stack detail, address, or phone output | PASS |
| Unavailable-domain truth | Policy and boundary return `not_yet_authoritative`, never synthesized values | PASS |

**Objective 1 GREEN — Authorized Projection Boundary Proven.**

## Objective 2 execution evidence

| Invariant | Executed proof | Result |
| --- | --- | --- |
| Current enrollment and year | PostgreSQL fixture has active 2026 enrollment and an active 2025 historical record in a closed year; projection returns only 2026 | PASS |
| Current placement structure | Projection returns active placement with authoritative AcademicYear, Class, Program and Level display fields | PASS |
| Subject context | Active Class subject offering is returned as display-safe code/name metadata | PASS |
| Historical separation | Closed-year enrollment and ended placement are present in PostgreSQL but excluded from `current` | PASS |
| Security and non-mutation | Same Objective 1 operational test continues to prove tenant fail-closed, role denial, HTTP 401/403 and no writes | PASS |

**Objective 2 GREEN — Current Student Context Proven.**

## Objective 3 execution evidence

| Invariant | Executed proof | Result |
| --- | --- | --- |
| Current/history separation | Fixture creates current 2026 context plus ended 2025 and 2024 placements; `current` contains only 2026 and `history` contains only the earlier periods | PASS |
| Deterministic temporal history | Enrollment and placement history order by AcademicYear start date descending, then canonical record timestamps/IDs | PASS |
| Historical structure fidelity | Each historical placement is read through its authoritative AcademicYear, Class, Program and Level; no current state is inferred into history | PASS |
| Honest absence | Active StudentProfile with no enrollment/placement returns `current` nulls and empty `history` arrays | PASS |
| Security/read-only/HTTP | Same isolated PostgreSQL test proves tenant fail-closed, teacher denial, HTTP 200/401/403, PII minimization and no authority mutation/event | PASS |

**Objective 3 GREEN — Historical Student Context Proven.**

## Objective 4 execution evidence

| Invariant | Executed proof | Result |
| --- | --- | --- |
| Unavailable-domain truth | HTTP and policy assertions require Finance, Assessment, Attendance and physical Documents to be exactly `not_yet_authoritative`; assertions reject invented balance/absence/success claims | PASS |
| Complete real-role matrix | PostgreSQL/HTTP exercises `institution_admin`, `director`, `secretariat`, `student` self and linked `parent` as allowed; `teacher`, `financial` and unlinked parent as denied | PASS |
| No invented aliases | Policy explicitly rejects non-role labels `guardian` and `finance`; actual roles remain `parent` and `financial` | PASS |
| Tenant/privacy hardening | Tenant B receives non-disclosing 404; assertions reject internal person, membership, institution and provider-related identifiers plus contact/address/SQL/stack detail | PASS |
| Read purity | Pre/post PostgreSQL snapshot covers events, all StudentProfile/Enrollment/Placement timestamps and schema-table count, proving no mutation or materialization | PASS |

**Objective 4 GREEN — Privacy and Unavailable-Domain Truth Proven.**

## Objective 5 execution evidence

| Invariant | Executed proof | Result |
| --- | --- | --- |
| Operational HTTP chain | Isolated real HTTP test covers current, history, unavailable domains, real `requireAuth`, InstitutionalContext and PostgreSQL source reads | PASS |
| Read-model coherence | Current 2026 enrollment/placement/class/program/level/subjects and older 2025/2024 history are asserted separately | PASS |
| Fixed query shape / N+1 fence | Counting executor asserts exactly three source queries for admin projection, independent of the number of historical records | PASS |
| Source-read indexes | Migration `0023_student_context_read_indexes.sql` provides tenant/student temporal indexes for Enrollment and Placement history filters | PASS |
| Safe partial/failure behavior | No-history StudentProfile returns null current/empty history; nonexistent and cross-tenant targets return safe 404; missing membership and denied roles return 403 | PASS |
| Read purity | Existing full snapshot proves no event, timestamp, source-authority or schema/materialization mutation | PASS |

**Objective 5 GREEN — Operational Student Context Projection Proven.**
