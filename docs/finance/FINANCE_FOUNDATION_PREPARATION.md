# Nexus Edu IA — Finance Foundation Preparation

**State:** PREPARATION — NOT IMPLEMENTATION AUTHORITY

## Purpose and implementation gate
This is the canonical working record for Finance Core architectural discovery. It records approved decisions but does **not** authorize product code, migrations, APIs, UI, or FINANCE-01 implementation until F0–F6 are closed, reviewed, approved and converted into an implementation plan.

## Product direction
Finance is a **Financial Operations Core for an international school platform**, not a collection of invoice/payment/expense screens and not a generic accounting ERP.

> **INTERNATIONAL CORE / COUNTRY-SPECIFIC ADAPTERS**

No country, currency, payment rail, fiscal rule or provider is a hard-coded boundary of the canonical Finance domain. Every capability must trace through:

`real operational problem -> authority -> state/invariant -> command/query -> persistence -> authorization -> failure/recovery -> evidence -> observable behavior`

The frontend is never financial authority.

## Foundation sequence
- **F0 — Financial Constitution:** DESIGN-CLOSED.
- **F1 — Institutional Financial Context:** DESIGN-CLOSED.
- **F2 — Money Model:** representation, precision/scale, rounding, currencies and conversion evidence.
- **F3 — Ledger Model:** facts/entries, immutability, derivation, reversals and operational-subledger boundary.
- **F4 — Transaction & Persistence Model:** PostgreSQL, aggregates, transactions, constraints, tenancy, idempotency, concurrency, atomicity and recovery.
- **F5 — Integration Contracts:** IAM, Person, Student, Enrollment, Academic and downstream projections.
- **F6 — Financial Account + Obligation Foundation:** financial responsibility and canonical receivable obligations.

Only after F0–F6 are coherent will Payments, Allocation, Reconciliation, Payables, Treasury, Fiscal/Documents, Reporting, providers and operational UX be decomposed into implementation slices.

# Previously approved product decisions

## P1-D01 — Financial Account is the financial-responsibility unit
A student's representative/guardian relationship does not automatically establish financial responsibility. Finance uses a dedicated Financial Account relationship while referencing existing `Person` identity; it must not duplicate people. Financial responsibility, payment permission, financial visibility, communication recipient and legal/document recipient are distinct concepts.

## P1-D02 — One Financial Account may group multiple students
A Financial Account may group multiple students/beneficiaries within one institution, while every obligation preserves student/beneficiary, academic/enrollment, rule and source provenance. Financial Account authority is institution-scoped. Detailed multi-student payment-allocation policy is deferred.

## P1-D03 — Functional currency + structural multi-currency
Every institution has one mandatory functional currency. Finance must nevertheless represent transactions in other currencies structurally from the beginning. When conversion occurs, original amount/currency and functional amount/currency plus conversion rate/source/effective timestamp must be preserved as applicable. FINANCE-01 does not attempt complete accounting-grade FX accounting. Different currencies are never silently summed without valid conversion policy.

# F0 — Financial Constitution

**Status: DESIGN-CLOSED by explicit Product Owner approval.**

## F0-D01 — Authoritative Financial Journal + domain aggregates + derived projections
**APPROVED.** Finance uses an authoritative operational Financial Journal, domain aggregates and derived projections. It does not use full event sourcing as the default and does not accept mutable financial tables plus audit log as sufficient authority.

A canonical financial fact is an economic event accepted by the server and persisted atomically under authorized institutional context with sufficient provenance/evidence for audit and compensation. Candidate concepts include `ObligationIssued`, `PaymentConfirmed`, `PaymentAllocated`, `ExpenseRecognized`, `OutgoingPaymentConfirmed`, `CreditGranted`, `AdjustmentPosted` and reversal facts; exact schema/names remain F3/F4 decisions.

The Journal is an operational financial subledger authority for Nexus, designed for future accounting/fiscal integration. FINANCE-01 is not thereby a complete international general-ledger/accounting ERP.

