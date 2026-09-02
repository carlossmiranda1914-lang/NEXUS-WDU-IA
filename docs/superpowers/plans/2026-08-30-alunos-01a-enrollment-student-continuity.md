# ALUNOS-01A Enrollment-to-Student Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Enrollment + Active Students + Student Record experience into one clearer, more professional and interactive lifecycle without replacing canonical authorities or introducing post-activation edits/document storage.

**Architecture:** Preserve Enrollment as the temporal write authority, Active Students as its own authorized read projection, and Student Record as the longitudinal read destination. Refine only the existing experience around a single lifecycle representation, the current process drawer and an activation handoff that is driven by confirmed backend truth. Motion is presentation-only and can never become a second source of process state.

**Tech Stack:** TypeScript, React, Express, PostgreSQL, Firebase authentication, existing Nexus/Tailwind visual system, Node/tsx contract tests.

**Spec:** `docs/superpowers/specs/2026-08-30-alunos-01a-enrollment-student-continuity-design.md`

## Global Constraints

- Baseline authority is `main@f945fe43d72e9f86078a184d557691e1c32d4b63`.
- Preserve canonical Enrollment lifecycle, atomic activation, process projection, blockers, next actions and audit/ledger guarantees.
- Preserve Active Students as a distinct backend projection and Student Record through opaque `studentRef`.
- Preserve the existing process drawer; refine it, do not replace it wholesale.
- Browser must not authorize tenant, stage, progress, activation, Student identity or completion.
- UI motion occurs only after canonical server truth is received or revalidated.
- No schema change is expected or authorized for visual continuity alone.
- No post-activation editing, generic Edit Student writer, physical file upload, document lifecycle, guardian writes, Academic movement commands, Finance, Assessment, Attendance, Communication, AI or Dashboard redesign.
- No internal Person, StudentProfile, Enrollment, tenant or document ID may be exposed to create navigation continuity.
- Normal failure semantics remain explicit: empty != error; partial != zero; unavailable != absent.
- Light/dark, desktop/tablet/mobile, keyboard focus and `prefers-reduced-motion` are mandatory acceptance surfaces.
- Human UAT is mandatory before DONE.

---

### Task 1: AS-IS Lifecycle Truth and Preservation Gate

**Files:**
- Create: `docs/roadmap/missions/ALUNOS-01A.md`
- Create: `tests/alunos-01a-lifecycle-authority-contract.test.ts`
- Inspect: `src/components/EnrollmentOperationsWorkspace.tsx`
- Inspect: `src/modules/enrollments/enrollment-operations-model.ts`
- Inspect: `src/modules/enrollments/enrollment-process-api.ts`
- Inspect: `src/modules/enrollments/enrollment-activation-api.ts`
- Inspect: Active Students HTTP/controller/repository files returned by repository search
- Inspect: `src/components/StudentRecordWorkspace.tsx`

**Interfaces:**
- Consumes: current canonical process stages, process projection, activation response, Active Students projection and `studentRef` navigation.
- Produces: a factual lifecycle/authority matrix and a frozen KEEP inventory used by every later task.

- [ ] **Step 1: Establish exact execution baseline**

Fetch/reconcile `origin/main`, create or enter an isolated named worktree from `codex/alunos-01a-design`, and record branch, worktree, HEAD, upstream and clean status in the mission evidence. Read `AGENTS.md`, `docs/operations/CODEX_EXECUTION_ADAPTER.md`, the spec and this plan before product edits.

- [ ] **Step 2: Write the governance/authority contract first**

Create `tests/alunos-01a-lifecycle-authority-contract.test.ts` to require `docs/roadmap/missions/ALUNOS-01A.md` to contain:

```text
LIFECYCLE=Entrada>Preparacao>Documentos>Verificacao>Decisao>Ativacao>Aluno ativo>Registo do Aluno
ENROLLMENT_AUTHORITY=SERVER
ACTIVE_STUDENTS_AUTHORITY=SERVER
STUDENT_RECORD_AUTHORITY=SERVER_READ_MODEL
PROCESS_DRAWER=PRESERVE
SCHEMA_CHANGE_EXPECTED=NO
POST_ACTIVATION_WRITES=OUT_OF_SCOPE
PHYSICAL_DOCUMENT_UPLOAD=OUT_OF_SCOPE
```

Also require an explicit `KEEP | REFINE | ADD | DEFER` inventory and a rule that animation cannot advance canonical state.

- [ ] **Step 3: Run the new contract and prove RED**

Run:

```bash
npx tsx tests/alunos-01a-lifecycle-authority-contract.test.ts
```

Expected: FAIL because the mission pack does not yet exist.

- [ ] **Step 4: Trace the current lifecycle from real code**

Document this matrix from repository evidence only:

```text
USER STAGE | SERVER SOURCE | CURRENT UI SURFACE | CURRENT ACTION OWNER | SAFE PUBLIC NAV REF | KEEP/REFINE
```

At minimum trace entry/draft, document waiting, verification/review, validated/decision, activation, Active Students and Student Record. Record where current UI labels differ from canonical process-stage keys; do not rename backend states in this task.

- [ ] **Step 5: Freeze the KEEP inventory**

In `ALUNOS-01A.md`, explicitly preserve: canonical activation command, process drawer information architecture, blockers, `nextAction`, stage evidence, version/concurrency handling, one-person Active Students projection, opaque `studentRef`, five-section Student Record, tenant/auth/privacy regressions and existing light/dark/mobile behavior.

- [ ] **Step 6: Run GREEN governance proof**

Run:

```bash
npx tsx tests/alunos-01a-lifecycle-authority-contract.test.ts
npm run lint
git diff --check
```

Expected: PASS. Product code diff must still be zero.

- [ ] **Step 7: Commit and stop for review**

Commit only mission/test evidence:

```bash
git add docs/roadmap/missions/ALUNOS-01A.md tests/alunos-01a-lifecycle-authority-contract.test.ts
git commit -m "docs(alunos): map enrollment student lifecycle authority"
git push
```

Do not start Task 2 before review.

---

### Task 2: Single Lifecycle Presentation Model

**Files:**
- Create: `src/modules/enrollments/enrollment-lifecycle-presentation.ts`
- Modify: `src/components/EnrollmentOperationsWorkspace.tsx`
- Create: `tests/alunos-01a-lifecycle-presentation.test.ts`
- Test: `tests/enrollment-operations-ui-contract.test.ts`
- Test: `tests/active-students-ui-contract.test.ts`

**Interfaces:**
- Consumes: existing `EnrollmentOperationalRecord[]`, canonical process projection/stages and current Active Students count.
- Produces:

```ts
export type EnrollmentLifecycleStep = {
  key: 'entry' | 'preparation' | 'documents' | 'verification' | 'decision' | 'activation' | 'active_student';
  label: string;
  count: number;
  tone: 'neutral' | 'info' | 'attention' | 'success';
  selectedView: 'entries' | 'enrollments' | 'students';
  source: 'enrollment' | 'active-students';
};

export function buildEnrollmentLifecyclePresentation(
  records: EnrollmentOperationalRecord[],
  activeStudentCount: number,
): EnrollmentLifecycleStep[];
```

The helper may classify existing canonical record states/stages for presentation, but must not create new business state or mutate records.

- [ ] **Step 1: Write RED unit tests for a single seven-step presentation**

Create fixtures with records in draft/review/document/validated/active states and an independent active-student count. Assert exactly these human steps and deterministic order:

```ts
['Entrada', 'Preparação', 'Documentos', 'Verificação', 'Decisão', 'Ativação', 'Aluno ativo']
```

Assert `Aluno ativo` count comes only from the Active Students projection input, never by counting enrollment rows.

- [ ] **Step 2: Run RED**

