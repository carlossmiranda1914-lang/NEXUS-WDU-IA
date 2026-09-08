# FINANCE-F6-01 — Institutional Discount Policy & Contextual Obligation Concession v1

## 1. Executive Summary & Verification Evidence

FINANCE-F6-01 establishes versioned institutional discount policies and contextual concession of discounts to individual financial obligations.

- **Aggregate Runner:** `node scripts/run-finance-f6-discount-policy.mjs` $\to$ `F6_AGGREGATE=PASS` (12/12 suites passing).
- **Regression Suites:** F5 Adjustment, F4 Allocation, F3 Payment Core, and Operational Consolidation $\to$ `PASS`.
- **Static & Security Gates:** `lint`, `build`, `test:diff`, `test:secrets`, `test:artifacts` $\to$ `PASS`.
- **Migration Path:** `src/db/migrations/0040_finance_discount_policy_and_obligation_discounts.sql`.

---

## 2. Invariants & Authority Enforcement

### 2.1 One Active Discount Authority
- **Mechanism:** Strict command locking and derived active-fact projection:
  1. Transaction acquires `finance_financial_accounts ... FOR UPDATE` followed by `finance_obligations ... FOR UPDATE`.
  2. Transaction queries and locks `finance_obligation_discounts ... FOR UPDATE` and `finance_obligation_discount_revocations ... FOR UPDATE`.
  3. Active discounts are derived deterministically as discounts without a corresponding revocation row.
  4. If an active discount already exists on the target obligation, the operation fails with `DISCOUNT_ALREADY_ACTIVE`.
- **Concurrency Serialization:** Proved in PostgreSQL concurrency suite Race 1 (`tests/finance-discount-concurrency-postgres.test.ts`). Two simultaneous discount applications serialize on the obligation row lock; the first succeeds and commits, while the second is rejected with `DISCOUNT_ALREADY_ACTIVE`.

### 2.2 Immutable Facts & Compensating Revocations
- Applied discount records in `finance_obligation_discounts` are strictly append-only and immutable.
- Revocations in `finance_obligation_discount_revocations` are separate append-only compensating facts with a database constraint `uq_discount_single_revocation UNIQUE (institution_id, original_discount_id)` preventing double-revocation.

### 2.3 Covered Floor Invariant
- Server-side mathematical validation ensures that applied discounts cannot reduce the obligation's effective due below the covered amount ($O_{effective} \ge \text{Covered}$).

### 2.4 Race 3 Dual-Serialization Validity
In concurrent execution of percentage discount concession (20%) and decrease adjustment (30 EUR) on a 100 EUR obligation:
- **Serialization A (Discount first):** 20% on 100 EUR $\to$ 20 EUR discount fact; then 30 EUR decrease adjustment $\to$ `effectiveDue = 50 EUR`.
- **Serialization B (Adjustment first):** 30 EUR decrease adjustment $\to$ 70 EUR pre-discount due; then 20% on 70 EUR $\to$ 14 EUR discount fact $\to$ `effectiveDue = 56 EUR`.
Both paths produce exact fact counts (1 discount, 1 adjustment), exact journal transactions (2 confirmed), and valid non-negative positions.

---

## 3. Complete File Inventory (`BASE..HEAD`)

Comparing approved plan baseline `d1576b07317c4c5cb9fb092616a5273875fb265d` to implementation:

```
Total Files: 39

Modified Authority Files:
- src/modules/finance/allocation-repository.ts (Incorporates F6 discounts in remainingCoverable check)
- src/modules/finance/obligation-adjustment-repository.ts (Locks discounts and evaluates F6 position in adjustments)
- src/modules/finance/journal-model.ts (Adds obligation_discount journal and position types)
- src/modules/finance/obligation-financial-position.ts (Adds gross/revoked/net discount position math)
- src/modules/finance/finance-operational-context-model.ts (Adds active discount and history models)
- src/modules/finance/finance-operational-context-repository.ts (Projects active discount and discount history)
- src/components/finance/fee-catalogue/FinanceFeeCatalogueWorkspace.tsx (Hosts Policy tab; FeeCatalogueList untouched)
- src/components/finance/operational/FinanceOperationalTruthPanels.tsx (Adds discount contextual menu actions)
- src/components/finance/operational/FinanceOperationalContextWorkspace.tsx (Integrates discount drawer)
- src/components/finance/operational/FinanceOperationalHistory.tsx (Renders discount history items)
- server.ts (Registers discount HTTP routes)
- scripts/provision-local-finance-uat.ts (Seeds discount policies and UAT obligation scenarios)
- tests/finance-obligation-financial-position.test.ts (Extends position unit tests with discount cases)

New F6 Product & Test Files:
- src/db/migrations/0040_finance_discount_policy_and_obligation_discounts.sql
- src/modules/finance/discount-policy-model.ts
- src/modules/finance/discount-policy-repository.ts
- src/modules/finance/discount-policy-http.ts
- src/modules/finance/discount-policy-client.ts
- src/modules/finance/obligation-discount-model.ts
- src/modules/finance/obligation-discount-repository.ts
- src/modules/finance/obligation-discount-http.ts
- src/modules/finance/obligation-discount-client.ts
- src/components/finance/fee-catalogue/FinanceDiscountPolicyView.tsx
- src/components/finance/fee-catalogue/FinanceDiscountPolicyList.tsx
- src/components/finance/fee-catalogue/FinanceDiscountPolicyCreateDialog.tsx
- src/components/finance/fee-catalogue/FinanceDiscountPolicyVersionDialog.tsx
- src/components/finance/fee-catalogue/FinanceDiscountPolicyArchiveDialog.tsx
- src/components/finance/operational/FinanceObligationDiscountView.tsx
- scripts/run-finance-f6-discount-policy.mjs
- tests/finance-discount-policy-schema-postgres.test.ts
- tests/finance-discount-policy-postgres.test.ts
- tests/finance-obligation-discount-schema-postgres.test.ts
- tests/finance-obligation-discount-postgres.test.ts
- tests/finance-discount-concurrency-postgres.test.ts
- tests/finance-discount-policy-http.test.ts
- tests/finance-obligation-discount-http.test.ts
- tests/finance-discount-policy-ui.test.ts
- tests/finance-obligation-discount-ui.test.ts
- tests/finance-f6-real-flow-integration.test.ts
```

---

## 4. Human UAT Instructions

1. **Policy Administration:** Navigate to Catálogo de Propinas $\to$ "Políticas de Desconto". Create institutional policy `BOLSA-20` (20% percentage) and `IRMAOS-10` (10 EUR fixed).
2. **Contextual Concession:** Open operational context for student account with a 100 EUR obligation and 40 EUR allocated.
3. **Concede Discount:** In obligation row menu `...`, select "Conceder desconto". Apply `BOLSA-20`. Verify effective due becomes 80 EUR, covered 40 EUR, remaining 40 EUR.
4. **Active Discount Restriction:** Attempt to apply a second discount on the same obligation; verify the UI/backend prohibits multiple active discounts.
5. **Revocation Flow:** In obligation row menu `...`, select "Revogar desconto". Provide justification and confirm. Verify effective due is restored to 100 EUR.
6. **Floor Violation Protection:** Attempt to apply a 70 EUR discount when 40 EUR is already covered; verify submission is blocked as a floor violation.
