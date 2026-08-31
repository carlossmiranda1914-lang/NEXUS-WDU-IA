# ALUNOS-01A — Enrollment-to-Student Continuity & Interaction

**State:** IMPLEMENTING
**Design authority:** `docs/superpowers/specs/2026-08-30-alunos-01a-enrollment-student-continuity-design.md`
**Implementation plan:** `docs/superpowers/plans/2026-08-30-alunos-01a-enrollment-student-continuity.md`
**Baseline:** `main@f945fe43d72e9f86078a184d557691e1c32d4b63`
**Execution branch:** `codex/alunos-01a-design`
**Worktree:** `D:\Soft\NEXUS-WDU-IA-alunos-01a`
**Task 1 checkpoint input:** `15d3f99edff765a9076ebb38f14c9acb1c11e186`; upstream `origin/codex/alunos-01a-design`; merge-base `f945fe43d72e9f86078a184d557691e1c32d4b63`.

## Scope statement

**Objective:** make the existing canonical Enrollment, Active Students and Student Record journey visibly continuous without changing domain ownership.

**Protected invariants:** server-owned Enrollment lifecycle; atomic activation; process projection with blockers, next action, evidence and version; one-person Active Students projection; opaque `studentRef`; server-owned Student Record read model; tenant isolation, authorization, privacy and no-write reads.

**Task 1 files:** this mission pack and `tests/alunos-01a-lifecycle-authority-contract.test.ts` only.

**Out of scope:** post-activation Student writes; physical-document storage/lifecycle; guardian writes; Academic movement; Finance; Assessment; Attendance; Communication; AI; photograph/media; Dashboard redesign; schema changes.

**Stop rule:** later implementation stops if a safe process-to-Student-Record bridge requires an internal identifier, canonical lifecycle truth cannot be derived from server contracts, a visual state needs invented domain semantics, or a schema/write-authority change becomes necessary.

## Frozen authority contract

```text
LIFECYCLE=Entrada>Preparacao>Documentos>Verificacao>Decisao>Ativacao>Aluno ativo>Registo do Aluno
ENROLLMENT_AUTHORITY=SERVER
ACTIVE_STUDENTS_AUTHORITY=SERVER
STUDENT_RECORD_AUTHORITY=SERVER_READ_MODEL
PROCESS_DRAWER=PRESERVE
SCHEMA_CHANGE_EXPECTED=NO
POST_ACTIVATION_WRITES=OUT_OF_SCOPE
PHYSICAL_DOCUMENT_UPLOAD=OUT_OF_SCOPE
ANIMATION_CANNOT_ADVANCE_CANONICAL_STATE=YES
```

The first six labels are the Enrollment process presentation. `Aluno ativo` is the authorized institutional outcome; `Registo do Aluno` is the longitudinal read destination. They are not competing client-owned pipelines.

## Task 1 — AS-IS Lifecycle Truth and Preservation Gate

### Repository-evidenced lifecycle matrix

