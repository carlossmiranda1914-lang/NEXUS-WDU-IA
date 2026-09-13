# Angola Invoice Document Surface — Design Specification

**Date:** 2026-09-13
**Status:** Approved design — implementation not yet authorized by this document alone
**Baseline:** `e507a37ddd391aabf28e26cb820fb082a3a210a5`
**Branch:** `codex/finance-case-b-invoice`

## 1. Purpose

Replace the current generic invoice preview cards with a rigid, professional, document-first invoice surface designed first for Angola, while preserving backend authority, immutable documentary truth, tenant isolation, and the existing invoice issuance pipeline.

The same canonical documentary presentation must drive:

1. pre-issue preview;
2. issued-document detail/history;
3. PDF artifact;
4. print output.

The browser must never invent documentary or fiscal facts. Angola-specific fiscal content must come from the server-side jurisdiction policy/adapter and existing authoritative data. Unknown or unsupported Angola requirements must fail closed or be omitted explicitly; no AGT data, rate, QR, signature, hash, certification mark, or official claim may be fabricated.

## 2. Problem Statement

The current invoice flow is functionally real but the presentation is too generic. The pre-issue experience is presented as unrelated cards rather than as the document that will eventually be issued and printed. Human UAT also showed that when readiness is blocked, valid obligation facts may disappear from the preview, producing values such as `Indisponível` even when the live obligation list already shows authoritative facts such as due date and amount.

This creates four product problems:

- weak professional presentation;
- poor correspondence between preview and printed invoice;
- mixed concepts of source facts and readiness blockers;
- risk of superficial UI fixes that copy data from list projections instead of using documentary authority.

The new design must solve all four together.

## 3. Non-Negotiable Invariants

1. **Invoice authority is obligation-based.** Payment and allocation facts do not determine the invoice total.
2. **Institution authority is server-side.** The browser does not authorize or choose the tenant.
3. **Preview is non-mutating.** It creates no financial document, consumes no sequence, persists no snapshot, and creates no artifact.
4. **Issued invoice is immutable.** Its V3 snapshot remains the historical truth after later changes to the live obligation.
5. **One documentary presentation contract.** Preview, issued detail, artifact/PDF, and print must share the same structural model instead of independently assembling invoice data.
6. **No fake fiscal truth.** Angola-specific fields are populated only from authoritative policy/data.
7. **Blocked readiness does not erase known source facts.** Valid, safely resolved documentary facts remain visible even when issuance is blocked by a missing series, party, fiscal profile, or other prerequisite.
8. **No client reconstruction from list rows.** The invoice surface consumes the invoice preview/document presentation returned by the backend.
9. **Receipt behavior remains intact.** Invoice redesign must not regress Receipt V2, receipt artifacts, or financial-document history.
10. **Angola first, generalize later.** The core structure should not prevent future jurisdictions, but this phase optimizes the document surface for Angola.

## 4. Product Model: Document First, Status Second

The invoice screen must stop behaving like a dashboard of generic cards. Its primary visual object is the invoice itself.

Readiness, warnings, and blockers are auxiliary controls around the document, not replacements for it.

### 4.1 Required page composition

```text
+------------------------------------------------------------------+
| STATUS / READINESS STRIP                                          |
| Preview only • No number allocated • Blocking reason if any      |
+------------------------------------------------------------------+
| [LOGO]  ISSUER LEGAL NAME                          FATURA          |
|         NIF                                        Serie / No.     |
|         Registered address                        Issue date       |
|                                                   Due date         |
+------------------------------------------------------------------+
| DESTINATARIO                                                     |
| Name                                                             |
| Tax identifier when authoritative                                |
| Address / documentary reference when authoritative               |
+------------------------------------------------------------------+
| DESCRIPTION         QTY   UNIT PRICE   DISCOUNT   TAX      TOTAL  |
| Canonical line...   1     100,00       0,00       ...      100,00 |
+------------------------------------------------------------------+
|                                             Subtotal   100,00 AOA |
|                                             Discount     0,00 AOA |
|                                             Tax          0,00 AOA |
|                                             TOTAL      100,00 AOA |
+------------------------------------------------------------------+
| Obligation / operation reference                                 |
| Payment terms / due information                                  |
| Policy-backed legal / fiscal mentions                            |
+------------------------------------------------------------------+
```

