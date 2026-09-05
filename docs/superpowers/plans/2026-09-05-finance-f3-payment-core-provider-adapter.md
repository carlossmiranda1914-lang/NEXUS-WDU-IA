# FINANCE-F3-01 Payment Core + Provider Adapter Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one canonical incoming Payment authority for Nexus Finance, prove it with controlled manual/offline receipt flow plus one real Adyen sandbox integration, and establish the EMIS/MULTICAIXA Angola adapter contract without introducing Allocation, fake settlement, provider-specific Finance authority, or unsafe secret handling.

**Architecture:** All producers converge on one application boundary, `ConfirmIncomingPayment`. Manual/offline operations and provider adapters normalize to one provider-neutral confirmation intent. Only the canonical application service may create Payment economic truth and the matching Journal fact atomically in PostgreSQL. Provider ingress remains untrusted until authenticity, institution configuration, confirmation threshold, idempotency, and canonical intent are validated.

**Tech Stack:** TypeScript, Node.js, Express, React, PostgreSQL, existing Nexus Finance `Money`, financial-context, Journal, idempotency/command-result, institutional-auth, migration runner, Firebase bearer-token client pattern, Adyen test APIs/webhooks, EMIS/MULTICAIXA contract fixtures.

**Spec:** `docs/superpowers/specs/2026-09-05-finance-f3-payment-core-provider-adapter-design.md`

## Global Constraints

- Preserve FINANCE-F1 Fee Catalogue and FINANCE-F2 Financial Account/Obligation as closed consumed dependencies.
- Payment confirmation MUST NOT allocate to, reduce, settle, or mutate an Obligation.
- There is exactly one canonical incoming Payment confirmation authority.
- No country, currency, bank, rail, or provider becomes a hard-coded Finance Core boundary.
- Canonical Money uses the existing exact decimal/currency policy; no `number`, `FLOAT`, `REAL`, or `DOUBLE` as financial authority.
- Confirmed economic facts are immutable; no destructive cancellation/update path.
- Provider callbacks never write Journal, Payment, projections, or balances directly.
- Provider secrets, HMAC material, API keys, PAN, CVV, bearer tokens, or full sensitive payloads must never reach browser projections, normal logs, source control, command approval text, or canonical Finance tables.
- PostgreSQL commit is the canonical persistence boundary; migrations are append-only and must not rewrite applied migrations.
- Runtime frontend/backend/migration SHA parity is mandatory before Human UAT.
- Adyen is the first sandbox proof adapter, not the universal Nexus provider.
- Angola is first-class: EMIS/MULTICAIXA must be represented by a real adapter contract and contract tests, but must remain `CONTRACT_READY` rather than falsely `LIVE_VERIFIED` if no authorized sandbox/credentials/protocol are available.

---

## File Map

The executor must preserve existing repository patterns and keep responsibilities separated.

**Create — domain/application**
- `src/modules/finance/payment-model.ts` — provider-neutral Payment domain, normalized confirmation intent, invariants.
- `src/modules/finance/payment-policy.ts` — Finance role/capability policy for payment reads/manual confirmation/provider administration.
- `src/modules/finance/payment-repository.ts` — canonical PostgreSQL read/write boundary; confirmed Payment + Journal transaction atomically.
- `src/modules/finance/payment-service.ts` — `ConfirmIncomingPayment` orchestration shared by manual and provider producers.
- `src/modules/finance/payment-provider-model.ts` — institution provider-configuration model and lifecycle.
- `src/modules/finance/payment-provider-repository.ts` — tenant-scoped provider configuration persistence/read projection.

**Create — adapters/integration**
- `src/modules/finance/providers/payment-provider-adapter.ts` — narrow provider adapter interface.
- `src/modules/finance/providers/adyen-adapter.ts` — Adyen sandbox initiation/normalization/authentication boundary.
- `src/modules/finance/providers/emis-multicaixa-adapter.ts` — Angola contract adapter and normalization/authentication hooks.
- `src/modules/finance/payment-provider-http.ts` — provider configuration/admin HTTP.
- `src/modules/finance/payment-webhook-http.ts` — isolated provider webhook ingress; never direct Finance write.
- `src/modules/finance/payment-http.ts` — operational read/manual receipt HTTP.

