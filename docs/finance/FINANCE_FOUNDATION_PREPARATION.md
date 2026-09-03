# Nexus Edu IA — Finance Foundation Preparation

**State:** PREPARATION — NOT IMPLEMENTATION AUTHORITY

## Purpose and implementation gate
This is the canonical working record for Finance Core architectural discovery. It records approved decisions but does **not** authorize product code, migrations, APIs, UI, or FINANCE-01 implementation until F0–F6 are closed, reviewed, approved and converted into an implementation plan.

## Product direction
Finance is a **Financial Operations Core for an international school platform**, not a collection of invoice/payment/expense screens and not a generic accounting ERP.

> **INTERNATIONAL CORE / COUNTRY-SPECIFIC ADAPTERS**

No country, currency, payment rail, fiscal rule or provider is a hard-coded boundary of the canonical Finance domain. Finance will cover connected but separately owned receivables, payables/internal expenses, financial facts, payments, allocations, reconciliation, corrections/reversals, evidence/documents, provider-neutral orchestration, jurisdiction adapters, professional reporting and authorized read models.

Every capability must trace through:

`real operational problem -> authority -> state/invariant -> command/query -> persistence -> authorization -> failure/recovery -> evidence -> observable behavior`

The frontend is never financial authority.

## Foundation sequence
- **F0 — Financial Constitution:** domain boundaries, language, authority, invariants, history/audit and facts versus projections.
- **F1 — Institutional Financial Context:** jurisdiction, locale, functional currency, timezone, financial calendar, rounding and capabilities.
- **F2 — Money Model:** representation, precision/scale, rounding, currencies and conversion evidence.
- **F3 — Ledger Model:** facts/entries, immutability, derivation, reversals and operational-subledger boundary.
- **F4 — Transaction & Persistence Model:** PostgreSQL, aggregates, transactions, constraints, tenancy, idempotency, concurrency, atomicity and recovery.
- **F5 — Integration Contracts:** IAM, Person, Student, Enrollment, Academic and downstream projections.
- **F6 — Financial Account + Obligation Foundation:** financial responsibility and canonical receivable obligations.

Only after the foundation is coherent will Payments, Allocation, Reconciliation, Payables, Treasury, Fiscal/Documents, Reporting, providers and operational UX be decomposed into implementation slices.

# Approved decisions

## P1-D01 — Financial Account is the financial-responsibility unit
The student's representative/guardian relationship does not automatically establish financial responsibility. Finance uses a dedicated Financial Account relationship while referencing existing `Person` identity; it must not duplicate people.

Financial responsibility, payment permission, financial visibility, communication recipient and legal/document recipient are distinct concepts even when the same person fulfils several roles.

## P1-D02 — One Financial Account may group multiple students
A Financial Account may group multiple students/beneficiaries within one institution, while every obligation preserves its own student/beneficiary, academic/enrollment, rule and source provenance.

Financial Account authority is institution-scoped. Global Person identity must never merge or expose financial data across institutions. Detailed multi-student payment-allocation policy is deferred until the lower foundation is closed.

## P1-D03 — Functional currency + structural multi-currency
Every institution has one mandatory functional currency. Finance must nevertheless represent transactions in other currencies from the beginning.

When conversion occurs, the original economic fact and conversion evidence must be preserved: transaction amount/currency, functional amount/currency, conversion rate, rate source and effective timestamp as applicable.

FINANCE-01 will not attempt full accounting-grade FX revaluation, automatic FX gain/loss accounting or a complete international accounting engine. Different currencies may never be silently summed without an explicit valid conversion policy.

# F0 — Financial Constitution

## F0-D01 — Authoritative Financial Journal + domain aggregates + derived projections
**APPROVED.**

> **Authority model: Authoritative Financial Journal + domain aggregates + derived projections.**

Finance will not use full event sourcing as its default architecture and will not accept mutable financial tables plus an audit log as sufficient authority. A canonical financial fact is an economic event accepted by the server as valid and persisted atomically under authorized institutional context with enough provenance/evidence to be audited and, when necessary, compensated without destructive historical rewriting.

A fact preserves as applicable: tenant/institution, fact type, cause/origin, domain references, monetary amount(s) with currency, economic effective time, recorded time, actor/system authority, idempotency/correlation identity, source/provider/evidence and reversal/compensation relationship.

Candidate fact concepts include `ObligationIssued`, `PaymentConfirmed`, `PaymentAllocated`, `ExpenseRecognized`, `OutgoingPaymentConfirmed`, `CreditGranted`, `AdjustmentPosted` and `FinancialFactReversed`. Exact persisted names/schema remain F3/F4 decisions.

