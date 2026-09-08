# Finance F6 Discount Policy v1 Implementation Plan

> For agentic workers:
> REQUIRED SUB-SKILL:
> superpowers:subagent-driven-development
> or
> superpowers:executing-plans

**Goal:** Deliver institutional Discount Policies with immutable versioning, append-only obligation concession & revocation facts, unified financial position calculation, strict covered-floor enforcement, atomic Journal integration, and a contextual Financial Account drawer without mutating historical facts.

**Architecture:** Implemented across a clean worktree on branch `codex/finance-f6-discount-policy-v1`. Extends the canonical `deriveObligationFinancialPosition` as the sole authority for balance derivation. All financial concessions are append-only rows in `finance_obligation_discounts` and `finance_obligation_discount_revocations`, bonded atomically to `finance_journal_transactions` with composite tenant foreign keys `(institution_id, ...)`. UI provides an institutional policy management tab and an in-context concession drawer over the retained Financial Account view.

**Tech Stack:** TypeScript (strict), React 19, Express 4, `pg` (node-postgres), PostgreSQL 15+, TailwindCSS / Nexus Aurora tokens, Lucide icons, Motion, `tsx` / Node.js test runners.

**Spec:** `docs/superpowers/specs/2026-09-08-finance-f6-discount-policy-v1-design.md` (Commit: `39680c3db1f8e6f6ec10c4944bcead658e401d54`).

---

## Global Constraints

- **Single Position Authority:** `deriveObligationFinancialPosition` is the sole source of truth for obligation balances; never build a secondary client or server balance formula.
- **Fact Immutability:** `finance_obligation_discounts` has no mutable status column. Revocation is a distinct append-only fact in `finance_obligation_discount_revocations`. Historical Obligation, Payment, Allocation, and Adjustment facts are never updated or deleted.
- **Tenant Isolation:** All tables and foreign keys enforce composite tenant safety `(institution_id, ...)`. Cross-tenant references fail closed at the database level.
- **Single Command-Level Instant:** `applicationInstant: Date` is sampled exactly once server-side at command entry; zero browser clock authority (`BROWSER_TIME_AUTHORITY = NO`).
- **Deterministic Version Applicability:** At most one policy version is applicable for a policy at any `applicationInstant`. Version effective intervals `[effectiveFrom, effectiveTo]` may not overlap.
- **Covered Floor Invariant:** Discounts can never reduce `effectiveDue` below `netCovered` (`effectiveDue >= netCovered` and `remainingCoverable >= 0`).
- **Strict Role Authorization:** Mutation permitted only for `institution_admin` and `financial`. Read-only for `director`. All others `403 Forbidden`.
- **Scope Discipline:** Exclude automatic rule engines, discount stacking, partial revocations, late penalties (F7), customer credits (F8), and refunds (F9).

---

## File Responsibility Map