**Create — browser/UI**
- `src/modules/finance/payment-client.ts` — authenticated client, idempotency key handling, typed error mapping.
- `src/components/FinancePaymentsWorkspace.tsx` — Recebimentos list/router.
- `src/components/FinancePaymentsListView.tsx` — confirmed/unapplied Payment list.
- `src/components/FinancePaymentCreateView.tsx` — controlled manual/offline receipt workflow.
- `src/components/FinancePaymentProvidersView.tsx` — bounded administrative provider status/config view.

**Modify**
- `src/components/FinanceWorkspace.tsx` — add `Recebimentos` sibling navigation without changing F1/F2 semantics.
- existing server route registration file used by Finance — register payment, provider-admin, and provider-webhook routes through current repository pattern.
- `package.json` — add F3 aggregate test script only; add no dependency unless Task 8 proves the official provider SDK is required and the existing HTTP stack cannot safely support signature/test API needs.

**Migrations**
- Create the next free append-only migration after the authoritative branch is inspected at execution time. Do not assume the number in advance.

**Tests**
- `tests/finance-payment-model.test.ts`
- `tests/finance-payment-schema-postgres.test.ts`
- `tests/finance-payment-postgres.test.ts`
- `tests/finance-payment-concurrency-postgres.test.ts`
- `tests/finance-payment-http.test.ts`
- `tests/finance-payment-client.test.ts`
- `tests/finance-payment-ui.test.ts`
- `tests/finance-payment-adyen-adapter.test.ts`
- `tests/finance-payment-adyen-webhook-postgres.test.ts`
- `tests/finance-payment-emis-contract.test.ts`
- `tests/finance-payment-runtime-parity.test.ts`
- `scripts/run-finance-f3-payment-core.mjs`

---

### Task 1: Establish authoritative F3 branch/worktree and prove Journal compatibility

**Files:**
- Read: `docs/superpowers/specs/2026-09-05-finance-f3-payment-core-provider-adapter-design.md`
- Read: `docs/finance/FINANCE_EXECUTION_GUARDRAILS.md`
- Read: `src/modules/finance/journal-model.ts`
- Read: `src/modules/finance/journal-repository.ts`
- Read: `src/modules/finance/finance-command.ts`
- Read: `src/db/migrations/0027_finance_foundation.sql`
- Read: `src/db/migrations/0029_finance_journal_provenance.sql`
- Test: `tests/finance-journal-postgres.test.ts`

**Interfaces:**
- Consumes: closed F1/F2 remote baseline and existing Journal/idempotency contracts.
- Produces: one explicit implementation decision: existing `foundation_value_received/received_value` truthfully represents confirmed incoming Payment, or `JOURNAL_EXTENSION_REQUIRED=YES` with exact evidence before production code.

- [ ] **Step 1: Create isolated F3 worktree/branch from the exact authoritative post-F2 remote SHA**

Use the repository's worktree procedure. Name the branch `codex/finance-f3-payment-core-provider-adapter`. Record `BASE_SHA`, branch, worktree path, and clean status.

- [ ] **Step 2: Inspect current migration tip and Journal transaction semantics**

Verify the next free migration number; do not rewrite 0027–0034 or any later migration already present.

- [ ] **Step 3: Write a failing characterization test for PaymentConfirmed Journal semantics**

Add a focused test proving the intended Journal type/position pair can represent confirmed received value without implying Allocation or Obligation settlement. If existing types cannot make that statement truthfully, do not weaken the assertion.

- [ ] **Step 4: Run the characterization**

Run the focused test plus `tests/finance-journal-postgres.test.ts`.

