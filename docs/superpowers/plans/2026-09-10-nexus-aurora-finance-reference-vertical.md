# Nexus Aurora + Finance Reference Vertical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the reusable Nexus Aurora product-surface foundation and make Finance the first real Reference Vertical while preserving authoritative Finance/BPM behavior and closing INSTITUTIONAL-READINESS-01 through real UAT.

**Architecture:** Aurora is a progressive presentation architecture layered below domain/security/BPM truth. Implementation begins with repository reconciliation and Surface Contracts, then introduces semantic tokens/primitives only where required by the Finance reference surfaces. Finance readiness, receipt eligibility, capabilities, issuance, persistence, and evidence remain server-authoritative; visual work must not create parallel business truth.

**Tech Stack:** TypeScript, React, existing CSS/Tailwind stack as repository-fit confirms, Express, PostgreSQL, Firebase identity, existing Finance services/tests, Node/tsx test runners.

**Spec:** `docs/superpowers/specs/2026-09-10-nexus-aurora-product-surface-architecture-design.md`

## Global Constraints

- `CLAREZA ANTES DE DECORAÇÃO`.
- Product path: `Contexto → Ação → Validação → Evidência → Resultado`.
- `BROWSER_AUTHORITY=NO`.
- Domain/security/BPM truth outranks Aurora presentation.
- No new Finance authority, readiness flag, jurisdiction rule, or synthetic production compliance path.
- No schema change is authorized by this plan. If a migration becomes necessary, STOP because migration adjudication is a separate P0 decision.
- No full frontend rewrite. Apply Aurora progressively to new/touched surfaces and reusable primitives needed by the reference vertical.
- Do not alter Documents ownership/boundaries.
- Do not hide or weaken legitimate unsupported-jurisdiction states.
- No success before authoritative confirmation.
- Use semantic tokens; do not scatter new brand hex values through components.
- Accessibility, keyboard focus, Light/Dark/Tonal/System behavior, and responsive use are product requirements.
- Automated tests prove deterministic contracts; Human UAT judges hierarchy, clarity, density, comfort, professional quality, and flow comprehension.
- Work by closed objective, not micro-patches. Ordinary test/build/runtime failures are operational work, not Product Owner blockers.

---

## Task 1: Reconcile Current Branch, Authorities, and Existing INSTITUTIONAL-READINESS-01 Work

**Files:**
- Read: current Finance implementation worktree/branch and latest published checkpoint.
- Read: `docs/superpowers/specs/2026-09-10-institutional-readiness-finance-guided-configuration-design.md`
- Read: `docs/superpowers/plans/2026-09-10-institutional-readiness-finance-guided-configuration.md`
- Read: `docs/superpowers/specs/2026-09-10-nexus-aurora-product-surface-architecture-design.md`
- Read: current Finance workspace, readiness, eligibility, document service, fiscal adapter registry/configuration, HTTP/client, and UAT preflight files.
- Create/Modify: no production file until reconciliation is complete.

**Interfaces:**
- Consumes: current Finance checkpoint and both approved specs.
- Produces: exact authority map, exact file manifest, current open defects, baseline gate evidence, and no-schema confirmation.

- [ ] **Step 1: Lock execution identity**

Run:
```bash
git status --short
git branch --show-current
git rev-parse HEAD
git log -1 --oneline
```
Expected: isolated implementation worktree; record exact SHA. Do not implement on `main`.

- [ ] **Step 2: Reconcile current code rather than trusting historical reports**

Locate and inspect the actual implementations for:
```text
finance readiness
receipt/payment eligibility or preflight
financial-document issue command/service
fiscal adapter registry
fiscal configuration HTTP command
receipt series authority
FinanceWorkspace
FinancePaymentsWorkspace
FinanceConfigurationWorkspace
FinancialDocumentsWorkspace
runtime UAT preflight
```
Expected: a one-page execution note identifying which previously reported defects are still present at the current SHA.

- [ ] **Step 3: Explicitly prove the authority topology**