| Action | Path | Responsibility | Interfaces Consumed | Interfaces Produced |
| :--- | :--- | :--- | :--- | :--- |
| **CREATE** | `src/db/migrations/0040_finance_discount_policy_and_obligation_discounts.sql` | Schema for policies, versions, applied discounts, revocations, indexes, and composite FKs | PostgreSQL DDL | DB tables & constraints |
| **CREATE** | `src/modules/finance/discount-policy-model.ts` | Domain models, types, and validation for discount policies and versions | `Money`, `Currency` | `DiscountPolicy`, `DiscountPolicyVersion`, `DiscountCalculationMode` |
| **CREATE** | `src/modules/finance/discount-policy-repository.ts` | Database operations for policy creation, versioning, resolution, and archival | `pg.Pool`, `DiscountPolicyModel` | `DiscountPolicyRepository` |
| **CREATE** | `src/modules/finance/obligation-discount-model.ts` | Domain models for append-only discount application and revocation facts | `Money`, `DiscountPolicyModel` | `ObligationDiscount`, `ObligationDiscountRevocation` |
| **CREATE** | `src/modules/finance/obligation-discount-repository.ts` | Atomic execution of Apply and Revoke commands with locking and Journal entries | `pg.Pool`, `JournalRepository`, `PositionEngine` | `ObligationDiscountRepository` |
| **MODIFY** | `src/modules/finance/journal-model.ts` | Extend typed Journal vocabulary with discount transaction and position types | Foundation Journal types | `DiscountJournalType`, `DiscountPositionType` |
| **MODIFY** | `src/modules/finance/journal-repository.ts` | Support discount Journal booking validation and transaction types | `journal-model.ts` | Updated Journal validator |
| **MODIFY** | `src/modules/finance/obligation-financial-position.ts` | Extend derived position formula with gross/revoked/net discounts and floor checks | `Money` | Extended `deriveObligationFinancialPosition` |
| **MODIFY** | `src/modules/finance/obligation-adjustment-repository.ts` | Feed discount facts into position inputs during Adjustment validation | `obligation-financial-position.ts` | Updated Adjustment validation |
| **MODIFY** | `src/modules/finance/allocation-repository.ts` | Feed discount facts into position inputs during Payment Allocation validation | `obligation-financial-position.ts` | Updated Allocation validation |
| **CREATE** | `src/modules/finance/discount-policy-http.ts` | HTTP routes and controllers for discount policy management | Express, `InstitutionalContext`, Auth | Policy REST endpoints |
| **CREATE** | `src/modules/finance/obligation-discount-http.ts` | HTTP routes and controllers for applying and revoking obligation discounts | Express, `InstitutionalContext`, Idempotency | Concession REST endpoints |
| **CREATE** | `src/modules/finance/discount-policy-client.ts` | Typed client for policy CRUD and versioning API | Fetch / HTTP client | `DiscountPolicyClient` |
| **CREATE** | `src/modules/finance/obligation-discount-client.ts` | Typed client for apply and revoke discount API | Fetch / HTTP client | `ObligationDiscountClient` |
| **MODIFY** | `src/modules/finance/finance-operational-context-model.ts` | Add discount summaries and active concessions to account read model | `Money` | Extended operational context types |
| **MODIFY** | `src/modules/finance/finance-operational-context-repository.ts` | Query discount facts and compile derived balance & history | PostgreSQL, Position Engine | Updated operational context reads |
| **CREATE** | `src/components/finance/fee-catalogue/FinanceDiscountPolicyView.tsx` | UI component for managing policies, creating versions, and viewing validity | React, `discount-policy-client.ts` | Policy management surface |
| **MODIFY** | `src/components/finance/fee-catalogue/FinanceFeeCatalogueWorkspace.tsx` | Host the discount policy management view as a tab/section | React | Integrated catalogue workspace |
| **CREATE** | `src/components/finance/operational/FinanceObligationDiscountView.tsx` | Contextual drawer for applying and revoking discounts over Financial Account | React, `obligation-discount-client.ts` | Contextual concession drawer |
| **MODIFY** | `src/components/finance/operational/FinanceOperationalContextWorkspace.tsx` | Wire `...` contextual menu to open the discount drawer for eligible charges | React, Context Workspace | Extended operational workspace |
| **MODIFY** | `src/components/finance/operational/FinanceOperationalHistory.tsx` | Render applied and revoked discount facts chronologically with reason | React | Extended operational history |
| **MODIFY** | `scripts/provision-local-finance-uat.ts` | Seed deterministic F6 UAT fixture (account, charges, and test policies) | `pg`, DB repositories | UAT provisioner |
| **CREATE** | `scripts/run-finance-f6-discount-policy.mjs` | Fast fail-fast test runner for all F6 unit, PostgreSQL, concurrency, and UI tests | Node.js | F6 test runner |
| **CREATE** | `docs/finance/FINANCE_F6_01_HANDOFF.md` | Handoff report documenting test evidence, migrations, and UAT verification | Markdown | Antigravity Handoff Codex |

---

## Implementation Tasks

### Task 1: Schema & Policy Version Authority

**Files:**
- Create `src/db/migrations/0040_finance_discount_policy_and_obligation_discounts.sql`
- Create `src/modules/finance/discount-policy-model.ts`
- Create `src/modules/finance/discount-policy-repository.ts`
- Create `tests/finance-discount-policy-schema-postgres.test.ts`
- Create `tests/finance-discount-policy-postgres.test.ts`

**Interfaces:**
- `DiscountPolicy`: `{ id: string, institutionId: string, code: string, status: 'active' | 'archived', createdAt: Date, updatedAt: Date }`
- `DiscountPolicyVersion`: `{ id: string, institutionId: string, policyId: string, version: number, name: string, description: string | null, calculationMode: 'percentage' | 'fixed_amount', value: string, currency: string | null, effectiveFrom: Date | null, effectiveTo: Date | null, createdAt: Date, actorPersonId: string | null }`
- `createDiscountPolicy(actor, input): Promise<DiscountPolicy & { version: DiscountPolicyVersion }>`
- `createDiscountPolicyVersion(actor, policyId, input): Promise<DiscountPolicyVersion>`
- `archiveDiscountPolicy(actor, policyId): Promise<DiscountPolicy>`
- `resolveApplicablePolicyVersion(institutionId, policyId, applicationInstant): Promise<DiscountPolicyVersion | null>`

**Detailed Steps:**
- [ ] **Failing Test (RED):** Write `tests/finance-discount-policy-schema-postgres.test.ts` and `tests/finance-discount-policy-postgres.test.ts` testing:
  - Policy identity creation with version 1.
  - Immutable version append (`version = 2`).
  - Immutability of version 1 row after version 2 created.
  - Overlapping effective interval rejection (`OVERLAPPING_VERSION_INTERVAL`).
  - Coexistence of future non-overlapping version (`future.effectiveFrom > current.effectiveTo`).
  - Archiving policy prevents new versions and new applications.
  - Composite tenant foreign key enforcement `(institution_id, policy_id)`.
  - Migration rollback and re-apply idempotency.
