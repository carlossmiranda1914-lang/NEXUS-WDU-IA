# Nexus Edu IA — Finance Foundation Preparation

**State:** PREPARATION — NOT IMPLEMENTATION AUTHORITY

## Purpose and implementation gate
This is the canonical working record for Finance Core architectural discovery. It records approved decisions but does **not** authorize product code, migrations, APIs, UI, or FINANCE-01 implementation until F0–F6 are closed, reviewed, approved and converted into an implementation plan.

## Product direction
Finance is a **Financial Operations Core for an international school platform**, not a collection of invoice/payment/expense screens and not a generic accounting ERP.

> **INTERNATIONAL CORE / COUNTRY-SPECIFIC ADAPTERS**

No country, currency, payment rail, fiscal rule or provider is a hard-coded boundary of the canonical Finance domain. Every capability must trace through `real operational problem -> authority -> state/invariant -> command/query -> persistence -> authorization -> failure/recovery -> evidence -> observable behavior`. The frontend is never financial authority.

## Foundation sequence
- **F0 — Financial Constitution:** DESIGN-CLOSED — approved below.
- **F1 — Institutional Financial Context:** jurisdiction, locale, functional currency, timezone, financial calendar, rounding and capabilities.
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

Payment confirmation does not itself settle an obligation; allocation creates that settlement effect. Allocation does not imply external reconciliation. Legitimate intermediate states remain representable. Example: obligation 300 EUR + confirmed payment 300 EUR + failed/not-yet-created allocation means 300 EUR received/unapplied while the obligation remains 300 EUR outstanding until valid allocation authority exists.

## F0-D05 — Reversal & Compensation Law
**APPROVED.** A confirmed financial fact is not destructively undone. Total or partial correction, where semantically allowed, creates a new explicitly linked compensating/reversal fact with reason, authority, timestamps, amount/currency, correlation/idempotency and required evidence.

`Reversal`, `Refund`, `Credit` and `Adjustment` are distinct economic operations. A reversal neutralizes/corrects prior authority; a refund represents a real outgoing return of value; credit and adjustment retain their own semantics. No generic “correct amount” operation may hide these distinctions. Partial reversal may never exceed the remaining reversible value. Late corrections preserve original and correction temporal provenance rather than rewriting historical periods.

## F0-D06 — Temporal Financial Law
**APPROVED.** Finance distinguishes economic effective time, authoritative recorded time and external/provider occurrence time when applicable. A single `created_at` is insufficient financial semantics.

The backend determines or validates economically sensitive dates according to source, institutional policy, provider and jurisdiction. Authoritative instants must be non-ambiguous; institutional/jurisdictional timezone remains explicit context for periods and presentation. Financial/business period is preserved explicitly where required and cannot be silently reclassified by later configuration changes. Exact PostgreSQL representation belongs to F4.

## F0-D07 — Authorization, Tenant & Financial Capability Law
**APPROVED.** Every financial operation is authorized server-side against active institutional Membership/context, a specific financial capability/policy and the affected resource. Browser-supplied institution, role, permission or financial scope is never authority.

Capabilities distinguish real operations: viewing does not imply creating obligations; creating expense does not imply approval; initiating/registering payment does not imply confirmation; discount does not imply reversal; report generation does not automatically imply unrestricted financial-data visibility.

The architecture supports segregation of duties without forcing an oversized staffing model: policies may require creator != approver, additional approval above thresholds or elevated authority for sensitive reversal/settlement operations. All Finance references are institution-compatible; foreign-tenant identifiers fail closed/non-disclose. PostgreSQL defense-in-depth may supplement but never replace application authorization. AI, browser, Excel, BI, unverified webhook and external integrations have no autonomous financial authority.

## F0-D08 — Audit, Evidence & Provenance Law
**APPROVED.** `Financial Fact`, `Audit Record` and `Evidence` are complementary but distinct authorities.

Sensitive financial commands preserve enough provenance to reconstruct who/system initiated them, institutional Membership/capability context, affected authority, timing, reason, correlation/idempotency, evidence relationship and result. Auditability does not justify indiscriminate payload duplication: secrets, tokens, banking data and personal/financial-sensitive data are minimized/redacted; larger evidence is securely referenced with appropriate integrity/provenance rather than copied into generic logs.

When policy requires evidence or approval, its absence remains an explicit pending/exception condition; the system cannot manufacture success.

## F0-D09 — Single Financial Write Authority & Consistency Law
**APPROVED.** Every economic mutation enters Finance Core through an authorized domain command. UI, Excel imports, provider callbacks, jobs, automation and AI do not directly write Journal entries, balances or canonical financial authority.

Canonical internal path:

`Command -> Institutional Context -> Authorization -> Validation -> Domain Invariants -> PostgreSQL Transaction -> Financial Fact/Aggregate -> Audit/Outbox -> Projection`

The PostgreSQL commit of canonical Finance authority is the internal persistence boundary. A failed authoritative transaction produces no fictitious partial success. Once a fact is committed, later failure of dashboard projection, notification, Student 360, reporting or another downstream side effect does not invalidate that fact; downstream processing is recoverable/idempotent. F4 will decide exact outbox/workers/checkpoints. Finance does not pretend PostgreSQL + provider + email + BI form one distributed transaction.

## F0-D10 — Failure, Retry & Recovery Law
**APPROVED.** Finance is fail-closed and preserves explicit uncertainty. When the system cannot prove whether an external/economic operation occurred, it neither invents success nor blindly assumes definitive economic failure.

Technical error and economic result are distinct dimensions. Timeouts, network failures and worker crashes do not automatically prove the external operation did not happen. Ambiguous cases remain explicit (`pending/unknown/review` semantics to be named in later aggregate design) and recovery consults canonical authority/evidence before creating new economic facts. Critical retries, callbacks, commands and downstream messages are idempotent. Downstream failure does not erase committed facts. No retry may silently duplicate obligation, payment, allocation, reversal or other authority.

## F0-D11 — Bounded Financial Authority
**APPROVED.** Finance owns economic meaning and financial position. Upstream modules own their domain causes/context; downstream modules consume authorized financial projections. Integration occurs through explicit contracts and stable references, never duplicated or cross-written authority.

Examples: Enrollment can establish activation/context but cannot write a charge; Academic provides academic context but not financial truth; Student/Person identity is referenced rather than duplicated; IAM provides identity/Membership/authorization context but not financial amounts; Documents represent authorized financial facts but do not create payment truth; Communications consumes authorized events; Excel/BI/reporting consume projections; providers supply evidence/confirmation through adapters; AI may assist/explain/propose but cannot autonomously confirm/reverse/create financial facts.

Finance likewise must not create parallel Student, Enrollment, Person or Membership authorities merely because it needs context. Any economic snapshot of upstream context must be minimal, intentional and separately defined in F5/F6.

## F0-D12 — Versioned Financial Policy Law
**APPROVED.** Financial policies evolve through explicit versions/effective periods. Editing current configuration never retroactively changes the economic meaning of confirmed facts.

Any fact whose value/terms depend on policy preserves both a stable reference to the applicable policy version and the minimum immutable economic snapshot required to explain/reproduce the historical result. The design must avoid both extremes: a mutable pointer to “current policy” is insufficient, while indiscriminately copying entire policy JSON into every fact is unnecessary.

This law applies as relevant to fee/catalogue rules, discounts, penalties, due-date rules, rounding/financial policy, approval rules and other economic policy. Future policy versions govern future/effectively applicable operations according to explicit effective-date rules; historical facts retain their original policy provenance.

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

# Other accepted directions

## Financial Obligation
Historical obligations preserve economically relevant rule/version snapshot. Retry/concurrency must not duplicate the same economic cause. Exact uniqueness/idempotency belongs to F4.

## International adaptation boundary
Canonical Finance remains stable while adapters/configuration resolve payment rails/providers (including MULTICAIXA/MCX Express, KWiK, MB WAY, MULTIBANCO, cards, transfers, cash/POS and future rails), jurisdiction/compliance, currencies/locales and fiscal/document behavior.

## Reporting/export
Reporting is downstream of authorized read models: `authorized ledger/read model -> report dataset -> versioned institutional template -> PDF/XLSX`. Excel import, if supported, passes staging/validation/preview and authorized commands. Power BI consumes projections and cannot mutate Finance.

## Payables / institutional expenses
Finance includes internal expenses/payables as well as receivables. They share the financial authority/Journal foundation while retaining distinct workflows/aggregates. Finance is not automatically procurement, payroll or a generic accounting suite.

# Implementation gate
No Finance product implementation is authorized by this document. F0 is design-closed, but F1–F6, cross-cutting proof/risk mapping, legacy retirement and final written design/spec review remain open. Only after those close and Product Owner approves the written design will an implementation plan be produced.

Future execution ownership remains: ChatGPT/Planner for architecture/adjudication; Codex as approved-slice writer; Antigravity as independent read-only-by-default reviewer; GitHub/CI as durable evidence; Product Owner for design/UAT/merge decisions. One writer owns an authority unit at a time; review is SHA-bound; CI green alone is not merge eligibility.

# Next design action
Proceed to **F1 — Institutional Financial Context**. Close jurisdiction/locale, functional currency, timezone/financial calendar, rounding-policy ownership, enabled capabilities, institutional financial profile and configuration versioning before F2 Money Model.