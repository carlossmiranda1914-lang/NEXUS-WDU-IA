# Nexus Edu IA — F2 Money Model Preparation

**State:** PREPARATION — NOT IMPLEMENTATION AUTHORITY

## Purpose
This is the canonical working record for the F2 Money Model decisions under the Finance Foundation. It does not authorize product code, migrations, APIs, UI, or FINANCE-01 implementation. F0 and F1 are already design-closed; F2 remains open until the remaining money-model decisions are approved and consolidated.

## F2-D01 — Canonical Money Value
**APPROVED.** Every authoritative monetary value is represented conceptually as a `Money` value object composed of:

- an **exact decimal amount**; and
- an **explicit recognized currency**.

Authoritative money is never represented by floating-point arithmetic (`float`, `double`, JavaScript `number`) as economic truth.

Canonical API representation must preserve decimal exactness, conceptually:

`{ "amount": "300.00", "currency": "EUR" }`

Formatted strings such as `1.250,50 €`, symbols such as `€`, `Kz`, `$`, and locale-specific number formatting are presentation/input concerns, not canonical authority.

Money values of different currencies are not directly comparable or additive. Cross-currency behavior requires an explicit conversion operation with its own evidence and policy.

## F2-D02 — Bounded Exact Decimal Precision
**APPROVED.** The Finance domain uses bounded exact-decimal arithmetic rather than a single global two-decimal model or unbounded arbitrary precision.

Architectural envelope:

- up to **30 digits of total precision**;
- up to **12 fractional decimal places**.

This envelope is a representation boundary, not a statement that every financial operation may use 12 decimal places. Economic scale is determined by currency metadata, institutional monetary policy, operation semantics and settlement/provider constraints.

The design distinguishes:

- `CalculationDecimal` / high-precision intermediate calculations;
- canonical `Money` produced only after explicit quantization/rounding;
- settlement precision;
- display precision.

Exchange rates and ratios are not `Money`; they use a separate exact-decimal ratio/rate type.

Remainders and rounding differences may never disappear silently. Distribution algorithms must preserve the original total exactly after quantization.

Exact PostgreSQL `NUMERIC(p,s)` choices remain an F4 persistence decision, but no authoritative monetary column may use floating-point storage.

## F2-D03 — Canonical Currency Registry
**APPROVED.** Finance uses an internal, versioned Currency Registry based on controlled snapshots of ISO 4217 metadata rather than runtime dependency on an external provider or web service.

The canonical monetary identity is the ISO alphabetic three-letter currency code, e.g. `EUR`, `AOA`, `USD`, `GBP`.

Symbols and localized currency names are presentation metadata and are not authority.

The registry preserves, as applicable:

- ISO alphabetic code;
- ISO numeric code;
- ISO minor-unit metadata;
- active/historical/special support classification;
- registry version/source provenance.

ISO minor-unit metadata, calculation precision, settlement precision and display precision remain distinct concepts.

A currency recognized by the Nexus registry is not automatically enabled for an institution. Institution Financial Profile/policy determines which currencies are permitted for authoritative operations.

Unknown or incompatible currency codes fail closed. Historical currencies remain readable/auditable for historical facts but are not automatically valid for new economic facts.

Currency Registry updates are deliberate, versioned, reviewed and tested. Finance transactions do not fetch or mutate currency metadata dynamically from external sources at runtime.

Being an ISO-recognized code does not automatically imply that Nexus supports that instrument operationally. Digital assets/crypto are outside the initial canonical Currency model unless separately designed and approved.

## F2-D04 — Strict Monetary Arithmetic & Comparison Law
**APPROVED.** `Money` is an immutable value object with strict same-currency arithmetic semantics.

### Same-currency operations
Direct addition, subtraction, equality and ordering require the same currency.

Examples:

- `100 EUR + 50 EUR = 150 EUR` — valid;
- `100 EUR - 30 EUR = 70 EUR` — valid;
- `100 EUR > 90 EUR` — valid.

### Cross-currency operations
Cross-currency addition, subtraction, equality/ordering and aggregation are invalid by default.

Examples:

- `100 EUR + 100 USD` — domain error;
- `100 EUR > 100 USD` — domain error;
- `100 EUR == 100 USD` — not a valid direct monetary comparison.

Even `0 EUR` and `0 USD` remain different monetary values because currency is part of the value identity.

No `Money` operation performs hidden FX conversion or looks up exchange rates automatically.

### Multiplication/division
`Money × Money` is prohibited because it has no canonical financial unit meaning.

Money may interact with explicitly typed exact-decimal scalars/ratios for calculation, for example percentage or rate calculations. Such operations produce a high-precision calculation candidate and only become canonical Money after the applicable quantization/rounding policy.

### Distribution and remainder
Financial division/distribution is not allowed to lose value silently. When a Money amount is split into monetary parts, the operation must use an explicit deterministic remainder policy and satisfy:

> **sum(parts) = original Money exactly**

Example: `100.00 EUR / 3` cannot become three times `33.33 EUR`. A valid deterministic distribution could be `33.34 + 33.33 + 33.33 = 100.00 EUR`, subject to the approved policy.

### Arithmetic versus business authority
Monetary arithmetic does not itself authorize a financial mutation. Calculating `100 EUR - 30 EUR = 70 EUR` does not authorize reducing an obligation. Economic change still requires the appropriate authorized Finance command and canonical financial fact.

### Invalid numeric states
Canonical Money cannot represent or accept:

- NaN;
- Infinity;
- non-finite numeric states;
- missing/unknown currency;
- floating-point-derived authority without explicit safe parsing/normalization;
- implicit locale-formatted monetary strings as canonical input.

## F2 invariants accumulated so far
1. `Money = exact decimal amount + explicit recognized currency`.
2. Floating-point values are never authoritative monetary truth.
3. Canonical APIs preserve monetary decimal amounts as exact strings or an equivalent exact transport representation.
4. Currency symbols/names/localized formatting are presentation only.
5. Money precision is bounded; the architectural envelope is up to 30 total digits / 12 fractional digits.
6. Technical decimal capacity does not define the economic scale allowed for a transaction.
7. Calculation precision, canonical Money precision, settlement precision and display precision are distinct.
8. Exchange rates/ratios are exact decimal types separate from Money.
9. ISO 4217-based currency metadata is maintained in a controlled, versioned internal registry.
10. Registry recognition does not equal institutional enablement.
11. Unknown/incompatible currencies fail closed.
12. Direct monetary arithmetic/comparison requires identical currency.
13. Cross-currency operations never convert implicitly.
14. `Money × Money` is prohibited.
15. Money/scalar calculations require explicit quantization before becoming canonical Money.
16. Monetary distributions preserve the original total exactly and handle remainders deterministically.
17. Arithmetic capability never substitutes for authorized financial business commands.
18. NaN, Infinity and ambiguous formatted monetary inputs cannot enter canonical Money authority.

## Next F2 design action
Proceed to **F2-D05 — FX / Conversion Evidence Law**: define explicit exchange-rate identity, base/quote direction, source/effective time, rate precision, conversion result provenance, functional-currency projection rules, stale/missing-rate behavior, provider-executed conversion evidence and the boundary that prevents FINANCE-01 from becoming a full FX accounting engine.