# STUDENT-EXPERIENCE-02 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine Active Students and Registo do Aluno into a premium, serene and operationally useful read experience that exposes only canonically verified attention and routes any real action to its owning domain.

**Architecture:** Preserve the existing Student Context as the single authorised server-side read boundary. First prove which current domain facts legitimately require human attention; only then add a minimal backend operational projection and render it in Active Students/Summary/owning sections without frontend heuristics or new write authority.

**Tech Stack:** TypeScript, React, Express, PostgreSQL, Firebase authentication, Nexus Aurora/Tailwind conventions, Node test contracts.

**Spec:** `docs/superpowers/specs/2026-08-30-student-experience-02-design.md`

## Global Constraints

- Product direction: premium and serene, not a cockpit.
- Normal state is quiet; factual exceptions are obvious.
- Attention requires canonical fact + explicit domain rule.
- Student Record remains read-only: see here, resolve at the owner.
- Canonical path: PostgreSQL/domain owner -> Student Context -> HTTP -> UI.
- No browser-owned tenant authority, cross-domain joins, attention heuristics or hardcoded product fixtures.
- No new schema by default. Stop before implementing any capability that requires a new authority/schema/public reference/write contract.
- No physical document lifecycle, photograph, guardian writes, Finance, Assessment, Attendance, Communication, predictive scoring or new Student aggregate.
- Preserve all accepted STUDENT-EXPERIENCE-01 visual/security/read-model behavior.

---

### Task 1: Canonical Attention Rule Inventory

**Files:**
- Create: `docs/roadmap/missions/STUDENT-EXPERIENCE-02.md`
- Test: `tests/student-experience-02-attention-rules-contract.test.ts`
- Inspect only: `src/modules/student-context/student-context-api.ts`
- Inspect only: `src/modules/enrollments/enrollment-operations-model.ts`
- Inspect only: relevant document/enrollment policy and tests

**Interfaces:**
- Consumes: current canonical enrollment/document/student-context states.
- Produces: an approved inventory with `FACT | CANONICAL OWNER | SOURCE FIELD/STATE | DOMAIN RULE | USER MEANING | OWNING SECTION | REAL ACTION AVAILABLE? | SAFE ROUTE AVAILABLE?` and a finite set of accepted attention rule codes.

- [ ] **Step 1: Recover governance and current authority**

Read `AGENTS.md`, `CODEX_EXECUTION_ADAPTER.md`, the design spec, `STUDENT-EXPERIENCE-01.md`, `ACTIVE_MISSION.md`, `PROJECT_STATE.md`, Student Context policy/API, enrollment operations model and document-state contracts. Record branch/worktree/HEAD and do not modify product code.

- [ ] **Step 2: Write the failing contract test**

Create a test that requires the new mission file to contain the three product laws, the exact inventory columns, `SCHEMA_CHANGE_EXPECTED=NO`, and an explicit statement that absence/null alone cannot create attention. It must fail before the mission file exists.

- [ ] **Step 3: Run the contract test and verify RED**

Run the targeted Node/TypeScript test command used by adjacent mission-contract tests. Expected: FAIL because `STUDENT-EXPERIENCE-02.md` is absent/incomplete.

- [ ] **Step 4: Audit candidate facts without inventing semantics**

For every candidate current fact, trace database/schema -> repository/query -> HTTP projection -> existing domain rule/test. At minimum audit enrollment lifecycle states and document metadata states. Reject any candidate whose operational meaning or owner action is not proven.

- [ ] **Step 5: Write the mission file and inventory**

Record only evidence-backed rules. Each accepted rule gets a stable semantic code and explicit owner. If no rule survives, record `ATTENTION_RULES_ACCEPTED=NONE` and stop the attention implementation path rather than fabricating behavior.

- [ ] **Step 6: Run the contract test and governance checks**

Expected: PASS. Run `git diff --check` and the relevant docs/mission contract tests.

