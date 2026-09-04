# Nexus Edu IA — Finance Foundation Implementation Design

**Status:** SPEC FOR PRODUCT OWNER REVIEW — NOT IMPLEMENTATION AUTHORITY
**Date:** 2026-09-03
**Scope:** Finance Foundation only — F0 Financial Constitution, F1 Institutional Financial Context, F2 Money Model, F3 Operational Journal Model, F4 Transaction/Persistence/Recovery Model.
**Implementation authorization:** NO. Approval of this spec is required before an implementation plan or executable Finance mission is created.

## 1. Purpose

This specification converts the approved F0–F4 Finance architecture into one implementation-ready contract. Its purpose is to let a new engineer/agent implement the Finance foundation without relying on chat history, inventing financial semantics, preserving hidden legacy authority, or expanding prematurely into Payments, Allocation, Reconciliation, Reporting, Payables, Fiscal or UI.

The implementation target is a **real international Financial Operations Core foundation**: server-authoritative, institution-scoped, exact-decimal, append-oriented, idempotent, transactional, auditable, replayable and provable against real PostgreSQL.

The first implementation stage is deliberately not a complete Finance product. It is the minimum durable authority on which later obligations, payments, expenses/payables, allocation, reconciliation, providers and reporting can safely depend.

## 2. Authority and source precedence

When this specification conflicts with another source, resolve authority in this order:

1. Product Owner-approved F0–F4 Finance decisions.
2. Canonical Nexus architecture / ADRs / engineering governance.
3. This implementation design.
4. Future approved implementation plan and mission.
5. Code/tests.

Primary Finance design records for this spec:

- `docs/finance/FINANCE_FOUNDATION_PREPARATION.md` — F0 + F1 and product direction.
- `docs/finance/FINANCE_F2_MONEY_MODEL_PREPARATION.md` — F2-D01 through D04.
- `docs/finance/FINANCE_F2_D05_D13_APPROVED_DECISIONS.md` — F2-D05 through D13.
- `docs/finance/FINANCE_F2_COMPLETENESS_REVIEW.md` — F2 closure.
- `docs/finance/FINANCE_F3_LEDGER_MODEL_REVIEW.md` — F3-D01 through D08 and proof contract.
- `docs/finance/FINANCE_F4_PERSISTENCE_RECOVERY_REVIEW.md` — F4-D01 through D04 and proof contract.

This specification must not silently weaken those records.

## 3. Scope boundary

### 3.1 In scope for the foundation implementation

The implementation plan derived from this spec may create only the minimum authority needed to prove F0–F4:

- Institution Financial Profile authority and version resolution sufficient for foundation validation.
- canonical Currency Registry snapshot mechanism sufficient for supported foundation currencies.
- exact-decimal value types: `Money`, calculation decimal infrastructure, `DecimalRatio`, `Percentage`, directional `ExchangeRate`.
- canonical decimal normalization and transport parsing/serialization.
- monetary quantization/remainder primitives required by the foundation proof.
- explicit Conversion Evidence contract sufficient to persist/reproduce an economic conversion when exercised by the foundation.
- Operational Financial Journal foundation: Journal Transaction + typed Journal Entries/Positions.
- Journal lifecycle/confirmation boundary.
- causal linkage primitives for reversal/compensation proof.
- scoped idempotent command identity/fingerprint/result authority.
- required financial audit/provenance linkage for foundation commands.
- durable outbox/event intent needed to prove downstream recoverability.
- one or more minimal rebuildable Finance projections used only to prove projection authority/rebuild semantics.
- PostgreSQL migrations, constraints, tenant-safe relationships, concurrency protection and restart/recovery behavior.
- explicit legacy fences necessary to prove that mutable `outstandingFees` or equivalent paths do not become Finance authority.

### 3.2 Explicitly out of scope

The foundation implementation must not opportunistically build:

- complete Obligation lifecycle;
- payment provider integrations or provider checkout UX;
- multi-obligation / multi-student allocation policy;
- reconciliation workflow/state machine;
- refunds as a full product workflow;
- expense/payable operational workflow beyond any minimal typed journal fact needed solely to prove generic Journal behavior;
- treasury/cash register/bank account operations;
- fiscal invoice/receipt issuance;
- tax engine;
- accounting chart of accounts / statutory general ledger;
- FX revaluation and gain/loss accounting;
- MB WAY, Multibanco, MULTICAIXA/MCX Express or any country/provider-specific adapter;
- full reports, Excel templates, Power BI feeds or dashboard UX;
- Student 360 Finance UI;
- final Financial Account/Obligation domain from F6.

