# FINANCE-F1-01 Fee / Emolument Catalogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in one objective-complete mission. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first real upper-Finance vertical: a tenant-safe, PostgreSQL-authoritative, exact-Money Fee / Emolument Catalogue with server authorization, HTTP API, Nexus UI, behavioral proof and human UAT.

**Architecture:** Add a versioned catalogue aggregate beside the integrated Finance Foundation. Reuse canonical institutional context, `requireFinancialContext()`, exact Money, `executeIdempotentFinanceCommand()` and Finance audit authority. Catalogue administration must remain non-economic: it writes catalogue/configuration authority but never Journal/projection truth.

**Tech Stack:** TypeScript, Node/Express, PostgreSQL/pg, React, existing Nexus auth/IAM/Finance Foundation, tsx tests, Vite build.

**Spec:** `docs/roadmap/missions/FINANCE-F1-01-FEE-CATALOGUE.md`

## Global Constraints

- Baseline authority: merged `main`; re-confirm exact SHA at preflight.
- Mission authority: `FINANCE-F1-01-FEE-CATALOGUE.md` + `FINANCE-F1-01_DOR_EVIDENCE.md`.
- Roles: `institution_admin` and `financial` read/write; `director` read only; all other canonical roles deny.
- Institution/person/role authority comes only from resolved active Membership context.
- Money is exact; no authoritative JS floating-point arithmetic.
- Currency must be enabled by the effective Financial Profile.
- Catalogue mutations are administrative, never Journal/projection economic facts.
- Legacy `students.outstanding_fees` and legacy invoices/payments remain non-canonical and untouched.
- Migration history is immutable; expected next migration is `0031`, but execution must re-confirm before writing.
- No obligation, invoice, payment, allocation, reconciliation, fiscal or reporting scope.
- Operating standard: priority clear, no useless cycles, no silent scope expansion, no false GREEN, advance immediately once sufficient evidence exists.

---

### Task 1: Canonical PostgreSQL catalogue schema + domain model

**Files:**
- Create: `src/db/migrations/0031_finance_fee_catalogue.sql`
- Create: `src/modules/finance/fee-catalogue-model.ts`
- Create: `tests/finance-fee-catalogue-schema-postgres.test.ts`
- Create: `tests/finance-fee-catalogue-model.test.ts`

**Interfaces:**
- Consumes: `Money` from `src/modules/finance/money.ts`; canonical currency registry; `institutions` and existing Finance migration conventions.
- Produces: `FeeCatalogueItem`, `FeeCatalogueVersion`, `CreateFeeCatalogueInput`, `UpdateFeeCatalogueInput`, lifecycle/status/kind validation and PostgreSQL tables `finance_fee_catalogue_items` / `finance_fee_catalogue_versions`.

- [ ] **Step 1: Preflight migration authority**

Run repository migration listing and prove no migration `0031` exists. If `0031` exists, STOP as a genuine migration-authority collision; do not renumber by inference.

- [ ] **Step 2: Write schema/model RED tests**

`tests/finance-fee-catalogue-model.test.ts` must assert: non-blank normalized code/name/kind, valid exact positive Money, valid effective time, and rejection of zero/negative/over-scale amounts.

`tests/finance-fee-catalogue-schema-postgres.test.ts` must assert zero catalogue tables before new migration, then expected tables/columns/constraints after migration, tenant-safe composite FK, unique `(institution_id,code)`, unique `(institution_id,item_id,version)`, status check, effective interval check, exact decimal envelope and no hard-delete cascade.

Run both and record valid REDs before implementation.

- [ ] **Step 3: Implement minimal domain model**

Define typed inputs and pure validation/normalization only. Do not add persistence or HTTP behavior in this task.

- [ ] **Step 4: Implement append-only migration**

Create only the two approved catalogue tables and constraints from the mission. Reuse the Finance exact-decimal envelope pattern rather than inventing a weaker numeric rule.

- [ ] **Step 5: Prove GREEN**

Run targeted model and PostgreSQL schema tests plus isolated migration bootstrap/checksum regression. Commit only after targeted GREEN.

