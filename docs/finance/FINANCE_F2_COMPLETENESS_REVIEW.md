# Nexus Edu IA — F2 Money Model Completeness Review

**State:** REVIEW — NOT IMPLEMENTATION AUTHORITY  
**Reviewed scope:** approved F2-D01 through F2-D10, F0/F1 constraints, current Finance architecture/roadmap, and downstream requirements from Ledger, Payments, Allocation, Reconciliation, Reporting and PostgreSQL persistence.

## Executive determination

F2 is **NOT YET DESIGN-CLOSED**.

The approved decisions establish the correct monetary foundation: exact decimal Money, bounded precision, currency registry, strict same-currency arithmetic, explicit FX evidence, transaction/functional duality, deterministic quantization/remainder, strict API parsing/serialization, sign/magnitude separation and executable proof obligations.

However, completeness review found **three material gaps** that should be closed before F3 Ledger Model begins. These are not UI details and should not be deferred to implementation because they affect identity/idempotency, reconciliation semantics and the exact-decimal helper types already referenced by approved F2 decisions.

## Evidence from canonical repository

The canonical roadmap requires Finance to establish authority/ledger first, followed by payments/allocations, reversals/refunds, reconciliation, financial read models and reports. It also states that legacy `outstandingFees` cannot remain balance authority. Therefore F2 must be stable enough to support those downstream semantics without redesign during coding.

The architecture contract states that Finance is ledger-oriented, critical writes are idempotent and transactional, reconciliation/payment confirmation/reversal/refund/adjustment are explicit use cases, and balance is a projection over movements.

The Product Truth audit confirms the current Finance UI/API surface is not canonical: there is no canonical ledger/obligation/payment-allocation authority yet, and browser-only mutations are not financial facts. F2 therefore has no legacy monetary representation that should be preserved as new authority.

## Coverage review

### Ledger readiness
**Mostly covered, one gap.**

Covered:
- exact decimal Money;
- explicit currency;
- immutable Money value semantics;
- no implicit cross-currency arithmetic;
- sign does not replace economic meaning;
- historical FX result preservation;
- monetary proof requirements.

Gap:
- **canonical decimal identity/normalization is not yet defined.** The design must decide whether textual forms such as `1`, `1.0`, `1.00`, `01.00`, and `-0.00` represent the same canonical Money identity and what exact serialization is used for hashing/idempotency/checksums.

Without this, two semantically equal Money values could produce different idempotency material or audit/checksum payloads.

### Payments/provider readiness
**Covered with one dependent type gap.**

Covered:
- provider-specific representations normalize before Finance Core;
- payment amounts cannot use floating point authority;
- provider-executed FX preserves applied rate/result;
- unknown/institution-disabled currencies fail closed;
- zero/negative validity is operation-specific.

Gap:
- the approved design references exact-decimal scalars/ratios and ExchangeRate but has not fully defined their canonical semantics, bounds and serialization.

### Allocation readiness
**Covered.**

The approved same-currency arithmetic and deterministic remainder laws are sufficient foundation for later allocation policy. Multi-student ordering/priority remains correctly deferred to the Allocation domain, not Money.

### Reconciliation readiness
**One material gap.**

Money equality is strict, but reconciliation may legitimately use a policy tolerance or classify differences caused by provider fees, FX or settlement behavior.

F2 does not yet state the critical boundary:

> approximate/tolerance matching must never become `Money.equals()` and must never silently mutate an amount.

Without this law, future reconciliation code could introduce fuzzy monetary equality into the core Money type.

### Reporting/read-model readiness
**Covered at foundation level.**

Transaction Money, Functional Money and Presentation Currency are separated. Historical economic conversion is immutable; presentation conversion is non-authoritative. Detailed reporting rate selection/as-of policy belongs to Reporting, provided it preserves the F2 distinction.

### PostgreSQL persistence readiness
**Mostly covered, one gap shared with Ledger.**

Covered:
- no floating-point monetary columns;
- bounded decimal envelope;
- exact round-trip requirement;
- strict currency semantics.

