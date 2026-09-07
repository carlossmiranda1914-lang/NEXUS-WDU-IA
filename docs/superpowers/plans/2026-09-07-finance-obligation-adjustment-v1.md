# Obligation-linked Adjustment v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one immutable, tenant-safe administrative Adjustment fact that changes an Obligation's derived due position without rewriting historical Finance facts.

**Architecture:** Execute from a clean worktree branch `codex/finance-f5-obligation-adjustment-v1` created from the approved Finance baseline containing F4 Allocation. A shared server-side obligation-position calculator is the sole source for Adjustment commands, Allocation validation and operational reads. PostgreSQL facts are append-only and Journal-typed; the existing operational workspace is the sole UI.

**Tech Stack:** TypeScript, React, Express, `pg`, PostgreSQL migrations, exact `Money`, node/tsx tests.

**Spec:** `docs/superpowers/specs/2026-09-07-finance-obligation-adjustment-v1-design.md`

## Global Constraints

- Preflight fetches origin, proves clean baseline/migration tip and authorized disposable test DB before edits.
- Original Obligation, Payment and Allocation facts are never updated/deleted; no JS Number for money.
- Directions are `increase|decrease` plus positive Money; user input has no `effectiveAt`.
- Read: institution_admin/financial/director; mutate: institution_admin/financial only.
- Exclude Discount, Penalty, Credit, Refund, Reconciliation, FX, invoice rewrite, provider return, bulk/import and automation.

---

### Task 1: Preflight and shared Obligation financial position

**Files:** Create `src/modules/finance/obligation-financial-position.ts`, `tests/finance-obligation-financial-position.test.ts`; modify `src/modules/finance/allocation-model.ts` only if it exports current position types.

**Interfaces:** Produce `deriveObligationFinancialPosition({ original, adjustments, allocations, allocationReversals }): { netAdjustments, effectiveDue, netCovered, remainingCoverable }` and `AdjustmentDirection`/positive-Money validation.

- [ ] Write tests with literal 100/−20/covered 40 → effective 80/remaining 40; multiple directions; reversal restores capacity; decrease below covered rejects; opposing partial compensation cumulative limit rejects overage.
- [ ] Run `npm exec -- tsx tests/finance-obligation-financial-position.test.ts`; expect import/function failure.
- [ ] Implement exact-Money reductions only, deriving all four values and rejecting invalid direction, non-positive amount and covered-floor breach.
- [ ] Run the targeted test; expect PASS. Commit `feat(finance): add obligation financial position authority`.

### Task 2: Schema and typed Journal vocabulary

**Files:** Create next preflight-selected `src/db/migrations/00xx_finance_obligation_adjustments.sql`; modify `src/modules/finance/journal-model.ts`, `src/modules/finance/journal-repository.ts`; create `tests/finance-adjustment-schema-postgres.test.ts`.

**Interfaces:** Add `obligation_adjustment`; `obligation_due_increased|obligation_due_decreased`; immutable `finance_obligation_adjustments` with composite tenant FKs and `compensates_adjustment_id` targeting a root Adjustment.

- [ ] Write PostgreSQL tests for fresh migration, exact positive NUMERIC, reason <=500, tenant FKs, unsupported Journal type rejection and UPDATE/DELETE rejection.
- [ ] Run targeted schema test; expect missing table/vocabulary failure.
- [ ] Add only the migration and Journal validation mapping; preserve all F3/F4 vocabulary.
- [ ] Re-run schema test; expect PASS. Commit `feat(finance): add adjustment persistence authority`.

### Task 3: Atomic Adjustment command

**Files:** Create `src/modules/finance/obligation-adjustment-model.ts`, `src/modules/finance/obligation-adjustment-repository.ts`; create `tests/finance-adjustment-postgres.test.ts`.

**Interfaces:** Produce `recordAdjustment(actor, { obligationId, direction, amount, currency, reason, compensatesAdjustmentId? }, idempotencyKey)`.

- [ ] Write stateful tests for increase/decrease, same account/currency/open obligation, root-only compensation, opposite direction, partial cumulative cap, Journal+row atomicity and injected rollback.
- [ ] Run targeted test; expect module/command failure.
- [ ] Implement one transaction locking account → obligation → allocations → reversals → adjustments/root compensation; re-read Task 1 position and persist Journal then immutable fact.
- [ ] Re-run test; expect PASS. Commit `feat(finance): record immutable obligation adjustments`.

### Task 4: Concurrency and idempotency

