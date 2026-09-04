# Nexus Edu IA — F2 Approved Decisions D05-D13

**State:** APPROVED DESIGN RECORD — NOT IMPLEMENTATION AUTHORITY
**Scope:** companion to `FINANCE_F2_MONEY_MODEL_PREPARATION.md`, which already records approved F2-D01 through F2-D04.
**Purpose:** preserve the Product Owner-approved F2-D05 through F2-D13 decisions without rewriting or truncating the existing canonical preparation file. This document does not authorize code, migrations, APIs, UI or FINANCE-01 implementation.

## F2-D05 — Explicit FX Conversion Evidence
**APPROVED.** Every economic cross-currency conversion is explicit, direction-aware and provenance-bound. A conversion preserves original Money, converted Money, exact-decimal rate, base/quote currencies, rate source, effective/recorded time and applicable policy/evidence. Missing, stale or ambiguous rates are never silently substituted. Provider-executed conversion preserves the rate/result actually applied by the provider. Presentation conversion is non-authoritative. Historical financial facts are never implicitly revalued using later exchange rates. FINANCE-01 excludes full FX revaluation and gain/loss accounting.

Additional laws:
- a naked numeric rate is insufficient authority;
- canonical direction is explicit, conceptually `1 base = rate quote`;
- reciprocal conversion is never implicit;
- rate freshness/validity is operation/policy-specific rather than a hidden global threshold;
- missing required conversion evidence fails closed or remains in an explicit unresolved/pending state defined by the later operation;
- provider fees/spread, where economically explicit, are not silently hidden inside tolerance or rewritten history.

## F2-D06 — Transaction / Functional Money Duality
**APPROVED.** Authoritative operations preserve original Transaction Money. When an economic conversion to the institution's functional currency is required, the confirmed fact also preserves the resulting Functional Money and corresponding Conversion Evidence. Functional Money is derived but historically immutable after confirmation; it never replaces the original amount and is distinct from presentation currency.

Invariant: no historical report may require today's FX rate to reconstruct a functional amount that was already part of the economic meaning of a confirmed fact.

## F2-D07 — Quantization & Remainder Law
**APPROVED.** A high-precision calculation result does not become canonical Money until explicit quantization under the applicable currency/monetary/operation policy. Rounding mode and remainder-distribution strategy are separate, versioned policy concepts. Monetary distributions preserve the original total exactly. Remainders never disappear, are never assigned randomly and are never corrected silently in the frontend. Confirmed Money is not retroactively re-quantized after policy changes.

Invariant: `sum(distributed parts) = original Money exactly`.

## F2-D08 — Canonical Money Boundary Contract
**APPROVED.** Canonical financial contracts transport amount as a non-localized decimal string and currency as an explicit canonical currency code. Floating-point JSON numbers, scientific notation, currency symbols, thousands separators and locale-formatted strings are not canonical Money input. Parsing is strict and does not round, convert currency, invent zero or silently correct values. Locale-aware parsing belongs to interaction boundaries; provider-specific representations are normalized by adapters before entering Finance Core. Authoritative outputs preserve exact canonical representation.

Invariant: `parse(serialize(Money)) = Money` exactly.

## F2-D09 — Monetary Validity, Sign & Magnitude Law
**APPROVED.** Money defines mathematical representability; each command/aggregate defines economic validity. Zero and negative values may be structurally representable but do not implicitly authorize zero/negative economic operations. Sign never substitutes for financial semantics: refund, reversal, credit, adjustment, expense and payment remain distinct operations. Values must respect the global decimal envelope and any applicable institutional/operation/approval limits. Overflow, excessive scale or invalid magnitude fail closed without truncation, saturation or floating-point fallback.

## F2-D10 — Money Model Proof Contract
**APPROVED.** Money Model implementation is DONE only when executable proof demonstrates exact decimal round-trip, same-currency arithmetic, cross-currency rejection, currency-registry enforcement, precision/scale boundaries, deterministic quantization/remainder conservation, strict transport parsing, FX provenance/immutability, sign/magnitude enforcement and historical reproducibility. Persistence proof uses disposable real PostgreSQL when applicable. Structural/source-string tests cannot substitute for economic behavior.

Mandatory risk/proof classes include:
- no floating-point monetary authority;
- exact API/domain/PostgreSQL round-trip;
- cross-currency rejection;
- unknown/historical/institution-disabled currency behavior;
- overflow/scale rejection;
- no silent rounding;
- deterministic remainder conservation;
- no implicit FX;
- immutable historical FX result;
- conversion evidence requirement;
- preservation of Transaction Money;
- strict boundary parsing;
- exact serialization round-trip;
- sign cannot manufacture another economic operation;
- server-side institutional policy enforcement.