Gap:
- canonical decimal normalization/identity is required before defining stable DB/API hashing, equality, unique/idempotency material and deterministic serialized evidence.

## Required additional F2 decisions

### F2-D11 — Canonical Decimal Normalization & Money Identity
**REQUIRED — OPEN.**

Must define:
- numeric equality versus textual equality;
- canonical treatment of leading zeros;
- canonical treatment of trailing fractional zeros;
- prohibition/normalization of negative zero;
- canonical decimal serialization used for hashing, idempotency and evidence;
- whether display scale is ever preserved separately from Money identity;
- exact invariant for `serialize(parse(x))` and equality/hash consistency.

Recommended direction: Money identity is numeric amount + currency, not user-entered lexical formatting. A single canonical decimal serialization should be generated server-side. Negative zero should normalize to zero. Display scale remains presentation metadata rather than Money identity.

### F2-D12 — Exact Equality vs Reconciliation Tolerance
**REQUIRED — OPEN.**

Must define:
- `Money.equals()` is exact same-currency equality only;
- no epsilon/floating tolerance exists inside Money;
- reconciliation tolerance is an explicit versioned business policy;
- a tolerance match produces a reconciliation classification/exception decision, not an altered Money amount;
- fee/FX/settlement differences remain explicit financial facts or exceptions where applicable.

Recommended direction: never introduce fuzzy equality into the canonical Money value object.

### F2-D13 — Decimal Ratio / Percentage / ExchangeRate Type Contract
**REQUIRED — OPEN.**

Approved F2 decisions already rely on non-Money exact decimal types. Their contract must be closed before F2 is complete.

Must define:
- exact-decimal, non-floating representation;
- bounded precision/scale;
- canonical serialization/normalization;
- `Percentage`/generic ratio semantics versus `ExchangeRate` semantics;
- ExchangeRate requires explicit base currency, quote currency and direction;
- no implicit rate inversion;
- zero/negative rate validity rules;
- multiplication with Money produces calculation output requiring explicit quantization before canonical Money;
- source/effective-time evidence remains outside the numeric rate value where appropriate but bound to economic conversion evidence.

Recommended direction: small immutable typed value objects (`DecimalRatio`, `Percentage` where useful, `ExchangeRate`) rather than one untyped decimal helper used everywhere.

## Findings deliberately deferred — not F2 gaps

The following are important but belong to later domains and should **not** inflate F2:

- allocation priority across siblings/obligations;
- provider fee accounting;
- tax calculation models;
- cash denomination handling;
- bank settlement batching;
- reconciliation workflow/state machine;
- accounting FX gains/losses and revaluation;
- report-specific presentation-rate/as-of selection;
- invoice/fiscal rounding rules beyond the generic monetary-policy boundary;
- exact PostgreSQL table/column definitions;
- actual decimal-library selection.

## Risk adjudication

- **P0 design gaps before F3:** D11, D12, D13.
- **P1:** none identified in F2 foundation after those three are closed.
- **Premature implementation risk:** HIGH if F3/F4 begins before D11-D13, because normalization, equality/tolerance or rate semantics would otherwise be invented inside Ledger/Reconciliation implementation.
- **Need to redesign approved D01-D10:** NO. The gaps extend them; no contradiction requiring reversal was found.

## Closure gate

F2 may be marked **DESIGN-CLOSED** only after:

1. F2-D11 approved;
2. F2-D12 approved;
3. F2-D13 approved;
4. D01-D13 consolidated into the canonical F2 document;
5. internal contradiction/placeholder scan passes;
6. proof obligations are updated to include canonicalization/hash consistency, strict-vs-tolerance behavior and ratio/rate serialization;
7. Product Owner explicitly approves F2 closure.

Until then:

**F2_STATUS=OPEN**  
**IMPLEMENTATION_AUTHORIZED=NO**  
**F3_LEDGER_DESIGN_START=BLOCKED_BY_F2_D11_D12_D13**