Record:
```text
MODULE_READINESS_AUTHORITY=
RECEIPT_READINESS_AUTHORITY=
PAYMENT_ELIGIBILITY_AUTHORITY=
ISSUANCE_VALIDATION_AUTHORITY=
ADAPTER_REGISTRY_AUTHORITY=
FISCAL_CONFIG_WRITE_AUTHORITY=
SERIES_NUMBERING_AUTHORITY=
DOCUMENT_EVIDENCE_AUTHORITY=
```
If preflight/readiness and transactional issuance still encode duplicated business eligibility rules, classify it as an in-scope architectural defect and fix it before Aurora visual migration.

- [ ] **Step 4: Baseline verification**

Resolve exact scripts from `package.json`, then run at minimum the current targeted INSTITUTIONAL-READINESS/F7-06 chain, lint, and build.
Expected: establish baseline. A pre-existing unrelated failure is classified; do not silently normalize it.

- [ ] **Step 5: Confirm migration boundary**

No migration is planned. If schema work becomes necessary, return:
```text
REAL_BLOCKER=MIGRATION_AUTHORITY_CHANGE_REQUIRED
WHY=
```
and stop before creating/renumbering a migration.

---

## Task 2: Close Operational Truth Before Visual Migration

**Files:**
- Modify only the exact Finance authority/eligibility/adapter files proven necessary by Task 1.
- Test: existing Finance eligibility/preflight/issuance tests; add focused regression tests beside current canonical suites.

**Interfaces:**
- Consumes: current Payment, Financial Profile, Fiscal Configuration, adapter registry, document series, capability, and document issuance authorities.
- Produces: one canonical documentary validation boundary used by non-mutating preflight and transactional issue, with transactional locking/mutation layered around rather than duplicated business rules.

- [ ] **Step 1: Write/confirm RED tests for any still-open authority defect**

Required contracts when applicable:
```text
preflight and issue return the same canonical eligibility reason for the same immutable snapshot
unknown/unapproved adapter fails closed
synthetic UAT adapter cannot be enabled through normal production-facing configuration
preflight allocates no number and mutates no Finance business state
issue revalidates under required transaction/locks before mutation
Payment/series locking and atomic numbering remain intact
safe public reason codes do not expose raw internal errors
```
Expected: any confirmed current defect has a failing regression test before production change.

- [ ] **Step 2: Run RED**

Run the smallest exact test command(s) for the defect.
Expected: FAIL for the intended reason, not environment noise.

- [ ] **Step 3: Implement the minimal canonical boundary**

Requirements:
```text
one business eligibility rule source
one trusted server adapter registry dependency
production registry contains only approved production adapters
test/UAT synthetic adapter is injected explicitly by test/UAT composition
browser adapter strings never become authority merely because they were posted
issue command adds transaction/lock/mutation semantics without copying eligibility rules
```
Do not invent a production jurisdiction adapter.

- [ ] **Step 4: Run GREEN + Finance regressions**

Run the focused tests, current F7-06/readiness suites, then broader F7/F6 regression chain as available.
Expected: PASS with numbering/idempotency/history invariants preserved.

- [ ] **Step 5: Commit the operational-truth closure**

Commit only the focused authority correction before any Aurora visual work.

---

## Task 3: Materialize the Nexus Surface Contracts for Finance

**Files:**
- Create: `docs/product/surfaces/finance-reference-vertical-v1.md` (or repository-fit equivalent under existing product docs).
- Modify production files: none.

**Interfaces:**
- Consumes: approved Aurora spec + current authoritative Finance behavior.
- Produces: explicit contracts for each material Finance surface consumed by later UI tasks.

- [ ] **Step 1: Define Finance Workspace contract**

Record exact values for:
```text
SURFACE=FinanceWorkspace
USER_ROLE=<authorized Finance/institution roles from current policy>
JOB_TO_BE_DONE=orient within Finance and reach the correct operational surface
DOMINANT_OPERATIONAL_MOMENT=current Finance work, not navigation chrome
AURORA_PATTERN=Operational Workspace
```
Include server capabilities and responsive/navigation constraints.