Expected outcomes:
- PASS means existing Foundation type is semantically sufficient for F3-01 and is reused through the canonical Journal API.
- FAIL due to semantic mismatch means STOP and return `JOURNAL_EXTENSION_REQUIRED=YES` with the exact missing economic type/position; do not invent a generic workaround.

- [ ] **Step 5: Commit only if a test/document characterization change was required**

Commit message: `test(finance-f3): characterize payment journal boundary`.

---

### Task 2: Define the provider-neutral Payment domain and policy

**Files:**
- Create: `src/modules/finance/payment-model.ts`
- Create: `src/modules/finance/payment-policy.ts`
- Test: `tests/finance-payment-model.test.ts`

**Interfaces:**
- Consumes: `Money`, currency registry, financial profile resolution, institutional context.
- Produces:
  - `PaymentSourceType = 'manual_offline' | 'provider'`
  - `ManualPaymentMethod = 'cash' | 'bank_transfer' | 'external_reference'`
  - `PaymentConfirmationState = 'confirmed'`
  - `ConfirmIncomingPaymentIntent`
  - `normalizeConfirmIncomingPaymentIntent(input, context)`
  - `requirePaymentReadRole(actor)` / `requirePaymentWriteRole(actor)` / provider-admin policy.

- [ ] **Step 1: Write failing domain tests**

Cover exact Money, explicit currency, positive amount, allowed source/method combinations, provider reference requirements, timestamp distinctions, immutable-confirmed-state contract, no allocation fields/status, and rejection of browser-supplied institution/role authority.

- [ ] **Step 2: Run the domain test**

Run: `npx tsx tests/finance-payment-model.test.ts`

Expected: FAIL because payment model/policy do not exist.

- [ ] **Step 3: Implement the minimal domain model**

`ConfirmIncomingPaymentIntent` must contain only canonical provider-neutral material intent, including source, Money, payer/account reference when known, method/rail, external/provider reference when applicable, economic effective time, provider occurrence time when applicable, reason/evidence reference where required, and actor/system provenance inputs. It must not contain Obligation allocation or settlement fields.

- [ ] **Step 4: Implement policy using existing Finance role conventions**

`institution_admin` and `financial` may perform permitted manual payment operations; `director` is read-only where existing Finance policy already grants read; unsupported roles fail closed. Provider callbacks do not use membership role as external authenticity.

- [ ] **Step 5: Run tests and commit**

Expected: PASS.

Commit: `feat(finance-f3): define canonical payment domain`.

---

### Task 3: Add append-only PostgreSQL authorities for Payments and provider configuration

**Files:**
- Create: next free `src/db/migrations/NNNN_finance_payments_and_provider_config.sql`
- Test: `tests/finance-payment-schema-postgres.test.ts`

**Interfaces:**
- Consumes: institution ownership, Finance Money envelope, financial-profile provenance, `finance_command_results`, Journal schema.
- Produces database authorities equivalent to:
  - `finance_payments`
  - `finance_payment_provider_configurations`
  - `finance_provider_events` or a minimal durable provider inbox if required for dedupe/recovery
  - institution-scoped payment operational counter/reference if existing generic Finance counter cannot be reused safely.

- [ ] **Step 1: Write schema test before migration**

Assert tables do not yet exist, then express required constraints: tenant-scoped ownership, exact `NUMERIC(30,12)`-compatible Money envelope, immutable confirmed economic fields, provider/external identity uniqueness in institution+provider scope, no secret-value columns, provider configuration environment/status/method/currency metadata, tenant-safe FKs, command/provenance linkage.

- [ ] **Step 2: Run schema test and verify RED**

Use canonical disposable PostgreSQL safety gate and migration harness.

- [ ] **Step 3: Write the append-only migration**

Do not store API keys/HMAC secrets. Persist secret references/identifiers only. Minimize provider payload storage; store normalized identifiers plus digest/metadata unless exact official contract requires more.