## F0-D02 — Economic immutability boundary
**APPROVED.** Confirmed economic facts are immutable. Operational lifecycle may evolve only through explicit, authorized and auditable transitions that do not rewrite historical economic meaning. Material corrections create new compensating/reversal authority; destructive deletion or silent overwrite is not a financial correction mechanism.

## F0-D03 — Derived Balance Law
**APPROVED.** Balances and financial positions are deterministic derived projections, never independently editable authority. Materialized projections may exist for performance but must be rebuildable/verifiable against canonical authority. If projection and Journal disagree, canonical facts win and the mismatch is an operational exception. Allocation matters; unapplied money remains explicit; currencies are not silently aggregated.

## F0-D04 — Separation of Financial Authorities
**APPROVED.** Obligation, Payment, Allocation, Financial Document and Reconciliation represent different truths and have explicit relationships.

- **Obligation:** legitimate economic amount due from an authorized cause/rule/context.
- **Payment:** server-authoritatively confirmed receipt/outgoing value according to its rail/provider/method threshold.
- **Allocation:** explicit application of confirmed value to eligible obligation/position.
- **Financial Document:** jurisdiction-aware representation/evidence; not payment/balance authority merely by existing.
- **Reconciliation:** verified relationship between Nexus records and independent/external evidence.

Payment confirmation does not itself settle an obligation; allocation creates that settlement effect. Allocation does not imply external reconciliation. Legitimate intermediate states remain representable.

## F0-D05 — Reversal & Compensation Law
**APPROVED.** A confirmed financial fact is not destructively undone. Total or partial correction, where semantically allowed, creates a new explicitly linked compensating/reversal fact with reason, authority, timestamps, amount/currency, correlation/idempotency and required evidence.

`Reversal`, `Refund`, `Credit` and `Adjustment` are distinct economic operations. Partial reversal may never exceed the remaining reversible value. Late corrections preserve original and correction temporal provenance rather than rewriting historical periods.

## F0-D06 — Temporal Financial Law
**APPROVED.** Finance distinguishes economic effective time, authoritative recorded time and external/provider occurrence time when applicable. A single `created_at` is insufficient financial semantics.

The backend determines or validates economically sensitive dates according to source, institutional policy, provider and jurisdiction. Authoritative instants must be non-ambiguous; institutional/jurisdictional timezone remains explicit context for periods and presentation. Financial/business period is preserved explicitly where required and cannot be silently reclassified by later configuration changes.

## F0-D07 — Authorization, Tenant & Financial Capability Law
**APPROVED.** Every financial operation is authorized server-side against active institutional Membership/context, a specific financial capability/policy and the affected resource. Browser-supplied institution, role, permission or financial scope is never authority.

Capabilities distinguish real operations. The architecture supports segregation of duties without forcing an oversized staffing model. Foreign-tenant identifiers fail closed/non-disclose. PostgreSQL defense-in-depth may supplement but never replace application authorization. AI, browser, Excel, BI, unverified webhook and external integrations have no autonomous financial authority.

## F0-D08 — Audit, Evidence & Provenance Law
**APPROVED.** `Financial Fact`, `Audit Record` and `Evidence` are complementary but distinct authorities.

Sensitive financial commands preserve enough provenance to reconstruct who/system initiated them, institutional Membership/capability context, affected authority, timing, reason, correlation/idempotency, evidence relationship and result. Sensitive data is minimized/redacted. When policy requires evidence or approval, its absence remains an explicit pending/exception condition.

## F0-D09 — Single Financial Write Authority & Consistency Law
**APPROVED.** Every economic mutation enters Finance Core through an authorized domain command. UI, Excel imports, provider callbacks, jobs, automation and AI do not directly write Journal entries, balances or canonical financial authority.

Canonical internal path:

`Command -> Institutional Context -> Authorization -> Validation -> Domain Invariants -> PostgreSQL Transaction -> Financial Fact/Aggregate -> Audit/Outbox -> Projection`

The PostgreSQL commit of canonical Finance authority is the internal persistence boundary. Downstream processing is recoverable/idempotent and cannot rewrite committed authority.