| USER STAGE | SERVER SOURCE | CURRENT UI SURFACE | CURRENT ACTION OWNER | SAFE PUBLIC NAV REF | KEEP/REFINE |
| --- | --- | --- | --- | --- | --- |
| Entrada | `enrollment_applications.status=draft`; process projection derives/persists `current_stage` | `EnrollmentOperationsWorkspace`: `Entrada` / `Entradas` | Enrollment intake and existing process commands, server-authorized | None for process; Enrollment API receives an internal enrollment id only | KEEP server lifecycle; REFINE presentation only |
| Preparação | Existing draft/readiness facts and process projection; current UI calls the stage `Identificação` where applicable | Operational workspace process/detail drawer | Existing Enrollment process authority | None | KEEP authority; REFINE human lifecycle label without renaming backend keys |
| Documentos | `enrollment_documents` plus document requirements feed `calculateProjection` and registration readiness | Workspace `Documentos`; preserved process drawer checklist | Enrollment document controller/policy | No safe Student Record owner bridge | KEEP factual checklist; REFINE only process hierarchy |
| Verificação | `under_review` application status and server process projection stages/evidence | Workspace `Verificação`; process drawer | Existing Enrollment process/decision commands | None | KEEP server fact and evidence |
| Decisão | `validated` application status, readiness and authorized decision/activation eligibility | Workspace `Decisão`; process drawer | Existing authorized Enrollment command | None | KEEP concurrency/version protections |
| Ativação | `activateEnrollment` transaction verifies role, readiness, documents and inactive profile, then atomically activates profile/application and records the command/event | Workspace activation stage and existing process drawer action | Canonical Enrollment activation controller/API | No safe student ref is returned by current activation result; Task 4 must prove a safe handoff before adding one | KEEP atomic activation and audit/idempotency; REFINE confirmed-only feedback |
| Aluno ativo | `student_profiles.status='active'`, authorized `loadActiveStudents` query scoped by institution | `Alunos ativos` view, distinct from Enrollment rows | Server read projection only | `student_profiles.public_ref` as opaque `studentRef` | KEEP one StudentProfile to one row and server tenant scope |
| Registo do Aluno | `loadStudentContext` resolves `(institution_id, public_ref)` before its bounded read projection | `StudentRecordWorkspace`, five existing sections | Server read model only | Opaque `studentRef` in `/api/student-context/:studentRef` | KEEP read-only cross-domain projection and no internal IDs |

### Current label/key reconciliation

The present operational model exposes status labels such as `Entrada iniciada`, `Em verificação`, `Aguardar documentos`, `Pronta para decisão`, `Requer atenção` and `Aluno ativo`; process records hold canonical `current_stage` values server-side. The current UI additionally has unavailable `Identificação` and `Financeiro` pipeline cards. Task 1 changes none of these backend labels or stage keys. Task 2 may present the approved human lifecycle only by mapping canonical facts, never by creating a second progress authority.

### KEEP | REFINE | ADD | DEFER inventory

| KEEP | REFINE | ADD | DEFER |
| --- | --- | --- | --- |
| Canonical activation command, transaction, audit ledger and idempotency; existing process drawer information architecture; blockers; `nextAction`; stage evidence; version/concurrency handling; one-person Active Students projection; opaque `studentRef`; five-section Student Record; tenant/auth/privacy regressions; existing light/dark/mobile behavior | A single human-facing lifecycle presentation; drawer visual hierarchy and confirmed-state motion; verified post-activation handoff only if a safe opaque bridge exists | No Task 1 product feature. Later tasks may add only a presentation mapping and a proven opaque Student Record handoff | Post-activation Student writer; physical document upload/storage/lifecycle; guardian writes; academic movement; Finance; Assessment; Attendance; Communication; AI; media; Dashboard; unsafe Enrollment/Document owner routing |

### Task 1 execution ledger

| Item | Evidence | Result |
| --- | --- | --- |
| Baseline/worktree | Branch `codex/alunos-01a-design`, upstream `origin/codex/alunos-01a-design`, merge-base `f945fe4`, named worktree recorded above | PASS |
| RED governance proof | `npx tsx tests/alunos-01a-lifecycle-authority-contract.test.ts` before this file existed | RED: `ENOENT` for this mission pack, exit 1 |
| AS-IS Enrollment authority | `enrollment-process-api.ts`, `enrollment-activation-api.ts`, controllers and workspace inspected | PASS — server owns process/activation |
| AS-IS Active Students authority | `active-students-api.ts` inspected | PASS — institution-scoped server projection with opaque reference |
| AS-IS Student Record authority | `student-context-api.ts`, controller and workspace inspected | PASS — server resolves `studentRef` before read projection |
| GREEN governance proof | `npx tsx tests/alunos-01a-lifecycle-authority-contract.test.ts`; `npm run lint`; `git diff --check` | PASS |

## Execution boundary

Task 1 introduced no product code, schema, write, navigation, animation or user-visible lifecycle behavior. Tasks 2 and 3 subsequently passed their independent review gates; Task 4 is blocked by the safe-reference prerequisite below.

## Task 4 stop-rule evidence — activation-to-Student-Record bridge

