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

Task 1 is documentation and governance only. It introduces no product code, schema, write, navigation, animation or user-visible lifecycle behavior. Subsequent Tasks 2–6 remain unstarted until their independent review gates.
