# FINANCE-F3-01 SDD Execution Ledger

- **Plan Path:** `docs/superpowers/plans/2026-09-05-finance-f3-payment-core-provider-adapter.md`
- **Spec Path:** `docs/superpowers/specs/2026-09-05-finance-f3-payment-core-provider-adapter-design.md`
- **Base SHA:** `918d633c5c5711f93591cd75631bd5a4d93aa683`
- **Base Branch:** `codex/finance-f3-payment-core-provider-adapter`
- **Worktree:** `C:\Users\Administrador\NEXUS-WDU-IA-main\worktrees\finance-f3-payment-core-provider-adapter`
- **Date Started:** 2026-09-05T13:31:00+01:00

## Architectural Rulings & Invariants
1. Exactly ONE canonical incoming Payment authority (`ConfirmIncomingPayment`).
2. Payment confirmation MUST NOT allocate, settle, or reduce an Obligation.
3. Provider adapters normalize to canonical confirmation intent; Finance Core owns economic truth.
4. Confirmed payments remain `NÃO APLICADO` / `UNAPPLIED`.
5. Canonical Money envelope: exact decimal, explicit currency, NUMERIC(30,12), no float/double/JS number authority.
6. Tenant isolation and server-only secret handling enforced on all paths.
7. Task 1 Journal Architectural Ruling: `JOURNAL_EXTENSION_REQUIRED=NO`. Canonical Journal semantics `foundation_value_received` and position `received_value` truthfully represent received economic value without implying obligation settlement or allocation.

## Task Status
- [x] Task 1: Establish authoritative F3 branch/worktree and prove Journal compatibility (SHA: 918d633c5c5711f93591cd75631bd5a4d93aa683)
- [x] Task 2: Define the provider-neutral Payment domain and policy (Commit: 5a9a751)
- [x] Task 3: Add append-only PostgreSQL authorities for Payments and provider configuration (Commit: 094ce7f)
- [x] Task 4: Implement canonical `ConfirmIncomingPayment` transaction boundary (Commit: 2011df2)
- [x] Task 5: Implement institution Payment Provider Configuration authority (Commit: bb4f7c4)
- [x] Task 6: Expose operational manual Payment HTTP boundary (Commit: 7faf088)
- [x] Task 7: Create the provider adapter contract and EMIS/MULTICAIXA Angola implementation boundary (Commit: 6d24305)
- [x] Task 8: Implement Adyen sandbox adapter with real provider proof (Commit: a269796)
- [x] Task 9: Implement isolated provider webhook ingress and provider-admin HTTP (Commit: 7c1799a)
- [x] Task 10: Implement authenticated Payment client and operational Recebimentos UI (Commit: e932332)
- [x] Task 11: Build F3 aggregate, regression suite, and runtime-parity gate
- [x] Task 12: Final independent review, sandbox evidence, and Human UAT preparation

## Audit Remediation (Post-SHA: c7682ff2f83601756368480c2f51bad3379843a3)
- **P1-A (Adyen Minor Unit Table Alignment):** CLOSED. Derived mapping strictly from official Adyen currency specification: ISK=2 decimals, IDR=0 decimals, CLP=2 decimals, CVE=0 decimals, JPY=0 decimals, BHD=3 decimals, EUR=2 decimals. No generic ISO assumption where Adyen differs. Retains exact BigInt/string conversion and fails controlled on missing/invalid currencies.
- **P1-B (Remove Premature Allocation States):** CLOSED. `PaymentAllocationStatus` returned to `'unapplied'`. PostgreSQL schema constraint (`chk_finance_payments_allocation_status_f3`) and TypeScript domain types strictly aligned. `partially_applied` and `fully_applied` removed from F3 domain. Zero allocation-derived state exposed in F3.
- **P2 (Secret Resolver Hardening):** CLOSED. Provider secret references restricted strictly to approved payment secret namespaces (`env://NEXUS_PAYMENT_*` and `vault://*`). Generic `process.env` fallback removed. Attempts to resolve unrelated process secrets (such as `DATABASE_URL`, `FIREBASE_PRIVATE_KEY`, `GEMINI_API_KEY`) rejected. Zero raw secret values exposed in browser, projections, logs, or errors. Deterministic test suite added.

## Final Verification & Evidence Summary
- **Aggregate Test Suite:** `npm run test:finance:f3:payment-core` (PASS)
- **F2 Regression:** `npm run test:finance:f2:account-obligation` (PASS)
- **F1 Regression:** `npm run test:finance:f1:fee-catalogue` (PASS)
- **Foundation Regression:** `npm run test:finance:foundation` (PASS)
- **FND03 Regression:** `npm run test:fnd03` (PASS)
- **Static Checks / Lint:** `npm run lint` (`tsc --noEmit`, PASS - 0 errors)
- **Production Build:** `npm run build` (`vite build && esbuild server.ts`, PASS)
- **Secret & Artifact Audits:** `npm run test:secrets` (PASS), `npm run test:artifacts` (PASS)
- **Adyen Sandbox Status:** `ADYEN_SANDBOX=BLOCKED_EXTERNAL_DEPENDENCY` (Real credentials absent in test environment)
- **EMIS Multicaixa Status:** `EMIS_MULTICAIXA=AWAITING_AUTHORIZED_PROTOCOL`
- **Manual Payment UAT Ready:** `YES`
- **Overall Finance-F3-01 Status:** `BLOCKED_EXTERNAL_DEPENDENCY`
- **Runtime Parity:** Validated at worktree `codex/finance-f3-payment-core-provider-adapter`