## F0-D10 — Failure, Retry & Recovery Law
**APPROVED.** Finance is fail-closed and preserves explicit uncertainty. Technical error and economic result are distinct dimensions. Ambiguous cases remain explicit and recovery consults canonical authority/evidence before creating new facts. Critical retries, callbacks, commands and downstream messages are idempotent.

## F0-D11 — Bounded Financial Authority
**APPROVED.** Finance owns economic meaning and financial position. Upstream modules own their domain causes/context; downstream modules consume authorized financial projections. Integration occurs through explicit contracts and stable references, never duplicated or cross-written authority.

Finance must not create parallel Student, Enrollment, Person or Membership authorities. Any economic snapshot of upstream context must be minimal, intentional and separately defined in F5/F6.

## F0-D12 — Versioned Financial Policy Law
**APPROVED.** Financial policies evolve through explicit versions/effective periods. Editing current configuration never retroactively changes the economic meaning of confirmed facts.

Any fact whose value/terms depend on policy preserves a stable reference to the applicable policy version and the minimum immutable economic snapshot required to explain/reproduce the historical result.

# F0 constitutional laws — closed set for foundation
1. Canonical economic facts are append-only historical authority.
2. Material corrections use semantically explicit compensating/reversal facts.
3. Balance/position is derived, rebuildable and never independently editable authority.
4. Obligation, Payment, Allocation, Financial Document and Reconciliation are separate authorities.
5. Payment confirmation does not imply allocation/settlement; allocation does not imply reconciliation.
6. Browser assertion alone cannot confirm canonical financial facts.
7. Institution/tenant authority is server-derived, institution-scoped and fail-closed.
8. Financial authorization is capability/policy-based and supports segregation of duties.
9. Critical commands/retries are idempotent; concurrency protection reaches PostgreSQL where applicable.
10. Monetary semantics always include explicit currency; cross-currency aggregation requires valid policy.
11. Economic, recorded and external occurrence times remain distinguishable where relevant.
12. Financial Fact, Audit Record and Evidence are distinct and linked with privacy-aware provenance.
13. Canonical financial writes enter through Finance Core commands; no UI/Excel/BI/AI/provider direct-write bypass exists.
14. Downstream projections/side effects are recoverable and cannot rewrite committed authority.
15. Technical failure is not automatically economic failure; uncertainty is explicit rather than fabricated.
16. Finance owns economic truth but not upstream identity/student/enrollment/academic authority.
17. Read models/reports/Student 360/XLSX/BI consume authorized projections and never form parallel truth.
18. Legacy mutable `outstandingFees`, browser/local state and equivalent paths cannot become new authority.
19. Financial policies are versioned/effective-dated; confirmed historical facts retain policy provenance and immutable economic snapshot.
20. Legitimate intermediate/failure states must remain representable; the system never manufactures downstream success to hide incomplete processing.

# F1 — Institutional Financial Context

**Status: DESIGN-CLOSED by explicit Product Owner approval.**

## F1-D01 — Institution Financial Profile Authority
**APPROVED.** Each institution has exactly one server-authoritative **Institution Financial Profile** as the canonical entrypoint for financial context. The profile resolves the institution's jurisdiction, functional currency, financial timezone, locale/formatting context, financial calendar/period rules, monetary/rounding policy references, enabled financial/payment/fiscal capabilities and institutional reporting/document context.

The profile must be valid before Finance may create authoritative economic facts. Missing, incomplete or inconsistent financial context causes the affected economic operation to fail closed. Nexus must never invent hidden defaults such as EUR, AOA, UTC, a country or a provider to keep a transaction moving.

The profile is an institutional Finance authority; browser state is never a substitute.

## F1-D02 — Primary Financial Jurisdiction
**APPROVED.** Each Institution Financial Profile has an explicit, versioned **primary financial jurisdiction**. Exceptions to that primary jurisdiction are allowed only through an explicitly supported capability/configuration for the applicable process.