- [ ] **RED Command:** `npx tsx tests/finance-discount-policy-schema-postgres.test.ts` (Expect failure: migration 0040 missing).
- [ ] **Implementation:**
  - Create migration `0040_finance_discount_policy_and_obligation_discounts.sql` with tables `finance_discount_policies` and `finance_discount_policy_versions` including unique constraints and check constraints.
  - Implement `src/modules/finance/discount-policy-model.ts` with input validation (percentage <= 100, fixed amount requires currency).
  - Implement `src/modules/finance/discount-policy-repository.ts` with atomic version creation and non-overlapping interval validation query:
    $$\text{SELECT COUNT(*) FROM finance\_discount\_policy\_versions WHERE institution\_id = \$1 AND policy\_id = \$2 AND (effective\_from IS NULL OR \$4 IS NULL OR effective\_from <= \$4) AND (effective\_to IS NULL OR \$3 IS NULL OR effective\_to >= \$3)}$$
  - Implement `resolveApplicablePolicyVersion` enforcing deterministic single version lookup.
- [ ] **GREEN Command:** `npx tsx tests/finance-discount-policy-schema-postgres.test.ts && npx tsx tests/finance-discount-policy-postgres.test.ts` (Expect PASS).
- [ ] **Commit Boundary:** `feat(finance): add discount policy and immutable version persistence authority`

---

### Task 2: Discount & Revocation Facts + Typed Journal Vocabulary

**Files:**
- Modify `src/db/migrations/0040_finance_discount_policy_and_obligation_discounts.sql`
- Modify `src/modules/finance/journal-model.ts`
- Modify `src/modules/finance/journal-repository.ts`
- Create `src/modules/finance/obligation-discount-model.ts`
- Create `tests/finance-obligation-discount-schema-postgres.test.ts`

**Interfaces:**
- `DiscountJournalType = 'obligation_discount'`
- `DiscountPositionType = 'obligation_discount_applied' | 'obligation_discount_revoked'`
- `ObligationDiscount`: `{ id: string, institutionId: string, financialAccountId: string, obligationId: string, policyId: string, policyVersionId: string, policyCode: string, policyName: string, policyVersion: number, calculationMode: DiscountCalculationMode, policyValue: string, amount: Money, currency: string, reason: string, journalTransactionId: string, appliedAt: Date, actorPersonId: string | null }`
- `ObligationDiscountRevocation`: `{ id: string, institutionId: string, financialAccountId: string, obligationId: string, originalDiscountId: string, amount: Money, currency: string, reason: string, journalTransactionId: string, revokedAt: Date, actorPersonId: string | null }`

**Detailed Steps:**
- [ ] **Failing Test (RED):** Write `tests/finance-obligation-discount-schema-postgres.test.ts` asserting:
  - `finance_obligation_discounts` has no mutable status column.
  - `finance_obligation_discount_revocations` has unique constraint on `(institution_id, original_discount_id)` preventing duplicate revocations.
  - Composite tenant foreign keys enforce tenant isolation for account, obligation, policy, policy version, and Journal transaction.
  - Negative proof: cross-tenant `journal_transaction_id` fails with foreign key violation.
  - Journal transaction rejects unregistered position types.
- [ ] **RED Command:** `npx tsx tests/finance-obligation-discount-schema-postgres.test.ts` (Expect failure).
- [ ] **Implementation:**
  - Add tables `finance_obligation_discounts` and `finance_obligation_discount_revocations` with composite foreign keys referencing `finance_journal_transactions(institution_id, id)`.
  - Update `src/modules/finance/journal-model.ts` and `journal-repository.ts` to register `obligation_discount` transaction type and `obligation_discount_applied`, `obligation_discount_revoked` position types.
  - Implement `src/modules/finance/obligation-discount-model.ts`.
- [ ] **GREEN Command:** `npx tsx tests/finance-obligation-discount-schema-postgres.test.ts` (Expect PASS).
- [ ] **Commit Boundary:** `feat(finance): add append-only obligation discount and revocation schema with journal linkage`

---

### Task 3: Unified Derived Position Authority Extension

**Files:**
- Modify `src/modules/finance/obligation-financial-position.ts`
- Modify `tests/finance-obligation-financial-position.test.ts`
- Modify `src/modules/finance/obligation-adjustment-repository.ts`
- Modify `src/modules/finance/allocation-repository.ts`