- [ ] **Step 7: Commit**

Commit only mission/inventory/test changes with a focused message such as `docs(student-experience): define factual attention rules`.

---

### Task 2: Server-Owned Operational Projection

**Files:**
- Modify: `src/modules/student-context/student-context-api.ts`
- Modify if contract requires: Student Context HTTP/type boundary adjacent to the API
- Test: `tests/student-context-objective1-postgres-http.test.ts`
- Create: `tests/student-experience-02-operational-context.test.ts`

**Interfaces:**
- Consumes: accepted attention rule codes from Task 1 and existing `loadStudentContext(...)`.
- Produces: a safe `operational` projection whose semantics are already resolved server-side. Suggested conceptual contract: `{ attentionCount, nextUsefulFact, items }`; exact names must follow repository conventions and tests.

- [ ] **Step 1: Write PostgreSQL/HTTP RED tests for each accepted rule**

For every accepted rule, create real PostgreSQL fixtures that prove the canonical state yields the expected safe operational projection. Also prove a normal student yields zero attention and that null/absence alone does not create attention.

- [ ] **Step 2: Add A/B and tenant RED tests**

Student A and B must have different canonical facts through the same endpoint; A must never receive B's attention. A foreign-tenant opaque ref remains non-disclosing.

- [ ] **Step 3: Add privacy/read-only RED tests**

Assert the operational JSON contains no internal IDs, provider IDs, contacts, storage paths or write affordance metadata unsupported by a real owner route. Snapshot relevant tables/events before and after reads.

- [ ] **Step 4: Run targeted tests and verify RED**

Expected: failures because the `operational` projection does not yet exist.

- [ ] **Step 5: Implement minimal server-side rule evaluation**

Extend Student Context using only accepted canonical facts. Keep rule evaluation in the backend. Do not add schema, new writer, browser authority or React interpretation of raw states.

- [ ] **Step 6: Prove deterministic ordering**

If multiple accepted rules can coexist, add a backend priority/order contract based on explicit mission policy. Never sort by CSS, label text or frontend guesswork.

- [ ] **Step 7: Run PostgreSQL/HTTP/security/read-only tests GREEN**

Run targeted Student Context PostgreSQL/HTTP, A/B, tenant, privacy and no-write tests. Expected: PASS.

- [ ] **Step 8: Commit**

Commit backend projection/tests only, e.g. `feat(student-experience): project factual student attention`.

---

### Task 3: Active Students — One Quiet Operational Fact

**Files:**
- Modify: server endpoint/read model that currently supplies `ActiveStudent`
- Modify: `src/components/EnrollmentOperationsWorkspace.tsx`
- Test: existing Active Students PostgreSQL/HTTP tests
- Create: `tests/student-experience-02-active-students-attention.test.ts`

**Interfaces:**
- Consumes: server-owned operational summary from Task 2.
- Produces: `ActiveStudent` with at most one already-resolved next useful operational fact; normal rows contain no decorative attention UI.

- [ ] **Step 1: Write RED contract tests**

Assert Active Students returns one person once, current academic context and at most one server-resolved operational fact. Assert no raw document/enrollment state interpretation exists in the React component.

- [ ] **Step 2: Run RED**

Expected: FAIL because `ActiveStudent` currently contains only identity/status/current academic context.

- [ ] **Step 3: Extend the server-owned Active Students projection minimally**

Reuse the same operational semantics as Student Context; do not duplicate rule logic in a second frontend or backend implementation. If reuse would create conflicting authority, stop and refactor toward one rule evaluator rather than copy/paste.

- [ ] **Step 4: Render the quiet row state**

In `EnrollmentOperationsWorkspace.tsx`, render no attention decoration for a normal student. When a verified fact exists, render one concise secondary line/indicator using existing Nexus tokens and accessible semantics. No badge wall, risk score or multi-alert stack.