- [ ] **Step 2: Define Operational Overview contract**

For `Situação Financeira`, specify which current authoritative data drives attention/work/evidence. Do not invent KPIs that current backend does not support.

- [ ] **Step 3: Define Operational Collection contracts**

Cover `Obrigações Financeiras`, `Recebimentos`, and `Documentos Financeiros`. For Recebimentos explicitly distinguish institution-level blockers from payment-specific eligibility.

- [ ] **Step 4: Define Guided Configuration contract**

Cover Financial Profile/Fiscal Configuration/Series/readiness states using the actual current server projections. Unsupported production jurisdiction must remain an honest blocked/unavailable state with no fake remediation action.

- [ ] **Step 5: Define evidence and UAT contract**

For the supported UAT path, specify what server/Persistence evidence proves a result. For unsupported production jurisdiction, specify the expected legitimate blocked state rather than demanding impossible issuance.

- [ ] **Step 6: Commit documentation**

Commit the Surface Contract independently so later UI review has a stable target.

---

## Task 4: Establish Aurora Tokens and Theme Aliases Needed by Finance

**Files:**
- Repository-fit first: locate existing global CSS/theme/token files and theme switcher.
- Modify/Create only the minimal canonical token/theme files proven by repository fit.
- Test: create or extend a focused Aurora token/theme contract test using the project's established test style.

**Interfaces:**
- Consumes: approved palette/modes from Aurora spec.
- Produces: semantic token aliases for Light, Dark, Tonal Nexus, and System resolution without embedding Finance rules.

- [ ] **Step 1: Write RED token contract**

Assert the canonical semantic families needed by the reference vertical exist:
```text
surface.canvas
surface.raised
surface.workspace
text.primary
text.secondary
border.default
action.primary
state.info
state.success
state.warning
state.danger
focus.ring
```
Also prove theme aliases exist for Light/Dark/Tonal and System resolves to Light/Dark behavior rather than a fourth unrelated palette.

- [ ] **Step 2: Run RED**

Run the focused token/theme test.
Expected: FAIL only for missing Aurora contract.

- [ ] **Step 3: Implement semantic tokens**

Use approved primitives:
```text
brand.void=#031D18
brand.deep=#064C3C
action.primary=#0B8B62
accent.vivid=#28C76F
accent.lime=#9BEA4A
surface.canvas=#F5FAF7
surface.raised=#FFFFFF
surface.mint=#DDF9E8
text.primary=#102E27
border.default=#D8E8E0
ai.primary=#00A6A6
info=#3478E5
success=#15803D
warning=#F2A93B
danger=#E65362
```
Physical values live in the token authority, not scattered through Finance components.

- [ ] **Step 4: Preserve existing user theme behavior**

Integrate with the current theme mechanism rather than creating a parallel theme engine. Add Tonal only through the approved alias model. Preserve device-follow behavior.

- [ ] **Step 5: Run GREEN + build**

Run token/theme tests, lint, build.
Expected: PASS with no Finance behavior change.

- [ ] **Step 6: Commit token foundation**

Commit separately from surface migration.

---

## Task 5: Implement Minimal Reusable Aurora Primitives Required by Finance

**Files:**
- Repository-fit determines exact component paths/names.
- Create/modify only primitives actually consumed by Tasks 6–8.
- Test: focused component contract tests.

**Interfaces:**
- Consumes: semantic tokens.
- Produces: domain-neutral primitives/compositions for workspace shell, page header, state notice, empty state, evidence, and dense collection needs actually proven by Finance.

- [ ] **Step 1: Inventory before creation**

Search existing shared components for button/input/select/modal/table/state/empty patterns. Reuse or adapt where compatible. Do not create `NexusButton` merely because the spec listed it as a candidate.

- [ ] **Step 2: Write RED tests only for missing reusable contracts**

At minimum prove:
```text
state notice communicates icon/text/context, not color alone
blocked state can render explanation without an action
confirmed evidence exposes content only after confirmed input state
keyboard focus remains visible
components consume semantic classes/tokens rather than new local brand hex values
```

