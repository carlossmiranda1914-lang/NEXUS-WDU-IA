# Nexus Edu IA — FINANCE-F3-01 Payment Core + Provider Adapter Foundation

**Status:** DESIGN APPROVED BY PRODUCT OWNER — IMPLEMENTATION NOT YET AUTHORIZED
**Date:** 2026-09-05
**Scope:** next Finance vertical after closed FINANCE-F1 Fee Catalogue and FINANCE-F2 Financial Account + Financial Obligation Core.

## 1. Purpose

FINANCE-F3-01 introduces the first canonical incoming-payment authority for Nexus Edu IA and the adapter boundary through which both manual/offline and provider-driven receipts become authoritative Finance facts.

The objective is not to build a generic payment screen. The objective is to establish one international Payment Core that can safely support institutions operating in Europe, Angola, and later other markets without hard-coding country, bank, currency, payment rail, or provider into the canonical Finance domain.

This design is bound by the Finance constitution already approved in `docs/finance/FINANCE_FOUNDATION_PREPARATION.md` and by the active execution guardrails in `docs/finance/FINANCE_EXECUTION_GUARDRAILS.md`.

## 2. Position in the canonical Finance sequence

Existing closed/established authorities:

1. Fee Catalogue — what may be charged.
2. Financial Account + Financial Obligation — who is financially responsible and what amount is legitimately due.

FINANCE-F3-01 adds:

3. Payment — what value has been server-authoritatively confirmed as received.

Later verticals remain separate:

4. Allocation — explicit application of confirmed value to obligations.
5. Reconciliation — verification against independent/external evidence.
6. Provider expansion, refunds/reversals, treasury, fiscal/document, reporting, and other later capabilities.

Payment confirmation MUST NOT settle an obligation by itself. A confirmed payment may remain unapplied until a later Allocation authority exists.

## 3. Core architectural law

There is exactly one canonical incoming-payment confirmation authority.

Conceptual command:

`ConfirmIncomingPayment`

All producers converge on that authority.

Initial producers in this mission:

- manual/offline receipt flow;
- Adyen sandbox adapter for a real automatic-provider proof;
- EMIS/MULTICAIXA contract adapter boundary for Angola, implemented structurally and contract-tested without pretending a live provider integration where sandbox/credentials/contract are unavailable.

Future producers may include additional rails/providers, imports, bank feeds, or verified automation, but none may bypass the canonical command or write directly to Journal, balances, projections, or Payment persistence.

## 4. International-core / regional-adapter model

The Payment Core MUST remain provider-neutral.

The canonical domain may represent:

- institution;
- payment identity;
- Money;
- payer / Financial Account context when applicable;
- rail/method classification;
- provider or manual source;
- provider/external reference;
- provider occurrence time when applicable;
- economic effective time;
- authoritative recorded time;
- evidence/provenance;
- confirmation status;
- idempotency identity;
- correlation identity;
- immutable provider payload digest/reference where required;
- financial profile/policy provenance.

Provider-specific payloads, API credentials, webhook signature schemes, region-specific parameters, and merchant identifiers belong in adapter/configuration boundaries rather than the canonical Payment model.

## 5. Institution Payment Provider Configuration

Each institution controls its own provider/rail configuration. Nexus MUST NOT require schools to share one Nexus merchant/bank account as the canonical product model.

Conceptual authority:

`InstitutionPaymentProviderConfiguration`

Minimum concerns:

- institution-scoped UUID;
- provider key;
- environment (`test` / `live` where supported);
- status/lifecycle;
- merchant/account/store reference as required by provider;
- supported transaction currencies;
- enabled payment methods/rails;
- onboarding/configuration state;
- operational availability state;
- capability/effective-period provenance;
- secret reference only, never secret value in browser or ordinary application records;
- created/updated audit metadata.

The following dimensions remain distinct:

1. regional/provider compatibility;
2. institution enablement/contracting;
3. technical/operational availability;
4. user authorization.

A country never silently enables a provider. A provider never grants user authority.

## 6. Payment domain

A Payment represents value that the server can legitimately state was received according to the applicable confirmation threshold for its source/rail.

A Payment is NOT:

- an Obligation;
- an Allocation;
- an invoice/document;
- reconciliation evidence by itself;
- a mutable balance;
- a browser assertion;
- a provider webhook row treated as economic truth merely because it was received.

Minimum canonical Payment properties:

