# Finance Reference Vertical Surface Contracts v1

**Scope:** Nexus Aurora reference vertical for Finance.  This document records
current repository truth; it does not authorize a fiscal jurisdiction, a new
Finance command, or a schema change.

## Authority boundary

| Concern | Authoritative source | Presentation rule |
| --- | --- | --- |
| Module readiness | `GET /api/finance/readiness` / `resolveFinanceReadiness` | Browser displays the returned requirements only. |
| Receipt readiness | Readiness's `receiptIssuance` projection | No issue action when it is blocked or unavailable. |
| Payment eligibility | `GET /api/finance/payments/:id/receipt-eligibility` / canonical evaluator | Per-payment reason is rendered as a safe institutional message. |
| Issuance | `PostgresFinancialDocumentRepository.issue` | Server revalidates under transaction locks before the series counter changes. |
| Fiscal adapter | Explicit server-composed `FiscalAdapterRegistry` | Production has no approved adapter; synthetic `core` is UAT/test composition only. |
| Fiscal configuration and series | Capability-gated Finance HTTP commands | Browser submits intent; it cannot select an unregistered adapter as authority. |
| Documentary evidence | Financial-document HTTP projection and private artifact endpoint | Browser never recalculates document truth or exposes a storage reference. |

`BROWSER_AUTHORITY=NO` and `SCHEMA_CHANGE=NO` are invariants for every surface below.

## Finance Workspace

```text
SURFACE=FinanceWorkspace
USER_ROLE=server-authorized Finance and institution roles
JOB_TO_BE_DONE=orient within Finance and reach the correct operational work
DOMINANT_OPERATIONAL_MOMENT=the selected Finance work surface
SERVER_CAPABILITIES=returned by each protected Finance projection
AURORA_PATTERN=Operational Workspace
RESPONSIVE_BEHAVIOR=hierarchical destinations remain reachable without horizontal-scroll navigation
ACCESSIBILITY_REQUIREMENTS=current destination, visible keyboard focus, semantic navigation label
PROOF_OF_DONE=all existing authorized destinations remain reachable; navigation is subordinate to work
```

Information architecture:

```text
Visão Geral
  Situação Financeira
Operação
  Obrigações Financeiras
  Recebimentos
  Documentos Financeiros
Configuração
  Catálogo de Emolumentos
  Configuração Financeira
```

## Situação Financeira

```text
SURFACE=FinanceOperationalContextWorkspace
JOB_TO_BE_DONE=understand the current authoritative financial context
AUTHORITATIVE_DATA=current Finance operational-context projection
AURORA_PATTERN=Operational Overview
CRITICAL_STATES=loading, unavailable, ready
NON_GOAL=invented KPI, chart, or readiness state
```

## Obrigações Financeiras

```text
SURFACE=FinancialObligationsWorkspace
JOB_TO_BE_DONE=review and operate on authoritative financial obligations
AUTHORITATIVE_DATA=Finance obligation projection and server capabilities
AURORA_PATTERN=Operational Collection
EVIDENCE_REQUIRED=persisted obligation status after a confirmed server operation
```

## Recebimentos

```text
SURFACE=FinancePaymentsWorkspace
JOB_TO_BE_DONE=review confirmed payments and issue an eligible official receipt
PRIMARY_ACTION=Issue receipt only when issue capability + module readiness + receipt readiness + payment eligibility are positive
BLOCKED_STATES=institution readiness appears once; payment-specific eligibility appears on that payment
AUTHORITATIVE_DATA=payment projection, readiness, capabilities, eligibility projection
EVIDENCE_REQUIRED=returned persisted document number and refreshed Financial Document projection
AURORA_PATTERN=Operational Collection + Attention/Blocked + Evidence
PROOF_OF_DONE=no optimistic success; retry keeps the idempotency key; no number is allocated by preflight
```

For a production institution without an approved jurisdiction adapter, the
legitimate result is `BLOCKED`: no synthetic configuration or issue action is
offered.

## Documentos Financeiros

```text
SURFACE=FinancialDocumentsWorkspace
JOB_TO_BE_DONE=inspect official immutable document history, provenance, corrections, and private artifacts
WHO_CAN_ACT=server-derived read, issue, and correct capabilities
AUTHORITATIVE_DATA=Finance document list/detail/provenance/correction/artifact projections
EVIDENCE_REQUIRED=issued reference, provenance, correction relation, and authorized private artifact
AURORA_PATTERN=Operational Collection + Evidence
BLOCKED_STATES=authentication, institution selection, authorization, artifact retrieval failure
NON_GOAL=editing an issued document or office-document ownership
```

## Configuração Financeira

```text
SURFACE=FinanceConfigurationWorkspace
JOB_TO_BE_DONE=understand authoritative setup prerequisites and complete only legitimate remediations
AUTHORITATIVE_DATA=readiness, effective profile, configuration, and series projections
SERVER_CAPABILITIES=fiscal configuration and series read/manage capabilities
AURORA_PATTERN=Guided Configuration + Attention/Blocked
PROOF_OF_DONE=the UI refreshes readiness from the server after a confirmed mutation; it never flips READY locally
```

An unsupported jurisdiction is explained as unavailable/blocked. It has no
browser-side workaround, inferred compliance field, or `NEXUS_TEST` path.

## Finance Catalogue

```text
SURFACE=FinanceFeeCatalogueWorkspace
JOB_TO_BE_DONE=maintain and inspect authoritative fee catalogue data
AUTHORITATIVE_DATA=existing Finance catalogue projection and commands
AURORA_PATTERN=Configuration Collection
NON_GOAL=creating fiscal configuration or document authority
```

## UAT evidence contract

The supported local UAT runtime is explicitly composed with its synthetic
adapter by server startup. Human UAT must distinguish domain truth,
authorization, persistence evidence, and Aurora experience. Production-like
unsupported-jurisdiction UAT must validate the honest blocked state rather
than demand impossible receipt issuance.
