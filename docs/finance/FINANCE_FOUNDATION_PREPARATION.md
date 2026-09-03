# Nexus Edu IA — Finance Foundation Preparation

**State:** PREPARATION — NOT IMPLEMENTATION AUTHORITY  
**Purpose:** Canonical working record for the Finance Core architectural discovery.  
**Rule:** This document records approved architectural decisions and open questions. It does not authorize product code, schema migrations, APIs, UI, or FINANCE-01 implementation until the design is completed, reviewed, approved, and converted into an implementation plan.

## 1. Product direction

Finance is a **Financial Operations Core for an international school platform**, not a collection of invoice/payment/expense screens and not a generic accounting ERP.

Architecture principle:

> **INTERNATIONAL CORE / COUNTRY-SPECIFIC ADAPTERS**

Angola, Portugal, and future countries are supported contexts; no country, currency, payment rail, fiscal rule, or provider may become the hard-coded boundary of the canonical Finance domain.

The Finance authority must eventually support, through connected but separately owned workflows:

- receivables;
- payables / internal institutional expenses;
- immutable/auditable financial facts;
- payments and allocations;
- reconciliation;
- reversals, adjustments, discounts, credits and penalties;
- financial documents/evidence;
- provider-neutral payment orchestration;
- jurisdiction/fiscal adapters;
- professional reporting, PDF and XLSX;
- authorized read models for Student 360, operational UX, exports and BI.

## 2. Non-negotiable product rule

Finance must not be implemented as generic buttons, decorative dashboards, fictitious tables, local browser state, or demo workflows.

Every implemented capability must be traceable through:

`real operational problem -> authority -> state/invariant -> command/query -> persistence -> authorization -> failure/recovery -> evidence -> observable behavior`

The frontend is a consumer/operator of the financial domain. It is not financial authority and must not be used to invent the domain model.

## 3. Foundation sequence under design

Before operational Finance UI is authorized, discovery must close the following layers:

### F0 — Financial Constitution
Define domain boundaries, canonical language, authority ownership, invariants, forbidden shortcuts, historical/audit rules and the relationship between financial facts and projections.

### F1 — Institutional Financial Context
Define jurisdiction, locale, functional currency, timezone, financial calendar, rounding policy, enabled financial/payment/fiscal capabilities and institutional report/document profile.

### F2 — Money Model
Define monetary representation, precision/scale, rounding, ISO currency handling, transaction currency versus functional currency, conversion evidence and rules preventing invalid cross-currency aggregation.

### F3 — Ledger Model
Define financial facts/entries, immutability, balance derivation, reversals/compensating entries, transaction semantics and the boundary between an operational financial ledger/subledger and future accounting integration.

### F4 — Transaction & Persistence Model
Define PostgreSQL authority, aggregate boundaries, transaction boundaries, constraints, tenant ownership, idempotency, concurrency, atomicity, outbox/audit implications, failure recovery and migration rules.

### F5 — Integration Contracts
Define stable contracts with IAM, Person, Student, Enrollment and Academic context, plus downstream read contracts for Student 360, Documents, Communications, Reporting and BI. Finance must reference upstream authority; it must not duplicate it.

### F6 — Financial Account + Obligation Foundation
Define financial responsibility/account structures and the first canonical receivable obligation lifecycle on top of F0–F5.

Only after this foundation is coherent should Payments, Allocation, Reconciliation, Payables, Treasury, Fiscal/Documents, Reporting, provider integrations and operational UX be decomposed into implementation slices.

## 4. Approved architectural decisions to date

### P1-D01 — Financial Account is the financial-responsibility unit
A student's existing primary representative/guardian relationship does **not** automatically mean financial responsibility.

Finance will use a dedicated **Financial Account** concept for financial responsibility. Existing `Person` identity is referenced; Finance must not create duplicate finance-specific people merely because a person becomes financially responsible.

Representative/guardian information may assist configuration, but financial responsibility is an explicit Finance relationship.

Financial responsibility, payment permission, financial visibility, communication recipient and legal/document recipient must not be assumed to be the same relationship.

### P1-D02 — One Financial Account may group multiple students
Within one institution, a Financial Account may group multiple students/beneficiaries, for example siblings sharing a family financial context.

This aggregation does **not** erase provenance. Every obligation remains attributable to the student/beneficiary, academic/enrollment context, rule and source that created it.

Financial Account ownership remains institution-scoped. A global Person identity must never cause financial data from separate institutions to merge or become cross-tenant visible.

Detailed payment-allocation policy across multiple students is intentionally deferred until the lower financial foundation is closed.

### P1-D03 — Functional currency per institution + structural multi-currency support
Every institution has one mandatory **functional currency**.

The Finance Core must nevertheless be capable from the beginning of representing transactions in currencies other than the institution's functional currency.

When conversion exists, the model must preserve the original economic fact and sufficient conversion evidence, including concepts equivalent to:

- transaction amount;
- transaction currency;
- functional amount;
- functional currency;
- exchange/conversion rate used;
- rate source;
- rate/effective timestamp.

