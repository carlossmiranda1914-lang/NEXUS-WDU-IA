# STUDENT-EXPERIENCE-02 Implementation Plan — Revised after Task 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine Active Students and Registo do Aluno into a premium, serene, backend-truthful institutional experience without manufacturing operational alerts or new domain authority.

**Architecture:** Task 1 proved `ATTENTION_RULES_ACCEPTED=NONE`. Therefore the attention-projection path is closed for this mission unless a future canonical domain contract changes. The revised path is: prove backend/frontend truth -> audit contextual owner-routing readiness -> refine the approved Student Record visually without changing authority -> harden product states/performance/accessibility -> Human UAT.

**Tech Stack:** TypeScript, React, Express, PostgreSQL, Firebase authentication, Nexus Aurora/Tailwind conventions, Node test contracts.

**Spec:** `docs/superpowers/specs/2026-08-30-student-experience-02-design.md`

## Task 1 result — frozen

`ATTENTION_RULES_ACCEPTED=NONE`

Rejected candidates remain documented in `docs/roadmap/missions/STUDENT-EXPERIENCE-02.md`. Do not reinterpret raw document/enrollment/guardian statuses, nulls, unavailable domains or missing academic context as attention.

## Global Constraints

- Product direction: premium and serene, not a cockpit.
- Normal state is quiet.
- No attention UI while `ATTENTION_RULES_ACCEPTED=NONE`.
- Student Record remains read-only: see here, resolve at the owner only when a real safe owner route exists.
- Canonical path: PostgreSQL/domain owner -> Student Context -> HTTP -> UI.
- No browser-owned tenant authority, cross-domain joins, attention heuristics or hardcoded product fixtures.
- No new schema by default. Stop before implementing any capability that requires a new authority/schema/public reference/write contract.
- No physical document lifecycle, photograph, guardian writes, Finance, Assessment, Attendance, Communication, predictive scoring or new Student aggregate.
- Preserve all accepted STUDENT-EXPERIENCE-01 visual/security/read-model behavior.
- A new tranche may improve an accepted surface but may not degrade it.

---

### Task 2: Backend/Frontend Truth & Real-Data Parity

**Files:**
- Create: `tests/student-experience-02-backend-frontend-truth.test.ts`
- Inspect: `src/modules/student-context/student-context-api.ts`
- Inspect: Student Context HTTP controller/routes
- Inspect: Active Students server read boundary
- Inspect: `src/components/StudentRecordWorkspace.tsx`
- Inspect: `src/components/EnrollmentOperationsWorkspace.tsx`
- Modify product code only if a demonstrated parity defect exists.

**Interfaces:**
- Consumes: current canonical Student Context and Active Students read models.
- Produces: evidence matrix `VISIBLE ELEMENT -> HTTP FIELD -> SERVER PROJECTION -> CANONICAL OWNER/SOURCE`, A/B real-data proof, stale-data safety proof, and a finite defect list. It does not produce attention semantics.

- [ ] **Step 1: Recover exact branch/mission authority**

Read `AGENTS.md`, `CODEX_EXECUTION_ADAPTER.md`, design spec, revised plan, mission pack, `ACTIVE_MISSION.md`, `PROJECT_STATE.md`, Student Context API/controller and Active Students boundary. Record worktree/branch/HEAD. Do not start UI changes.

- [ ] **Step 2: Write RED truth-contract tests**

Require every currently visible Student Record/Active Students data element to trace to an HTTP field and server projection. At minimum cover display name, student state, academic year, class, program/level, enrollment history, academic history, document metadata and guardian name/relationship/status. Reject fixture-only constants and browser joins/authority.

- [ ] **Step 3: Run RED and classify failures**

Run the targeted contract. Expected: either RED revealing missing traceability/fixture coupling, or PASS only if current code already satisfies the new contract. Do not manufacture a failure merely to satisfy TDD ceremony; record characterization when behavior already exists.

- [ ] **Step 4: Prove A/B replacement through canonical backend data**

Use two students with deliberately different canonical PostgreSQL data. Same endpoints and same React components must render distinct authorised data with no React/constants edit. Prove A -> B does not retain stale A data.

- [ ] **Step 5: Prove tenant/privacy/read-only boundaries**

Foreign-tenant opaque refs fail closed/non-disclosing. Assert no internal IDs, Firebase UID, membership IDs, national ID, address, storage paths or unauthorised contacts leak. Snapshot relevant writes/audit side effects around reads and prove none are introduced.

- [ ] **Step 6: Fix only demonstrated truth defects**

If any visible element is browser-derived from authority that belongs on the server, move only that derivation to the existing authorised backend boundary. No schema, no new domain, no attention projection.