If implementation cannot prove F0–F4 without pulling one of these domains into authority, that is a STOP condition and architecture must be adjudicated rather than silently expanding scope.

## 4. Constitutional invariants

Every implementation choice must preserve all of the following:

1. Confirmed economic facts are immutable historical authority.
2. Material correction is append-only through an explicit reversal/compensating economic fact.
3. Balance/financial position is derived, rebuildable and never independently editable authority.
4. Obligation, Payment, Allocation, Financial Document and Reconciliation remain separate future authorities; the foundation may not collapse them.
5. Browser, Excel, BI, AI, provider callback or background worker may not directly create Journal authority outside an authorized Finance command.
6. Institution and Membership/capability context are resolved server-side; foreign-tenant references fail closed and non-disclose.
7. Financial policy/context is versioned/effective-dated; current settings may not reinterpret confirmed history.
8. Economic effective time, recorded time and provider/external occurrence time remain distinguishable where applicable.
9. Financial Fact, Audit Record and Evidence are separate but linked concepts.
10. Technical failure is not automatically economic failure; ambiguous outcomes recover from canonical authority before a new fact is created.
11. Finance does not duplicate Person, Student, Enrollment, Membership or Academic authority.
12. Legacy mutable `outstandingFees` and equivalent convenience fields cannot become canonical balance authority.

Any implementation path violating one of these is P0 and blocks the foundation gate.

## 5. Institution Financial Context contract

### 5.1 Institution Financial Profile

Finance requires one institution-scoped server-authoritative Financial Profile entrypoint. The profile must resolve, for an economic operation:

- `institutionId` from server-authoritative InstitutionalContext;
- primary financial jurisdiction;
- functional currency effective for the operation;
- financial timezone;
- financial calendar / period context needed by foundation semantics;
- monetary/rounding policy version reference;
- relevant capability availability state;
- profile version/effective interval.

No hidden default may be invented. Missing/incompatible context blocks the affected authoritative operation.

### 5.2 Independence of context axes

Jurisdiction, currency, locale, timezone and provider are independent. Country selection must never infer provider enablement, and a currency code must never infer jurisdiction.

### 5.3 Historical profile provenance

Any confirmed fact whose meaning depends on profile/policy context must persist stable provenance sufficient to answer which version/context governed it. Later profile changes must not rewrite historical facts or projection replay.

## 6. Exact-decimal monetary model

### 6.1 Money

Canonical `Money` is an immutable value with exactly:

- normalized exact decimal amount;
- canonical recognized currency code.

Authoritative monetary arithmetic must never use JavaScript `number`, PostgreSQL floating-point types, `NaN`, Infinity or locale-formatted text as economic truth.

Canonical transport representation is conceptually:

```json
{ "amount": "1234.56", "currency": "EUR" }
```

### 6.2 Precision envelopes

- Money: maximum 30 total decimal digits and maximum 12 fractional digits.
- DecimalRatio / ExchangeRate: maximum 30 total digits and maximum 18 fractional digits.

These are representation envelopes, not permission for every operation to use the maximum scale.

### 6.3 Canonical normalization

Money identity is mathematical value + currency, not lexical formatting. Accepted equivalent decimal representations must normalize deterministically.

Required laws:

- leading zeros do not create a new value identity;
- insignificant trailing fractional zeros do not create a new value identity;
- explicit positive sign is not part of canonical identity;
- negative zero normalizes to zero;
- scientific notation is not canonical transport input;
- locale thousands/decimal separators are not canonical transport input;
- equivalent Money values generate identical canonical serialization/hash/idempotency material.

Required properties:

`normalize(normalize(x)) = normalize(x)`

`Money.equals(a,b) => canonicalSerialize(a) == canonicalSerialize(b)`

### 6.4 Arithmetic

Direct addition, subtraction, equality and ordering require identical currency.

Cross-currency arithmetic/comparison must fail unless performed by an explicit conversion operation. No Money method or helper may perform hidden FX lookup or reciprocal conversion.

