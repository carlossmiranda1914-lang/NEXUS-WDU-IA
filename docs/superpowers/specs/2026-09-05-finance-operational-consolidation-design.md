# Nexus Edu IA — Finance Operational Consolidation Design

**Status:** APPROVED PRODUCT DESIGN — IMPLEMENTATION AUTHORITY FOR PLAN CREATION
**Date:** 2026-09-05
**Approved option:** A — Financial Account / financial context as the operational center
**Scope:** operational consolidation of existing Finance authorities and UI; no Allocation, provider integration, fiscal engine, treasury, or replacement of canonical Person/Student/Enrollment/Finance authorities.

## 1. Purpose

The Finance domain already contains real canonical authorities for financial context, fee catalogue, obligations and payments. The current product surface, however, exposes those authorities mainly as separate technical entities. This design consolidates them into one operational workflow centered on the Financial Account / financial context so that school staff can understand and act on a student's or payer's financial situation without needing to know the internal Finance object model.

This is a consolidation mission, not a rebuild. Existing canonical authorities remain authoritative. The new work composes them into a contextual operational read model and routes existing mutations through their current server-authoritative commands.

## 2. Product decision

The approved product model is:

**Person / Student / Enrollment provide identity and academic context. Financial Account provides financial responsibility context. Fee Catalogue defines what may be charged. Obligation records what became due. Payment records what was received.**

The user experience may enter Finance from a Student, Enrollment or direct Finance search, but the financial operational center is the Financial Account / financial context, not the Student entity itself.

## 3. Constitutional invariants

1. Finance must not duplicate Person, Student, Enrollment, Membership or Institution authority.
2. Financial Account must not become a duplicate Student profile.
3. Obligation and Payment remain separate canonical authorities.
4. Payment does not liquidate an Obligation without a future explicit Allocation authority.
5. No UI label may imply an allocated, settled or net balance that the canonical model cannot prove.
6. Browser state is never authority for institution, membership, payer, account or tenant ownership.
7. All contextual lookups and mutations are institution-scoped and fail closed on foreign-tenant references.
8. Existing exact-decimal Money and Finance foundation rules remain unchanged.
9. Confirmed financial facts remain immutable except through the existing approved append/reversal model.
10. No provider, fiscal, treasury or reconciliation semantics may be invented in this mission.

## 4. Current-state problem

The current top-level Finance workspace exposes three independent technical tabs: `Catálogo de Emolumentos`, `Obrigações Financeiras`, and `Recebimentos`.

The current manual payment form can record method, amount, currency, evidence/reference, effective date and notes. The client contract already supports `financialAccountId` and `payerPersonId`, but the current UI does not populate those values. This creates an operational gap: a staff member can record received money without seeing sufficient payer/account context in the form.

The current Payment client also stores the global `fetch` function on an instance and later calls it through the instance. The observed Human UAT failure `Illegal invocation` must be reproduced by a deterministic characterization test before any fix is accepted.

## 5. Target operational model

### 5.1 Finance Operational Context

Introduce one server-authoritative read projection named conceptually `FinanceOperationalContext`.

It is not a new financial authority. It is a read composition over existing authorities.

Minimum projection shape:

```ts
export type FinanceOperationalContext = {
  financialAccount: {
    id: string;
    status: string;
    version: number;
  };
  responsiblePerson: {
    personId: string;
    displayName: string;
  } | null;
  students: Array<{
    studentId: string;
    personId: string;
    displayName: string;
    enrollmentId?: string;
    enrollmentStatus?: string;
  }>;
  openObligations: Array<{
    id: string;
    description: string;
    amount: { amount: string; currency: string };
    dueAt?: string;
    status: string;
  }>;
  confirmedUnallocatedPayments: Array<{
    id: string;
    amount: { amount: string; currency: string };
    method: string;
    effectiveAt: string;
    payerPersonId?: string;
    status: string;
  }>;
};
```

Field names may be adapted to existing canonical model names during implementation, but semantic ownership may not change.

### 5.2 Entry points

The same operational context must be reachable by at least:

- direct Finance search by a supported identifier/name;
- Student context action `Ver situação financeira`;
- Enrollment context action when an enrolled student's financial account is resolvable.

Entry points must navigate to or open the same canonical Finance operational surface. They must not fork logic.

### 5.3 Operational surface

The primary Finance surface becomes account/context-oriented.

For a selected context, the user must see in one place:

- financial account identity/status;
- responsible person, when defined;
- associated student(s);
- relevant enrollment context where available;
- open obligations;
- confirmed/unallocated payments;
- explicit actions permitted by current authority: create obligation where already supported and register manual/offline payment.

The existing Fee Catalogue remains an administrative configuration surface and does not become part of the operational account timeline.

## 6. Required user journeys

### Journey A — Consult financial situation

1. Staff opens Finance or enters from Student/Enrollment.
2. Staff resolves one Financial Account / financial context.
3. Nexus displays responsible person, associated student(s), open obligations and confirmed/unallocated payments.
4. Empty states are explicit and truthful.
5. No derived `paid`, `settled`, `outstanding after payment` or net balance is shown unless canonical Allocation exists and proves it.

