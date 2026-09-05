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

## Audit Remediation (Post-SHA: f190c9844c9f3e127fde7551add450962625b8cd)
- **P0-01 (Adyen Auth Bypass Elimination):** CLOSED. Test mode auth bypass removed. Deterministic HMAC authentication enforced across all environments. Missing/invalid HMAC returns zero economic effect.
- **P0-02 (EMIS Protocol Inventions Removed):** CLOSED. All guessed headers/payloads removed. Status set to `AWAITING_AUTHORIZED_PROTOCOL`.
- **P0-03 (Provider Tenant Binding):** CLOSED. Webhook cryptographically authenticates and strictly binds external `merchantAccountCode` to configured `merchantAccountRef`. Mismatched merchant / cross-tenant replay fails closed.
- **P0-04 (Provenance & Financial Context):** CLOSED. Effective profile resolved strictly via `PostgresFinancialProfileStore`. Migration 0036 establishes `actor_kind` (`human`, `system`, `provider`) with strict schema constraints. No fake persons or zero UUIDs.
- **P1-05 (Adyen Minor Units):** CLOSED. Official ISO 4217 scales implemented for 0-decimal, 2-decimal, and 3-decimal currencies using exact BigInt math without floats or EUR defaults.
- **P1-06 (Provider Occurrence Time):** CLOSED. Only set when explicitly and validly provided by provider; never fabricated with local NOW().
- **P1-07 (Secret Reference Resolution):** CLOSED. `SecretResolver` resolves secrets strictly from `secretReferenceId` server-side. Distinct institution secret references proven without cross-acceptance.
- **P1-08 (Payer Tenant Safety):** CLOSED. Payer person validated against institutional memberships and financial account parties. Foreign payers rejected.
- **System Actor Extension Required:** NO (Handled via Migration 0036).
- **EMIS Multicaixa Status:** `AWAITING_AUTHORIZED_PROTOCOL`
- **Adyen Sandbox Status:** `BLOCKED_EXTERNAL_DEPENDENCY`
- **Manual Payment UAT Ready:** `YES`
- **Overall Finance-F3-01 Status:** `BLOCKED_EXTERNAL_DEPENDENCY`

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
- **Runtime Parity:** Validated at worktree `codex/finance-f3-payment-core-provider-adapter`