- `id` UUID;
- `institutionId`;
- server-generated operational payment reference;
- source type (`manual_offline`, `provider`);
- provider key when applicable;
- payment method/rail classification;
- provider/external payment reference when applicable;
- Financial Account reference when known/applicable;
- payer Person reference when known/applicable;
- Money snapshot: exact amount + currency;
- economic/effective timestamp;
- provider occurrence timestamp when applicable;
- recorded timestamp;
- confirmation state;
- institution financial profile/policy provenance;
- command/idempotency provenance;
- actor/system provenance;
- evidence relationship where required;
- immutable provider normalized fingerprint/digest where applicable.

## 7. Payment lifecycle

FINANCE-F3-01 keeps lifecycle intentionally narrow.

Canonical authoritative state for this slice:

- `confirmed`

Provider attempts/events that are not yet confirmed may exist as non-economic adapter/ingestion state if needed, but they MUST NOT enter canonical Payment truth or canonical Finance balances/projections.

Do not introduce fake `paid`, `settled`, `allocated`, `reconciled`, or obligation-settlement states.

Post-confirmation corrections are not destructive updates. Full refund/reversal/chargeback implementation is out of scope for this mission unless a provider sandbox callback must be represented as non-authoritative pending evidence for a later slice.

## 8. Manual/offline producer

Manual/offline entry exists because schools may legitimately receive value outside an online gateway.

Supported initial classifications may include:

- cash;
- bank transfer verified by an authorized Finance user;
- external reference receipt where the institution has valid evidence.

The operator may enter only legitimate source context. Server rules validate Money, institutional financial context, authorization, timestamps, evidence requirements, and idempotency.

Manual entry MUST NOT become a shortcut around provider or reconciliation rules. It represents a deliberate authorized assertion that value was received according to the institution's accepted offline evidence policy.

## 9. Adyen sandbox adapter

Adyen is the first online provider reference adapter for this mission because the approved product direction requires one real sandbox integration to prove the adapter architecture instead of postponing all external-provider work.

The adapter MUST be isolated behind a provider interface and MUST NOT leak provider-specific structures into Payment Core consumers.

Required capabilities for the sandbox proof:

- institution-scoped provider configuration;
- test credentials loaded only from secure server-side configuration/secret mechanism;
- creation/initiation of a provider payment flow only as far as required to obtain a real sandbox provider event;
- webhook/callback ingestion;
- provider authenticity/signature verification where supported;
- provider reference extraction;
- normalized provider event mapping;
- duplicate callback handling;
- same external identity + conflicting material content detection;
- canonical `ConfirmIncomingPayment` invocation only after the provider confirmation threshold is satisfied;
- no direct Journal/Payment table write from webhook controller code.

The sandbox is evidence of architecture, not authorization to hard-code Adyen as the universal Nexus provider.

## 10. EMIS / MULTICAIXA Angola adapter contract

Angola is a first-class target context in the architecture. It MUST NOT be represented as a future afterthought.

FINANCE-F3-01 therefore defines and implements an `EmisMulticaixaAdapter` contract boundary sufficient for:

- institution-scoped configuration;
- supported rail/method classification;
- external/provider operation identity;
- normalized event mapping;
- authenticity verification hook;
- idempotency identity;
- confirmation-threshold mapping;
- canonical Payment command invocation;
- contract fixtures/tests based on the approved integration contract available to the project.

A live/sandbox call MUST NOT be fabricated if no authorized test endpoint, credentials, partner contract, or official protocol is available. In that case the adapter remains `CONTRACT_READY` rather than `LIVE_VERIFIED`, and the exact missing external dependency is documented.

The architecture must allow a certified/local PSP/PST-SP or direct authorized EMIS integration to plug into this boundary later without changing Payment Core semantics.

## 11. Provider adapter interface

Every provider adapter must expose a narrow, testable interface conceptually equivalent to:

- resolve/validate institution provider configuration;
- initiate provider flow where the rail requires initiation;
- authenticate incoming provider event;
- parse provider event;
- normalize to a provider-neutral payment confirmation candidate;
- classify confirmation threshold/result;
- produce canonical idempotency/correlation identity;
- call or return into the application service that owns `ConfirmIncomingPayment`.

Adapters MUST NOT:

- authorize institution membership;
- invent institution IDs from untrusted payload fields;
- create Financial Accounts/Persons;
- write Journal rows directly;
- write canonical Payment rows directly;
- allocate Payment to Obligation;
- mark Obligation as paid;
- persist secrets in browser/localStorage/source control.

## 12. Provider event ingestion

Provider event ingestion is an untrusted external boundary.

Required sequence:

`HTTP event -> provider route -> raw-body/signature verification -> provider configuration resolution -> provider-event identity -> normalization -> canonical intent fingerprint -> idempotency/concurrency guard -> ConfirmIncomingPayment -> PostgreSQL commit -> audit/outbox -> response`

If authenticity cannot be proven, there is zero economic effect.

If the provider event is duplicated, the same canonical result is returned/recovered without a second Payment.

If the same external identity arrives with materially different normalized economic intent, processing fails closed and records an operational exception without creating a second economic fact.

## 13. Idempotency, concurrency, and lost-response law

The mission MUST prove all of the following against real PostgreSQL:

- sequential duplicate callback -> one Payment;
- 20 parallel duplicate callbacks -> one Payment;
- same provider identity + same canonical fingerprint -> same established result;
- same provider identity + different Money/currency/institution/material intent -> conflict;
- same manual idempotency key + same canonical intent -> replay same Payment;
- same manual key + different intent -> conflict;
- simulated commit success + response loss + retry -> recover existing Payment;
- two legitimate payments of equal amount are both accepted when their canonical identities differ.

Browser debounce is not a correctness mechanism.

## 14. Money and currency

Payment Money uses the existing canonical Money contract.

Requirements:

- exact decimal representation;
- no float/real/double as authority;
- explicit transaction currency;
- functional-currency context preserved when applicable;
- no silent currency conversion;
- no silent aggregation of unlike currencies;
- settlement/rail precision validated according to existing Finance policy/provider rules;
- historical confirmed Money is immutable.

## 15. Journal boundary

`PaymentConfirmed` is an economic fact anticipated by the approved Finance constitution.

FINANCE-F3-01 implementation must bind to the existing Finance Journal through an explicit transaction type/position semantics that truthfully represent confirmed incoming value.

The implementation MUST stop for architecture adjudication if the current Journal model cannot truthfully represent a confirmed incoming payment without abusing `foundation_value_received` or another generic type.

A provider callback itself is not a Journal fact. Only canonical server confirmation after validation creates economic truth.

## 16. Financial Account / Obligation relationship

A Payment may reference a Financial Account or payer context where known, but Payment confirmation does not require Allocation.

FINANCE-F3-01 MUST NOT:

- reduce Obligation amount;
- change Obligation status to paid/settled;
- create Allocation rows;
- infer allocation from equal amount;
- choose the oldest obligation automatically;
- hide unapplied money.

Confirmed but unapplied value must remain explicitly representable for the next Allocation vertical.

## 17. Persistence

Use the next free append-only migration from the authoritative implementation baseline.

Likely authorities include concepts equivalent to:

- `finance_payments`;
- `finance_payment_provider_configurations`;
- `finance_provider_events` or a bounded inbox/receipt authority where needed;
- supporting tenant-safe constraints/indexes.

Exact names follow existing repository conventions.

Persistence requirements:

- institution-scoped ownership;
- tenant-safe composite relations where applicable;
- Money exact persistence using established Finance numeric envelope;
- immutable confirmed economic fields;
- external provider identity uniqueness in proper provider/institution scope;
- durable canonical idempotency;
- raw provider payload minimization/redaction;
- cryptographic/hash evidence where full payload retention is unnecessary;
- no secrets in canonical Finance tables;
- no destructive migration of economic history;
- atomic Payment + Journal + required audit/outbox boundary as defined by existing Finance transaction law.

## 18. Security and secret handling

Provider credentials and signing secrets are server-only.

Forbidden:

- browser-visible secrets;
- source-controlled secrets;
- secrets in ordinary DB response projections;
- logging bearer tokens, API keys, HMAC secrets, full card data, or sensitive provider payloads;
- passing secrets inline in shell approval commands;
- storing PAN/CVV as Nexus authority.

Use the repository's established secret/configuration mechanism. If a provider requires handling that would materially expand PCI/security scope, stop and minimize the Nexus boundary rather than silently accepting the expanded responsibility.

## 19. Authorization

Authorization remains server-derived from active institutional context and Finance capability.

Minimum product policy for the first slice:

- `institution_admin`: read/manage institutional provider configuration as permitted; read payments; perform approved manual receipt actions;
- `financial`: read payments and perform operational manual receipt actions where policy permits;
- `director`: read-only if existing Finance policy grants it;
- other roles: fail closed.

Provider callbacks are system/external actors, not user memberships. Their authority comes only from verified provider authenticity + resolved institution/provider configuration + canonical Finance application service rules.

## 20. HTTP/API boundary

Conceptual API families:

Operational:

- `GET /api/finance/payments`
- `GET /api/finance/payments/:id`
- `POST /api/finance/payments/manual`