**Interfaces:**
- `ObligationFinancialPositionInput`:
  ```typescript
  export interface ObligationFinancialPositionInput {
    readonly original: Money;
    readonly adjustments: readonly { readonly direction: 'increase' | 'decrease'; readonly amount: Money }[];
    readonly discounts: readonly { readonly id: string; readonly amount: Money }[];
    readonly discountRevocations: readonly { readonly originalDiscountId: string; readonly amount: Money }[];
    readonly allocations: readonly Money[];
    readonly allocationReversals: readonly Money[];
  }
  ```
- `ObligationFinancialPosition`:
  ```typescript
  export interface ObligationFinancialPosition {
    readonly netAdjustments: Money;
    readonly grossDiscounts: Money;
    readonly revokedDiscounts: Money;
    readonly netDiscounts: Money;
    readonly effectiveDue: Money;
    readonly netCovered: Money;
    readonly remainingCoverable: Money;
  }
  ```

**Detailed Steps:**
- [ ] **Failing Test (RED):** Extend `tests/finance-obligation-financial-position.test.ts` with test cases:
  - Original 100 EUR, 0 adjustments, 20 EUR discount, covered 40 EUR $\to$ grossDiscounts 20, revokedDiscounts 0, netDiscounts 20, effectiveDue 80, remainingCoverable 40.
  - Revocation of 20 EUR discount $\to$ grossDiscounts 20, revokedDiscounts 20, netDiscounts 0, effectiveDue 100, remainingCoverable 60.
  - Discount combined with Adjustments (+10 EUR increase, 20 EUR discount $\to$ effectiveDue 90 EUR).
  - Covered floor invariant failure: 70 EUR discount when covered is 40 EUR on 100 EUR charge $\to$ throws `Error('Effective obligation due cannot be below covered amount')`.
  - Non-authoritative fact status: derived position strictly computes `netDiscounts = grossDiscounts - revokedDiscounts` without reading any row status field.
- [ ] **RED Command:** `npx tsx tests/finance-obligation-financial-position.test.ts` (Expect compilation/assertion error).
- [ ] **Implementation:**
  - Update `deriveObligationFinancialPosition` in `src/modules/finance/obligation-financial-position.ts` to compute:
    $$\text{grossDiscounts} = \sum \text{discounts}, \quad \text{revokedDiscounts} = \sum \text{discountRevocations}, \quad \text{netDiscounts} = \text{grossDiscounts} - \text{revokedDiscounts}$$
    $$\text{effectiveDue} = \text{original} + \text{netAdjustments} - \text{netDiscounts}$$
    $$\text{remainingCoverable} = \text{effectiveDue} - \text{netCovered}$$
  - Enforce `effectiveDue >= netCovered` and `remainingCoverable >= 0`.
  - Update `obligation-adjustment-repository.ts` and `allocation-repository.ts` to supply `discounts` and `discountRevocations` when calling `deriveObligationFinancialPosition`.
- [ ] **GREEN Command:** `npx tsx tests/finance-obligation-financial-position.test.ts` (Expect PASS).
- [ ] **Commit Boundary:** `feat(finance): extend canonical obligation financial position with discount facts`

---

### Task 4: Atomic Apply & Revoke Commands

**Files:**
- Create `src/modules/finance/obligation-discount-repository.ts`
- Create `tests/finance-obligation-discount-postgres.test.ts`

**Interfaces:**
- `applyObligationDiscount(actor, input, idempotencyKey): Promise<{ discount: ObligationDiscount, position: ObligationFinancialPosition }>`
  - `input: { obligationId: string, discountPolicyId?: string, discountPolicyVersionId?: string, reason: string }`
- `revokeObligationDiscount(actor, input, idempotencyKey): Promise<{ revocation: ObligationDiscountRevocation, position: ObligationFinancialPosition }>`
  - `input: { obligationId: string, discountId: string, reason: string }`

**Detailed Steps:**
- [ ] **Failing Test (RED):** Write `tests/finance-obligation-discount-postgres.test.ts` testing:
  - Single server-sampled `applicationInstant` used for policy eligibility and fact `applied_at`.
  - Percentage calculation: 20% on 100 EUR $\to$ exact 20.00 EUR Money discount.
  - Percentage calculation with rounding: 15% on 33.33 EUR $\to$ exact `round_half_up` Money discount.
  - Fixed amount calculation: exact Money match with obligation currency.
  - Currency mismatch rejection: fixed discount in USD on EUR obligation fails (`DISCOUNT_CURRENCY_MISMATCH`).
  - Covered floor validation: attempting 70 EUR discount when 40 EUR covered on 100 EUR charge fails (`DISCOUNT_FLOOR_VIOLATION`).
  - One active discount invariant: applying second discount on obligation with active discount fails (`DISCOUNT_ALREADY_ACTIVE`).
  - Total revocation: creates immutable revocation fact, posts `obligation_discount_revoked` Journal entry, and restores payable balance to 100 EUR.
  - Once-only revocation: revoking already revoked discount fails (`DISCOUNT_ALREADY_REVOKED`).
  - New application after revocation: successfully applies a new discount after prior discount is revoked.
  - Idempotency: exact replay returns 200 OK (`replayed: true`); conflicting payload returns 409.
  - Atomic rollback: database error rolls back both fact and Journal entry.
