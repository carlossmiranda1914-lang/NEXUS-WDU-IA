# STUDENT-360-01 — Authorized Student Context Projection

**State:** DONE — STUDENT-360-01
**Baseline:** `main @ c093fab221489e273aead35312ac8339a6e32718`
**Dependencies:** IAM/InstitutionalContext, ENROLLMENT-01/02, ACADEMIC-01 — DONE.

## Outcome

Provide one server-authorized, read-only Student Context response. It composes existing facts; it never creates a Student aggregate, persists a projection, or performs a domain mutation.

## Traceability and scope

- Product: Master Plan §§4–6 requires Student 360 after Academic Core and defines it as a projection, not a write owner.
- Architecture: `StudentProfile` is the institutional relationship; Student 360 is read-only (§8). Academic/Enrollment remain their own authorities.
- Roadmap: Part 5 follows Academic Core and precedes Finance.
- Audit: legacy student aggregate mixes identity, academic, grades/attendance and finance; replacement is incremental.

### IN

One HTTP backend boundary, safe response projection, current/history semantics, authorization/tenant policy, pagination for history, operational tests and a bounded Student Context UI consumer if required by the implemented contract.

### OUT

Writes to Person, StudentProfile, Enrollment, Academic, Documents, Finance, Assessment or Attendance; new schema/projection table/materialized cache; Student 360 as a new authority; Finance, physical file bytes, grades, attendance, messaging, global search and browser-chosen institution.

## Authority and response contract

`GET /api/student-context/:personRef` is resolved from authenticated `InstitutionalContext`; the URL is an opaque server-validated reference, never an institution selector. Cross-tenant/non-authorized targets respond non-disclosing `404`; missing context is authentication/selection failure.

The response contains only safe display fields necessary for the authorized role:

- `current`: active StudentProfile, current Enrollment, current academic year/class/program/level/placement, and applicable subject context;
- `history`: paginated Enrollment and Placement records, with immutable lifecycle/status/time semantics distinct from `current`;
- `documents`: factual Enrollment Document metadata only (type/status/verified timestamp), never evidence reference, bytes, path, hash or download URL unless a later Document authority establishes it;
- `unavailable`: Finance, Assessment, Attendance and physical Documents as `{ status: 'not_yet_authoritative' }`, never zero, empty-success, fabricated totals or sample facts;
- `deniedSections`: explicit section keys where an otherwise authorized viewer lacks a section policy.

No internal UUIDs, national-ID, address, phone, e-mail, guardian contact, document reference or legacy student ID appear unless an approved role/section contract proves need. The initial contract must prefer opaque references and display-safe fields.

## Permissions

| Existing role | Initial scope | Decision |
| --- | --- | --- |
| `institution_admin`, `director`, `secretariat` | full available institutional Student Context for a same-tenant student | allow; Documents stays metadata-only |
| `student` | own active Student Context only | allow through existing `resolveAuthorizedStudents` self relation |
| `parent` (the implemented guardian-equivalent role) | active linked student only | allow through active `GuardianRelationship` only |
| `teacher` | denied in this mission | TeacherAssignment alone does not yet prove teacher-to-student roster visibility policy |
| `financial` (not `finance`) | denied in this mission | Finance authority/read policy is not canonical |
| `guardian`, `finance` | no such current InstitutionalRole | future-scope labels; never mapped implicitly |

Role-based allow/deny is necessary but insufficient: every read must prove same-institution ownership and, for parent/student, the server-side relationship. No `users.role` or client-supplied institution/person value is authority.

## Query and performance design

The boundary uses a fixed, bounded query plan: resolve authorized target first; fetch current facts through institution-constrained joins; then fetch enrollment and placement history with a cursor/limit. Batch document metadata by enrollment IDs; no per-row query (N+1). Existing tenant/year/student placement indexes are used; implementation must obtain `EXPLAIN` evidence before adding an index. No cache/materialized table is permitted initially.

## Invariants and failures

- `current` means active lifecycle fact valid now; `history` means past/non-current lifecycle records, never a synonym for all rows.
- Query-only endpoint produces no event, audit mutation, version change, cache write or domain write.
- A person without active StudentProfile or without an authorized relation is not disclosed.
- Finance/Assessment/Attendance/physical-documents remain unavailable facts, not blocked reads with invented data.

## Acceptance and test matrix

| AC | Required proof |
| --- | --- |
| AC01 | same-tenant authorized student response from PostgreSQL + HTTP chain |
| AC02 | A→B target/institution fails closed without PII |
| AC03 | admin/director/secretariat allow; teacher/financial deny |
| AC04 | student self and parent active GuardianRelationship scope only |
| AC05 | current Enrollment and current Placement are correct and distinct |
| AC06 | historical Enrollment/Placement paginate and exclude current semantics correctly |
| AC07 | Program/Level/Class/Subject context is institution/year consistent |
| AC08 | document metadata is factual and PII-minimized |
| AC09 | Finance/Assessment/Attendance/physical Documents return not-yet-authoritative, not zero/success |
| AC10 | no write side effects: row counts/events/versions unchanged |
| AC11 | HTTP requires resolved InstitutionalContext; client tenant fields are ignored/rejected |
| AC12 | query-count/N+1 and pagination contract; no cache/projection persistence |

Required evidence: focused policy/contract tests; isolated PostgreSQL A/B and no-write tests; real HTTP `requireAuth`/InstitutionalContext chain; existing Enrollment, document, Academic and IAM regressions; lint/build/diff/quality gate; safe response inspection.

## Stop rules

Stop and return to PREPARATION if a role needs information not covered by the above policy; a required source has ambiguous owner/current-history semantics; a response needs physical Document or Finance facts; N+1 cannot be bounded without a new architecture decision; a source query cannot prove tenant ownership; or implementation requires adding a Student write model/cache.

## Definition of Ready

AS-IS sources, role names, relationship policy, response sections, unavailable-domain semantics, query boundaries, ACs, no-write proof and stop rules are explicit. Finance, Assessment, Attendance and physical storage are explicitly unavailable rather than dependencies that silently broaden this mission.

**READY — STUDENT-360-01**

## Closeout validation

The implementation remains a read-only composition boundary. It has no Student-360 table, cache, event emission or write authority. Historical enrollment and placement history uses bounded, deterministic pagination; Enrollment document output is metadata-only (`type`, `status`, `verifiedAt`) and never contains evidence references, bytes or download locations. The final aggregate gate recorded `exit=0` and `quality-gate: PASS`; the executable evidence is in `STUDENT-360-01_DOR_EVIDENCE.md`.

**DONE — STUDENT-360-01 AUTHORIZED STUDENT CONTEXT PROJECTION PROVEN.**