The first Finance implementation will **not** attempt full accounting-grade foreign-exchange revaluation, automatic FX gain/loss accounting or a complete international accounting engine.

Amounts in different currencies must never be silently added into a single total without an explicit, valid conversion policy.

## 5. Financial Obligation direction already accepted for further design

A financial obligation is conceptually distinct from:

- invoice/fiscal document;
- payment;
- allocation;
- balance/read model;
- student record;
- enrollment record.

It represents a legitimate amount due because of an authorized financial cause/rule/context.

Historical obligations must preserve the economically relevant rule/version snapshot. A later catalogue or plan price change must not silently rewrite historical obligations.

Retry or concurrent processing of the same economic cause must not create duplicate obligations. Exact idempotency and PostgreSQL concurrency mechanisms remain to be designed under F4.

Cancellation/reversal must preserve history; destructive deletion of financial facts is not an acceptable correction mechanism.

Legacy mutable `outstandingFees`-style balance authority is not the target architecture. Balance must ultimately be a derived/projection concept based on canonical financial facts and allocations/adjustments.

## 6. International adaptation boundary

The canonical domain must remain stable while adapters/configuration resolve regional behavior.

Conceptual separation:

- **Canonical Finance:** accounts, obligations, ledger/facts, payments, allocations, reconciliation, reversals, evidence.
- **Payment rails/providers:** MULTICAIXA/MCX Express, KWiK, MB WAY, MULTIBANCO, cards, transfers, cash/POS and future rails/providers.
- **Jurisdiction/compliance:** Angola, Portugal and future jurisdictions.
- **Currency/locale:** AOA, EUR and future currencies/locales.
- **Fiscal/document adapters:** jurisdiction-specific requirements and external certified/fiscal systems where required.

Payment confirmation must eventually be server-authoritative. A browser click or user assertion alone must never convert a payment into a confirmed financial fact.

## 7. Reporting/export direction already accepted

Finance reporting is a downstream projection of financial authority, not an independent calculator of truth.

Target flow:

`authorized ledger/read model -> report query/dataset -> versioned institutional template -> PDF/XLSX`

XLSX output must be a professional workbook rather than a generic raw table. The design must cover institutional branding, proper monetary/date types, column sizing, filters, frozen regions where useful, totals/subtotals, print configuration, sheets where justified, localization and audit/version metadata.

PDF and XLSX may have different presentation optimized for their purpose while remaining numerically consistent with the same authorized source.

Excel imports, if later supported, must pass through staging, validation, preview/error handling and authorized Finance commands. Excel is never financial authority.

Power BI/analytics must consume authorized read models/analytics projections and must not mutate Finance authority.

## 8. Payables / institutional expenses direction

The Finance Core scope includes internal institutional expenses/payables as well as student/institution receivables.

Receivables and payables share the financial authority/ledger foundation but must retain distinct operational workflows and aggregates. Supplier/counterparty, supporting evidence, approval, outgoing payment, settlement/reconciliation and segregation of duties require dedicated design before implementation.

Finance is not automatically a full procurement, payroll or generic accounting suite. Those boundaries require separate evidence and decisions.

## 9. Implementation gate

No Finance product implementation is authorized by this preparation document.

Before implementation planning begins, the design must at minimum close:

1. F0–F6 foundation decisions;
2. authority and ownership map;
3. money and ledger invariants;
4. transaction/idempotency/concurrency model;
5. PostgreSQL persistence strategy;
6. IAM/tenant isolation and segregation-of-duties model;
7. upstream/downstream integration contracts;
8. legacy migration/retirement boundaries;
9. failure/retry/recovery matrix;
10. `Risk -> Required Proof -> Tool -> DONE` mapping;
11. first implementation-slice decomposition;
12. explicit human design approval.

After approval, the architectural design must be converted into a dedicated implementation plan. Agent prompts/missions must derive from that plan rather than from conversation fragments.

## 10. Agent execution direction

The future implementation plan must make ownership explicit:

- **ChatGPT / Planner:** architecture, scope, invariants, priority, adjudication and DONE eligibility.
- **Codex:** primary implementer/writer for an approved slice.
- **Antigravity:** independent reviewer/verifier, read-only by default.
- **GitHub/CI:** durable independent evidence and integration gate.
- **Product Owner:** scope/design approval, affected UAT and merge decisions.

One writer owns a code/authority unit at a time. Reviewer findings must be evidence-based and SHA-bound. CI green alone is not sufficient for merge eligibility.

## 11. Next design action

Continue with **F0 — Financial Constitution** and close its non-negotiable laws before schema/API/UI design.

Open F0 subjects include:

- exact definition of canonical financial fact;
- operational ledger versus accounting-ledger boundary;
- immutable versus correctable data classes;
- balance derivation laws;
- obligation/payment/document separation;
- reversal/compensation laws;
- temporal/effective-date rules;
- authorization and tenant laws;
- audit/evidence minimum;
- consistency expectations between write authority and read models;
- forbidden direct-write paths;
- failure semantics.

These questions are architectural and must be resolved before implementation.