- [ ] **RED Command:** `npx tsx tests/finance-obligation-discount-postgres.test.ts` (Expect failure).
- [ ] **Implementation:**
  - Implement `src/modules/finance/obligation-discount-repository.ts` adhering strictly to lock hierarchy:
    1. Lock Financial Account (`FOR UPDATE`)
    2. Lock Obligation (`FOR UPDATE`)
    3. Lock Allocations & Reversals (`FOR UPDATE`)
    4. Lock Adjustments (`FOR UPDATE`)
    5. Lock Discounts & Revocations (`FOR UPDATE`)
  - Sample `const applicationInstant = new Date();` once at start of command.
  - Resolve applicable policy version via `resolveApplicablePolicyVersion(institutionId, policyId, applicationInstant)`.
  - Calculate discount amount using exact decimal arithmetic.
  - Derive updated position with candidate discount and verify floor constraint.
  - Persist Journal transaction + entry, then insert `finance_obligation_discounts` fact.
  - Implement `revokeObligationDiscount` using identical lock order, verifying target discount exists, is active (no revocation fact), inserting compensating Journal entry and `finance_obligation_discount_revocations` fact.
- [ ] **GREEN Command:** `npx tsx tests/finance-obligation-discount-postgres.test.ts` (Expect PASS).
- [ ] **Commit Boundary:** `feat(finance): implement atomic obligation discount apply and revoke commands`

---

### Task 5: PostgreSQL Concurrency & Race Proofs

**Files:**
- Create `tests/finance-discount-concurrency-postgres.test.ts`

**Interfaces:**
- Proves 8 explicit race conditions under real PostgreSQL transactions.

**Detailed Steps:**
- [ ] **Failing Test (RED):** Write `tests/finance-discount-concurrency-postgres.test.ts` implementing:
  1. **Apply × Apply Race:** Two concurrent `applyObligationDiscount` commands on same obligation $\to$ exactly 1 succeeds (`201`), exactly 1 fails (`409 DISCOUNT_ALREADY_ACTIVE`); exactly 1 discount fact created.
  2. **Apply × Allocation Race:** Concurrent Apply (20 EUR) and Payment Allocation (50 EUR) on 100 EUR obligation $\to$ serialized cleanly; final effectiveDue = 80 EUR, netCovered = 50 EUR, remainingCoverable = 30 EUR; no floor breach.
  3. **Apply × Adjustment Race:** Concurrent Apply (20 EUR) and Decrease Adjustment (30 EUR) on 100 EUR obligation $\to$ serialized; effectiveDue = 50 EUR, remainingCoverable = 50 EUR.
  4. **Apply × Allocation Reversal Race:** Concurrent Apply (20 EUR) and Allocation Reversal (20 EUR) on 100 EUR obligation with 40 EUR covered $\to$ serialized; netCovered becomes 20 EUR, remainingCoverable becomes 60 EUR.
  5. **Revoke × Allocation Race:** Concurrent Revoke (freeing 20 EUR) and Allocation (attempting 50 EUR) $\to$ serialized; allocation succeeds as capacity is restored.
  6. **Revoke × Adjustment Race:** Concurrent Revoke and Adjustment $\to$ serialized; final balance consistent.
  7. **Revoke × Discount Apply Race:** Concurrent Revoke of discount 1 and Apply of discount 2 $\to$ serialized; new discount succeeds only after revocation commits.
  8. **Revoke × Revoke Race:** Two concurrent revocations of same discount $\to$ exactly 1 succeeds, exactly 1 fails (`409 DISCOUNT_ALREADY_REVOKED`); unique constraint `uq_discount_single_revocation` preserved.
- [ ] **RED Command:** `npx tsx tests/finance-discount-concurrency-postgres.test.ts` (Expect test execution / verification).
- [ ] **Implementation:**
  - Verify that lock order in `obligation-discount-repository.ts`, `allocation-repository.ts`, and `obligation-adjustment-repository.ts` prevents deadlocks and enforces deterministic execution.
- [ ] **GREEN Command:** `npx tsx tests/finance-discount-concurrency-postgres.test.ts` (Expect PASS across all 8 races).
- [ ] **Commit Boundary:** `test(finance): prove discount concurrency invariants across 8 real postgres races`

---

### Task 6: HTTP Routes, Authorization & Client Path

**Files:**
- Create `src/modules/finance/discount-policy-http.ts`
- Create `src/modules/finance/obligation-discount-http.ts`
- Create `src/modules/finance/discount-policy-client.ts`
- Create `src/modules/finance/obligation-discount-client.ts`
- Modify `server.ts`
- Create `tests/finance-discount-policy-http.test.ts`
- Create `tests/finance-obligation-discount-http.test.ts`