- [ ] **Step 5: Run Active Students and visual contract tests GREEN**

Prove one-person semantics, A/B data replacement, no historical duplication, no frontend fixtures and no visual regression.

- [ ] **Step 6: Commit**

Commit Active Students changes/tests only.

---

### Task 4: Student Record — Serene Summary and Contextual Detail

**Files:**
- Modify: `src/components/StudentRecordWorkspace.tsx`
- Test: `tests/student-record-final-hardening-contract.test.ts`
- Test: `tests/student-record-visual-regression-contract.test.ts`
- Create: `tests/student-experience-02-student-record-attention.test.ts`

**Interfaces:**
- Consumes: server-resolved Student Context `operational` projection.
- Produces: discreet Summary attention indication plus contextual factual treatment in the owning existing section. No Student Record writes.

- [ ] **Step 1: Write RED UI contracts**

Require: normal Summary has no decorative attention panel; verified attention produces a restrained indication; detail is present in the owning section; raw backend enums are not exposed; React does not derive attention from `documents.metadata`, null placement, guardians length or similar heuristics.

- [ ] **Step 2: Run RED**

Expected: FAIL because the current Student Record has no operational projection rendering.

- [ ] **Step 3: Implement the Summary treatment**

Add only a small, visually subordinate attention indication when `attentionCount > 0`. Preserve Entity Context Header, tabs, cards, current/history hierarchy, spacing, light/dark and responsive behavior from the accepted baseline.

- [ ] **Step 4: Implement owning-section treatment**

For each accepted rule, display the already-resolved factual meaning in its natural section. Render an action only if Task 1 proved a real owner use case and safe route. Otherwise render fact only. Do not introduce disabled/fake buttons.

- [ ] **Step 5: Refine visual composition without redesigning architecture**

Audit spacing, typography, surface hierarchy, dead whitespace, badge usage and semantic colour. Use existing Nexus tokens. Normal state must remain quiet; exception colour must be reserved for real semantics. Do not copy the IAM layout mechanically.

- [ ] **Step 6: Accessibility and interaction checks**

Verify heading hierarchy, tab names, keyboard navigation, visible focus, `role=status`/`role=alert` where semantically appropriate, touch targets and that colour is not the only attention signal.

- [ ] **Step 7: Run Student Record/visual/accessibility contracts GREEN**

Expected: PASS without weakening prior 2.1–2.6 contracts.

- [ ] **Step 8: Commit**

Commit Student Record UI/tests only.

---

### Task 5: Backend/Frontend Parity and Failure-State Proof

**Files:**
- Create: `tests/student-experience-02-backend-frontend-parity.test.ts`
- Modify only if a demonstrated defect exists: Student Context/Active Students/UI files from Tasks 2–4

**Interfaces:**
- Consumes: completed operational projection and UI.
- Produces: traceable evidence `VISIBLE ELEMENT -> HTTP FIELD -> SERVER PROJECTION -> CANONICAL OWNER/RULE` and full failure-state proof.

- [ ] **Step 1: Encode the parity matrix**

For each visible operational element, assert an HTTP field and accepted rule code exists. Fail if JSX contains independent attention heuristics or fixture-specific labels/data.

- [ ] **Step 2: Prove state transitions through backend data only**

Change Student A's canonical fixture state in PostgreSQL, call the same endpoint/component contract and prove the visible operational state changes without React/constants edits.

- [ ] **Step 3: Prove stale-data safety**

Switch A -> B and retry/error/reload paths; assert A's attention cannot remain visible for B.

- [ ] **Step 4: Prove empty/partial/error distinctions**

Cover loading, no attention, missing optional domain data, 401, 403, 404/non-disclosure and infrastructure failure/retry. No crash and no error rendered as success/empty.

- [ ] **Step 5: Run parity/state suite GREEN**

Expected: PASS.

- [ ] **Step 6: Commit**

Commit evidence/tests and only defect fixes demonstrated by the suite.