**Files:** Create `tests/finance-adjustment-concurrency-postgres.test.ts`; modify only Task 3 repository where locking/fingerprint implementation requires it.

**Interfaces:** Preserve `remainingCoverable >= 0`; same key/same fingerprint replay; same key/different fingerprint conflict.

- [ ] Write concurrent PostgreSQL tests: two decreases, decrease/Allocation, Adjustment/AllocationReversal and competing partial compensations.
- [ ] Run test; expect at least one race invariant failure before locking is complete.
- [ ] Make lock order deterministic and lock root plus cumulative compensation rows for compensation.
- [ ] Re-run race and command tests; expect PASS. Commit `test(finance): prove adjustment concurrency invariants`.

### Task 5: Allocation integration

**Files:** Modify `src/modules/finance/allocation-repository.ts`; extend `tests/finance-allocation-postgres.test.ts` and `tests/finance-allocation-concurrency-postgres.test.ts`.

**Interfaces:** Allocation validation consumes Task 1 `remainingCoverable`; it does not alter Allocation facts.

- [ ] Write the literal regression: original 100, decrease 20, covered 40; Allocation 41 rejects, 40 accepts; compensating Adjustment restores capacity.
- [ ] Run allocation tests; expect original-amount validation to allow 41.
- [ ] Replace duplicated remaining calculation with the shared position calculation inside the existing locked transaction.
- [ ] Run Allocation targeted/concurrency tests; expect PASS. Commit `feat(finance): make allocation adjustment-aware`.

### Task 6: HTTP authorization and real client path

**Files:** Create `src/modules/finance/obligation-adjustment-http.ts`, `src/modules/finance/obligation-adjustment-client.ts`; modify Finance route registration; create `tests/finance-adjustment-http.test.ts` and client test.

**Interfaces:** `POST /api/finance/obligations/:obligationId/adjustments`; body normal `{direction,amount,currency,reason}` or compensation adds `compensatesAdjustmentId`; required `Idempotency-Key`; response fact plus position.

- [ ] Write real client → Express → PostgreSQL tests for success, 401, 403 director/secretariat, 404, 409 replay conflict, 422 floor/currency/reason and foreign tenant.
- [ ] Run HTTP test; expect route absence.
- [ ] Register the command route with canonical authenticated context and fixed role matrix; reject public `effectiveAt`.
- [ ] Re-run HTTP/client tests; expect PASS. Commit `feat(finance): expose adjustment command`.

### Task 7: Operational read model and complete frontend

**Files:** Modify `finance-operational-context-model.ts`, repository and `FinanceOperationalContextWorkspace.tsx`; create adjustment view/client components and rendered tests under `tests/finance-adjustment-ui.test.ts`.

**Interfaces:** Context exposes original, net adjustment, effective, covered, remaining and chronological reasoned facts from Task 1; UI opens **Registar correção** and refreshes canonically.

- [ ] Write rendered tests for increase/decrease, mandatory reason, floor error, preview, submit/error/refetch, original/history preservation, dark/light and narrow layout semantics.
- [ ] Run UI tests; expect adjustment operation/read absence.
- [ ] Implement one guided workspace flow and history entry using operational Portuguese; no Journal/UUID exposure or second client-side balance formula.
- [ ] Re-run UI and context tests; expect PASS. Commit `feat(finance): complete adjustment operations`.

### Task 8: Aggregate, handoff and UAT

**Files:** Create `scripts/run-finance-f5-obligation-adjustment.mjs`, `docs/finance/FINANCE_F5_01_HANDOFF.md`; update only execution evidence sections of the Mission Pack.

- [ ] Write aggregate runner to fail-fast through domain, schema, command, race, Allocation integration, HTTP/client and UI suites.
- [ ] Run it before final wiring; expect a missing/failed aggregate until all listed suites are registered.
- [ ] Implement runner and documentation-only handoff with UAT fixture: original 100, covered 40, −20, rejected −50, +10, optional linked compensation.
- [ ] Run once at final HEAD: F5, F4, F3, Obligation, Fee, Foundation, FND03, lint, build, diff, secrets and artifacts; commit/push handoff only after all PASS and Human UAT remains pending.

## Plan self-review

Tasks 1–8 cover every approved domain, Journal, schema, atomicity, concurrency, Allocation integration, HTTP, read/UI, aggregate and UAT requirement. One derived authority is produced in Task 1 and consumed in Tasks 3, 5 and 7. No task adds Refund, Credit, Discount, Penalty or Reconciliation scope; each has a red/green/verifiable commit boundary.
