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

Finance will not use full event sourcing as its default architecture and will not accept mutable financial tables plus an audit log as sufficient authority.

> **Authority model: Authoritative Financial Journal + domain aggregates + derived projections.**

A canonical financial fact is an economic event accepted by the server as valid and persisted atomically under authorized institutional context with enough provenance/evidence to be audited and, when necessary, compensated without destructive historical rewriting.

A fact preserves as applicable: tenant/institution, fact type, cause/origin, domain references, monetary amount(s) with currency, economic effective time, recorded time, actor/system authority, idempotency/correlation identity, source/provider/evidence and reversal/compensation relationship.

Candidate fact concepts include `ObligationIssued`, `PaymentConfirmed`, `PaymentAllocated`, `ExpenseRecognized`, `OutgoingPaymentConfirmed`, `CreditGranted`, `AdjustmentPosted` and `FinancialFactReversed`. Exact persisted names/schema remain F3/F4 decisions.

Current balance, total debt, overdue totals, family aggregates, Student 360 widgets, PDF/XLSX, BI metrics, browser calculations and legacy `outstandingFees`-style fields are not independent authority. Financial/fiscal documents are evidence/representations tied to facts and jurisdictional rules; they do not automatically become payment/balance authority.

The Journal is an operational financial subledger authority for Nexus, designed for future accounting/fiscal integration. FINANCE-01 is not thereby a complete international general-ledger/accounting ERP.

## F0-D02 — Economic immutability boundary
**APPROVED.**

> **Confirmed economic facts are immutable. Operational lifecycle may evolve only through explicit, authorized and auditable transitions that do not rewrite historical economic meaning. Material corrections use new compensating/reversal facts.**

Consequences:
- original confirmed amount/currency/cause/economic provenance cannot be silently overwritten;
- destructive deletion is not a financial correction mechanism;
- later settlement, reconciliation, overdue condition or workflow state does not mutate the original economic fact;
- material correction creates linked compensating/reversal authority;
- non-economic administrative metadata may be correctable only under an explicit policy and audit trail, and must never be used to smuggle a change to economic meaning;
- aggregate lifecycle state is operational state, not replacement authority for the underlying facts.

## F0-D03 — Derived Balance Law
**APPROVED.**

> **Balances and financial positions are deterministic derived projections, never independently editable authority. Persisted/materialized projections must be rebuildable and verifiable against canonical financial authority.**

Consequences:
- no new `balance`, `outstandingFees`, `amountDue` or equivalent mutable field may become a second source of truth;
- a projection may be persisted for performance, but is disposable/rebuildable from canonical authority;
- projection state must preserve sufficient checkpoint/provenance to support verification and controlled rebuild;
- if a projection disagrees with canonical authority, the Journal/facts win and the mismatch is a detectable operational exception; Finance must not rewrite the Journal merely to make a dashboard match;
- allocation matters: a confirmed payment does not automatically reduce a specific obligation unless the applicable allocation/settlement fact exists;
- unapplied money remains an explicit financial position and cannot disappear into an aggregate total;
- cross-currency balances cannot be silently combined without an explicit valid conversion/reporting policy;
- Student 360, reports, XLSX, BI and operational dashboards consume authorized read models rather than recalculate independent balances.

Example invariant: if an obligation is 300 EUR, a confirmed payment is 200 EUR, and only 150 EUR is validly allocated to that obligation, its outstanding position is 150 EUR; the remaining 50 EUR is represented separately as unapplied/available value according to the later allocation model.

## F0 constitutional laws accumulated so far
1. Confirmed economic facts are append-only historical authority.
2. Material corrections use compensating/reversal facts, never destructive rewrite/delete.
3. Balance is derived and never independently editable authority.
4. Obligation, invoice/document, payment, allocation and reconciliation are distinct concepts.
5. Browser assertion alone cannot confirm a canonical financial fact.
6. Institution/tenant authority is server-derived and fail-closed.
7. No canonical financial operation may cross institution boundaries.
8. Critical financial commands require idempotent semantics.
9. Concurrency safety must be enforceable at PostgreSQL authority boundaries where applicable.
10. Every monetary amount carries explicit currency semantics.
11. Economic effective time and recorded time are distinct where both matter.
12. Read models must be rebuildable/correctable without mutating historical economic facts.
13. Reports, Excel, BI and Student 360 consume authorized projections rather than parallel financial truth.
14. No new authority may be built on legacy mutable `outstandingFees`, browser state or similar transitional paths.
15. Projection divergence is an exception to detect/reconcile, not permission to mutate historical authority.

# Other accepted directions

## Financial Obligation
A financial obligation is distinct from invoice/fiscal document, payment, allocation, balance/read model, Student and Enrollment. It represents a legitimate amount due because of an authorized cause/rule/context. Historical obligations preserve the economically relevant rule/version snapshot. Retry/concurrency must not duplicate the same economic cause. Exact idempotency/constraint design belongs to F4.

## International adaptation boundary
Canonical Finance remains stable while configuration/adapters resolve payment rails/providers (including MULTICAIXA/MCX Express, KWiK, MB WAY, MULTIBANCO, cards, transfers, cash/POS and future rails), jurisdiction/compliance, currencies/locales and fiscal/document behavior. Payment confirmation will be server-authoritative; browser/user assertion alone never confirms payment.

## Reporting/export
Reporting is downstream of authorized financial read models. Target flow:

`authorized ledger/read model -> report dataset -> versioned institutional template -> PDF/XLSX`

XLSX must be a professional workbook with institutional branding, correct monetary/date types, sizing, filters, useful frozen regions, totals/subtotals, print configuration, localization and audit/version metadata. Excel import, if supported, goes through staging/validation/preview and authorized commands; Excel is never authority. Power BI consumes authorized projections and cannot mutate Finance.

## Payables / institutional expenses
Finance includes internal expenses/payables as well as receivables. They share the financial authority/ledger foundation while retaining distinct workflows/aggregates. Supplier/counterparty, supporting evidence, approval, outgoing payment, settlement/reconciliation and segregation of duties require later design. Finance is not automatically procurement, payroll or a generic accounting suite.

# Implementation gate
No Finance product implementation is authorized by this preparation document.

Before implementation planning, design must close F0–F6, authority/ownership, money/ledger invariants, transactions/idempotency/concurrency, PostgreSQL strategy, IAM/tenant/segregation, integration contracts, legacy retirement, failure/recovery, `Risk -> Required Proof -> Tool -> DONE`, slice decomposition and explicit human approval.

Future execution ownership remains: ChatGPT/Planner for architecture/adjudication; Codex as approved-slice writer; Antigravity as independent read-only-by-default reviewer; GitHub/CI as durable evidence; Product Owner for design/UAT/merge decisions. One writer owns an authority unit at a time; review is SHA-bound; CI green alone is not merge eligibility.

# Next F0 design action
Close the next constitutional boundary before schema/API/UI design: **obligation/payment/allocation/document/reconciliation separation and their authority relationships**, followed by reversal/compensation, temporal law, authorization/tenant law, audit/evidence minimum, write/read consistency, forbidden write paths and failure semantics.