- [ ] **Step 4: Add database protection for confirmed Payment immutability**

Prevent UPDATE/DELETE of confirmed economic amount, currency, provider identity, effective/provider timestamps, source, and financial provenance through constraints/triggers consistent with repository conventions. Operational non-economic metadata may only be mutable if the spec explicitly permits it.

- [ ] **Step 5: Run isolated migration twice**

Prove clean-chain migration and idempotent migration runner behavior.

- [ ] **Step 6: Commit**

Commit: `feat(finance-f3): add payment persistence authority`.

---

### Task 4: Implement canonical `ConfirmIncomingPayment` transaction boundary

**Files:**
- Create: `src/modules/finance/payment-repository.ts`
- Create: `src/modules/finance/payment-service.ts`
- Test: `tests/finance-payment-postgres.test.ts`
- Test: `tests/finance-payment-concurrency-postgres.test.ts`

**Interfaces:**
- Consumes: `ConfirmIncomingPaymentIntent`, `requireFinancialContext`, canonical Finance fingerprint/idempotency, Journal repository/confirmation API.
- Produces:
  - `confirmIncomingPayment(actorOrSystemContext, intent, idempotencyIdentity): Promise<Payment>`
  - `listPayments(actor, filters)`
  - `getPayment(actor, id)`

- [ ] **Step 1: Write RED PostgreSQL tests for manual confirmation**

Prove one Payment + one truthful Journal fact + command-result linkage in one transaction; exact Money round-trip; financial-profile provenance; generated operational reference; zero Obligation update/allocation rows.

- [ ] **Step 2: Add forced-failure rollback points**

Inject failure after Payment insert but before Journal, after Journal but before command-result/outbox, and prove zero partial canonical truth survives.

- [ ] **Step 3: Write RED idempotency/concurrency tests**

Prove same key+same fingerprint replay, same key+different intent conflict, 20 concurrent identical confirmations -> one Payment, two legitimate same-amount distinct identities -> two Payments, lost-response retry -> established result.

- [ ] **Step 4: Implement using existing `executeIdempotentFinanceCommand` and canonical fingerprint**

Do not create a second idempotency table/authority. The fingerprint must include every materially economic field: institution scope, source/provider identity, Money, account/payer, rail/method, effective/provider time, and material evidence/reference inputs.

- [ ] **Step 5: Persist Payment and Journal atomically**

The repository/application service must call the existing Journal boundary; it must not duplicate Journal SQL in webhook/controller code.

- [ ] **Step 6: Run tests and commit**

Commit: `feat(finance-f3): confirm incoming payments atomically`.

---

### Task 5: Implement institution Payment Provider Configuration authority

**Files:**
- Create: `src/modules/finance/payment-provider-model.ts`
- Create: `src/modules/finance/payment-provider-repository.ts`
- Test: extend `tests/finance-payment-postgres.test.ts` or add focused provider-config test if file size becomes unclear.

**Interfaces:**
- Produces provider-neutral configuration with provider key, environment, lifecycle, merchant/store reference, enabled methods, supported currencies, onboarding/config state, operational availability, capability/effective provenance, and server-only secret reference identifier.

- [ ] **Step 1: Write RED tests**

Prove tenant isolation, no secret values in rows/read projections, no automatic enablement from country, independent compatibility/enablement/availability/auth dimensions, and inactive/misconfigured provider cannot create confirmation candidates.

- [ ] **Step 2: Implement model/repository**

Provider keys initially include `adyen` and `emis_multicaixa`; do not make either mandatory for every institution.

- [ ] **Step 3: Run tests and commit**

Commit: `feat(finance-f3): add institutional provider configuration`.

---

### Task 6: Expose operational manual Payment HTTP boundary

**Files:**
- Create: `src/modules/finance/payment-http.ts`
- Modify: Finance/server route registration file identified during Task 1
- Test: `tests/finance-payment-http.test.ts`