The actual responsive UI may stack sections on small screens, but information hierarchy and documentary meaning must remain stable.

## 5. Canonical Presentation Contract

The existing canonical financial-document presentation should be extended carefully rather than replaced with invoice-only UI objects.

The invoice-capable presentation must be able to express at least:

### Document identity
- document type label;
- preview vs issued state;
- official number when issued;
- series reference when available;
- issue date;
- due date;
- currency.

### Issuer
- legal name;
- tax identifier when authoritative;
- registered address lines;
- logo asset reference when authoritative and supported.

### Recipient
- name;
- tax identifier when authoritative;
- address lines when authoritative;
- safe operational/documentary reference where supported.

### Operation/source
- obligation reference;
- immutable invoice lines.

### Invoice line
At minimum:
- description/label;
- quantity;
- unit price;
- discount;
- tax amount or policy-backed representation;
- line net;
- line total;
- currency.

The model must not collapse invoice lines to a single `label + amount` shape if doing so loses facts already frozen in V3.

### Totals
- subtotal;
- discount total;
- tax total;
- document total;
- currency.

### Fiscal/legal content
- tax treatment from policy;
- legal mentions from policy;
- jurisdiction facts that are actually authoritative.

### Verification / official fields
Only present when backed by real authority. No fake QR, signature, certification mark, hash, or AGT registration state.

## 6. Preview Contract

The pre-issue endpoint must return a structured invoice preview suitable for direct rendering into the canonical invoice surface.

The response must separate **document facts** from **issuance readiness**.

Conceptually:

```text
invoicePreview = {
  state: 'preview',
  presentation: { ...canonical invoice presentation facts... },
  readiness: {
    status: 'READY' | 'BLOCKED',
    reasonCode: string | null,
    blockers: [...]
  },
  issuance: {
    documentCreated: false,
    definitiveNumberAllocated: false
  }
}
```

Exact types should follow existing project conventions. The important rule is semantic separation.

### 6.1 Partial-fact behavior

If the obligation is valid and tenant-safe but invoice issuance is blocked by a missing series, the preview should still show all already-resolved obligation facts that are safe and authoritative, such as:

- obligation reference;
- description;
- amount/totals;
- due date;
- currency.

If issuer or recipient cannot be resolved, only those sections should show a clear missing-data state. The backend must not return an all-empty invoice solely because readiness is `BLOCKED`.

### 6.2 Security behavior

Partial preview must not leak cross-tenant or unauthorized facts. Tenant/IAM validation still happens before facts are disclosed.

## 7. Readiness Presentation

Readiness should appear in a compact strip or side panel outside the invoice body.

Examples:

- `Pronta para emissão`;
- `Série de Fatura não configurada`;
- `Perfil legal da instituição em falta`;
- `Destinatário documental incompleto`;
- `Configuração fiscal não efetiva`;
- external production dependency when specifically supported by policy.

The UI must map actual reason codes. It must not claim an AGT-specific cause for a generic readiness failure.

When blocked, the issue action is disabled/absent, but the document preview remains readable with the facts that were successfully resolved.

## 8. Preview vs Issued Invoice

The visual structure should be nearly identical so users can understand what will be issued.

### Preview
- visible `PRE-VISUALIZACAO — AINDA NAO EMITIDA` state;
- no definitive official number;
- no implication of AGT production issuance;
- no persisted PDF required;
- emission button only when readiness is READY.

### Issued invoice
- definitive series/sequence/official number;
- immutable issue timestamp;
- immutable V3 facts;
- artifact actions;
- no re-query of the live obligation to rebuild historical document contents.

## 9. Angola-First Rules

This phase designs the document surface for Angola, but does not hardcode unsupported fiscal law.

