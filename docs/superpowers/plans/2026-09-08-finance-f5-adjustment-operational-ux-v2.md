# FINANCE-F5-01 — Adjustment operational UX v2 implementation plan

## Goal

Replace the rejected generic Adjustment form with a contextual Financial Account charge action and side drawer, while preserving every existing Finance economic authority.

## Architecture

`FinanceOperationalContextWorkspace` owns account, selected charge, theme and canonical reload. A selected charge opens a drawer composed only where responsibilities warrant it: contextual action boundary, drawer shell, decision/input, exact display-only impact, and compact action footer. The existing Adjustment client/HTTP command remains the sole submit path; operational context/history remains the read authority.

## Tech Stack

React/TypeScript, existing Tailwind utility conventions, exact `Money`, existing fetch client, Express/PostgreSQL command path, React renderer tests and real-browser UAT infrastructure.

## Spec

`docs/superpowers/specs/2026-09-08-finance-f5-adjustment-operational-ux-v2-design.md`, complemented by the F5 economic design and guardrails.

## Global Constraints

- Domain semantics, schema, Journal vocabulary, roles, lock order, idempotency, Allocation/Payment authority and HTTP contract remain unchanged.
- No page/tab/permanent Adjustment surface; no Discount/Penalty/Credit/Refund work.
- Exact Money-compatible preview is display guidance only; server remains authoritative.
- A code change is permitted only after a RED proof for its owning task.

## File responsibility map

| Responsibility | Existing/target file |
|---|---|
| Account orchestration, selected charge, refresh, theme | `src/components/finance/operational/FinanceOperationalContextWorkspace.tsx` |
| Charge presentation and contextual action boundary | `FinanceOperationalContextWorkspace.tsx` or a focused charge-row component extracted only if needed |
| Current Adjustment surface / decision-input-impact | `FinanceObligationAdjustmentView.tsx` (replace or split by clear drawer responsibilities) |
| Drawer shell, focus and responsive behavior | focused component adjacent to `FinanceObligationAdjustmentView.tsx` only if existing workspace has no reusable drawer |
| Submit/fetch wiring | `src/modules/finance/obligation-adjustment-client.ts` |
| Operational position/history | `finance-operational-context-model.ts`, `finance-operational-context-repository.ts`, `FinanceOperationalHistory.tsx` |
| Allocation coherence reference | `FinanceAllocationCreateView.tsx`, `FinanceAllocationReverseView.tsx`, `FinanceAllocationHistory.tsx` |
| Exact Money | `src/modules/finance/money.ts` |
| UI/browser proof | `tests/finance-adjustment-ui.test.ts`, new focused browser test, canonical local UAT scripts |

### Task 1 — P1 Illegal Invocation: reproduce before correction

**Files:** `tests/finance-adjustment-browser.test.ts` (new); inspect `FinanceOperationalContextWorkspace.tsx`, `obligation-adjustment-client.ts` and browser wiring. **Consumes:** selected charge action and current fetch client. **Produces:** a precise failing real-browser regression and documented call boundary.

- [ ] Reproduce from the existing browser/runtime state where available; otherwise add the smallest browser/client characterization that invokes the exact bound/unbound Adjustment client path. Capture the exact `Illegal invocation` request state and stack boundary. This task does not depend on the final Finance UAT fixture.
- [ ] Run the characterization and require RED with the original browser error; retain the real-browser reproduction requirement for Task 6 once the canonical fixture exists.
- [ ] Trace whether the failing value is `window.fetch`, client method binding, or event callback; record the concrete cause in the test assertion.
- [ ] Apply only the minimal root-cause correction in the owning frontend/client file; no catch-and-mask or speculative fetch replacement.
- [ ] Re-run the browser regression GREEN, then `npx tsx tests/finance-adjustment-ui.test.ts`. Commit `fix(finance): preserve adjustment browser fetch binding`.

### Task 2 — Contextual charge action and drawer boundary

**Files:** `FinanceOperationalContextWorkspace.tsx`; focused drawer shell only if no existing reusable shell; `tests/finance-adjustment-ui.test.ts`. **Consumes:** selected operational charge and theme. **Produces:** `onRegisterAdjustment(charge)` with charge-owned context.

- [ ] Add a RED rendered test that no permanent Adjustment page/card/action row exists; the selected charge exposes `…` and `Registar correção`.
- [ ] Implement contextual action hierarchy without technical IDs, account/charge/currency reselection, or button proliferation.
- [ ] Add RED/GREEN tests for opening/closing the exact charge drawer, retained account context, Escape/cancel, focus containment and focus restoration to its originating action.
- [ ] Commit `feat(finance): open adjustment from charge context`.

### Task 3 — Drawer decision, input and exact impact