**Interfaces:**
- Endpoints:
  - `GET /api/finance/payments`
  - `GET /api/finance/payments/:id`
  - `POST /api/finance/payments/manual`
- Manual mutation requires `Idempotency-Key`.

- [ ] **Step 1: Write RED HTTP integration tests against real PostgreSQL**

Cover 401, 403, foreign tenant 404/no disclosure, 422 invalid Money/method/context, 409 idempotency conflict, positive 201, replay response, exact persisted Payment+Journal, and zero Obligation mutation.

- [ ] **Step 2: Implement using `createRequireAuth` and existing Finance policy**

Institution and role come from backend context. The browser must not send authoritative institutionId/profileVersion/Journal type.

- [ ] **Step 3: Map errors canonically**

No raw SQL/internal provider messages.

- [ ] **Step 4: Run tests and commit**

Commit: `feat(finance-f3): expose manual payment API`.

---

### Task 7: Create the provider adapter contract and EMIS/MULTICAIXA Angola implementation boundary

**Files:**
- Create: `src/modules/finance/providers/payment-provider-adapter.ts`
- Create: `src/modules/finance/providers/emis-multicaixa-adapter.ts`
- Test: `tests/finance-payment-emis-contract.test.ts`

**Interfaces:**
- Define a provider-neutral adapter interface with explicit functions such as:
  - `authenticateEvent(rawBody, headers, config): Promise<ProviderAuthResult>`
  - `parseEvent(rawBody, headers): ProviderEventEnvelope`
  - `normalizeConfirmationCandidate(event, config): ProviderPaymentCandidate | null`
  - `buildProviderIdempotencyIdentity(candidate): ProviderIdentity`
- Adapter returns normalized candidate; it never writes Finance authority.

- [ ] **Step 1: Write contract tests first**

Use only official/approved EMIS/PST-SP protocol material actually available to the project. Prove event identity, method classification, normalization, authenticity hook failure -> no candidate, confirmation threshold mapping, and no provider-specific field leakage into canonical Payment intent.

- [ ] **Step 2: Implement `EmisMulticaixaAdapter`**

If no authorized sandbox/test endpoint or official signing protocol is available, expose explicit capability state `CONTRACT_READY` and tests using approved fixtures. Do not invent endpoints, signatures, headers, or credentials.

- [ ] **Step 3: Record the external dependency precisely**

In test/spec evidence, state which authorized sandbox/partner artifact is required to move from `CONTRACT_READY` to `LIVE_VERIFIED`.

- [ ] **Step 4: Commit**

Commit: `feat(finance-f3): define EMIS Multicaixa adapter contract`.

---

### Task 8: Implement Adyen sandbox adapter with real provider proof

**Files:**
- Create: `src/modules/finance/providers/adyen-adapter.ts`
- Test: `tests/finance-payment-adyen-adapter.test.ts`
- Test: `tests/finance-payment-adyen-webhook-postgres.test.ts`
- Modify: server-side secure configuration loader only if required by existing patterns
- Modify: `package.json` only if an official SDK dependency is demonstrably necessary.

**Interfaces:**
- Consumes server-only Adyen test credentials/merchant configuration from the existing secure mechanism.
- Produces verified normalized provider candidate into `ConfirmIncomingPayment`.

- [ ] **Step 1: Inspect current official Adyen sandbox/webhook requirements at execution time**

Use current official Adyen documentation. Record exact event type/confirmation threshold, HMAC/signature mechanism, test environment requirements, and merchant reference scope in implementation notes/tests. Do not code from remembered API shapes.

- [ ] **Step 2: Write deterministic adapter tests before network integration**

Fixtures must prove valid signature/event -> normalized candidate; invalid signature -> rejection; non-confirmation event -> no Payment candidate; duplicate reference normalization; amount/currency exact conversion without floats.

- [ ] **Step 3: Implement adapter with raw-body verification before JSON trust**

Never log secret/signature material or sensitive full payload.