Provider administration:

- `GET /api/finance/payment-providers`
- bounded configuration endpoints required for test-mode provider setup without exposing secrets.

Provider ingress:

- provider-specific webhook route(s) under a clearly isolated integration namespace.

Mutation endpoints require canonical idempotency where appropriate.

Errors remain controlled:

- 401 unauthenticated user operation;
- 403 unauthorized capability;
- 404 foreign/not-visible resource;
- 409 duplicate identity with conflicting canonical intent / concurrency conflict;
- 422 invalid domain input/configuration;
- provider ingress authentication failure returns provider-appropriate rejection without economic effect;
- no raw SQL/provider-secret leakage.

## 21. Finance UI

Extend the Finance internal navigation coherently:

`Finanças & Contas`

- `Catálogo de Emolumentos`
- `Obrigações Financeiras`
- `Recebimentos`

`Recebimentos` is an operational workspace, not a gateway-configuration dump.

Minimum list projection:

- operational Payment reference;
- confirmed amount/currency;
- payer/Financial Account when known;
- source/method in user-facing language;
- provider/external reference where appropriate and safe;
- effective date;
- recorded date;
- `Não aplicado` indicator while Allocation does not exist.

Primary operation:

- `Registar recebimento` for controlled manual/offline confirmation.

Provider configuration belongs in a dedicated administrative subview.

Do not expose raw UUIDs, provider payload JSON, internal enum names, or secret/configuration internals as normal school UX.

## 22. Manual receipt UX

The manual flow must require deliberate user choices and no hidden economic defaults.

Conceptual sequence:

1. Select/confirm Financial Account or payer context when applicable.
2. Select manual method (`Numerário`, `Transferência bancária`, or approved external-reference method).
3. Enter exact Money and currency only where allowed by institutional context.
4. Enter occurrence/effective context where legitimate.
5. Enter external/bank/reference evidence where required.
6. Review.
7. Confirm receipt.
8. Return to Recebimentos list with generated operational Payment reference and `Não aplicado` state.

No obligation is silently selected or settled.

## 23. Provider configuration UX

The institution should see operational configuration status, not low-level provider internals.

Minimum concepts:

- provider;
- environment;
- onboarding/configuration state;
- enabled methods;
- supported currencies;
- operational availability;
- last verification/test state;
- no secret values displayed after submission.

Adyen sandbox must be clearly marked test-only.

EMIS/MULTICAIXA configuration must clearly distinguish `CONTRACT_READY` from `LIVE_VERIFIED`.

## 24. Test strategy

Implementation is TDD-first.

### Domain tests

Prove:

- Payment confirmed semantics;
- Money precision/currency rules;
- immutable confirmed economics;
- provider-neutral normalized intent;
- no Allocation side effects;
- manual/provider source validation;
- temporal/provenance requirements.

### PostgreSQL tests

Prove:

- schema/constraints;
- exact Money round-trip;
- tenant-safe relationships;
- Payment + Journal atomicity;
- rollback on injected failure;
- durable idempotency;
- 20-way concurrent duplicate provider event;
- same external identity conflicting intent;
- lost-response retry recovery;
- historical immutability;
- no destructive migration behavior.

### HTTP tests

Prove:

- user 401/403/404/409/422;
- positive manual confirmation reaches PostgreSQL and Journal;
- foreign institution access fails closed;
- provider ingress invalid authenticity => zero effect;
- provider ingress valid sandbox event => exactly one Payment;
- duplicate callback => same result/no duplicate;
- provider/configuration mismatch => fail closed.

### Adapter contract tests

Adyen:

- sandbox normalization;
- authenticity verification;
- success threshold mapping;
- duplicate event mapping;
- conflicting event detection;
- no provider-specific data leakage into core public types.

EMIS/MULTICAIXA:

- contract interface completeness;
- fixture normalization;
- authenticity hook behavior;
- external identity/idempotency mapping;
- confirmation threshold contract;
- no claim of live verification without authorized external environment.

### Client/UI tests

Prove:

- Firebase auth on user-facing APIs;
- no provider secrets in browser;
- idempotency key on manual mutation;
- Recebimentos list states;
- manual receipt sequence;
- provider configuration safe projection;
- `Não aplicado` is explicit;
- no automatic Obligation settlement;
- operational language only.

## 25. Human UAT

Before UAT, runtime parity is mandatory:

- intended Finance branch;
- final HEAD SHA;
- frontend and backend same SHA;
- migrations current;
- no stale Nexus process;
- Adyen sandbox adapter runtime/config corresponds to the same final code state.

