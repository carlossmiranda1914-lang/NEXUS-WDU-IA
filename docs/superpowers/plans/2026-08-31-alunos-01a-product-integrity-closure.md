# ALUNOS-01A.3 Product Integrity & Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the supported Enrollment → Student journey product-complete and integrity-safe without changing domain ownership.

**Architecture:** Preserve all canonical server authorities and fix only the continuity/integrity gaps between them. Close unsafe post-activation transitions first, then stale async state, then expose the existing activation authority, harden Journey partial failure, finish identity-review continuity, and end with an adversarial product gate plus real UAT.

**Tech Stack:** React/TypeScript, Express, PostgreSQL, existing Enrollment/Student Context APIs, repository TDD/quality scripts.

**Spec:** `docs/superpowers/specs/2026-08-31-alunos-01a-product-integrity-closure-design.md`

## Global Constraints

- Preserve canonical Enrollment, document, activation, Active Students and Student Record authorities.
- No schema change unless a stop-rule review proves it unavoidable.
- No physical document storage/upload.
- No generic post-activation Student write subsystem.
- No browser-owned tenant/person authority or internal-ID navigation.
- Existing tests are evidence, not proof of PRODUCT_GREEN.
- Each task requires a fresh implementer and independent reviewer.

---

### Task 1: Post-Activation Integrity

**Files:**
- Modify: `src/modules/enrollments/enrollment-policy.ts`
- Modify only if required by affected contract: Enrollment workflow/action policy files that mirror the transition graph
- Test: `tests/alunos-01a3-post-activation-integrity.test.ts`

**Interfaces:**
- Consumes: existing Enrollment status transition policy.
- Produces: no generic `active -> cancelled` path; post-activation mutation remains outside this mission.

- [ ] Write a failing contract proving generic operational transitions cannot move an active Enrollment to cancelled while leaving StudentProfile authority untouched.
- [ ] Run the focused test and confirm RED against the current transition graph.
- [ ] Remove only the unsafe generic `active -> cancelled` transition and reconcile any mirrored UI/action policy.
- [ ] Prove active Enrollment remains immutable through generic lifecycle actions; do not create a StudentProfile deactivation command.
- [ ] Run Enrollment policy, activation, Active Students and Student Context affected regressions to GREEN.
- [ ] Independent reviewer verifies no legitimate pre-activation cancellation path was removed.
- [ ] Commit Task 1 and record the checkpoint/ruling in the SDD ledger.

### Task 2: Async and Stale-State Safety

**Files:**
- Modify: `src/components/StudentRecordWorkspace.tsx`
- Modify: `src/components/EnrollmentOperationsWorkspace.tsx`
- Modify other read clients only if direct evidence shows the same defect on the changed path
- Test: `tests/alunos-01a3-stale-state-contract.test.ts`

**Interfaces:**
- Consumes: current authenticated fetch/read behavior.
- Produces: latest-request-wins authoritative rendering; stale content cannot remain actionable after ref/context change or failed refresh.

- [ ] Write RED cases for Student A → Student B switch where B fails, and for late A response arriving after B.
- [ ] Write RED for an Enrollment refresh failure leaving stale action-enabled process truth visible.
- [ ] Implement request sequencing/abort semantics consistent with the codebase; clear or quarantine old authoritative content while a new identity/process is unresolved.
- [ ] Make error and authoritative content mutually coherent; actions must not remain enabled from stale state.
- [ ] Prove server-confirmed writes still refresh rather than advancing canonical state optimistically.
- [ ] Run Student Record, Enrollment workspace, privacy and no-write regressions to GREEN.
- [ ] Independent reviewer attempts stale/late-response races and verifies no cross-student rendering.
- [ ] Commit Task 2 and update ledger.

### Task 3: Authorized Activation Continuity

**Files:**
- Modify: `src/components/EnrollmentLifecycleActions.tsx`
- Modify: `src/components/EnrollmentOperationsWorkspace.tsx`
- Reuse existing activation client/controller; create a focused client helper only if current UI has no reusable boundary
- Test: `tests/alunos-01a3-activation-product-continuity.test.ts`

**Interfaces:**
- Consumes: existing canonical activation API, role/context returned by server, lifecycle version/idempotency contract.
- Produces: authorized Administration/Direção product action and opaque `studentRef` handoff after server success.

- [ ] Write RED proving `validated` Enrollment has a reachable activation action for authorized leadership and no activation action for secretariat.
- [ ] Prove the UI does not independently calculate eligibility beyond rendering server-provided state/permissions.
- [ ] Invoke the existing activation command with required version/idempotency fields and wait for server confirmation.
- [ ] On success, refresh Enrollment/Active Students and expose `Abrir Registo do Aluno` using only returned opaque `studentRef`.
- [ ] Prove retry/idempotency yields one active student and the same safe handoff.
- [ ] Prove unauthorized roles fail closed and no internal identifiers are rendered.
- [ ] Run activation PostgreSQL/HTTP, Active Students, Student Context and UI contracts to GREEN.
- [ ] Independent reviewer validates the real role boundary and handoff path.
- [ ] Commit Task 3 and update ledger.