**Interfaces:**
- `GET /api/finance/discount-policies` $\to$ Returns policies with `latestVersion` and `currentApplicableVersion`
- `POST /api/finance/discount-policies` $\to$ `201 Created`
- `POST /api/finance/discount-policies/:id/versions` $\to$ `201 Created`
- `PATCH /api/finance/discount-policies/:id/archive` $\to$ `200 OK`
- `POST /api/finance/obligations/:obligationId/discounts` $\to$ `201 Created`
- `POST /api/finance/obligations/:obligationId/discounts/:discountId/revoke` $\to$ `200 OK`
- `DiscountPolicyClient` and `ObligationDiscountClient` methods with typed error handling.

**Detailed Steps:**
- [ ] **Failing Test (RED):** Write `tests/finance-discount-policy-http.test.ts` and `tests/finance-obligation-discount-http.test.ts` testing:
  - Full request-response lifecycles through Express.
  - Role authorization matrix: `institution_admin` and `financial` ALLOWED (`201/200`), `director` FORBIDDEN (`403`), unauthenticated UNAUTHORIZED (`401`).
  - Read endpoints allow `director`, `institution_admin`, `financial`.
  - Non-disclosure: cross-tenant IDs return generic `404 Not Found`.
  - Server calculation authority: client cannot pass custom calculated amount for percentage discounts.
  - Error responses formatted with standardized error codes (`DISCOUNT_FLOOR_VIOLATION`, `DISCOUNT_ALREADY_ACTIVE`, `DISCOUNT_POLICY_OVERLAPPING_INTERVAL`, `DISCOUNT_POLICY_NOT_CURRENTLY_APPLICABLE`).
- [ ] **RED Command:** `npx tsx tests/finance-discount-policy-http.test.ts` (Expect failure: routes missing).
- [ ] **Implementation:**
  - Implement `discount-policy-http.ts` and `obligation-discount-http.ts` using `requireRole` and `requireInstitutionalContext`.
  - Implement typed clients `discount-policy-client.ts` and `obligation-discount-client.ts` using canonical fetch patterns.
  - Register routers in `server.ts`.
- [ ] **GREEN Command:** `npx tsx tests/finance-discount-policy-http.test.ts && npx tsx tests/finance-obligation-discount-http.test.ts` (Expect PASS).
- [ ] **Commit Boundary:** `feat(finance): expose discount policy and concession http endpoints and typed clients`

---

### Task 7: Institutional Discount Policy Management UX

**Files:**
- Create `src/components/finance/fee-catalogue/FinanceDiscountPolicyView.tsx`
- Modify `src/components/finance/fee-catalogue/FinanceFeeCatalogueWorkspace.tsx`
- Create `tests/finance-discount-policy-ui.test.ts`

**Interfaces:**
- `FinanceDiscountPolicyView`: Renders policy table, version badges, creation modal, version creation modal, and archive action.
- Integrated into `FinanceFeeCatalogueWorkspace` under tab `Políticas de Desconto`.

**Detailed Steps:**
- [ ] **Failing Test (RED):** Write `tests/finance-discount-policy-ui.test.ts` asserting:
  - Table renders policy code, name, calculation mode badge, current rate/value, validity window, and status.
  - Distinguishes `currentApplicableVersion` from `latestVersion` (shows badge if a future version is scheduled).
  - "Nova Política" modal opens, validates inputs (percentage $\le 100$, fixed requires currency), and triggers client creation.
  - "Nova Versão" action opens modal with prefilled code and policy identity.
  - "Arquivar" action with confirmation.
  - Loading, empty, and error states.
  - Keyboard accessibility (Escape closes modal, Enter submits, focus trap).
  - Light/Dark theme compatibility.
- [ ] **RED Command:** `npx tsx tests/finance-discount-policy-ui.test.ts` (Expect failure).
- [ ] **Implementation:**
  - Build `FinanceDiscountPolicyView.tsx` using Nexus Aurora tokens, clean typography, responsive layout, and human-friendly Portuguese terminology.
  - Embed in `FinanceFeeCatalogueWorkspace.tsx`.
- [ ] **GREEN Command:** `npx tsx tests/finance-discount-policy-ui.test.ts` (Expect PASS).
- [ ] **Commit Boundary:** `feat(finance): add institutional discount policy management surface`

---

### Task 8: Contextual Obligation Discount Drawer UX

**Files:**
- Create `src/components/finance/operational/FinanceObligationDiscountView.tsx`
- Modify `src/components/finance/operational/FinanceOperationalContextWorkspace.tsx`
- Create `tests/finance-obligation-discount-ui.test.ts`

**Interfaces:**
- `FinanceObligationDiscountView`: Contextual slide-over drawer mounted over retained Financial Account view.
- Drawer handles two modes:
  1. `apply`: Policy selector, live financial before $\to$ discount $\to$ after preview, reason input, floor boundary warning, and confirm button.
  2. `revoke`: Active discount summary, reason input, restore preview, and confirm revocation button.