`Money × Money` is prohibited.

Money may interact with typed exact-decimal ratios/rates only through a high-precision calculation result; the result does not become canonical Money before explicit quantization.

### 6.5 Quantization and remainder

Quantization is explicit. Rounding mode and remainder-allocation strategy are separate policy concepts.

A distribution must preserve value exactly:

`sum(parts) = original Money`

Remainders may not disappear, be randomly assigned, or be corrected in the frontend. Confirmed Money is never retroactively re-quantized because policy changed.

### 6.6 Sign and economic semantics

Money may structurally represent zero or negative values, but operation validity is defined by the command/domain. Negative values may not be used to fake Refund, Reversal, Credit, Adjustment, Expense or Payment semantics.

## 7. Currency Registry and FX contract

### 7.1 Currency Registry

Finance uses an internal versioned registry based on controlled ISO 4217 snapshots. Runtime economic operations may not depend on fetching ISO/provider metadata from the network.

Registry recognition and institutional enablement are separate. A valid ISO currency is not automatically enabled for every institution.

Historical currency metadata remains interpretable; a historical/special code is not automatically valid for new economic facts.

### 7.2 ExchangeRate

`ExchangeRate` is an exact-decimal typed value containing at least:

- base currency;
- quote currency;
- positive exact rate;
- explicit direction: `1 base = rate quote`.

Rate inversion is never implicit. A reciprocal, if needed, is an explicit derived value with preserved provenance.

### 7.3 Conversion Evidence

An economic conversion must preserve, where applicable:

- original Transaction Money;
- converted/Functional Money;
- ExchangeRate identity;
- rate source;
- effective time;
- recorded/observed time;
- policy/version reference;
- provider/external reference when relevant.

Presentation conversion is non-authoritative and cannot replace economic Conversion Evidence.

A confirmed historical conversion is not recalculated using a later rate.

## 8. Operational Financial Journal contract

### 8.1 Journal authority

The Finance Journal is institution-scoped, append-oriented operational economic authority. It is a subledger for Nexus operations, not a statutory general ledger.

Each confirmed economic event is represented by one `JournalTransaction` containing a complete set of semantically typed `JournalEntry` / `JournalPosition` records sufficient to reconstruct its financial effect and provenance.

### 8.2 Typed positions

An entry may never exist merely as an untyped `+amount` or `-amount`. Every entry requires an economic role compatible with the Journal Transaction type.

Initial implementation may use a deliberately small foundation allowlist of position types, but each type must have explicit semantics. Adding a new production economic position type after the foundation requires the later domain mission to define its conservation rules.

### 8.3 Economic balance

“Balanced” means that the complete entry set satisfies the explicit conservation invariant of its transaction type. The foundation must not force statutory debit=credit accounting unless a future accounting mission explicitly adopts that model.

No confirmed transaction may exist if its entries cannot reconstruct a coherent, currency-compatible financial effect.

### 8.4 Lifecycle

Only `confirmed` Journal authority affects canonical financial projections.

Pre-confirmation/draft/validation records, if the implementation requires them, are non-authoritative and may not affect balance.

Confirmation is:

- server-authoritative;
- atomic;
- irreversible in place;
- allowed only after authorization, context, domain, currency and required evidence validation pass.

A failed/cancelled pre-confirmation attempt has zero economic effect. A confirmed transaction cannot be changed back to draft/cancelled.

### 8.5 Reversal and causal linkage

A reversal/compensating transaction is a new confirmed fact linked explicitly to the original authority.

The foundation causal model must preserve at minimum:

- source/original transaction identity;
- compensation/reversal transaction identity;
- semantic operation type;
- reason;
- actor/system authority/provenance;
- effective/recorded timestamps;
- affected Money;
- idempotent command correlation.

Partial reversals may not exceed the remaining reversible value. Concurrent reversals must preserve the same invariant.

Refund, Reversal, Credit and Adjustment remain distinct semantic operations even if their arithmetic effects could resemble each other.

## 9. Projection contract

Canonical Journal facts + authoritative Finance aggregates are economic truth. A projection/read model is derived authority for reading only.

The foundation must implement at least one critical projection sufficient to prove:

- confirmed-only contribution;
- deterministic replay;
- projection destruction/rebuild equivalence;
- projection failure after Journal commit does not invalidate the confirmed fact;
- current policy/FX changes do not change previously confirmed historical result.