**Acceptance:** a staff member can answer `who is financially responsible, what is due, and what money has been received` from one operational surface without switching among three technical tabs.

### Journey B — Register contextualized manual/offline payment

1. Staff starts from a resolved Finance Operational Context.
2. Form shows the selected Financial Account and payer/responsible-person context before confirmation.
3. Staff enters payment method, exact-decimal amount, supported currency, evidence/reference where required, effective date and notes.
4. Client sends the canonical `financialAccountId` and, when applicable, `payerPersonId` to the existing Payment command.
5. Server revalidates institution/account/person ownership and permissions.
6. Payment is confirmed through existing Payment authority.
7. UI refreshes from server and shows the new payment as `confirmed / unallocated` or the canonical equivalent.
8. No obligation is modified by this action.

**Acceptance:** payment creation is context-bound and server-authoritative, yet still preserves non-allocation.

### Journey C — Review financial history

1. Staff opens an account context.
2. UI shows a readable chronological history composed from existing Obligation and Payment facts.
3. Each history item remains typed as an Obligation or Payment; the UI may visually group them but may not collapse them into one mutable record.
4. The history is reconstructable by refreshing from canonical server reads.

**Acceptance:** staff can understand the financial activity around the account while the domain model remains separated.

## 7. `Illegal invocation` defect contract

The defect is part of this consolidation mission because it blocks the approved payment journey.

Implementation requirements:

1. Write a deterministic failing test that invokes `PaymentApiClient` with the default/global fetch path or an equivalent browser-native function whose receiver semantics reproduce the defect.
2. Prove the failure before changing implementation.
3. Change the client so native `fetch` is invoked safely; preferred minimal approaches are a lexical wrapper such as `(input, init) => fetch(input, init)` or explicit binding where required.
4. Preserve custom injected `fetcher` behavior for tests.
5. Add regression coverage for authenticated request headers, error parsing and the manual-payment endpoint.

No speculative broad refactor of API clients is authorized by this defect alone.

## 8. API and authority boundary

Preferred read endpoint:

`GET /api/finance/operational-context?financialAccountId=<id>`

Alternative route shape may be used if it follows existing server routing conventions, but one canonical read contract must exist.

The endpoint must:

- resolve institution and membership server-side;
- authorize the Finance read capability using existing policy patterns;
- reject foreign-tenant account IDs without disclosing foreign data;
- compose existing financial account, person/student/enrollment, obligation and payment repositories/read services;
- return a presentation-safe projection only;
- contain no mutation and create no financial facts.

If direct search is implemented in this mission, search results must be institution-scoped and presentation-safe. Search must not expose arbitrary person identities across tenants.

## 9. UX information hierarchy

The operational page should use this order:

1. Context header: account + responsible person + associated student(s).
2. Primary actions: `Registar recebimento` and any already-authorized obligation action.
3. Two truth cards/sections: `Obrigações em aberto` and `Recebimentos confirmados não aplicados`.
4. Unified typed history below.
5. Administrative link/navigation to Fee Catalogue kept secondary.

The page must support existing light/dark themes and current responsive patterns. Avoid introducing a new design system in this mission.

## 10. Explicit non-goals

This mission does not implement:

- Allocation between Payment and Obligation;
- automatic debt settlement;
- payment matching or reconciliation;
- refunds as a new workflow;
- Adyen, EMIS, MB WAY, Multibanco, MULTICAIXA or other provider integrations;
- fiscal invoice/receipt issuance;
- bank account/treasury/cash-register accounting;
- general ledger/statutory accounting;
- penalties, discounts, credits or adjustments unless already canonical and required only for read presentation;
- new Student or Enrollment authority;
- AI-generated financial decisions;
- a cross-currency net balance.

## 11. Human UAT gate

The mission is not complete until a human validates all of the following in the real local app:

1. Open Finance and resolve a known student/account.
2. Confirm responsible person and student context are understandable.
3. Confirm at least one open obligation appears when fixture data contains one.
4. Register a manual/offline payment from that context.
5. Confirm no `Illegal invocation` or browser-console error occurs.
6. Refresh the browser and prove the payment persists from server authority.
7. Confirm the obligation remains unchanged/unallocated.
8. Confirm the same context is reachable from the Student entry point.
9. Check light and dark mode and responsive behavior.
10. Confirm foreign-tenant context cannot be retrieved.

## 12. Completion definition

Finance Operational Consolidation is complete only when:

- all three approved journeys pass automated contract/regression tests;
- PostgreSQL proves tenant-safe context composition and payment ownership;
- the `Illegal invocation` regression is green;
- existing Finance foundation, Fee Catalogue, Obligation and Payment gates remain green;
- lint, build, secret scan and committed-diff checks pass;
- Human UAT passes;
- no Allocation or other non-goal authority was introduced.

After this gate, Allocation may be considered as a separate architecture/product mission. It is not implicitly authorized by this design.