---

### Task 2: Catalogue repository + idempotent command boundary + audit

**Files:**
- Create: `src/modules/finance/fee-catalogue-repository.ts`
- Create: `src/modules/finance/fee-catalogue-command.ts`
- Create: `tests/finance-fee-catalogue-postgres.test.ts`
- Create: `tests/finance-fee-catalogue-concurrency-postgres.test.ts`

**Interfaces:**
- Consumes: Task 1 model/schema; `requireFinancialContext()`; `executeIdempotentFinanceCommand()`; `finance_audit_records`.
- Produces: create, read, list, update-version, activate and deactivate commands returning canonical catalogue views.

- [ ] **Step 1: Write repository RED for create/read/list/history**

Use real disposable PostgreSQL. Prove create is institution-scoped, version 1 is current, history is readable, and same code in a different institution is legal while duplicate code in the same institution conflicts.

- [ ] **Step 2: Implement create/read/list**

Creation must insert item + version 1 atomically. Validate required currency through `requireFinancialContext()` before persistence. Record institution-scoped Finance audit metadata with actor person and operation; do not create a Journal transaction.

- [ ] **Step 3: Write version/concurrency RED**

Prove two concurrent edits against the same expected version cannot both advance current state. Prove prior version remains unchanged and new version closes the old effective interval atomically.

- [ ] **Step 4: Implement versioned edit**

Lock the item row, compare expected current version, close prior effective version, insert N+1 and advance `current_version` in one transaction. Return deterministic stale-version conflict.

- [ ] **Step 5: Write lifecycle + idempotency RED**

Prove activate/deactivate never delete history, same command identity/fingerprint replays one fact, mismatched fingerprint conflicts, and no catalogue mutation changes confirmed Journal count or `finance_position_projection`.

- [ ] **Step 6: Implement lifecycle + idempotent commands**

Use existing Finance command identity with operation namespaces such as `finance.fee_catalogue.create`, `.update`, `.activate`, `.deactivate`. No in-memory mutex/idempotency state.

- [ ] **Step 7: Prove tenant and exactness negatives**

A cannot read/update B by direct UUID; disabled currency fails closed; over-scale amount is rejected before/at persistence with no silent rounding; suspended/revoked context must not enter the repository mutation boundary.

- [ ] **Step 8: Commit targeted GREEN**

Run Task 2 PostgreSQL + concurrency suites and Task 1 regressions before commit.

---

### Task 3: Server policy + HTTP API

**Files:**
- Create: `src/modules/finance/fee-catalogue-policy.ts`
- Create: `src/modules/finance/fee-catalogue-http.ts`
- Modify: `server.ts`
- Create: `tests/finance-fee-catalogue-http.test.ts`
- Create: `tests/finance-fee-catalogue-policy.test.ts`

**Interfaces:**
- Consumes: canonical `InstitutionalContext`; Task 2 command/repository interfaces.
- Produces: authenticated API under `/api/finance/fee-catalogue` with stable 401/403/404/409/422 contracts.

- [ ] **Step 1: Write role-matrix RED**

Assert exactly: `institution_admin` read/write, `financial` read/write, `director` read-only, `secretariat|teacher|student|parent` deny. No alias `finance` or legacy `admin` is accepted.

- [ ] **Step 2: Implement policy**

Policy consumes canonical InstitutionalRole only and contains no browser or legacy role translation.

- [ ] **Step 3: Write HTTP REDs**

Cover list/get/create/update/activate/deactivate plus unauthenticated, forbidden, foreign ID, duplicate code, stale version, disabled currency, malformed amount and idempotency conflict. Attempting to supply another institution in body/query must not switch tenant authority.

- [ ] **Step 4: Implement HTTP adapter and register routes**

Resolve institutional context server-side, enforce policy, parse exact Money from string representation, call Task 2 commands, and map domain conflicts to stable HTTP statuses. Do not revive legacy `/api/invoices` routes.

- [ ] **Step 5: Prove HTTP GREEN**