A projection may be materialized for speed, but it may not contain an economic fact that cannot be rebuilt from canonical authority.

## 10. Canonical command and idempotency contract

Every foundation command capable of creating or compensating economic authority requires a scoped server-verifiable idempotency identity.

Idempotency scope must include institutional authority and operation namespace/type; the exact physical key is implementation detail, but tenant separation is mandatory.

The persisted idempotency authority must contain enough information to distinguish:

- same key + same canonical command fingerprint => replay/recover existing result;
- same key + materially different canonical fingerprint => conflict, no new economic fact.

The canonical fingerprint must use normalized server-generated economic representation; semantically equal lexical Money input must not create different fingerprints.

Similar amounts/actors/dates are not sufficient to declare a duplicate. Two legitimate distinct economic operations with different identities must both be possible.

Transport uncertainty is not economic failure. If commit succeeded but the response was lost, retry must recover the already committed result.

## 11. PostgreSQL transaction boundary

For each authoritative foundation command, one PostgreSQL transaction must contain every element required to truthfully establish its economic result.

Where applicable the atomic set includes:

- authoritative Finance aggregate mutation;
- Journal Transaction;
- complete Journal Entries/Positions;
- scoped idempotency identity + canonical fingerprint + result reference;
- required factual audit/provenance record;
- required durable outbox/event intent.

The rule is all-or-nothing. A failure after any intermediate write must leave no partial economic authority.

The following remain outside the canonical financial DB transaction:

- email/WhatsApp notification delivery;
- realtime push;
- external provider/network calls;
- report generation;
- Excel/BI export;
- rebuildable projection worker execution;
- object-storage upload performed after confirmation.

If external evidence is required before confirmation, it must already be durably established/validated; the financial commit stores the authoritative reference/provenance required by policy.

No external/provider call may be made while holding canonical Finance database locks/transactions open.

## 12. Persistence integrity contract

PostgreSQL is the final structural defense. Domain code owns business meaning, but stable structural invariants must be enforced by database constraints wherever deterministic.

The implementation plan must use appropriate combinations of:

- `NOT NULL` for required authority fields;
- exact `NUMERIC/DECIMAL`, never floating-point, for authoritative monetary/rate values;
- `CHECK` for stable numeric/lifecycle invariants;
- scoped `UNIQUE` constraints/indexes for idempotency/provider identities;
- real foreign keys for authoritative relationships where possible;
- composite/tenant-safe relationships so a child cannot point to a foreign-institution parent;
- version/CAS for stale-write-sensitive aggregates;
- deliberately scoped row/advisory locks or isolation only when required by an invariant.

PostgreSQL must not become an opaque business-policy engine. Institution policy/authorization rules do not belong in complex triggers merely to duplicate service logic.

Confirmed economic facts may not be corrected by soft delete.

## 13. Concurrency contract

Concurrency protection is scoped to the smallest authoritative resource/identity required by the invariant.

Required behaviors:

- concurrent same-idempotency commands => exactly one committed economic result;
- distinct legitimate operations => both may commit;
- concurrent partial reversals => committed sum never exceeds remaining reversible value;
- stale expected version => explicit conflict, never silent overwrite;
- unrelated tenants/resources => no unnecessary global Finance lock;
- multi-resource lock acquisition => deterministic order;
- deadlock/serialization abort => no partial economic fact;
- retry after DB concurrency abort => uses the same economic/idempotent command identity.

Global Finance locking and blanket `SERIALIZABLE` isolation are prohibited as default designs.

## 14. Migration authority

Finance extends the existing canonical `src/db/migration-runner.ts`; it may not introduce a second migration engine or runtime business-DDL path.

Required migration behavior:

- deterministic ordered migration filenames;
- ambiguous order rejected;
- applied migration recorded in `nexus_schema_migrations` with checksum;
- applied migration checksum/history is immutable;
- each migration + migration ledger insert commits atomically;
- failed migration rolls back completely;
- clean empty PostgreSQL database can bootstrap the full chain without manual DDL;
- application startup validates required schema and fails closed if it is incompatible/missing; startup must not silently repair Finance business schema.

## 15. Audit, provenance and outbox

### 15.1 Financial audit truth

