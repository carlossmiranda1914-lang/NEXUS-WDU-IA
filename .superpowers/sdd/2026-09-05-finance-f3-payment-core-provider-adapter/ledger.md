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
- [ ] Task 2: Define the provider-neutral Payment domain and policy
- [ ] Task 3: Add append-only PostgreSQL authorities for Payments and provider configuration
- [ ] Task 4: Implement canonical `ConfirmIncomingPayment` transaction boundary
- [ ] Task 5: Implement institution Payment Provider Configuration authority
- [ ] Task 6: Expose operational manual Payment HTTP boundary
- [ ] Task 7: Create the provider adapter contract and EMIS/MULTICAIXA Angola implementation boundary
- [ ] Task 8: Implement Adyen sandbox adapter with real provider proof
- [ ] Task 9: Implement isolated provider webhook ingress and provider-admin HTTP
- [ ] Task 10: Implement authenticated Payment client and operational Recebimentos UI
- [ ] Task 11: Build F3 aggregate, regression suite, and runtime-parity gate
- [ ] Task 12: Final independent review, sandbox evidence, and Human UAT preparation