- [ ] **Step 3: Implement minimal primitives**

Keep them domain-neutral. No Finance eligibility/readiness logic inside Aurora components.

- [ ] **Step 4: Run GREEN + accessibility-focused checks available in repo**

Run focused tests, lint, build.

- [ ] **Step 5: Commit reusable primitives**

Commit before migrating Finance surfaces.

---

## Task 6: Convert Finance Navigation into Aurora Operational Workspace

**Files:**
- Modify: current `FinanceWorkspace` implementation and only its directly related presentation files.
- Test: extend current Finance workspace UI tests or add focused Aurora Finance navigation tests.

**Interfaces:**
- Consumes: Finance Workspace Surface Contract + Aurora tokens/primitives.
- Produces: compact hierarchical Finance navigation with work area as visual center of gravity.

- [ ] **Step 1: Write RED UX contract tests**

Prove:
```text
Visão Geral / Operação / Configuração are represented as hierarchy, not peer tabs
current destination is explicit
no primary horizontal-scroll navigation dependency
work content remains the dominant region
existing authorized destinations remain reachable
mobile/tablet transformation preserves destination hierarchy
```

- [ ] **Step 2: Run RED**

Expected: current rejected navigation fails at least the hierarchy/no-horizontal-scroll contract.

- [ ] **Step 3: Implement Operational Workspace composition**

Preserve the approved information architecture:
```text
Visão Geral
  Situação Financeira
Operação
  Obrigações Financeiras
  Recebimentos
  Documentos Financeiros
Configuração
  Catálogo de Emolumentos
  Configuração Financeira
```
Do not add fictitious future modules. Navigation occupies little; work occupies much.

- [ ] **Step 4: Verify responsive and keyboard behavior**

Test desktop, non-maximized desktop/tablet width, and mobile width. Essential destinations must not depend on hover.

- [ ] **Step 5: Run GREEN + Finance regressions**

Run focused UI tests, readiness/client tests, lint, build.

- [ ] **Step 6: Commit workspace migration**

Commit independently.

---

## Task 7: Convert Recebimentos into an Authoritative Operational Collection

**Files:**
- Modify: current `FinancePaymentsWorkspace` and related safe client/projection presentation only.
- Test: extend current payment/eligibility UI tests.

**Interfaces:**
- Consumes: module readiness, receipt issuance readiness, payment-specific eligibility/preflight, server capabilities, current Payment projection.
- Produces: dense operational collection where institutional blockers appear once and record-specific blockers/actions remain record-specific.

- [ ] **Step 1: Write RED state tests**

Required cases:
```text
institution-level unsupported adapter -> one contextual notice, not repeated on every payment
payment-specific ineligible state -> reason appears on affected record
issue action appears only when capability + receipt readiness + payment eligibility are positive
no raw "server validation" language when safe domain reason exists
processing does not show confirmed evidence
successful issue refreshes authoritative data/evidence
422 safe reason preserves specific domain meaning rather than generic collapse
```

- [ ] **Step 2: Run RED**

Expected: rejected/current UI fails at least repetition/human-language/evidence contracts where still present.

- [ ] **Step 3: Implement Operational Collection hierarchy**

Use one contextual module/institution notice, prioritized attention only where meaningful, then the dense payment collection. Do not manufacture dashboard metrics.

- [ ] **Step 4: Implement action/evidence truth**

Button visibility follows server-derived capability/readiness/eligibility. Issue command still revalidates server-side. After success, show authoritative Financial Document evidence from refreshed server state rather than locally synthesized success.

- [ ] **Step 5: Run GREEN + transactional regressions**

Run UI tests plus canonical issuance/idempotency/numbering tests and lint/build.

- [ ] **Step 6: Commit Recebimentos migration**

Commit independently.

---

## Task 8: Convert Finance Configuration and Documents to Guided Configuration + Evidence Patterns