For foundation commands, required factual audit/provenance is part of the canonical transaction when absence would make the economic result unauditable.

The record must support reconstruction of, as applicable:

- institution;
- actor/system identity and Membership/capability context;
- command/correlation/idempotency identity;
- affected financial authority;
- reason;
- effective/recorded time;
- evidence relationship;
- outcome.

Operational logs/metrics are not substitutes for financial audit truth.

### 15.2 Durable outbox

When a confirmed fact requires recoverable downstream processing, the outbox/event intent is committed in the same PostgreSQL transaction as the fact. Delivery occurs later and is idempotent/retryable.

Worker/process restart must recover pending work from durable state. Required downstream processing may not exist only in an in-memory queue.

## 16. Legacy authority fence

Before the foundation can be considered proven, repository/API/read-model tests must establish that legacy mutable `outstandingFees` or equivalent convenience paths cannot independently create or alter canonical Finance position.

A legacy field may remain temporarily readable only when explicitly classified as non-authoritative compatibility data. New Finance commands may not dual-write it as a second balance authority unless a separately approved migration/compatibility contract explicitly requires it.

Ambiguous legacy ownership/data meaning is a STOP condition. The implementation must not guess or reinterpret legacy financial data merely to populate new Journal authority.

## 17. Minimal foundation implementation slices

The subsequent implementation plan should decompose this design into small checkpoints rather than one FINANCE-FOUNDATION mega-task. The exact task numbering is plan work, but the intended dependency order is:

1. **Monetary primitives** — exact decimal infrastructure, Money, normalization, Currency Registry, ratios/rates, quantization and tests.
2. **Institution Financial Context minimum** — profile/version resolver and fail-closed context contract required by authoritative commands.
3. **Finance persistence schema** — migrations/constraints for Journal, entries, command idempotency, required audit/outbox and minimal projection authority.
4. **Journal domain + repository** — typed transactions/entries, lifecycle, atomic confirmation and rollback.
5. **Idempotency/concurrency** — replay/conflict, concurrent duplicate protection, version/CAS/locking primitives.
6. **Reversal/causal proof slice** — minimal original + partial reversal command sufficient to prove causal/remaining-reversible/concurrency laws, without building the final Refund/Payment products.
7. **Projection/recovery slice** — confirmed-only projection, outbox/restart, rebuild/historical reproducibility.
8. **Foundation aggregate verification** — clean bootstrap, negative tenant tests, legacy fence, quality gate, independent review.

No slice is DONE merely because its own unit tests pass. Each slice must satisfy the applicable proof class and leave the branch recoverable/clean.

## 18. Required proof matrix

The implementation plan must map every task to material risk and required proof. At minimum the foundation aggregate gate requires:

| Risk | Minimum proof |
| --- | --- |
| Exact Money semantics | domain/property tests + canonical serialization tests |
| Precision persistence | real PostgreSQL round-trip including envelope boundaries |
| Floating-point leakage | schema/contract negative proof + authoritative path inspection |
| Currency policy | known/enabled allow + unknown/disabled deny |
| Quantization/remainder | property tests proving deterministic conservation |
| Cross-currency misuse | negative domain/PostgreSQL proof |
| Journal partial write | injected-failure PostgreSQL rollback tests at multiple stages |
| Draft affecting balance | lifecycle + real projection proof |
| Cross-tenant ownership | same-tenant allow + foreign-tenant deny at HTTP/PostgreSQL boundaries |
| Idempotent retry | sequential replay on real PostgreSQL |
| Concurrent duplicate | parallel real PostgreSQL requests => exactly one result |
| Same key / different fingerprint | conflict + no second fact |
| Lost response | committed result recovered on retry |
| Over-reversal | concurrent real PostgreSQL proof |
| Stale write | CAS/version conflict proof |
| Confirmed mutation/delete | negative repository/PostgreSQL proof |
| Mandatory outbox | outbox insert failure rolls back fact |
| Worker/restart recovery | durable pending work survives restart/retry |
| Projection authority | destroy + rebuild => same canonical result |
| Historical reproducibility | policy/FX/registry changed after fact => replay unchanged |
| Migration authority | clean-chain, failed migration rollback, checksum mismatch rejection |
| Startup schema truth | valid schema restart PASS; missing/incompatible schema fail-closed; no runtime DDL |
| Legacy finance bypass | mutation of legacy field cannot change canonical Finance position |
| Integration review | independent READ-ONLY review bound to exact HEAD; zero unresolved P0/P1 |