**Detailed Steps:**
- [ ] **Failing Test (RED):** Write `tests/finance-obligation-discount-ui.test.ts` asserting:
  - Financial Account workspace remains visible behind the drawer.
  - Charge row `...` menu displays `Aplicar desconto institucional` when eligible, and `Revogar desconto` when active discount exists.
  - Drawer opens with accurate obligation context header (Charge Title, Original, Covered, Current Due).
  - Selecting percentage policy (e.g. 20%) displays real-time preview: `Original: 100.00 EUR | Desconto: -20.00 EUR | Novo devido: 80.00 EUR | Restante: 40.00 EUR`.
  - Selecting fixed policy exceeding floor displays preventive warning banner and disables submit button.
  - Mandatory reason validation before submit.
  - Submit shows loading state, prevents duplicate clicks, and triggers context refetch on success.
  - Revocation flow displays restored balance preview.
  - Accessibility: `role="dialog"`, `aria-modal="true"`, focus trap, Escape closes drawer.
- [ ] **RED Command:** `npx tsx tests/finance-obligation-discount-ui.test.ts` (Expect failure).
- [ ] **Implementation:**
  - Build `FinanceObligationDiscountView.tsx` matching the F5 UX V2 visual standard (Nexus Aurora surface, border-border-subtle, text-primary, microinteractions $\le 150\text{ms}$).
  - Integrate drawer trigger into `FinanceOperationalContextWorkspace.tsx` charge row menu.
- [ ] **GREEN Command:** `npx tsx tests/finance-obligation-discount-ui.test.ts` (Expect PASS).
- [ ] **Commit Boundary:** `feat(finance): add contextual obligation discount application and revocation drawer`

---

### Task 9: Operational History, UAT Provisioner & Real Browser Gate

**Files:**
- Modify `src/modules/finance/finance-operational-context-model.ts`
- Modify `src/modules/finance/finance-operational-context-repository.ts`
- Modify `src/components/finance/operational/FinanceOperationalHistory.tsx`
- Modify `scripts/provision-local-finance-uat.ts`
- Create `tests/finance-f6-real-flow-integration.test.ts`

**Interfaces:**
- Operational history includes:
  - `ObligationDiscountAppliedFact`: `{ kind: 'discount_applied', discountId: string, policyName: string, policyCode: string, amount: Money, reason: string, appliedAt: Date, actorName: string }`
  - `ObligationDiscountRevokedFact`: `{ kind: 'discount_revoked', revocationId: string, originalDiscountId: string, amount: Money, reason: string, revokedAt: Date, actorName: string }`
- `provisionLocalFinanceUat` seeds:
  - Account: `UAT — Finance Discount 100-40-60`
  - Obligation: `UAT-F6-DISCOUNT-100-40-60` (Original: `100.00 EUR`, Covered: `40.00 EUR`, Remaining: `60.00 EUR`)
  - Policies: `BOLSA-20` (20%), `IRMAOS-10` (10 EUR), `EXCEDENTE-70` (70 EUR)

**Detailed Steps:**
- [ ] **Failing Test (RED):** Write `tests/finance-f6-real-flow-integration.test.ts` verifying the end-to-end flow from provisioned UAT data through repository, Journal, history, and position derivation.
- [ ] **RED Command:** `npx tsx tests/finance-f6-real-flow-integration.test.ts` (Expect failure).
- [ ] **Implementation:**
  - Extend `finance-operational-context-repository.ts` to load discount and revocation facts and merge them into `FinanceOperationalHistory`.
  - Update `FinanceOperationalHistory.tsx` to render discount facts with distinct emerald/amber badges, policy code, and operational reason.
  - Update `scripts/provision-local-finance-uat.ts` to provision F6 test policies and obligation fixture idempotently.
- [ ] **GREEN Command:** `npx tsx tests/finance-f6-real-flow-integration.test.ts` (Expect PASS).
- [ ] **Commit Boundary:** `feat(finance): integrate discount operational history and seed uat fixture`

---

### Task 10: Final Codex Deterministic Verification & Antigravity Handoff

**Files:**
- Create `scripts/run-finance-f6-discount-policy.mjs`
- Create `docs/finance/FINANCE_F6_01_HANDOFF.md`