- [ ] **Step 4: Add real sandbox integration test gated by explicit environment authorization**

The test must skip/fail with a clear `EXTERNAL_SANDBOX_REQUIRED` condition when authorized sandbox credentials are absent; it must never fabricate PASS. When credentials are available, obtain/ingest a real sandbox provider event and prove canonical Payment persistence through the same application service.

- [ ] **Step 5: Add duplicate-webhook PostgreSQL proof**

Replay the same verified event sequentially and 20-way concurrently; assert exactly one Payment and one Journal fact.

- [ ] **Step 6: Commit**

Commit: `feat(finance-f3): integrate Adyen sandbox adapter`.

---

### Task 9: Implement isolated provider webhook ingress and provider-admin HTTP

**Files:**
- Create: `src/modules/finance/payment-webhook-http.ts`
- Create: `src/modules/finance/payment-provider-http.ts`
- Modify: Finance/server route registration
- Test: extend `tests/finance-payment-http.test.ts` and `tests/finance-payment-adyen-webhook-postgres.test.ts`

**Interfaces:**
- Provider route resolves provider configuration without trusting institutionId from payload as authority.
- Verified event -> adapter -> normalized candidate -> canonical service.

- [ ] **Step 1: Write RED webhook boundary tests**

Cover invalid signature = zero effect, unknown/inactive config = zero effect, tenant/reference mismatch = fail closed, duplicate callback = established result, conflicting same identity = operational conflict/no second Payment.

- [ ] **Step 2: Implement isolated routes**

Do not reuse user bearer-auth semantics for provider callbacks. Provider authenticity + configured tenant/provider context are required.

- [ ] **Step 3: Add bounded provider-admin endpoints**

Expose status/config metadata without returning secret values. `institution_admin` may manage permitted configuration; other role rules follow spec.

- [ ] **Step 4: Run tests and commit**

Commit: `feat(finance-f3): add provider ingress and administration API`.

---

### Task 10: Implement authenticated Payment client and operational Recebimentos UI

**Files:**
- Create: `src/modules/finance/payment-client.ts`
- Create: `src/components/FinancePaymentsWorkspace.tsx`
- Create: `src/components/FinancePaymentsListView.tsx`
- Create: `src/components/FinancePaymentCreateView.tsx`
- Create: `src/components/FinancePaymentProvidersView.tsx`
- Modify: `src/components/FinanceWorkspace.tsx`
- Test: `tests/finance-payment-client.test.ts`
- Test: `tests/finance-payment-ui.test.ts`

**Interfaces:**
- Client obtains Firebase ID token using the canonical existing frontend pattern and adds `Idempotency-Key` to manual mutation.
- Workspace adds sibling navigation `Recebimentos` without altering Catalogue/Obligations behavior.

- [ ] **Step 1: Write RED client tests**

Prove token transport, no browser institution authority, idempotency header, controlled 401/403/409/422 mapping, and no provider secrets in client types.

- [ ] **Step 2: Implement client**

Use the same authentication transport pattern already corrected in F1/F2.

- [ ] **Step 3: Write RED UI tests**

Prove loading, empty, error/retry, list of confirmed Payments, `Não aplicado` indicator, manual receipt flow, deliberate Financial Account/payer selection when applicable, deliberate method selection, no hidden provider/default method selection, no obligation settlement action, no raw UUID/internal enums.

- [ ] **Step 4: Implement `Recebimentos` integrated workspace**

Manual form must show review before confirm and return the generated Payment reference. Amount/currency must obey institutional Money context; no silently invented currency.

- [ ] **Step 5: Implement provider configuration subview**

Show provider, environment, configuration/onboarding state, enabled methods/currencies, operational availability, last verification state. Never display secret values. Mark Adyen sandbox test-only; distinguish EMIS `CONTRACT_READY` from `LIVE_VERIFIED`.

- [ ] **Step 6: Run tests and commit**

Commit: `feat(finance-f3): add receipts and provider workspace`.