**Status:** RESOLVED — server-owned opaque correlation implemented and independently reviewed.

The independent repository audit on `8f2298a` established:

- `activateEnrollment` returns and the HTTP controller serializes only `{ enrollmentId, lifecycleVersion, status }`; `enrollmentId` is an internal command target and cannot enter browser navigation.
- The authorized Active Students projection exposes opaque `studentRef`, but has no enrollment correlation reference. Its HTTP contract explicitly excludes enrollment and person internal identifiers.
- Enrollment workspace records share only human display data with Active Students. Matching by a name, offer or academic year would be ambiguous and is prohibited.
- The existing Process Drawer provides only the approved validation/review actions; it has no canonical activation action path. Activation remains reserved to the existing Administration/Direção authority.

The approved prerequisite is now implemented in `49cbf13`: canonical activation resolves `student_profiles.public_ref` in the locked institutional transaction, returns and persists only the opaque `studentRef`, and normalizes legacy idempotency-ledger replays without exposing historical internal identifiers. PostgreSQL and HTTP proofs cover exact correlation, retry/idempotency, concurrency, one Active Students row, tenant fail-closed behavior and Student Record access. No internal-ID fallback, display-name matching, client mapping, schema change or new activation authority was introduced.

## Task 5 visual and motion evidence

**Status:** static contract GREEN; live matrix remains reserved for Task 6 human UAT.

- Lifecycle and workspace navigation retain horizontal overflow protection for narrow screens.
- Keyboard focus now uses a distinct `focus-visible` emerald ring with a theme-aware offset, separate from selected state treatment.
- Existing drawer enter/exit and progress transitions retain `motion-reduce` static fallbacks; no looping decorative animation or dashboard metric wall was introduced.
- The contractual dark and light classes remain in the same component. Desktop, 768px, 390px and authenticated live interaction are deliberately not marked observed until the Task 6 UAT run.

## P0 continuation — Document requirements & Enrollment continuity

**State:** IMPLEMENTING — authorised P0 repair within the existing Enrollment Document authority.

### Root cause

The canonical data model, intake snapshot service, document-status transitions and validation gate already existed. The UAT target, however, contained no active `enrollment_document_policies` and no `enrollment_document_requirements`; the only configuration evidence was direct PostgreSQL setup in tests. No server-authorized configuration boundary existed to create an offer policy and explicitly materialize its first snapshot, so the Process Drawer correctly failed closed with `POLICY_NOT_CAPTURED`.

### Frozen repair contract

```text
DOCUMENT_REQUIREMENT_AUTHORITY=enrollment_document_policies + enrollment_document_requirements
CONFIGURATION_OWNER=SERVER (institution_admin | director)
MATERIALIZATION_OWNER=SERVER (explicit selected-enrollment command)
DOCUMENT_STATUS_AUTHORITY=enrollment_documents
PHYSICAL_UPLOAD_STORAGE=OUT_OF_SCOPE
SCHEMA_CHANGE_EXPECTED=NO
SNAPSHOT_STABILITY=CAPTURED_ENROLLMENTS_IMMUTABLE
```

- The new command receives only the existing Enrollment internal command target; it resolves the offer and institution server-side.
- A mutable enrollment with no prior policy snapshot may explicitly receive a newly configured or matching active offer policy and one materialized pending row per requirement.
- A repeated equivalent command replays without duplicate policy/requirements/documents. A captured snapshot with different requirements returns conflict; later offer-policy changes do not rewrite it.
- `pending → submitted → verified/rejected` remains the existing Enrollment Document transition authority. A submitted reference is evidence metadata only and never claims upload/storage.
- Configuration does not alter Enrollment activation, `studentRef`, Active Students, Student Record, schema migrations or browser-owned institutional authority.

### P0 evidence ledger