---

### Task 6: Performance, Responsive, Theme and Angola Product Gate

**Files:**
- Modify only on demonstrated defect: `src/components/StudentRecordWorkspace.tsx`, `src/components/EnrollmentOperationsWorkspace.tsx`, Student Context read path
- Test: existing performance/visual/responsive contracts
- Create if needed: `tests/student-experience-02-product-gate.test.ts`

**Interfaces:**
- Consumes: completed Student Experience 02.
- Produces: final automated readiness evidence before Human UAT.

- [ ] **Step 1: Measure request/query behavior**

Record request count opening Active Students/Student Record and switching tabs. Prove bounded query shape, no N+1, no tab request storm, no polling and no browser authoritative materialisation.

- [ ] **Step 2: Validate responsive behavior**

Exercise desktop, tablet and mobile widths. Check Entity Context Header, horizontal tabs, lists, attention treatment, overflow, touch targets and back navigation. Fix only demonstrated regressions.

- [ ] **Step 3: Validate light/dark**

Check identical semantic hierarchy, contrast, surfaces, attention treatment, hover/focus and no new arbitrary palette.

- [ ] **Step 4: Run Angola terminology scan**

Search visible runtime strings for technical naming and inappropriate locale remnants. Preserve code naming where internal; correct only visible product copy. Dates remain `pt-AO`.

- [ ] **Step 5: Run full affected regression fence**

Run Active Students PostgreSQL/HTTP, opaque refs, Student Context current/history, Enrollment/Academic affected tests, Documents metadata, Guardians, tenant/auth/privacy/no-write, visual regression, migration isolation `0001–0024`, typecheck, lint, build, secret scan, `git diff --check` and compatible aggregate quality gate.

- [ ] **Step 6: Commit final technical hardening**

Only if code/tests changed. Do not create churn-only commits.

---

### Task 7: Human UAT and Mission Closeout Checkpoint

**Files:**
- Modify: `docs/roadmap/missions/STUDENT-EXPERIENCE-02.md`
- Modify: `docs/operations/ACTIVE_MISSION.md`
- Modify: `docs/operations/PROJECT_STATE.md`

**Interfaces:**
- Consumes: all automated gates GREEN.
- Produces: a pushed clean checkpoint in `READY FOR HUMAN UAT`; no PR/merge without subsequent human acceptance.

- [ ] **Step 1: Prepare real UAT data through canonical backend paths**

Use at least one quiet student and one student with an accepted factual exception. No frontend fixtures.

- [ ] **Step 2: Run the portal and complete the product path**

`Alunos & Matrículas -> Alunos ativos -> Abrir registo -> Resumo -> Percurso académico -> Matrículas -> Documentos -> Encarregados`.

- [ ] **Step 3: Human-visible UAT matrix**

Validate quiet normal state, factual exception discoverability, owning-section detail, action absence/presence according to real owner capability, light/dark, desktop/tablet/mobile, keyboard/focus, back navigation, no internal IDs, no technical terminology, no fatal console errors and no unexpected failed requests.

- [ ] **Step 4: Record evidence and stop before DONE**

Set mission status to `READY FOR HUMAN UAT`, record HEAD/gates/UAT URL/known deferred capabilities. Do not mark DONE and do not open/merge PR until the human explicitly accepts.

- [ ] **Step 5: Push and verify checkpoint**

Confirm clean worktree, remote sync and fresh CI/quality evidence applicable to the branch.

## Final acceptance

The implementation is ready for Human UAT only when it proves:

`REAL CANONICAL FACT -> EXPLICIT DOMAIN RULE -> SERVER OPERATIONAL PROJECTION -> HTTP -> SERENE UI`

with one quiet normal state, obvious factual exceptions, no frontend authority, no fake actions, no cross-tenant leakage, no excessive PII, no hidden writes, no visual regression and no scope expansion into deferred domains.