- [ ] **Step 7: Run GREEN verification**

Run the new truth contract plus existing Student Context PostgreSQL/HTTP, Active Students, opaque-ref, tenant, privacy and read-only regressions; `git diff --check`.

- [ ] **Step 8: Checkpoint and STOP**

Commit only Task 2 evidence/tests and demonstrated defect fixes. Push. Report and stop before Task 3.

---

### Task 3: Contextual Owner-Routing Readiness Audit

**Files:**
- Modify: `docs/roadmap/missions/STUDENT-EXPERIENCE-02.md`
- Create: `tests/student-experience-02-owner-routing-contract.test.ts`
- Inspect: routes/controllers/public references for Enrollment, Documents, Academic, guardians and Student Record.
- Product code change expected: NO.

**Interfaces:**
- Consumes: current route/public-ref/permission architecture.
- Produces: `SECTION | OWNER | REAL OWNER USE CASE | SAFE PUBLIC REF | SAFE ROUTE | AUTHORISATION | CURRENTLY ROUTABLE? | PREREQUISITE`.

- [ ] **Step 1: Write RED governance contract**

Require the mission pack to contain the exact owner-routing matrix and an explicit ban on internal-ID routing/fake actions.

- [ ] **Step 2: Audit each existing Student Record section**

Audit Resumo, Percurso académico, Matrículas, Documentos and Encarregados. Trace actual routes/controllers/public refs and permission checks. Do not infer route safety from UI names.

- [ ] **Step 3: Classify routability**

Mark each owner as `ROUTABLE`, `READ_ONLY_NO_ACTION`, or `PREREQUISITE_REQUIRED`. A missing safe public ref or permission-safe route is a prerequisite, not permission to expose an internal identifier.

- [ ] **Step 4: Record prerequisites without implementing them**

Document exact missing capability, owner and future dependency. In particular, preserve Task 1's finding that mutable Enrollment/Document process actions do not currently have a safe Student Record -> owner process bridge.

- [ ] **Step 5: Run GREEN governance verification**

Contract PASS, `git diff --check` PASS, no product-code/schema diff.

- [ ] **Step 6: Commit/push and STOP**

No routing button is added merely because an owner exists.

---

### Task 4: Premium Serene UX Baseline Audit

**Files:**
- Create: `docs/roadmap/missions/STUDENT-EXPERIENCE-02-UX-AUDIT.md`
- Create: `tests/student-experience-02-ux-baseline-contract.test.ts`
- Inspect: `src/components/StudentRecordWorkspace.tsx`
- Inspect: `src/components/EnrollmentOperationsWorkspace.tsx`
- Inspect: Nexus Aurora/design-token sources and accepted visual regression tests.
- Product code change expected: NO.

**Interfaces:**
- Consumes: accepted STUDENT-EXPERIENCE-01 visual baseline and Nexus Aurora.
- Produces: evidence-backed visual defect/opportunity inventory, each classified `KEEP`, `REFINE`, or `REJECT` with reason and regression constraint.

- [ ] **Step 1: Capture current baseline deliberately**

Inspect desktop/tablet/mobile and light/dark for Active Students and all five Student Record sections. Use actual running UI, not JSX-only assumptions.

- [ ] **Step 2: Audit hierarchy and density**

Assess Entity Context Header, breadcrumb/back path, tabs, current-context emphasis, history lists, metadata lists, empty/partial states, typography, spacing, surfaces, badges, semantic colour, overflow and dead whitespace.

- [ ] **Step 3: Audit simplicity**

Reject card walls, duplicated current context, decorative status noise, fake success messaging, attention placeholders and unnecessary technical labels. Normal state must remain quiet.

- [ ] **Step 4: Audit accessibility and interaction**

Check heading order, keyboard tab path, visible focus, touch targets, horizontal tab behavior, colour-independent meaning and screen-reader semantics.

- [ ] **Step 5: Write the UX audit and RED/GREEN governance contract**

Every proposed refinement must identify current evidence, intended user benefit, exact surface, preserved authority and visual regression risk. No vague 'make modern' items.

- [ ] **Step 6: Commit/push and STOP**

No product UI implementation in this task.

---

### Task 5: Premium Serene Visual Refinement

**Files:**
- Modify: `src/components/StudentRecordWorkspace.tsx`
- Modify only if UX audit proves need: Active Students presentation in `src/components/EnrollmentOperationsWorkspace.tsx`
- Test: existing Student Record final-hardening/visual-regression contracts
- Create: `tests/student-experience-02-premium-serene-ui.test.ts`

**Interfaces:**
- Consumes: Task 4 `REFINE` items only.
- Produces: refined accepted UI with identical authority/data semantics.

