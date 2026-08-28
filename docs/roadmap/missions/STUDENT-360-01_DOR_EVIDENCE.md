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