| Proof | Evidence | Result |
| --- | --- | --- |
| AS-IS root cause | Approved local PostgreSQL target: `policies_active=0`, `requirements_total=0`, `enrollments_uncaptured=1` | PASS |
| RED | `npx tsx tests/alunos-01a-document-requirements-postgres-http.test.ts` before the boundary existed | PASS — missing module, exit 1 |
| PostgreSQL + HTTP | Same test after implementation: configuration, materialization, replay, required status truth, gate, 401/403/404, tenant isolation and exact public success shape | PASS (15 assertions) |
| Drawer contract | `npx tsx tests/alunos-01a-document-requirements-drawer-contract.test.ts` | PASS |
| Snapshot stability | Same PostgreSQL/HTTP test confirms a subsequent policy configuration does not rewrite the earlier enrollment snapshot | PASS |
| Affected regressions | Document policy/PostgreSQL/HTTP/UX/integration, S03 process, Enrollment activation PostgreSQL/HTTP, Active Students PostgreSQL/HTTP and Student Context PostgreSQL/HTTP/policy | PASS |
| Static + security | `npm run lint`, `npm run build`, `npm run test:secrets`, `git diff --check` | PASS |
| Aggregate quality gate | `npm run quality-gate` with the authorised local test target | PASS — exit 0 |
| Independent review | Read-only review of the complete P0 diff | PASS — no P0/P1; public success-shape P2 added and retested |
| Local UAT runtime | `npm run dev:test` with external, approved `TEST_DATABASE_URL` | PASS — `http://localhost:3000` returns 200 |

### Human UAT entry condition

The repair is technically validated and the local UAT server is prepared. The remaining acceptance is human validation of an authorised mutable Enrollment through the existing Process Drawer: configure factual requirements, observe the persisted checklist, record the existing metadata-only document transitions, verify the document stage advances only after all required rows are verified, and confirm a later policy configuration leaves the first captured snapshot unchanged. The official mission state remains `VALIDATING` until that human acceptance is recorded.

## ALUNOS-01A.2 — Single Process Truth execution tranche

**State:** AUTHORISED FOR SDD EXECUTION

**Design addendum:** `docs/superpowers/specs/2026-08-31-alunos-01a-single-process-truth-design.md`
**SDD plan:** `docs/superpowers/plans/2026-08-31-alunos-01a-single-process-truth.md`

### Why this tranche exists

Human review confirmed that the current Overview still presents multiple competing interpretations of the same process. The four large operational metric cards remain a second navigation/process surface, while the Journey presentation still derives several stages from broad Enrollment status counts and hardcodes `Preparação` to zero. This is not accepted as the final Nexus experience.

### Frozen execution order

```text
T1=SINGLE_PROCESS_TRUTH
T2=HUMAN_TERMINOLOGY
T3=ONE_JOURNEY_RAIL
T4=DRAWER_CONTINUITY
T5=NEXUS_MOTION_VISUAL
T6=REAL_ENROLLMENT_TO_STUDENT_UAT
```

### Protected completed work

The following are frozen and must not be rebuilt during ALUNOS-01A.2:

- P0 document requirements/materialization/checklist at `20cb0a9`;
- canonical Enrollment activation authority;
- activation → opaque `studentRef` bridge;
- Active Students authority/projection;
- Student Record authority/read model;
- tenant/auth/privacy guarantees;
- existing Process Drawer functional content.

### Controller rule

The conversation is not the execution authority. The spec, plan and plan-specific SDD ledger are authoritative. Each task uses a fresh implementer subagent followed by independent review. Completed ledger tasks are never re-dispatched. Normal implementation/test defects are fixed without pausing for human approval. Human input is required only at the final UAT gate or for a genuine stop-rule condition.

### Acceptance target

```text
PROCESS_TRUTH_SOURCE=SERVER_PROCESS_PROJECTION
ONE_PRIMARY_LIFECYCLE=YES
METRIC_CARD_WALL_AS_PROCESS_SURFACE=NO
DRAWER_IS_PROCESS_DETAIL=YES
HUMAN_TERMINOLOGY_UNIFIED=YES
MOTION_SERVER_CONFIRMED=YES
SECOND_CLIENT_STATE_MACHINE=NO
SCHEMA_CHANGE=NO
MISSION_GATE=READY_FOR_HUMAN_UAT
```