- [ ] **Step 1: Write failing visual/product contracts for approved REFINE items**

Encode structural invariants that can be tested without brittle pixel assertions. Preserve header, five sections, one-person semantics, current/history distinction, quiet normal state and no attention UI.

- [ ] **Step 2: Implement one visual unit at a time**

Refine hierarchy, spacing, typography, surfaces, list composition, tabs and responsive layout only where Task 4 identified a concrete issue. Use existing Nexus tokens; no arbitrary palette or mechanical IAM copy.

- [ ] **Step 3: Preserve factual semantics**

No new backend status interpretation, no new button without Task 3 `ROUTABLE`, no hidden write, no fixture data, no new domain claim.

- [ ] **Step 4: Validate desktop/tablet/mobile and light/dark after each meaningful unit**

A new tranche cannot degrade an accepted surface. Compare against Task 4 baseline and existing visual-regression contracts.

- [ ] **Step 5: Accessibility check**

Keyboard/focus/touch/heading/contrast/semantic-state checks PASS.

- [ ] **Step 6: Run targeted regressions GREEN**

Student Record, Active Students if touched, opaque refs, Student Context read regressions, typecheck/lint/build and `git diff --check`.

- [ ] **Step 7: Commit/push and STOP**

Report exact visual changes and preserved semantics.

---

### Task 6: Product Hardening Gate

**Files:**
- Modify only on demonstrated defect: affected Student Experience files.
- Create if needed: `tests/student-experience-02-product-gate.test.ts`

**Interfaces:**
- Consumes: refined Student Experience.
- Produces: automated readiness evidence before Human UAT.

- [ ] **Step 1: Measure request/query behavior**

Prove bounded Student Record/Active Students reads, no N+1, no tab request storm, no polling and no browser authoritative materialisation.

- [ ] **Step 2: Prove system states**

Loading, empty, partial, retryable error, 401, 403 and 404/non-disclosure remain semantically distinct and non-crashing.

- [ ] **Step 3: Angola terminology gate**

Visible copy is simple school-administration Portuguese appropriate to Angola; internal architecture terms remain internal. Dates remain `pt-AO`.

- [ ] **Step 4: Full affected regression fence**

Run Active Students PostgreSQL/HTTP, opaque refs, Student Context current/history, Enrollment/Academic affected tests, Documents metadata, Guardians, tenant/auth/privacy/no-write, visual regression, migration isolation `0001-0024`, typecheck, lint, build, secret scan, `git diff --check` and compatible aggregate quality gate.

- [ ] **Step 5: Commit only demonstrated hardening fixes**

No churn-only commit.

---

### Task 7: Human UAT and Closeout Checkpoint

**Files:**
- Modify: `docs/roadmap/missions/STUDENT-EXPERIENCE-02.md`
- Modify: `docs/operations/ACTIVE_MISSION.md`
- Modify: `docs/operations/PROJECT_STATE.md`

**Interfaces:**
- Consumes: all automated gates GREEN.
- Produces: pushed clean checkpoint in `READY FOR HUMAN UAT`; no PR/merge before explicit human acceptance.

- [ ] **Step 1: Prepare at least two fictitious UAT students through canonical backend paths**

Their data must differ materially across current academic context/history/documents/guardians so real-data replacement is visible. Fictitious data is allowed; fake functionality is not.

- [ ] **Step 2: Complete the product path**

`Alunos & Matrículas -> Alunos ativos -> Abrir registo -> Resumo -> Percurso académico -> Matrículas -> Documentos -> Encarregados`.

- [ ] **Step 3: Human visual matrix**

Validate premium-serene normal state, clarity within seconds, no attention decoration, no fake actions, light/dark, desktop/tablet/mobile, keyboard/focus, back navigation, no internal IDs/technical terminology, no fatal console errors and no unexpected failed requests.

- [ ] **Step 4: Record evidence and stop before DONE**

Set `READY FOR HUMAN UAT`, record HEAD/gates/UAT URL/deferred prerequisites. Do not mark DONE and do not open/merge PR until explicit human acceptance.

- [ ] **Step 5: Push and verify checkpoint**

Clean worktree, remote sync, fresh applicable CI/quality evidence.

## Final acceptance

With Task 1 frozen at `ATTENTION_RULES_ACCEPTED=NONE`, this mission succeeds when it proves:

`REAL CANONICAL DATA -> AUTHORISED SERVER PROJECTION -> HTTP -> PREMIUM SERENE UI`

and documents, without faking, where future owner-routing prerequisites remain.

If a later canonical domain change creates a valid attention rule, attention requires a new explicit mission/plan amendment before implementation.