**Detailed Steps:**
- [ ] **Create Test Runner:** Implement `scripts/run-finance-f6-discount-policy.mjs` executing the complete F6 suite:
  1. `finance-money-model.test.ts`
  2. `finance-obligation-financial-position.test.ts`
  3. `finance-discount-policy-schema-postgres.test.ts`
  4. `finance-discount-policy-postgres.test.ts`
  5. `finance-obligation-discount-schema-postgres.test.ts`
  6. `finance-obligation-discount-postgres.test.ts`
  7. `finance-discount-concurrency-postgres.test.ts`
  8. `finance-discount-policy-http.test.ts`
  9. `finance-obligation-discount-http.test.ts`
  10. `finance-discount-policy-ui.test.ts`
  11. `finance-obligation-discount-ui.test.ts`
  12. `finance-f6-real-flow-integration.test.ts`
  13. Regressions: F5 adjustments, F4 allocations, F3 payments, and operational consolidation runner.
- [ ] **Run Full Regression Suite:**
  ```powershell
  node scripts/run-finance-f6-discount-policy.mjs
  npm run lint
  npm run build
  node scripts/check-committed-diff.mjs
  ```
- [ ] **Handoff Document:** Create `docs/finance/FINANCE_F6_01_HANDOFF.md` recording all green evidence, migration hashes, clean worktree status, and the browser verification playbook for Antigravity.
- [ ] **Commit Boundary:** `docs(finance): complete finance f6 discount policy v1 deterministic implementation and handoff`

---

## Concrete Real Browser Gate (Antigravity Scope)

Upon handoff to Antigravity, the persistent test runtime (`http://localhost:3000`) is launched and validated against the following 18-step browser gate:

1. **Bootstrap:** Run UAT provisioner (`npm run uat:bootstrap`) to seed the clean `100.00 EUR` / `40.00 EUR` covered / `60.00 EUR` remaining fixture.
2. **Navigate:** Open browser to `http://localhost:3000`, authenticate as `admin@nexus.edu` (institution_admin).
3. **Policy Catalog:** Navigate to `Financeiro` $\to$ `Catálogo & Políticas` $\to$ `Políticas de Desconto`.
4. **Policy Verification:** Verify `BOLSA-20` (20%), `IRMAOS-10` (10 EUR), and `EXCEDENTE-70` (70 EUR) are listed with active badges.
5. **New Version Test:** Create version 2 of `BOLSA-20` with future `effectiveFrom` $\to$ verify version 1 remains the active applicable version.
6. **Navigate Account:** Open `Contas Financeiras` $\to$ select account `UAT — Finance Discount 100-40-60`.
7. **Contextual Action:** Click `...` menu on obligation `UAT-F6-DISCOUNT-100-40-60` $\to$ select `Aplicar desconto institucional`.
8. **Drawer Retention:** Verify Financial Account view remains visible behind the drawer.
9. **Percentage Concession Preview:** Select `BOLSA-20 (20%)` $\to$ verify live preview displays:
   - Original: `100.00 EUR`
   - Desconto: `-20.00 EUR`
   - Valor devido: `80.00 EUR`
   - Restante a liquidar: `40.00 EUR`
10. **Application Submit:** Enter reason `"Bolsa de Mérito Semestre 1"` $\to$ click `Confirmar Desconto`.
11. **Balance & History:** Verify charge due updates to `80.00 EUR`, remaining updates to `40.00 EUR`, and operational history displays applied discount entry.
12. **Page Refresh:** Hard reload page (`Ctrl+F5`) $\to$ verify balance and history persist without corruption.
13. **Revocation Flow:** Click `...` menu $\to$ select `Revogar desconto` $\to$ enter reason `"Perda de bolsa"` $\to$ click `Confirmar Revogação`.
14. **Balance Restoration:** Verify charge due restores to `100.00 EUR` and remaining restores to `60.00 EUR`.
15. **Re-Application (Fixed):** Click `...` $\to$ `Aplicar desconto institucional` $\to$ select `IRMAOS-10 (10.00 EUR)` $\to$ submit $\to$ verify due becomes `90.00 EUR` and remaining becomes `50.00 EUR`.
16. **Floor Violation Validation:** Attempt applying `EXCEDENTE-70 (70.00 EUR)` $\to$ verify floor violation warning banner is displayed and submission is blocked.
17. **A11y & Responsiveness:** Test Escape key drawer close, keyboard focus trapping, toggle Light/Dark themes, resize viewport to $375\text{px}$ (mobile fluid layout with no horizontal scroll).
18. **Runtime SHA Parity:** Confirm browser build matches Git HEAD SHA.

---

## Plan Self-Review & Verification

- **P0 / P1 Coverage:** All 4 original P1 items (Discount fact immutability, policy versioning, composite tenant FKs, complete proof matrix) and 3 residual P1 items (Journal composite FKs, single server application instant, deterministic version applicability intervals) are strictly integrated.
- **Single Derived Authority:** `deriveObligationFinancialPosition` in `obligation-financial-position.ts` is the sole formula for both server-side validation and operational UI.
- **No Scope Drift:** Excludes penalties, credit notes, refunds, rule engines, or stacking.
- **Zero Placeholders:** Every task has explicit file paths, exact interfaces, failing test conditions, RED/GREEN commands, and clear commit boundaries.