Jurisdiction, currency, locale, timezone and provider are independent dimensions. `AO` does not imply every transaction is AOA; `PT` does not imply every transaction is EUR; EUR does not prove Portugal; AOA does not itself establish Angola.

Jurisdiction-specific adapters may change validations, fiscal/document requirements and provider availability, but may never redefine F0 invariants such as immutability, idempotency, tenant isolation, reversal semantics or write authority.

## F1-D03 — Functional Currency Authority
**APPROVED.** Every institution has exactly one functional currency applicable for a defined effective period. Functional currency is a versioned, effective-dated financial setting rather than a freely editable display preference.

Three currency concepts remain distinct:

- **Transaction Currency:** currency of the original economic fact.
- **Functional Currency:** institution's financial base currency applicable for the effective context/period.
- **Presentation Currency:** optional converted presentation used in read models/reports.

Changing presentation currency never changes economic authority. Changing functional currency after Finance is live is a sensitive financial administration operation requiring explicit capability, effective date, validation, audit/evidence and transition rules. Historical facts keep the functional-currency context applicable when they were produced; no configuration change recalculates them retroactively.

## F1-D04 — Financial Time & Calendar Authority
**APPROVED.** Every Institution Financial Profile has an explicit financial timezone and explicit financial calendar/period configuration.

Financial Calendar and Academic Calendar are separate authorities even when linked by business rules. Academic-year boundaries may inform Finance but never automatically become Finance periods.

Financial timezone governs institutional interpretation of dates/day boundaries such as due dates and operational cutoffs. Authoritative timestamps remain non-ambiguous; precise storage representation belongs to F4. Rules such as last-business-day due dates, grace periods, penalties or daily-close cutoffs are versioned policies applied on top of this context rather than hard-coded date arithmetic.

Changes that can alter economic interpretation are versioned/effective-dated and cannot silently reclassify historical facts.

## F1-D05 — Rounding & Monetary Policy Authority
**APPROVED.** Calculation and economic rounding are server-side and governed by versioned monetary policy plus any mandatory constraints of currency, jurisdiction, provider/rail or specific operation.

The design distinguishes:

- **Calculation precision:** precision used during intermediate computations.
- **Settlement precision:** value granularity that can actually be settled for a given currency/rail.
- **Display precision:** presentation formatting only.

Frontend, reporting and exports do not establish economic rounding authority. Confirmed economic values preserve the applicable policy/version and are not historically recalculated after a policy change.

Remainders/rounding differences may never disappear silently; later F2/Allocation design must make their deterministic treatment explicit.

## F1-D06 — Financial Capability & Operational Availability Law
**APPROVED.** Finance separates four questions that must never be collapsed:

1. **Regional/provider compatibility** — is the capability supported for this context?
2. **Institutional enablement** — has the institution enabled/contracted the capability?
3. **Technical/operational availability** — is configuration valid and the adapter currently usable?
4. **User authorization** — may this Membership/capability execute the operation?

A jurisdiction does not automatically enable a provider. `country == PT` never implies MB WAY is active; `country == AO` never implies MULTICAIXA/MCX Express is active.

The same model applies beyond payments to fiscal issuance, reconciliation feeds, Excel imports/exports, banking integrations and future capabilities. Product capability is not user authorization.

## F1-D07 — Institution Financial Profile Lifecycle & Versioning
**APPROVED.** Institution Financial Profile is not a mutable bag of current settings. It has explicit version/effective-period semantics and a server-validated lifecycle.

Conceptually, Finance must distinguish current configuration, the effective version for a given operation/time, and historical versions. Exact state names remain implementation design, but incomplete/invalid configuration must block economic operations that depend on missing context.

Changes have impact classes. Presentation-only changes can be simpler; economically material changes such as functional currency, jurisdiction, financial timezone/calendar, rounding policy or critical capabilities require stronger authorization, effective dating, compatibility validation, audit/evidence and transition rules.

Finance may execute an authoritative operation only when it can resolve one valid, compatible Financial Profile version for that operation. Historical facts retain sufficient profile/policy provenance to answer which context governed them.