Static/source-string tests may supplement but never substitute for stateful PostgreSQL, tenant, authorization, concurrency or recovery proof.

## 19. Implementation STOP conditions

Codex/implementation owner must stop and return for architecture adjudication when any of the following occurs:

- a second financial write authority appears necessary;
- a required invariant cannot be expressed while preserving approved F0–F4 semantics;
- implementation needs to hold a DB transaction/lock across an external network/provider call;
- safe tenant ownership of legacy data cannot be proven;
- migration would destructively reinterpret existing financial values without an approved migration/reconciliation policy;
- idempotency correctness depends on process-local memory;
- required recovery depends on a non-durable queue;
- projection or legacy field would need to become economic authority;
- a numeric/storage choice cannot preserve F2 exactness and normalization;
- a provider/payment-specific requirement forces premature redefinition of the generic Journal model;
- implementation requires expanding into F5/F6 or later domains merely to make tests green.

Do not patch around a STOP condition. Preserve branch/SHA/evidence and request adjudication.

## 20. Review and ownership model

Foundation implementation is high-risk persistence/authority work.

Each executable mission must declare:

`MISSION, TASK, OWNER, REVIEWER, BASE_SHA, BRANCH/WORKTREE, AUTHORIZED_SCOPE, FORBIDDEN_SCOPE, RISKS, REQUIRED_PROOF, CURRENT_GATE`.

Default role allocation:

- Codex: implementation writer for the bounded mission.
- Antigravity: independent reviewer, READ-ONLY at the start, reviewing the exact implementation HEAD.

The reviewer may not silently repair the implementation. A correction creates a new HEAD and invalidates the prior merge-safe claim until that HEAD is reviewed.

## 21. Foundation completion definition

The Finance foundation is **PROVEN**, not merely implemented, only when all applicable conditions are true:

- F0–F4 laws are represented without known P0/P1 deviation;
- canonical migrations bootstrap a clean disposable PostgreSQL database;
- exact Money/rate persistence is demonstrated;
- Journal confirmation is atomic and partial writes are disproved by failure injection;
- scoped idempotency/concurrency proofs pass;
- cross-tenant negative proofs pass;
- confirmed history cannot be destructively rewritten through approved paths;
- durable outbox/restart recovery is demonstrated;
- critical projection rebuild and historical reproducibility pass;
- legacy balance authority is fenced;
- affected typecheck/build/secret/quality gates pass;
- independent exact-HEAD review reports zero unresolved P0/P1;
- working tree and remote handoff are coherent.

Human visual UAT is not the primary proof for this backend foundation. Later product slices will require Human UAT for real user workflows. Foundation product confidence comes principally from domain, HTTP, PostgreSQL, tenant, concurrency and recovery evidence.

## 22. Deliberately deferred decisions

Approval of this spec does not decide:

- final physical table/column/index names;
- exact PostgreSQL `NUMERIC(p,s)` per field beyond preserving F2 envelopes and exactness;
- exact decimal library;
- exact row-lock/advisory-lock syntax per command;
- exact transaction isolation level per command;
- final Journal position taxonomy for later business domains;
- final Financial Account / Obligation schema;
- payment/allocation/reconciliation/provider/fiscal/reporting workflows;
- final operational Finance UI.

These are implementation-plan or later-domain decisions. They may not weaken the invariants in this spec.

## 23. Self-review gate before implementation planning

This specification is ready for implementation planning only if Product Owner review confirms:

- no approved F0–F4 rule is omitted or contradicted;
- no later Finance domain has been accidentally implemented by design;
- no hidden country/provider assumption exists;
- no ambiguous authority path remains;
- every persistence/concurrency/tenant risk has a required executable proof;
- no placeholder is allowed to be filled by an agent with a product/architecture decision;
- the first implementation may remain deliberately backend/foundation-focused without fake UI.

**SPEC_STATUS=AWAITING_PRODUCT_OWNER_REVIEW**
**IMPLEMENTATION_AUTHORIZED=NO**
**NEXT_ON_APPROVAL=WRITE_FINANCE_FOUNDATION_IMPLEMENTATION_PLAN**
