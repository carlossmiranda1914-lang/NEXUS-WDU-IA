# FINANCE-F2-01 Implementation Plan
## Financial Account & Financial Obligation Core

**State:** READY FOR EXECUTION  
**Branch:** `codex/finance-f2-financial-account-obligation`  
**Base:** `8038d871adcfe6a9eec276150528e577265f10fe`

---

## 1. Plan Overview

This plan executes the test-first implementation of FINANCE-F2-01:
- Task 1: Migration 0033 (PostgreSQL schema for financial accounts, account parties, account counters, and financial obligations).
- Task 2: Domain models, validators, and normalization (`financial-account-model.ts`, `financial-obligation-model.ts`).
- Task 3: PostgreSQL repositories (`financial-account-repository.ts`, `financial-obligation-repository.ts`) with counter sequence, tenant isolation, money snapshotting, and idempotency.
- Task 4: HTTP route handlers and middleware (`financial-account-http.ts`, `financial-obligation-http.ts`, `server.ts`).
- Task 5: Frontend API client (`financial-obligation-client.ts`).
- Task 6: UI Components for integrated subviews (`FinancialObligationsWorkspace.tsx`, `FinancialObligationsListView.tsx`, `FinancialObligationCreateView.tsx`, `FinancialAccountsView.tsx`, and `FinancialPanel.tsx`).
- Task 7: Comprehensive test suite and aggregate runner (`scripts/run-finance-f2-account-obligation.mjs`).
- Task 8: Full verification gate sequence, secret scanning, build, and closure.

---

## 2. Test-First Work Breakdown

### Task 1: Migration 0033
- Create `src/db/migrations/0033_finance_accounts_and_obligations.sql`.
- Verify migration execution via `scripts/nexus-migrate.ts`.

### Task 2: Domain Models & Unit Tests
- Create `tests/finance-financial-account-model.test.ts` and `tests/finance-financial-obligation-model.test.ts`.
- Implement `src/modules/finance/financial-account-model.ts` and `src/modules/finance/financial-obligation-model.ts`.

### Task 3: Repositories & PostgreSQL Tests
- Create `tests/finance-financial-account-postgres.test.ts` and `tests/finance-financial-obligation-postgres.test.ts`.
- Implement `src/modules/finance/financial-account-repository.ts` and `src/modules/finance/financial-obligation-repository.ts`.
- Validate money snapshot law: obligation Money is immutable upon Fee Catalogue version changes.

### Task 4: HTTP Routes & Integration Tests
- Create `tests/finance-financial-obligation-http.test.ts`.
- Implement `src/modules/finance/financial-account-http.ts` and `src/modules/finance/financial-obligation-http.ts`.
- Register routes in `server.ts`.

### Task 5: Client & UI Tests
- Create `tests/finance-financial-obligation-client.test.ts` and `tests/finance-financial-obligation-ui.test.ts`.
- Implement `src/modules/finance/financial-obligation-client.ts`.
- Implement UI components under `src/components/finance/obligations/`.

### Task 6: Workspace Integration
- Add "Obrigações Financeiras" tab / navigation in `src/components/FinancialPanel.tsx`.

### Task 7: Aggregate Suite & Verification
- Create `scripts/run-finance-f2-account-obligation.mjs`.
- Add script `"test:finance:f2:account-obligation"` to `package.json`.
- Execute all canonical gates: F2 aggregate, F1 aggregate, foundation, fnd03, lint, build, diff check, secrets, artifacts.