Human UAT requires two paths.

### UAT A — Manual receipt

1. Finance -> Recebimentos.
2. Confirm empty/list state.
3. Registar recebimento.
4. Select legitimate payer/Financial Account context.
5. Select manual method.
6. Enter valid Money/evidence context.
7. Confirm.
8. Payment appears once as confirmed and `Não aplicado`.
9. Existing Obligation remains unchanged/unsettled.
10. Retry/reload does not duplicate the Payment.

### UAT B — Real provider sandbox

1. Institution has Adyen test configuration enabled.
2. Start the supported sandbox payment flow.
3. Complete provider sandbox payment.
4. Provider callback reaches Nexus.
5. Nexus verifies authenticity and confirmation threshold.
6. Exactly one Payment appears in Recebimentos.
7. Provider/external reference is traceable safely.
8. Re-deliver the same provider event repeatedly.
9. Still exactly one Payment exists.
10. Payment remains `Não aplicado`; Obligation remains untouched until Allocation exists.

EMIS/MULTICAIXA is not declared live UAT PASS until an authorized sandbox/test integration is available. Its F3-01 acceptance is contract-readiness plus deterministic adapter tests.

## 26. Scale and reliability target

The architecture must not be designed around a fragile 1,000-payments/day ceiling.

F3-01 must be structurally safe for provider callback bursts and institutional concurrency through:

- durable PostgreSQL idempotency;
- external-event uniqueness;
- bounded transaction scope;
- recoverable outbox/downstream processing;
- no process-local lock as economic correctness;
- retry-safe ingress;
- no synchronous dependence on projections for canonical commit.

Performance/load characterization should include a representative burst test or repository-level concurrency proof sufficient to show that correctness does not degrade under repeated/parallel callbacks. This mission does not require a full production capacity certification.

## 27. Explicit scope exclusions

Do NOT implement in FINANCE-F3-01:

- Allocation;
- obligation settlement/paid state;
- auto-match to oldest obligation;
- reconciliation workflow;
- full refund/reversal/chargeback domain;
- payout/settlement accounting;
- treasury/cash-register management;
- fiscal invoice/document issuance;
- penalties/discounts/installments;
- Enrollment-to-Finance automation;
- production enablement of multiple online providers;
- unsupported live EMIS integration;
- card-data vaulting;
- generic country-specific logic inside Payment Core.

## 28. STOP conditions

Implementation must stop for adjudication if:

- current Journal semantics cannot truthfully represent `PaymentConfirmed`;
- provider integration would require direct provider -> Payment/Journal writes;
- institution ownership cannot be resolved safely from provider configuration/event;
- provider authenticity cannot be verified to the required threshold;
- implementation requires storing prohibited payment-card data/secrets;
- an applied migration would need destructive rewrite;
- current Finance laws would need to change;
- Adyen sandbox access is unavailable and the code would otherwise fabricate a live/sandbox proof;
- EMIS/MULTICAIXA official/authorized contract information is insufficient to implement the contract adapter honestly.

Ordinary implementation choices are self-resolvable when they preserve the approved laws.

## 29. Completion gate

FINANCE-F3-01 may be declared `READY_FOR_HUMAN_UAT` only when:

- spec and implementation plan are approved;
- Payment Core domain and PostgreSQL authority are implemented;
- manual producer is operational;
- Adyen sandbox adapter is operational with real sandbox evidence;
- EMIS/MULTICAIXA contract adapter is structurally ready and honestly classified;
- provider configuration is institution-scoped and secret-safe;
- Journal integration is semantically correct;
- idempotency/concurrency/lost-response proofs pass;
- F1/F2/Foundation/FND03 regressions pass;
- lint/build/diff/secrets/artifacts gates pass;
- runtime SHA parity is proven before UAT.

Human UAT PASS is required before the vertical is closed/frozen.

## 30. Design decision summary

Approved direction:

- one international Nexus Payment Core;
- one canonical `ConfirmIncomingPayment` authority;
- manual/offline producer retained as a legitimate real-world rail, not a substitute for online providers;
- one real provider sandbox in F3-01: Adyen;
- Angola represented from the start through an EMIS/MULTICAIXA adapter contract boundary;
- institution-specific provider configurations;
- provider callbacks are untrusted ingress, never direct economic authority;
- Payment confirmation remains separate from Allocation and Reconciliation;
- confirmed Payments are immutable and may remain unapplied;
- provider expansion occurs by adding adapters, not rebuilding Finance Core;
- runtime SHA parity before every Human UAT is mandatory.