### 9.1 What may be Angola-specific
- terminology and field ordering appropriate to the Angola invoice context;
- issuer NIF presentation;
- policy-provided tax treatment;
- policy-provided legal mentions;
- jurisdiction-specific document labels/series references;
- future verified AGT fields when real authority exists.

### 9.2 What must not be invented
- tax rate;
- AGT certification status;
- AGT-assigned production series;
- QR code;
- digital signature;
- validation hash presented as official AGT data;
- legal phrase not provided by policy/verified authority.

If an Angola production fact is required but unavailable, issuance remains fail-closed and the preview explains the blocker without fabricating a substitute.

## 10. PDF and Print Parity

The PDF must render from the same canonical presentation used for the issued-document detail. No independent invoice reconstruction path is permitted.

The PDF layout should mirror the invoice structure:

1. issuer + invoice identity header;
2. recipient block;
3. line-items table;
4. totals block;
5. references and legal/fiscal mentions;
6. verification/footer fields only when authoritative.

The current simple text-stream PDF is acceptable as infrastructure but not as the final professional document surface. This phase should produce a structured, readable invoice artifact with stable alignment and page-safe layout.

Printing must print the generated artifact/PDF, not a separate live HTML reconstruction.

## 11. Historical Truth

Required invariant test:

1. issue an invoice;
2. capture its V3 snapshot/presentation;
3. legitimately change the live obligation later;
4. reopen document history;
5. regenerate/retrieve artifact;
6. compare.

Expected: the historical invoice and PDF remain unchanged.

## 12. Responsive Behavior

Desktop should resemble a printable A4 document centered in the application surface.

Mobile may stack metadata blocks and horizontally scroll or adapt line tables, but must not hide documentary facts or replace the invoice with generic cards.

Print layout is independent of viewport width and must remain document-stable.

## 13. Accessibility and State Handling

- semantic headings for invoice sections;
- table semantics for line items;
- clear loading state;
- clear blocked-readiness state;
- clear error state;
- disabled issuance while request is active;
- explicit issued/replayed state;
- no dead buttons.

## 14. Implementation Boundaries

Likely affected responsibilities:

- invoice preview backend projection/contract;
- canonical financial-document presentation;
- financial obligation invoice preview UI;
- issued financial-document detail UI;
- invoice-capable artifact renderer;
- targeted tests for presentation, preview, artifact, and UAT contracts.

Avoid unrelated redesign of the Finance module. Avoid new parallel invoice history, invoice repository, invoice PDF service, or browser-side fiscal calculation.

## 15. Acceptance Criteria

The design is implemented only when all of the following are true:

1. An open obligation can open a document-shaped invoice preview.
2. Known obligation facts do not disappear merely because a series/readiness prerequisite is missing.
3. The preview clearly distinguishes not-issued from issued state.
4. Invoice lines show description, quantity, unit value, discount, tax representation, and total from server-authoritative facts.
5. Totals use the central exact money presentation.
6. Issuer and recipient sections come from server authority; missing data is localized and explicit.
7. READY preview can issue through the existing authoritative endpoint.
8. Issued invoice opens in the existing Financial Documents history.
9. Issued detail has the same information hierarchy as preview.
10. PDF contains the same frozen documentary facts and a professional structured layout.
11. Print uses the PDF artifact.
12. Cross-tenant access remains denied.
13. Receipt regressions stay green.
14. No AGT or tax facts are invented.
15. Human UAT validates visual clarity, factual correctness, preview/issued parity, PDF, refresh persistence, and print.

## 16. Explicit Non-Goals

- Fatura-Recibo;
- broad Finance redesign;
- credit-note redesign;
- new jurisdictions;
- obtaining AGT credentials;
- pretending test/UAT issuance is Angola production issuance;
- browser-side fiscal authority;
- destructive rewrite of V1/V2/V3 historical snapshots.

## 17. Future Generalization

After Angola invoice surface is proven, extract the reusable common structure as the generic document shell while keeping jurisdiction-specific fiscal blocks behind policy/adapter contracts. Generalization must happen from a proven Angola implementation, not by prematurely creating an abstract document system that weakens current correctness.