Current balance, total debt, overdue totals, family aggregates, Student 360 widgets, PDF/XLSX, BI metrics, browser calculations and legacy `outstandingFees`-style fields are not independent authority. Financial/fiscal documents are evidence/representations tied to facts and jurisdictional rules; they do not automatically become payment/balance authority.

The Journal is an operational financial subledger authority for Nexus, designed for future accounting/fiscal integration. FINANCE-01 is not thereby a complete international general-ledger/accounting ERP.

## F0-D02 — Economic immutability boundary
**APPROVED.**

> **Confirmed economic facts are immutable. Operational lifecycle may evolve only through explicit, authorized and auditable transitions that do not rewrite historical economic meaning. Material corrections use new compensating/reversal facts.**

Original confirmed amount/currency/cause/economic provenance cannot be silently overwritten; destructive deletion is not a correction mechanism; settlement/reconciliation/overdue/workflow state does not mutate the original fact; material correction creates linked compensating/reversal authority. Non-economic metadata is correctable only under explicit policy/audit and cannot smuggle a change to economic meaning.

## F0-D03 — Derived Balance Law
**APPROVED.**

> **Balances and financial positions are deterministic derived projections, never independently editable authority. Persisted/materialized projections must be rebuildable and verifiable against canonical financial authority.**

No new `balance`, `outstandingFees`, `amountDue` or equivalent mutable field may become a second source of truth. Materialized projections may exist for performance but are disposable/rebuildable and must carry sufficient checkpoint/provenance for verification. If a projection disagrees with canonical authority, the Journal/facts win and the mismatch is an operational exception.

Allocation matters: confirmed payment does not automatically reduce a specific obligation. Unapplied money remains an explicit financial position. Different currencies cannot be silently aggregated without valid conversion/reporting policy. Student 360, reports, XLSX, BI and dashboards consume authorized read models.

Example: obligation 300 EUR + confirmed payment 200 EUR + only 150 EUR validly allocated = obligation outstanding 150 EUR and 50 EUR represented separately as unapplied/available value under the later allocation model.

## F0-D04 — Separation of Financial Authorities
**APPROVED.**

> **Obligation, Payment, Allocation, Financial Document and Reconciliation represent different truths. None may impersonate or silently mutate the authority of another. Their relationships must be explicit.**

### Obligation
Represents an authorized economic amount due because of a legitimate rule/cause/context. It answers **what is owed, why, by/for which financial context, in which currency and under which effective terms**. An obligation is not proof that money was received and is not itself a fiscal/payment document.

### Payment
Represents money/value whose receipt (or, for payables, outgoing settlement) has reached the server-authoritative confirmation threshold defined for its rail/provider/method. A browser click, UI status or generated receipt cannot alone create `PaymentConfirmed` authority.

A confirmed payment may exist without being allocated to any obligation.

### Allocation
Represents the explicit application of confirmed financial value to one or more eligible obligations/positions. Allocation is the authority that links available payment/credit value to a particular obligation settlement effect.

A payment does **not** automatically settle an obligation merely because amount, payer or timing appears to match. Deterministic auto-allocation may later be allowed only through an explicit policy that creates auditable allocation authority.

Allocation must eventually enforce invariants such as no over-allocation beyond eligible available value, explicit currency/conversion semantics, tenant/context compatibility and idempotent/concurrency-safe application. Exact rules belong to later design.

### Financial Document
Invoice, receipt, credit/debit note, fiscal document and supporting evidence represent/document financial facts according to operational and jurisdictional requirements. A document is not automatically the authority for payment, allocation, reconciliation or balance.

Document lifecycle may be legally/fiscally important and can constrain later operations, but it remains a distinct authority boundary. Country-specific fiscal semantics belong to jurisdiction adapters rather than being hard-coded into the canonical Finance Core.

### Reconciliation
Represents the verified relationship between Nexus financial records and an independent/external source of evidence such as provider settlement, bank movement, cash-close evidence or another approved reconciliation source.

Reconciliation does not create payment merely because an external line exists, and payment confirmation does not by itself prove reconciliation. Matching, exception handling and deterministic reconciliation policy will be designed separately.

### Failure-safe consequence
The system must be able to represent legitimate intermediate states instead of forcing false success. For example:

`Obligation = 300 EUR`

`PaymentConfirmed = 300 EUR`

`Allocation = not yet created because processing failed`