### Task 4: Journey Partial-Failure Resilience

**Files:**
- Modify: `src/components/EnrollmentOperationsWorkspace.tsx`
- Modify: `src/modules/enrollments/enrollment-lifecycle-presentation.ts` only if the presentation contract needs explicit unresolved-process input
- Test: `tests/alunos-01a3-journey-partial-failure.test.ts`

**Interfaces:**
- Consumes: per-Enrollment server process projections.
- Produces: Journey based on fulfilled projections plus explicit unresolved-process warning/retry; no inferred stage for failures.

- [ ] Write RED proving one rejected `/process` request does not erase all fulfilled Journey data.
- [ ] Implement partial composition: keep fulfilled projections, track unresolved Enrollment refs separately, and present bounded warning state.
- [ ] Ensure counts/selection include only confirmed server process facts; never infer failed process stages from broad status heuristics.
- [ ] Add retry/reload path that can recover unresolved projections without duplicating records.
- [ ] Prove all-failure still fails safely and clearly.
- [ ] Run Journey Rail, drawer, responsive and process-projection regressions to GREEN.
- [ ] Independent reviewer injects one/many failures and checks the Journey remains truthful.
- [ ] Commit Task 4 and update ledger.

### Task 5: Identity Review Continuity

**Files:**
- Modify: `src/components/EnrollmentNewEntryDrawer.tsx`
- Reuse existing identity-resolution backend/client boundaries
- Modify backend/controller only if audit proves an existing safe adjudication authority is present but not exposed
- Test: `tests/alunos-01a3-identity-review-continuity.test.ts`

**Interfaces:**
- Consumes: canonical identity-resolution outcomes and existing safe adjudication authority, if present.
- Produces: a reachable human review outcome for ambiguous/restricted cases without exposing candidate internal identities.

- [ ] Characterize every current resolution status and map which already has a legitimate server-side next action.
- [ ] Write RED for ambiguous/restricted cases that currently end at `Confirmação adicional necessária` with no usable next step.
- [ ] If a safe existing adjudication command exists, expose the minimum role-gated review action and return to Enrollment after server confirmation.
- [ ] Prove candidate internal IDs/protected details never enter the browser decision contract.
- [ ] If any required outcome has no canonical adjudication command, STOP Task 5 with `GENUINE_PREREQUISITE_BLOCKER` naming the missing authority; do not fabricate client choice.
- [ ] Run identity/intake/tenant/privacy regressions and independent review.
- [ ] Commit Task 5 only when a safe product path is proven; otherwise record the blocker in ledger without fake completion.

### Task 6: Adversarial Product Gate and Real UAT

**Files:**
- Update: `docs/roadmap/missions/ALUNOS-01A.3.md`
- Update parent/state docs only after factual validation
- Reuse existing UAT/bootstrap/regression infrastructure

**Interfaces:**
- Consumes: Tasks 1–5 and all protected ALUNOS-01A work.
- Produces: adjudicated engineering/integrity/product evidence and portal ready for human acceptance.

- [ ] Run fresh affected PostgreSQL/HTTP/UI regressions plus lint, build, secret scan, `git diff --check` and canonical quality gate with authorized local DB configuration.
- [ ] Execute the real role-correct portal path: new/existing entry → preparation → documents → verification → decision → authorized activation → exactly one Active Student → Student Record.
- [ ] Exercise refresh/relogin, stale/late response, one-process failure, idempotent activation and cross-tenant negative cases.
- [ ] Validate no supported step requires SQL, scripts, devtools or manual identity guessing.
- [ ] Dispatch a fresh adversarial reviewer whose task is to disprove PRODUCT_GREEN by finding dead ends, authority/UI gaps, contradictory states, stale truth, duplicate outcomes or hidden prerequisites.
- [ ] Adjudicate every P0/P1 finding; PRODUCT_GREEN may be YES only when no unresolved P0/P1 blocks the supported journey.
- [ ] Inspect desktop, 768px, 390px, dark/light, keyboard and reduced motion where available; do not claim unobserved states.
- [ ] Update evidence with four separate statuses: `ENGINEERING_GREEN`, `INTEGRITY_GREEN`, `PRODUCT_GREEN`, `HUMAN_UAT_GREEN=PENDING`.
- [ ] Stop at `READY_FOR_HUMAN_UAT`; do not mark mission DONE or merge.

## SDD Execution Rule

Use a fresh implementer subagent for every task, followed by independent review. Keep a plan-specific ignored SDD ledger and trust it over conversation memory. Do not re-dispatch completed tasks. Ordinary defects are fixed continuously; stop only for the spec stop rules, destructive/security-sensitive actions, shared-branch side effects, or a genuine missing authority that would otherwise require invented behavior.

## Completion Gate

The plan is not complete because tests are green. It is complete only when Task 6 can truthfully report:

```text
ENGINEERING_GREEN=YES
INTEGRITY_GREEN=YES
PRODUCT_GREEN=YES
ADVERSARIAL_REVIEW=PASS
HUMAN_UAT_GREEN=PENDING
MISSION_GATE=READY_FOR_HUMAN_UAT
```