**Files:** `FinanceObligationAdjustmentView.tsx` and only focused adjacent components when the file has distinct shell/impact responsibilities; `money.ts` consumed unchanged; UI tests. **Produces:** contextual direction, amount and reason input plus display-only position preview.

- [ ] Write RED tests for Portuguese terminology, no redundant selects, required free-text reason, optional suggestion chips, increase/decrease transition, exact `100 → 80`, covered `40`, remaining `40`, and increase preview.
- [ ] Implement compact context, choice, input and before→after hierarchy; chips copy text only and never select economic intent.
- [ ] Write RED floor test for covered 40/reduction 50: invalid state, preserved input, maximum permitted reduction where deterministic, disabled confirmation and no ordinary negative result.
- [ ] Implement exact `Money`-compatible display calculation and invalid state; server remains authoritative. Commit `feat(finance): guide adjustment impact in contextual drawer`.

### Task 4 — Submit, refresh, history and compensation coherence

**Files:** workspace, adjustment view, `FinanceOperationalHistory.tsx`, operational context model/repository only if existing history projection lacks required display field; client consumed unchanged; UI/context tests. **Produces:** authoritative reload and coherent append-only history display.

- [ ] Add RED tests for compact stable footer, duplicate-submit prevention, submitting copy, server-error human message with preserved values/retry, and no raw runtime error.
- [ ] Add RED tests for authoritative success refresh of charge/position/history while retaining Financial Account context.
- [ ] Add RED history tests showing original charge, separately visible correction reason/direction and linked compensation while preserving the root fact.
- [ ] Implement only presentation/orchestration required by these tests; do not alter Adjustment/Allocation economics. Commit `feat(finance): refresh contextual adjustment history`.

### Task 5 — Theme, responsive, accessibility and bounded account coherence

**Files:** directly touched workspace/charge/drawer/history components and UI/browser tests. **Consumes:** existing `theme` convention. **Produces:** deliberate light/dark and reduced-viewport behavior.

- [ ] Add RED rendered assertions for light and dark semantic contrast, controlled reduction/increase/error/success states, no oversized generic card, proportional footer and no horizontal overflow/clipped content.
- [ ] Add RED keyboard tests for menu, drawer focus trap, Escape, Tab order and restored trigger focus; add reduced-motion-safe transition assertions only if the existing stack exposes motion preference.
- [ ] Implement purposeful state transitions and responsive drawer geometry; do not redesign unrelated Finance surfaces.
- [ ] Run focused UI tests GREEN. Commit `feat(finance): complete adjustment drawer accessibility`.

### Task 6 — Canonical local Finance UAT fixture, real-browser gate and closure

**Files:** `scripts/provision-local-finance-uat.ts` (new local/test-only helper), focused provisioning test, browser test and existing UAT infrastructure; no product schema/API files. **Consumes:** existing F2 Account, F1 catalogue prerequisite, F2 Obligation, F3 Payment and F4 Allocation authorities plus final contextual UI. **Produces:** safely repeatable canonical fixture and fresh browser evidence, not Human UAT.

- [ ] Write RED provisioning characterization for the authorized local test DB: canonical active UAT context, Account, original 100 EUR Obligation, confirmed Payment, canonical 40 EUR Allocation, effective 100, covered 40, remaining 60 and zero Adjustments. Run it twice and require no duplicate economic facts.
- [ ] Implement the smallest `scripts/provision-local-finance-uat.ts` helper only if absent. It must fail closed outside the approved local test DB, compose existing F1/F2/F3/F4 repositories/commands rather than manufacture Journal or economic rows with ad-hoc SQL, be tenant-safe, secret-safe and idempotent/safely reusable, and never become browser or production authority.
- [ ] Re-run the provisioning proof GREEN, then run real browser: account → correct charge → `…` → drawer → −20 preview → explicit submit → HTTP → PostgreSQL → canonical reload/history.
- [ ] Prove floor rejection creates no fact; positive Adjustment, linked compensation, server failure/retry, desktop/narrow and light/dark all behave correctly.
- [ ] Run once: targeted UX/browser tests, `node scripts/run-finance-f5-obligation-adjustment.mjs`, `npm run test:finance:f4:allocation`, `npm run test:finance:operational-consolidation`, lint, build, diff-check, secrets and artifacts.
- [ ] Commit/push, prove local/remote SHA and clean worktree, restart exact runtime, prove frontend/backend SHA plus HTTP 200 and UAT fixture readiness. Human UAT remains pending.

## Plan self-review

`SPEC_COVERAGE=COMPLETE`; `PLACEHOLDERS=0`; `TYPE_CONTRADICTIONS=0`; `VAGUE_VISUAL_STEPS=0`; `UNTESTED_APPROVED_REQUIREMENTS=0`; `OUT_OF_SCOPE_TASKS=0`; `TASKS_1_TO_5_FIXTURE_INDEPENDENT=PASS`. Database and HTTP changes are neither planned nor required.