---

### Task 11: Build F3 aggregate, regression suite, and runtime-parity gate

**Files:**
- Create: `scripts/run-finance-f3-payment-core.mjs`
- Create: `tests/finance-payment-runtime-parity.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `npm run test:finance:f3:payment-core`.

- [ ] **Step 1: Write aggregate runner characterization**

The runner executes in deterministic fail-fast order: safety/domain/schema/repository/concurrency/HTTP/adapters/webhook/client/UI/runtime-parity characterization. It must never auto-set `TEST_DATABASE_LOCAL_AUTHORIZED=true`.

- [ ] **Step 2: Add runtime parity proof contract**

Before Human UAT, the launch/recovery procedure must report expected branch, expected SHA, server working directory, server branch/SHA, current migration tip, and absence of stale Nexus dev server on the UAT port. This test/script may characterize the contract; runtime inspection itself occurs during UAT preparation.

- [ ] **Step 3: Run F3 aggregate and existing regressions**

Run:

```bash
npm run test:finance:f3:payment-core
npm run test:finance:f2:account-obligation
npm run test:finance:f1:fee-catalogue
npm run test:finance:foundation
npm run test:fnd03
npm run lint
npm run build
git diff --check
npm run test:secrets
npm run test:artifacts
```

- [ ] **Step 4: Commit**

Commit: `test(finance-f3): add payment aggregate and regression gates`.

---

### Task 12: Final independent review, sandbox evidence, and Human UAT preparation

**Files:**
- Review every F3 changed file against the approved spec.
- Do not add product scope during review.

**Interfaces:**
- Produces one closeout report bound to exact remote SHA and one UAT-ready runtime.

- [ ] **Step 1: Perform bounded final diff review**

Explicitly verify:

- no Allocation table/command/status;
- no Obligation amount/status mutation;
- no provider direct Payment/Journal write;
- no browser institution/role/provider-secret authority;
- no secret values in code/DB projections/logs;
- no hard-coded country/provider authority;
- no fake EMIS live verification;
- Adyen sandbox proof is real when claimed;
- provider callbacks are authenticated before economic interpretation;
- canonical idempotency covers external identity + material normalized intent;
- 20 duplicate callbacks produce one economic Payment;
- confirmed Payment fields are immutable;
- exact Money/currency preserved;
- Journal fact is truthful and atomic;
- F1/F2 regressions remain green.

- [ ] **Step 2: Verify external-sandbox status honestly**

Return one of:

`ADYEN_SANDBOX=PASS_REAL`

or

`ADYEN_SANDBOX=BLOCKED_EXTERNAL_DEPENDENCY` with the exact missing credential/merchant/test dependency. Do not convert fixture-only tests into a real-sandbox PASS claim.

EMIS must return one of:

`EMIS_MULTICAIXA=CONTRACT_READY`

or

`EMIS_MULTICAIXA=LIVE_VERIFIED` only with real authorized external proof.

- [ ] **Step 3: Push normally and verify remote parity**

No force push. No merge. Confirm local HEAD == remote F3 branch SHA.

- [ ] **Step 4: Restart UAT runtime from final F3 HEAD**

Stop only stale Nexus dev/test process. Start frontend/backend from the exact F3 worktree. Apply migrations canonically. Prove frontend/backend/migration parity before opening browser UAT.

- [ ] **Step 5: Prepare exact Human UAT**

Manual path:

1. `Finanças & Contas -> Recebimentos`.
2. Confirm no hidden provider/method/account default.
3. `Registar recebimento`.
4. Select Financial Account/payer context.
5. Select `Numerário` or `Transferência bancária`.
6. Enter exact valid Money/currency under institution profile.
7. Add legitimate reference/evidence where method requires it.
8. Review and confirm.
9. Confirm generated Payment reference appears as `Confirmado` and `Não aplicado`.
10. Open associated Obligation and prove it remains unchanged/open because Allocation does not exist.
11. Refresh/reopen and prove Payment persists.

Adyen sandbox path, when external sandbox is available:

1. Confirm institution Adyen configuration shows `test` and operationally available.
2. Initiate the approved sandbox payment flow.
3. Complete the sandbox provider confirmation.
4. Ingest real verified webhook.
5. Confirm exactly one Nexus Payment appears with correct provider reference, Money, source/method, timestamps, and `Não aplicado` state.
6. Replay the webhook and prove no duplicate Payment.

Provider configuration view:

1. Secrets are never displayed.
2. Adyen visibly shows sandbox/test-only.
3. EMIS/MULTICAIXA shows `CONTRACT_READY` unless real authorized live/sandbox verification exists.

- [ ] **Step 6: Return the final implementation report**

Use exactly:

```text
SPEC=PASS
PLAN=PASS
JOURNAL_BOUNDARY=<PASS|BLOCKED>
PAYMENT_DOMAIN=<PASS|BLOCKED>
PAYMENT_PERSISTENCE=<PASS|BLOCKED>
MANUAL_PAYMENT=<PASS|BLOCKED>
PROVIDER_CONFIG=<PASS|BLOCKED>
ADAPTER_FRAMEWORK=<PASS|BLOCKED>
ADYEN_SANDBOX=<PASS_REAL|BLOCKED_EXTERNAL_DEPENDENCY>
EMIS_MULTICAIXA=<CONTRACT_READY|LIVE_VERIFIED|BLOCKED>
WEBHOOK_AUTH=<PASS|BLOCKED>
IDEMPOTENCY=<PASS|BLOCKED>
CONCURRENCY_20X=<PASS|BLOCKED>
TENANT_ISOLATION=<PASS|BLOCKED>
PAYMENT_JOURNAL_ATOMICITY=<PASS|BLOCKED>
NO_ALLOCATION_SIDE_EFFECT=<PASS|BLOCKED>
UI=<PASS|BLOCKED>
RUNTIME_SHA_PARITY=<PASS|BLOCKED>
F3_AGGREGATE=<PASS|FAIL>
F2_REGRESSION=<PASS|FAIL>
F1_REGRESSION=<PASS|FAIL>
FOUNDATION=<PASS|FAIL>
FND03=<PASS|FAIL>
LINT=<PASS|FAIL>
BUILD=<PASS|FAIL>
SECRETS=<PASS|FAIL>
ARTIFACTS=<PASS|FAIL>
BASE_SHA=<sha>
REMOTE_SHA=<sha>
REMOTE_PARITY=<MATCH|MISMATCH>
FINANCE_F3_01=<READY_FOR_HUMAN_UAT|BLOCKED>
```

If `ADYEN_SANDBOX=BLOCKED_EXTERNAL_DEPENDENCY`, do not claim the provider integration is complete. The manual Payment Core and adapter framework may be technically ready, but FINANCE-F3-01 closeout remains blocked if the approved spec requires the real sandbox proof and the external dependency has not been supplied.

---

## Plan Self-Review Result

- Spec coverage: Payment Core, manual producer, provider configuration, adapter interface, Adyen sandbox, EMIS Angola contract, webhook security, idempotency/concurrency, Journal, Money, tenant isolation, UI, regression gates, and runtime parity all map to explicit tasks.
- Scope: Allocation, obligation settlement, reconciliation, refunds/chargebacks, treasury, fiscal, payouts/settlement, automatic Enrollment integration, and multi-provider production rollout are not implemented here.
- Type/authority consistency: all producers converge on `ConfirmIncomingPayment`; provider adapters return normalized candidates and never write canonical Finance authority directly.
- External-evidence honesty: Adyen real sandbox and EMIS live status cannot be claimed from fixtures alone.
- No placeholders: execution choices that depend on repository state are expressed as mandatory discovery gates with explicit stop criteria rather than invented migration numbers, API shapes, credentials, or provider protocols.