**Files:**
- Modify: current Finance configuration workspace.
- Modify: current Financial Documents workspace only as required by its Surface Contract.
- Test: extend guided-configuration and financial-document UI tests.

**Interfaces:**
- Consumes: authoritative readiness requirements, safe server capabilities/reasons, effective config/series projections, financial-document list/artifact projection.
- Produces: guided institutional setup plus documentary evidence surfaces without synthetic production configuration.

- [ ] **Step 1: Write RED Guided Configuration tests**

Prove:
```text
shows what is complete, missing, or blocked
explains why the next requirement matters
shows a mutation only when user capability + legitimate server-supported remediation exist
unsupported production jurisdiction exposes no synthetic core/NEXUS_TEST configuration path
successful mutation refreshes readiness from backend; UI never flips READY locally
error includes safe reason + legitimate retry/next step
```

- [ ] **Step 2: Write RED Financial Documents evidence tests**

Prove:
```text
empty state explains what belongs here without inventing data
authorized issued document exposes permitted evidence/artifact action
blocked/permission/error states remain explicit
no renderer/client recalculates documentary truth
```

- [ ] **Step 3: Run RED**

Run both focused suites.

- [ ] **Step 4: Implement Guided Configuration and Evidence patterns**

Use Aurora hierarchy/tokens without changing Finance command semantics. Configuration is progressive and task-oriented; Documents remains a projection of Finance authority.

- [ ] **Step 5: Run GREEN + regressions**

Run focused suites, F7 document regressions, readiness tests, lint, build.

- [ ] **Step 6: Commit configuration/documents migration**

Commit independently.

---

## Task 9: Reconcile Situação Financeira, Obrigações, and Catálogo Without Inventing Product Truth

**Files:**
- Modify only current Finance overview/obligations/catalog presentation files proven by Surface Contracts.
- Test: focused existing/new UI contracts.

**Interfaces:**
- Consumes: existing authoritative projections only.
- Produces: coherent Aurora reference vertical across remaining Finance destinations.

- [ ] **Step 1: Define RED contracts from existing truth**

For each surface, prove the primary job, current state, filters/actions, and empty/error behavior. Do not add metrics, charts, or actions without an existing authoritative source and operational purpose.

- [ ] **Step 2: Run RED**

Expected: fail only on the intended Aurora/flow contract.

- [ ] **Step 3: Migrate presentation progressively**

Apply Operational Overview/Collection/Configuration Collection as appropriate. Preserve current business behavior.

- [ ] **Step 4: Run GREEN + broad Finance UI regression**

Run focused suites, lint, build.

- [ ] **Step 5: Commit remaining reference surfaces**

Commit independently.

---

## Task 10: Real End-to-End UAT and INSTITUTIONAL-READINESS-01 Closure

**Files:**
- Modify product code only if UAT exposes an in-scope defect; each defect requires root-cause analysis and a failing regression test before correction.
- Update/create UAT evidence documentation only in approved repository evidence locations.

**Interfaces:**
- Consumes: completed Tasks 1–9 and canonical localhost runtime/preflight.
- Produces: final four-gate human/product evidence and a clear close/no-close decision.

- [ ] **Step 1: Run full machine preflight**

Verify:
```text
runtime SHA == current published SHA
canonical origin == http://localhost:3000
test database safety == PASS
migrations required by current branch == PASS
Firebase localhost authorization evidence remains valid unless browser proves otherwise
worktree/remote parity == expected
```
Do not reopen already-proven Firebase localhost configuration absent new contradictory evidence.

- [ ] **Step 2: Run regression closure before browser UAT**

Run current canonical Finance F7/F6/F5/F4/F3/readiness/eligibility/issuance suites as applicable, foundation regressions required by changed boundaries, lint, build, and secret/diff gates.

- [ ] **Step 3: Human UAT — orientation and responsive behavior**

At desktop, non-maximized/tablet-like width, and mobile width verify:
```text
location obvious in <5 seconds
navigation hierarchy understandable
no primary horizontal-scroll navigation
work dominates chrome
keyboard focus visible
Light and Dark coherent
Tonal Nexus coherent if exposed by current theme selector
```

