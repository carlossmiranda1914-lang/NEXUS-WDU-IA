# Institutional Readiness 01 — Finance Navigation Hierarchy Amendment

**Status:** APPROVED
**Date:** 2026-09-10
**Applies to:** `INSTITUTIONAL-READINESS-01`
**Parent spec:** `docs/superpowers/specs/2026-09-10-institutional-readiness-finance-guided-configuration-design.md`

## Decision

Finance must not continue growing as a single horizontal row of peer tabs. The current `FinanceWorkspace` horizontal navigation is an implementation-stage structure, not the final professional information architecture.

The approved Finance hierarchy is:

```text
Finanças & Contas
├── Visão Geral
│   └── Situação Financeira
├── Operação
│   ├── Obrigações Financeiras
│   ├── Recebimentos
│   └── Documentos Financeiros
└── Configuração
    ├── Catálogo de Emolumentos
    └── Configuração Financeira
```

Only capabilities that already exist or are explicitly in the approved Institutional Readiness scope may appear. Do not fabricate future modules, reports, reconciliation, or other navigation entries.

## UX invariants

1. `Situação Financeira` is the Finance overview/landing surface, not a peer operational tab.
2. `Obrigações Financeiras`, `Recebimentos`, and `Documentos Financeiros` are operational destinations.
3. `Catálogo de Emolumentos` and `Configuração Financeira` are configuration destinations.
4. Primary Finance navigation must not depend on horizontal scrolling to discover destinations.
5. Responsive behavior must preserve discoverability without requiring a maximized window.
6. Contextual remediation from an operational screen must deep-link/navigate to the single canonical Finance configuration surface rather than duplicate forms.
7. The user-facing information architecture follows institutional work, not backend table/class boundaries.
8. Backend/domain authority remains unchanged by this navigation decision.
9. The Finance hierarchy is a UX pattern for this module only; it does not authorize redesign of other Nexus modules in this slice.

## Configuration flow hardening

The approved flow must be sequential and requirement-driven:

```text
Finance readiness
→ determine first unresolved authoritative requirement
→ explain requirement in human language
→ resolve that requirement through canonical product UI
→ re-read readiness from backend
→ continue to next unresolved requirement
→ READY only when all required authorities are effective
```

The UI must not present a receipt-series form while an earlier required fiscal configuration remains unresolved unless the backend contract explicitly proves the series can be validly created independently. It must not ask the user to infer this dependency.

## Series code UX

A raw series code field without guidance is not approved as final UX.

The configuration experience must:

- explain what the series code identifies;
- distinguish series code from official document sequence number;
- provide a safe, jurisdiction-neutral suggestion if repository rules permit;
- explain the accepted format before submission;
- surface specific validation outcomes returned/provable from the backend;
- never ask the browser/user to control the official next number;
- never imply that a guessed value such as `REC` or `REC-2026` is legally required unless a verified rule establishes it.

Generic failure text such as `Verifique os dados e tente novamente` is insufficient when the system can classify the actual failure safely.

## Operational action gating

If readiness proves receipt issuance is currently unavailable:

- `Emitir recibo oficial` must not look fully executable and then fail predictably;
- the UI must show the missing requirement and legitimate remediation path;
- users with manage authority may receive `Concluir configuração`;
- users without manage authority receive explanation only;
- the server remains the final authority and revalidates configuration at command time.

## Acceptance additions

`INSTITUTIONAL-READINESS-01` cannot close until Human UAT proves:

- Finance navigation is understandable without horizontal-scroll discovery;
- overview, operation, and configuration hierarchy is visible and consistent;
- incomplete readiness guides the user through requirements in the correct dependency order;
- series-code guidance is understandable and validation errors are specific enough to resolve the problem;
- after valid configuration, Finance becomes READY from a fresh backend projection;
- receipt issuance becomes genuinely available and completes the existing Payment → Financial Document → private artifact flow;
- the flow remains usable in a non-maximized desktop viewport and responsive layout.

This amendment does not create a new implementation phase. It is part of the existing `INSTITUTIONAL-READINESS-01` closure objective.