Run:

```bash
npx tsx tests/alunos-01a-lifecycle-presentation.test.ts
```

Expected: FAIL because the presentation helper does not exist.

- [ ] **Step 3: Implement the pure presentation helper**

Create `enrollment-lifecycle-presentation.ts` as a pure mapping layer. Reuse existing functions/constants from `enrollment-operations-model.ts` where they already express canonical process classification. Do not duplicate backend authorization or process transition rules.

- [ ] **Step 4: Run unit test GREEN**

Run:

```bash
npx tsx tests/alunos-01a-lifecycle-presentation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Replace competing lifecycle/cycle presentation in the workspace**

Modify only the lifecycle summary portion of `EnrollmentOperationsWorkspace.tsx`. Render one connected lifecycle strip/rail using the seven presentation steps. Clicking a step may switch only to an existing safe view (`entries`, `enrollments`, `students`) and may apply existing client-side display filtering; it must not perform a mutation or claim a backend transition.

- [ ] **Step 6: Add structural UI contract assertions**

Update/create tests to assert:

```text
one lifecycle rail exists
seven labels exist once in lifecycle presentation
Active Students remains a separate view
no second process-cycle component remains visible
no internal IDs appear in lifecycle DOM contract
```

- [ ] **Step 7: Run affected UI regressions**

Run:

```bash
npx tsx tests/alunos-01a-lifecycle-presentation.test.ts
npx tsx tests/enrollment-operations-ui-contract.test.ts
npx tsx tests/active-students-ui-contract.test.ts
npm run lint
npm run build
git diff --check
```

Expected: PASS.

- [ ] **Step 8: Commit and stop**

```bash
git add src/modules/enrollments/enrollment-lifecycle-presentation.ts src/components/EnrollmentOperationsWorkspace.tsx tests/alunos-01a-lifecycle-presentation.test.ts tests/enrollment-operations-ui-contract.test.ts tests/active-students-ui-contract.test.ts
git commit -m "feat(alunos): unify enrollment lifecycle presentation"
git push
```

Stop before Task 3.

---

### Task 3: Preserve and Refine the Existing Process Drawer

**Files:**
- Modify: `src/components/EnrollmentOperationsWorkspace.tsx`
- Create: `tests/alunos-01a-process-drawer-interaction.test.ts`
- Test: existing Enrollment process/lifecycle UI contracts

**Interfaces:**
- Consumes: the existing selected Enrollment record and existing server process projection containing `currentStage`, `progress`, `stages`, `nextAction`, `blockers`, `version` and timestamps.
- Produces: the same drawer behavior with refined hierarchy/motion only; no new command contract.

- [ ] **Step 1: Characterize drawer invariants before changing styles**

Write `tests/alunos-01a-process-drawer-interaction.test.ts` to require the drawer to retain:

```text
current stage
server progress
stage evidence
blockers
next available action
version-aware existing action component
close action
```

Also require an explicit `motion-reduce`/reduced-motion treatment in animated drawer classes after implementation.

- [ ] **Step 2: Run characterization**

Run:

```bash
npx tsx tests/alunos-01a-process-drawer-interaction.test.ts
```

If existing invariants pass and only reduced-motion/motion treatment is absent, record characterization PASS + targeted RED for the new interaction requirement. Do not manufacture unrelated failures.

- [ ] **Step 3: Refine drawer visual hierarchy without changing data flow**

Within the existing drawer block in `EnrollmentOperationsWorkspace.tsx`:

- keep the existing process projection request and actions;
- make current stage and next legitimate action visually primary;
- make completed/pending/blocked stage distinctions easier to scan;
- use graphite/deep-neutral layers in dark mode;
- use Nexus emerald structurally and selective deep/electric blue for current-context emphasis;
- keep amber/rose reserved for factual attention/error states;
- add restrained enter/exit/section transition classes that have `motion-reduce:transition-none` or equivalent;
- do not create continuous looping animation.

- [ ] **Step 4: Ensure command feedback remains server-confirmed**

Audit `EnrollmentLifecycleActions` callback handling. After a successful existing command, refresh/reload the canonical process projection before showing a completed stage. On error, retain the last confirmed projection and render the existing human-readable error. Do not optimistically mutate `currentStage`, `progress` or `status` locally.

- [ ] **Step 5: Run drawer and enrollment regressions**

Run:

```bash
npx tsx tests/alunos-01a-process-drawer-interaction.test.ts
npx tsx tests/enrollment-operations-ui-contract.test.ts
npm run lint
npm run build
git diff --check
```

Expected: PASS.

- [ ] **Step 6: Live visual inspection**

Start the canonical local app and inspect drawer open/close, current stage, blocked state, available action and completed-stage presentation in dark/light at desktop and 390px. Toggle reduced motion in browser/OS emulation and confirm state meaning remains clear with transitions removed.

- [ ] **Step 7: Commit and stop**

```bash
git add src/components/EnrollmentOperationsWorkspace.tsx tests/alunos-01a-process-drawer-interaction.test.ts
git commit -m "feat(alunos): refine enrollment process interaction"
git push
```

Stop before Task 4.

---

### Task 4: Canonical Activation-to-Student Handoff

**Files:**
- Inspect/modify minimally: `src/modules/enrollments/enrollment-activation-api.ts`
- Modify if needed: Enrollment activation controller/HTTP response boundary
- Modify: `src/components/EnrollmentOperationsWorkspace.tsx`
- Create: `tests/alunos-01a-activation-handoff-postgres-http.test.ts`
- Create: `tests/alunos-01a-activation-handoff-ui.test.ts`
- Reuse: existing Active Students and opaque public-ref tests

**Interfaces:**
- Consumes: canonical successful activation and the already-authorized Active Students projection.
- Produces: a safe post-activation UI state that can open the correct Student Record only through an opaque `studentRef`. No internal Person/Enrollment ID becomes navigation authority.

- [ ] **Step 1: Write the PostgreSQL/HTTP RED/characterization proof**

Using the existing disposable PostgreSQL test harness, prove for one activation:

```text
before activation: no active StudentProfile projection for the target fixture
activate once through canonical command
activation response succeeds
exactly one active StudentProfile exists for person+institution
authorized Active Students returns exactly one matching row with opaque studentRef
repeat/retry activation does not create a duplicate person/profile
```

If canonical backend already proves all invariants, treat this as characterization PASS and do not change backend merely to create a RED state.

- [ ] **Step 2: Determine whether the activation response already exposes a safe opaque student reference**

Inspect the activation HTTP response. If it already includes the correct public `studentRef`, use it. If it exposes only internal IDs or no safe ref, do **not** expose internal IDs. Prefer a post-success refresh of `/api/active-students` and match only using an already-safe correlation supported by current public contract. If no safe unambiguous correlation exists, STOP under the spec stop rule and report a prerequisite instead of inventing one.

- [ ] **Step 3: Write UI handoff RED test**

Require that after confirmed activation the workspace provides a human handoff such as:

```text
Aluno ativado
Abrir registo do aluno
```

The action must call existing `onOpenStudentRecord(studentRef)` and must not pass `enrollmentId`, `personId` or other internal ID.

- [ ] **Step 4: Implement the minimum safe handoff**

After successful existing activation:

1. refresh the enrollment/process projection;
2. refresh Active Students from `/api/active-students`;
3. resolve the newly active student only through the safe result established in Step 2;
4. render a restrained success transition/handoff;
5. `Abrir registo do aluno` invokes the existing `onOpenStudentRecord(studentRef)`.

Do not automatically navigate before the human sees confirmation unless an existing approved Nexus pattern explicitly requires that behavior.

- [ ] **Step 5: Prove no duplicate identity and no stale list**

Run:

```bash
npx tsx tests/alunos-01a-activation-handoff-postgres-http.test.ts
npx tsx tests/alunos-01a-activation-handoff-ui.test.ts
npx tsx tests/active-students-ui-contract.test.ts
```

Expected: PASS; one activated person appears once and uses an opaque ref.

- [ ] **Step 6: Run security/regression fence**

Run the repository's existing Active Students PostgreSQL/HTTP, Student Context opaque-ref, tenant/privacy/read-only and Enrollment activation regressions, then:

```bash
npm run lint
npm run build
git diff --check
```

Expected: PASS.

- [ ] **Step 7: Commit and stop**

Commit only the safe handoff and its proofs. If backend change was unnecessary, keep backend untouched.

```bash
git add src/components/EnrollmentOperationsWorkspace.tsx tests/alunos-01a-activation-handoff-postgres-http.test.ts tests/alunos-01a-activation-handoff-ui.test.ts
git commit -m "feat(alunos): connect activation to student record handoff"
git push
```

Stop before Task 5.

---

### Task 5: Nexus Motion, Theme and Responsive Product Gate

**Files:**
- Modify only demonstrated visual defects: `src/components/EnrollmentOperationsWorkspace.tsx`
- Create: `tests/alunos-01a-visual-motion-contract.test.ts`
- Update: `docs/roadmap/missions/ALUNOS-01A.md`

**Interfaces:**
- Consumes: Tasks 2–4 completed surfaces.
- Produces: a single polished visual language with no semantic/data changes.

- [ ] **Step 1: Encode structural visual invariants**

Create `tests/alunos-01a-visual-motion-contract.test.ts` requiring:

```text
single lifecycle presentation
existing drawer preserved
opaque Student Record handoff only
light/dark classes retained
responsive overflow protection retained
keyboard focus treatment exists
reduced-motion class/branch exists
no autoplay/looping animation primitive
no new dashboard metric wall
```

- [ ] **Step 2: Run targeted contract**

```bash
npx tsx tests/alunos-01a-visual-motion-contract.test.ts
```

Fix only factual gaps relative to the approved spec.

- [ ] **Step 3: Perform live dark-mode refinement check**

At desktop, 768px and 390px inspect lifecycle rail, tabs/views, process drawer, activation handoff and Active Students. Dark mode must show controlled graphite depth, Nexus green structure and selective blue energy without reducing text contrast or turning every surface into a gradient.

- [ ] **Step 4: Perform light-mode equivalence check**

Verify identical information hierarchy, stage meaning, focus, errors and success semantics. Theme may change appearance, never meaning.

- [ ] **Step 5: Keyboard and reduced-motion check**

Tab through lifecycle controls, view navigation, drawer controls and handoff action. Focus must be distinct from selected/active state. With reduced motion enabled, all essential state/progress meaning remains available statically.

- [ ] **Step 6: Record visual evidence and debt honestly**

Update `ALUNOS-01A.md` with what was visually inspected and any remaining visual polish debt. Do not mark unobserved breakpoints/states PASS.

- [ ] **Step 7: Run GREEN fence**

```bash
npx tsx tests/alunos-01a-visual-motion-contract.test.ts
npx tsx tests/alunos-01a-lifecycle-presentation.test.ts
npx tsx tests/alunos-01a-process-drawer-interaction.test.ts
npx tsx tests/alunos-01a-activation-handoff-ui.test.ts
npm run lint
npm run build
npm run quality-gate
git diff --check
```

Run the existing secret scan command used by the repository quality gate if it is not already included and record its result.

- [ ] **Step 8: Commit and stop**

```bash
git add src/components/EnrollmentOperationsWorkspace.tsx tests/alunos-01a-visual-motion-contract.test.ts docs/roadmap/missions/ALUNOS-01A.md
git commit -m "feat(alunos): harden lifecycle visual interaction"
git push
```

Stop before Task 6.

---

### Task 6: End-to-End Real Workflow UAT Preparation and Closeout Gate

**Files:**
- Modify: `docs/roadmap/missions/ALUNOS-01A.md`
- Modify: `docs/operations/ACTIVE_MISSION.md`
- Modify: `docs/operations/PROJECT_STATE.md`
- Test: all ALUNOS-01A tests and affected existing Enrollment/Student Experience suites

**Interfaces:**
- Consumes: one-lifecycle UI, preserved drawer, safe activation handoff.
- Produces: clean pushed checkpoint `READY FOR HUMAN UAT`; no merge/DONE before human approval.

- [ ] **Step 1: Prepare canonical local UAT without fake frontend data**

Use existing ignored local configuration and canonical UAT/bootstrap patterns. Prepare at least:

```text
Fixture A: enrollment not yet active, with real process stages/actions available under current policies
Fixture B: active student used to prove one-person Active Students + Student Record navigation
```

All visible data must come through PostgreSQL/backend paths. No React fixture constants.

- [ ] **Step 2: Exercise the real product journey**

In the running authenticated app:

```text
Alunos
→ Visão Operacional
→ lifecycle stage selection
→ Entradas/Matrículas
→ open existing process drawer
→ inspect factual stage/progress/blockers/action
→ execute an actually allowed canonical action where fixture state permits
→ confirm UI changes only after server success
→ reach/inspect activation
→ observe active-student handoff
→ open Student Record without second manual search
→ return to Active Students
```

Do not use manual DB edits to make the UI appear correct during the human demonstration.

- [ ] **Step 3: Prove backend/identity invariants**

Fresh automated evidence must show:

```text
activation idempotence
one Person/StudentProfile per institution context
one active-student row per person
opaque studentRef navigation
cross-tenant failure remains non-disclosing
no hidden writes from Active Students/Student Record reads
```

- [ ] **Step 4: Run the full affected regression fence**

Run all new ALUNOS-01A contracts plus existing Enrollment lifecycle/process/document/activation tests, Active Students PostgreSQL/HTTP, Student Context PostgreSQL/HTTP and opaque-ref tests, tenant/privacy/read-only tests, migration isolation through `0024`, typecheck/lint, build, secret scan, `git diff --check` and aggregate quality gate.

- [ ] **Step 5: Prepare human visual UAT matrix**

Leave the local server running and browser at the ALUNOS-01A experience. Human validates:

```text
single lifecycle clarity
existing drawer still complete
motion tied to real state
activation handoff clarity
no duplicate student
Student Record opens correctly
professional dark mode
equivalent light mode
desktop/768/390
keyboard focus
reduced-motion semantics
no fake actions/progress/data
```

- [ ] **Step 6: Set status only to READY FOR HUMAN UAT**

Update mission/state docs with fresh HEAD, automated evidence, UAT URL, deferred `ALUNOS-01B` and `ALUNOS-01C`, and any remaining visual debt. Do not mark DONE.

- [ ] **Step 7: Commit, push and stop**

```bash
git add docs/roadmap/missions/ALUNOS-01A.md docs/operations/ACTIVE_MISSION.md docs/operations/PROJECT_STATE.md
git commit -m "docs(alunos): prepare lifecycle continuity human UAT"
git push
```

Report `NEXT_AUTHORISED_ACTION=HUMAN ACCEPTANCE ONLY` and stop. Do not start Finance, ALUNOS-01B or ALUNOS-01C.

## Final acceptance

ALUNOS-01A is ready for human acceptance only when the system proves:

`CANONICAL ENROLLMENT FACT → SINGLE LIFECYCLE PRESENTATION → EXISTING PROCESS DRAWER → CANONICAL ACTIVATION → AUTHORIZED ACTIVE STUDENT → OPAQUE STUDENT RECORD`

with no duplicated identity, no internal-ID navigation, no fake progress, no client-owned authority and no regression to the approved Enrollment or Student Experience.