Any authoritative path permitting JavaScript-number/floating-point monetary truth, implicit FX, silent rounding or currency-less amounts is a P0 defect for the Money Model mission.

## F2-D11 — Canonical Decimal Normalization & Money Identity
**APPROVED.** Money identity is normalized mathematical decimal value plus canonical currency, not the user's original lexical representation. Leading zeros, insignificant trailing fractional zeros, explicit plus sign and negative zero do not create different economic identities. Negative zero normalizes to zero. Equality, hashing, idempotency, checksums and canonical evidence use one deterministic server-generated canonical serialization. Display scale and locale remain outside economic identity; if an operation must preserve applied scale as economic metadata, that metadata does not redefine Money identity.

Required invariants:
- `normalize(normalize(x)) = normalize(x)`;
- equal Money values have identical canonical serialization;
- equivalent lexical inputs cannot produce different canonical idempotency/hash material.

## F2-D12 — Exact Equality vs Reconciliation Tolerance Law
**APPROVED.** Canonical Money equality is exact same-currency numeric equality after canonical normalization. Money has no epsilon, approximate equality or hidden tolerance. Any reconciliation tolerance is an explicit, currency-aware, versioned business policy evaluated outside Money. A tolerance decision never changes either monetary fact and preserves the exact difference and applicable policy/evidence. Known fees, FX effects, adjustments or other economic facts may not be silently absorbed as tolerance.

Invariant: changing ReconciliationPolicy cannot change `Money.equals()` or mutate existing financial facts.

## F2-D13 — Typed Exact-Decimal Ratio & Exchange Rate Law
**APPROVED.** Non-Money financial decimals use bounded, immutable exact-decimal semantic types rather than floating-point or one untyped universal decimal. `DecimalRatio`, `Percentage` and `ExchangeRate` are semantically distinct. ExchangeRate always identifies base currency, quote currency and direction; an economic FX rate must be strictly positive and is never implicitly inverted. Ratio/rate serialization uses canonical non-localized decimal strings. Money interactions produce high-precision calculation output requiring applicable quantization before canonical Money. ExchangeRate is distinct from ConversionEvidence.

Architectural envelopes:
- Money: up to 30 total digits / 12 fractional digits;
- DecimalRatio / ExchangeRate: up to 30 total digits / 18 fractional digits;
- exact PostgreSQL mappings remain an F4 decision.

Percentage is semantically distinct from a raw multiplier (for example, 15% is not an untyped `15`). Shared internal exact-decimal infrastructure is permitted, but semantic types must not collapse into one ambiguous financial value.

Required proofs include:
- direction distinguishes `ExchangeRate(EUR,AOA,r)` from `ExchangeRate(AOA,EUR,r)`;
- rate/ratio normalization is deterministic;
- Money × rate/ratio cannot bypass calculation context and quantization to become canonical Money;
- zero/negative economic FX rates fail closed.

## Updated F2 proof obligations
In addition to D10, future implementation must prove:
1. canonical normalization is idempotent;
2. equal Money values produce identical canonical serialization/hash material;
3. negative zero cannot survive canonicalization;
4. Money equality remains exact regardless of reconciliation policy;
5. tolerance decisions preserve both exact monetary facts and the exact difference;
6. typed ratios/percentages/rates cannot be interchanged implicitly;
7. ExchangeRate direction and currency pair are part of semantic identity;
8. no implicit reciprocal FX is used as authoritative conversion evidence;
9. rate/ratio exact-decimal serialization round-trips without precision loss.

## Scope deliberately deferred beyond F2
F2 does not define allocation priority across obligations/students, provider-fee accounting, tax models, cash denominations, settlement batching, reconciliation workflow/state machine, accounting FX gain/loss or revaluation, report-specific presentation FX selection, fiscal-document-specific rounding, exact PostgreSQL schema types, or the concrete decimal library. These remain later design/implementation responsibilities and must preserve F2 laws.

## Closure candidate status
All F2-D01 through F2-D13 decisions have Product Owner approval across the two F2 design records. The remaining action is a final contradiction/ambiguity/placeholder and downstream-readiness check before Product Owner approval of `F2 = DESIGN-CLOSED`.

**IMPLEMENTATION_AUTHORIZED=NO**