Run policy + HTTP + PostgreSQL catalogue suites. Confirm no Journal/projection side effect via an HTTP mutation path.

---

### Task 4: Nexus UI vertical

**Files:**
- Create: `src/modules/finance/fee-catalogue-client.ts`
- Create: `src/components/FinanceFeeCatalogueWorkspace.tsx`
- Modify: `src/App.tsx`
- Create: `tests/finance-fee-catalogue-client.test.ts`
- Create: `tests/finance-fee-catalogue-ui.test.ts`

**Interfaces:**
- Consumes: Task 3 HTTP contract only; browser never imports server repositories/policies.
- Produces: real Finance catalogue workspace with list, create/edit, activate/deactivate and authoritative refresh.

- [ ] **Step 1: Write client RED**

Assert request/response typing, exact amount stays string-based across HTTP, idempotency key is sent for writes, stale-version/validation/forbidden errors remain distinguishable.

- [ ] **Step 2: Implement typed client**

No localStorage, fixtures or fallback success. Client must surface server errors verbatim enough for UI state mapping.

- [ ] **Step 3: Write UI RED**

Cover loading, empty, list, create, edit with expected version, activate/deactivate, forbidden, validation/conflict and retry states. Successful mutation must refresh/use server-returned authority.

- [ ] **Step 4: Implement workspace and shell integration**

Integrate under existing Nexus Finance navigation/shell without redesigning unrelated modules. Respect responsive/light-dark conventions already used by existing workspaces.

- [ ] **Step 5: Prove UI GREEN**

Run client/UI tests and production build targeted enough to catch TypeScript/rendering errors.

---

### Task 5: Objective-complete integration proof + UAT + checkpoint

**Files:**
- Create: `scripts/run-finance-f1-fee-catalogue.mjs`
- Modify: `package.json` only for narrow F1 aliases/aggregate if absent
- Create: `.superpowers/sdd/2026-09-04-finance-f1-fee-catalogue/progress.md`
- Update: `docs/roadmap/missions/FINANCE-F1-01_DOR_EVIDENCE.md` only with execution evidence/status after implementation, not by rewriting design decisions

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: deterministic F1 aggregate evidence and exact remote-coherent implementation HEAD ready for independent review.

- [ ] **Step 1: Create one fail-fast F1 aggregate**

Stable order: model -> schema PostgreSQL -> repository PostgreSQL -> concurrency -> policy -> HTTP -> client -> UI. Preserve child exit code and stdout/stderr; do not parallelize shared DB tests.

- [ ] **Step 2: Run fresh final gates once the vertical is coherent**

Run:

```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npm run test:finance:f1:fee-catalogue
TEST_DATABASE_LOCAL_AUTHORIZED=true npm run test:finance:foundation
npm run test:migrations:isolated
npm run test:fnd03
npm run lint
npm run build
git diff --check
npm run quality-gate
```

If executor capture is unreliable, persist logs/exit codes and continue; timeout alone is not a Product Owner STOP.

- [ ] **Step 3: Human local UAT**

Using authorized local PostgreSQL + authenticated institutional users, prove: `financial` create/read/edit/history/deactivate/reactivate; restart persistence; `director` read-only; wrong institution/suspended membership denied; Journal/projection unchanged.

- [ ] **Step 4: Fix only mission-owned defects found by the above evidence**

Do not open a broad Finance audit. Fix reproducible failures attributable to F1 within the same mission and rerun only affected targeted proof plus final aggregate if the coherent vertical changed.

- [ ] **Step 5: Final checkpoint**

Commit/push normal history, prove local HEAD == remote HEAD, worktree clean, and report exact gate/UAT results. Do not self-merge or self-approve independent review.

## Self-review result

- Spec coverage: all mission requirements map to Tasks 1–5.
- Placeholder scan: no TBD/TODO/implementation-later steps remain.
- Type/authority consistency: server institutional context, exact Money, Financial Context, Finance command idempotency, audit and Journal non-economic boundary are consistently reused.
- Scope check: obligation/payment/invoice/reconciliation remain excluded; this plan is one coherent functional subsystem.