- [ ] **Step 4: Human UAT — Finance truth and flow**

Verify the real current institution state:
```text
Situação Financeira reflects authoritative data
Recebimentos shows confirmed payments
institution-level documentary blocker appears once if applicable
payment-specific eligibility is distinguishable
no issue button exists when authoritative conditions are negative
configuration explains exact legitimate next requirement
Documents empty/issued state matches server truth
```

If the environment has an explicitly authorized synthetic UAT adapter path, test issue only through that isolated UAT composition. Do not enable synthetic authority in production-facing configuration merely to obtain a green UAT.

- [ ] **Step 5: Human UAT — supported issue path when legitimately available**

When a legitimate supported UAT/production adapter context exists, prove:
```text
confirmed Payment
→ eligible preflight
→ issue command
→ server confirmation
→ Financial Document persisted
→ number allocated atomically
→ private PDF/artifact available
→ refreshed UI evidence matches persisted document
```
If no legitimate adapter is available, this path is `NOT_APPLICABLE_DUE_TO_EVIDENCED_PRODUCT_BOUNDARY`, not a fake PASS; the blocked state itself must pass Product Truth UAT.

- [ ] **Step 6: Classify UAT findings before changing code**

For every finding record:
```text
DOMAIN_DEFECT
OPERATIONAL_FLOW_DEFECT
AURORA_UX_DEFECT
PERSISTENCE_EVIDENCE_DEFECT
OUT_OF_SCOPE_DEBT
```
Do not convert cosmetic preference into domain work or hide domain defects as UX polish.

- [ ] **Step 7: Final closure report**

Return:
```text
INSTITUTIONAL_READINESS_01=PASS|FAIL
AURORA_FINANCE_REFERENCE_VERTICAL=PASS|FAIL
DOMAIN_TRUTH=PASS|FAIL
OPERATIONAL_FLOW=PASS|FAIL
AURORA_EXPERIENCE=PASS|FAIL
PERSISTENCE_EVIDENCE=PASS|FAIL
TENANT_ISOLATION=PASS|FAIL
AUTHORIZATION=PASS|FAIL
RESPONSIVE=PASS|FAIL
ACCESSIBILITY=PASS|FAIL
REGRESSION=PASS|FAIL
MIGRATION_ADJUDICATION_STATUS=<separate P0 status>
INSTITUTIONAL_SEARCH_PRODUCT_TRUTH_STATUS=<separate debt status>
FINAL_SHA=
REMOTE_PARITY=
WORKTREE_CLEAN=
```
Do not declare PASS if Human UAT has not occurred.

---

## Plan Self-Review

### Spec coverage

- Authority hierarchy / browser non-authority: Tasks 1–2, 7–10.
- Surface Contract: Task 3.
- Semantic tokens/themes: Task 4.
- Reusable primitives: Task 5.
- Operational Workspace: Task 6.
- Operational Collection / Attention / Blocked / Evidence: Task 7.
- Guided Configuration / Financial Document evidence: Task 8.
- Overview and remaining Finance surfaces: Task 9.
- Accessibility/responsive/theme/UAT: Tasks 4–10.
- Finance as Reference Vertical: Tasks 6–10.
- Productivity/no micro-patching: Global Constraints + Task 10 defect classification.
- No fake jurisdiction/compliance: Tasks 1–2, 8, 10.
- No migration bypass: Global Constraints + Task 1.

### Placeholder scan

No `TBD`, `TODO`, `implement later`, generic "write tests", or unbounded error-handling placeholders are permitted. Repository-fit is explicitly a Task 1 deliverable because current implementation has evolved beyond the historical plan; exact paths/scripts must be derived from the current SHA before edits rather than guessed in this plan.

### Type/interface consistency

The plan intentionally does not invent new production function/type names before Task 1 repository reconciliation. Existing canonical Finance interfaces are reused; any newly required reusable Aurora primitive must be defined and tested in Task 5 before Finance consumes it.