## F1-D08 — Institutional Financial Scope Law
**APPROVED.** `Institution` remains the root of financial authority and tenant isolation. Campus, branches, schools, poles or other operational units may act as subordinate financial dimensions when explicitly configured, but do not automatically become separate tenants or independent financial authorities.

A financial fact/obligation/expense may reference an authorized subordinate unit to support operational segmentation such as cash operations, reporting, expenses or future cost-center-like analysis, while institutional consolidation remains possible.

Every unit reference is validated server-side against the active Institution. The browser cannot choose an arbitrary unit to cross scope. Unit-specific bank accounts, cash registers, fiscal series or policies are **not** automatically assumed; they exist only when a later explicitly supported capability requires them.

This design supports both a small single-campus institution and a multi-campus group without prematurely building a multi-company ERP.

# F1 institutional-context laws — closed set for foundation
1. Authoritative Finance requires a valid Institution Financial Profile; no hidden defaults are permitted.
2. Jurisdiction, functional currency, locale, timezone and provider are independent axes.
3. Each institution has a primary financial jurisdiction; exceptions require explicit supported configuration.
4. Functional currency is exactly one per effective period, versioned and historically preserved.
5. Transaction, functional and presentation currencies are separate concepts.
6. Financial Calendar is distinct from Academic Calendar.
7. Financial timezone and period context are explicit and historically stable for recorded facts.
8. Rounding/calculation authority is server-side and policy-versioned; display precision is not economic authority.
9. Calculation precision, settlement precision and display precision remain distinct.
10. Regional compatibility, institutional enablement, technical availability and user authorization are separate capability dimensions.
11. Providers/payment rails are never activated solely by country or currency.
12. Financial Profile changes with economic impact are effective-dated, authorized, audited and transition-validated.
13. Historical operations preserve sufficient profile/policy provenance to remain explainable.
14. Institution remains tenant/financial root; campus/unit is a subordinate dimension unless a future explicit capability says otherwise.
15. Unit references are always server-validated against Institution and cannot be trusted from browser input.
16. Invalid/incomplete context blocks economic fact creation rather than falling back to guessed settings.

# Other accepted directions

## Financial Obligation
Historical obligations preserve economically relevant rule/version snapshot. Retry/concurrency must not duplicate the same economic cause. Exact uniqueness/idempotency belongs to F4.

## International adaptation boundary
Canonical Finance remains stable while adapters/configuration resolve payment rails/providers including MULTICAIXA/MCX Express, KWiK, MB WAY, MULTIBANCO, cards, transfers, cash/POS and future rails, plus jurisdiction/compliance, currencies/locales and fiscal/document behavior.

## Reporting/export
Reporting is downstream of authorized read models:

`authorized ledger/read model -> report dataset -> versioned institutional template -> PDF/XLSX`

Excel import, if supported, passes staging/validation/preview and authorized commands. Power BI consumes projections and cannot mutate Finance.

## Payables / institutional expenses
Finance includes internal expenses/payables as well as receivables. They share the financial authority/Journal foundation while retaining distinct workflows/aggregates. Finance is not automatically procurement, payroll or a generic accounting suite.

# Implementation gate
No Finance product implementation is authorized by this document. **F0 and F1 are design-closed; F2–F6 remain open.** Cross-cutting proof/risk mapping, legacy retirement, final written design/spec self-review and explicit Product Owner review remain required. Only after these close will an implementation plan be produced.

Future execution ownership remains: ChatGPT/Planner for architecture/adjudication; Codex as approved-slice writer; Antigravity as independent read-only-by-default reviewer; GitHub/CI as durable evidence; Product Owner for design/UAT/merge decisions. One writer owns an authority unit at a time; review is SHA-bound; CI green alone is not merge eligibility.

# Next design action
Proceed to **F2 — Money Model**. Close the canonical monetary representation, PostgreSQL-safe precision/scale strategy, currency metadata, arithmetic/rounding invariants, comparison and aggregation rules, conversion evidence, FX boundary, remainder semantics and API serialization rules before F3 Ledger Model.