Then the correct state is **300 EUR received/unapplied and the obligation still outstanding by 300 EUR**. The system must recover/retry the allocation idempotently; it must not silently mark the obligation paid merely because the amounts coincide.

Similarly, a payment may be allocated but still await external reconciliation, and a financial document may exist without implying payment.

### Authority relationship
Conceptually:

`Obligation -> amount legitimately due`

`Payment -> value confirmed received/outgoing`

`Allocation -> explicit application of value to obligation/position`

`Financial Position -> derived from canonical facts + allocations/adjustments`

`Reconciliation -> verified correspondence with independent evidence`

`Financial Document -> jurisdiction-aware representation/evidence of applicable facts`

These relationships must be represented by explicit references/facts and not by hidden status coupling.

## F0 constitutional laws accumulated so far
1. Confirmed economic facts are append-only historical authority.
2. Material corrections use compensating/reversal facts, never destructive rewrite/delete.
3. Balance is derived and never independently editable authority.
4. Obligation, Payment, Allocation, Financial Document and Reconciliation are distinct authorities with explicit relationships.
5. Payment confirmation alone does not imply obligation settlement; allocation is required for the settlement effect.
6. Allocation alone does not imply external reconciliation.
7. A document does not create payment/balance truth merely by existing.
8. Browser assertion alone cannot confirm a canonical financial fact.
9. Institution/tenant authority is server-derived and fail-closed.
10. No canonical financial operation may cross institution boundaries.
11. Critical financial commands require idempotent semantics.
12. Concurrency safety must be enforceable at PostgreSQL authority boundaries where applicable.
13. Every monetary amount carries explicit currency semantics.
14. Economic effective time and recorded time are distinct where both matter.
15. Read models must be rebuildable/correctable without mutating historical economic facts.
16. Reports, Excel, BI and Student 360 consume authorized projections rather than parallel financial truth.
17. No new authority may be built on legacy mutable `outstandingFees`, browser state or similar transitional paths.
18. Projection divergence is an exception to detect/reconcile, not permission to mutate historical authority.
19. Legitimate intermediate/failure states must remain representable; the system must never manufacture a successful downstream state to hide an incomplete workflow.

# Other accepted directions

## Financial Obligation
Historical obligations preserve the economically relevant rule/version snapshot. Retry/concurrency must not duplicate the same economic cause. Exact idempotency/constraint design belongs to F4.

## International adaptation boundary
Canonical Finance remains stable while configuration/adapters resolve payment rails/providers (including MULTICAIXA/MCX Express, KWiK, MB WAY, MULTIBANCO, cards, transfers, cash/POS and future rails), jurisdiction/compliance, currencies/locales and fiscal/document behavior. Payment confirmation is server-authoritative.

## Reporting/export
Reporting is downstream of authorized financial read models. Target: `authorized ledger/read model -> report dataset -> versioned institutional template -> PDF/XLSX`. XLSX must be a professional workbook with institutional branding, correct monetary/date types, sizing, filters, useful frozen regions, totals/subtotals, print configuration, localization and audit/version metadata. Excel import, if supported, goes through staging/validation/preview and authorized commands; Excel is never authority. Power BI consumes authorized projections and cannot mutate Finance.

## Payables / institutional expenses
Finance includes internal expenses/payables as well as receivables. They share the financial authority/ledger foundation while retaining distinct workflows/aggregates. Supplier/counterparty, supporting evidence, approval, outgoing payment, settlement/reconciliation and segregation of duties require later design. Finance is not automatically procurement, payroll or a generic accounting suite.

# Implementation gate
No Finance product implementation is authorized by this preparation document. Before implementation planning, design must close F0–F6, authority/ownership, money/ledger invariants, transactions/idempotency/concurrency, PostgreSQL strategy, IAM/tenant/segregation, integration contracts, legacy retirement, failure/recovery, `Risk -> Required Proof -> Tool -> DONE`, slice decomposition and explicit human approval.

Future execution ownership remains: ChatGPT/Planner for architecture/adjudication; Codex as approved-slice writer; Antigravity as independent read-only-by-default reviewer; GitHub/CI as durable evidence; Product Owner for design/UAT/merge decisions. One writer owns an authority unit at a time; review is SHA-bound; CI green alone is not merge eligibility.

# Next F0 design action
Close **reversal/compensation law**, then temporal/effective-date law, authorization/tenant law, audit/evidence minimum, write/read consistency, forbidden write paths and failure semantics before schema/API/UI design.