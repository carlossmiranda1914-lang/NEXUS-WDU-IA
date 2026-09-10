# Nexus Edu IA — Institutional Readiness + Finance Guided Configuration Design

**Status:** PROPOSED FOR USER REVIEW  
**Date:** 2026-09-10  
**Scope:** Institutional Readiness foundation with Finance as the first real consumer  
**Base:** Finance F7 branch after `f14d003de735487bc7f1e89e5d2ffb0cff4776fa`

## 1. Purpose

Convert the already-authoritative Finance configuration and Financial Documents capabilities into a real institutional operating flow. A school must be able to understand why Finance is not yet operational, complete the missing authorized configuration through Nexus itself, and then execute the real Finance workflow without SQL, fixtures, manual backend intervention, or browser-owned authority.

This design does **not** create a second Finance configuration authority. It introduces a derived readiness projection and guided configuration experience over existing canonical authorities.

## 2. Governing canonical sources

This design is subordinate to:

- `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md`
- `docs/architecture/ADR-001-institutional-context.md`
- `docs/product/NEXUS_EXPERIENCE_GUIDANCE_MODEL_V1.md`
- `docs/roadmap/IMPLEMENTATION_PLAN_VNEXT_V2.md`
- existing Finance Financial Profile, Fiscal Configuration, Financial Document Series, Financial Document, HTTP/IAM, idempotency and artifact authorities.

Canonical invariants preserved:

1. Firebase proves identity only.
2. Backend resolves `Identity → Person → Membership → Institution`.
3. Browser does not choose tenant authority.
4. PostgreSQL remains authority for institutional business state.
5. Finance owns financial configuration, financial documents, payments, allocations, adjustments and ledger truth.
6. Critical Finance writes remain server-authoritative, tenant-safe, transactional and idempotent where applicable.
7. Guided onboarding is progressive and task-oriented; no giant mandatory setup questionnaire.
8. Product UI must explain what needs attention, why, the legitimate next action, and the expected outcome.

## 3. Product decision

Approved product model: **hybrid progressive institutional configuration**.

- A central institutional configuration experience provides overall setup/readiness visibility.
- Each domain remains owner of its own canonical configuration and operational truth.
- Modules expose contextual remediation actions such as `Concluir configuração` when a real requirement is missing.
- An incomplete module does not make the entire institution unusable.
- Readiness never grants authorization.

## 4. Scope of the first implementation

The first implementation is:

**INSTITUTIONAL-READINESS-01 — Finance Readiness Projection + Guided Configuration UX**

It must deliver:

1. a server-derived Finance readiness query/projection;
2. human-readable missing requirements;
3. a central institutional configuration entry that can display Finance readiness;
4. contextual Finance remediation from the operational workflow;
5. guided use of the already-existing Finance fiscal-configuration and document-series authorities;
6. real persistence and re-evaluation after configuration changes;
7. end-to-end Human UAT from `Finance incomplete` to a real issued Financial Document and official artifact.

## 5. Explicit non-goals

This slice does not authorize:

- a new Finance configuration table duplicating existing authorities;
- a generic persisted `finance_ready=true` flag;
- a repository-wide readiness framework for every module;
- new country-specific tax/legal rules;
- Angola or Portugal production adapters;
- a new capability taxonomy where existing Finance capabilities already suffice;
- speculative series lifecycle states such as `draft` or `closed` unless current repository evidence proves they are required;
- browser-owned institution, jurisdiction, series-number or financial authority;
- direct SQL as the normal institutional setup path;
- migration renumbering or Finance/main integration conflict resolution inside this slice.

## 6. Readiness model

Readiness is a **derived application projection**, not an independent source of truth.

Conceptual statuses:

- `READY`
- `INCOMPLETE`
- `BLOCKED`

`NOT_CONFIGURED` may be represented as `INCOMPLETE` with explicit missing requirements unless repository fit proves a distinct status is necessary.

The first Finance projection derives from existing authority, at minimum:

- effective Institution Financial Profile;
- effective Fiscal Configuration where required by the current Financial Documents policy;
- effective Financial Document Series for the required document type;
- current InstitutionalContext and server-side capability projection.

The projection must not duplicate or persist the underlying configuration facts.

### 6.1 Conceptual response

The exact wire schema is subject to repository-fit, but must support semantics equivalent to:

```text
module = FINANCE
status = INCOMPLETE
canManage = true
requirements:
  FINANCIAL_PROFILE = COMPLETE
  FISCAL_CONFIGURATION = COMPLETE
  RECEIPT_SERIES = MISSING
```

Requirements must be stable machine-readable codes with separate human presentation.

## 7. Readiness and authorization are independent

Binding invariant:

```text
READINESS != AUTHORIZATION
```

A module may be READY while a user has no right to access it. A user may have a Finance role/capability while the module is INCOMPLETE.

Every mutation re-validates the current server-side context and authoritative configuration at execution time. UI readiness is informational and may not bypass command invariants.

## 8. Existing Finance authority to reuse

The implementation must reuse the current Finance authorities, including:

- Institution Financial Profile / effective financial context;
- Fiscal Configuration versions;
- Financial Document Series;
- Financial Document issuance and correction;
- server-derived Finance capabilities;
- idempotency primitives;
- PostgreSQL numbering authority;
- Financial Document artifacts and historical provenance.

No parallel write model is allowed.

## 9. Guided configuration UX

The user-facing configuration flow must avoid internal implementation vocabulary.

### 9.1 Central institutional entry

The institutional administration experience should expose a configuration/readiness surface that can show Finance state and provide a direct next action.

Example semantics:

```text
Finance
Configuração necessária
1 requisito por concluir
[Concluir configuração]
```

The central surface is an orientation/readiness layer, not the owner of Finance data.

### 9.2 Contextual Finance remediation

When the user reaches an operational Finance screen that depends on missing configuration, Nexus must explain the exact requirement and, when the user has the existing manage capability, offer a legitimate remediation path.

Example:

```text
Os recebimentos estão disponíveis, mas ainda não é possível emitir recibos oficiais.
Falta: Série de recibos
[Concluir configuração]
```

A user without configuration authority sees the reason but not an administrative mutation action.

### 9.3 Empty and blocked states

An empty legitimate collection must render as an empty state, not an error. A blocked configuration state must explain the missing requirement. Permission denial must be distinguishable from missing configuration.

## 10. Guided series configuration

The implementation must present existing series configuration as a task-oriented flow rather than exposing raw persistence fields without explanation.

For receipt issuance, the authorized administrator must be able to configure a valid effective receipt series using the existing server authority.

The browser may suggest safe defaults such as a human-readable code, but the server validates all inputs and remains authoritative.

The browser must never allocate or edit the next official sequence number.

A series already used by issued documents must remain historically referenceable. This slice does not introduce speculative lifecycle transitions beyond what the current authoritative model proves.

## 11. Finance readiness re-evaluation

Readiness must be recalculated from current authority on every relevant query.

Examples:

- no effective receipt series → `INCOMPLETE`;
- valid series created → next readiness query becomes `READY` where all other requirements are satisfied;
- series ceases to be effective → readiness must no longer report `READY`;
- current browser state may not freeze an obsolete readiness result for command authorization.

## 12. Institutional UX authority rules

The browser may send user intent only.

It must not authoritatively provide:

- institution identity;
- institutional role;
- jurisdiction authority;
- Finance readiness truth;
- official document number;
- current settlement truth;
- current effective policy result.

The backend resolves these from canonical context and data.

## 13. Multi-jurisdiction compatibility

The readiness/configuration UX is jurisdiction-neutral.

- `DEFAULT_COUNTRY=NONE` remains preserved.
- The Financial Profile remains the region/jurisdiction authority.
- Missing legal evidence must not remove generic technical capability.
- Missing legal evidence must prevent production legal/compliance activation for an unsupported jurisdiction.
- No `if country === ...` logic may be introduced in shared readiness or Finance UI outside an approved adapter/policy boundary.

## 14. Existing capabilities

Repository fit must reuse the current actions unless evidence proves a gap:

- `read`
- `issue`
- `correct`
- `fiscal_config_read`
- `fiscal_config_manage`
- `series_read`
- `series_manage`

Do not create a second capability taxonomy for this slice.

## 15. Security and tenancy invariants

Mandatory:

1. all institutional context server-derived;
2. cross-tenant configuration reads denied/non-disclosive;
3. cross-tenant configuration writes denied;
4. readiness projection queries only the resolved institution;
5. browser tampering cannot convert `canManage=false` into authority;
6. configuration management remains limited by existing server capability policy;
7. Financial Document issuance remains fail-closed if configuration is invalid at command time.

## 16. Persistence and historical truth

Human UAT must prove that configuration is persistent PostgreSQL truth, not frontend or in-memory state.

Required evidence:

- configure through Nexus;
- refresh;
- logout/login;
- runtime restart;
- same authoritative configuration remains;
- readiness recomputes correctly;
- subsequently issued Financial Document preserves its historical Financial Profile/Fiscal Configuration/Series/policy provenance;
- later configuration change must not rewrite already-issued documents.

## 17. End-to-end product outcome

The slice is not DONE until a real authorized institutional administrator can complete this flow:

```text
login
→ Finance reports INCOMPLETE with exact reason
→ Concluir configuração
→ configure valid receipt series through Nexus
→ readiness becomes READY
→ open confirmed eligible Payment
→ Emitir recibo oficial
→ server allocates official number atomically
→ Financial Document persists
→ document appears in Financial Documents
→ private PDF/artifact opens
→ refresh/logout-login/runtime restart
→ same document and configuration remain
```

## 18. Negative acceptance flows

Mandatory negative evidence:

- foreign tenant cannot read or mutate the series/configuration;
- user without manage capability cannot configure Finance;
- user without issue capability cannot issue;
- missing/ineffective series fails closed;
- browser manipulation of readiness or institution cannot authorize a command;
- double-click/retry does not create a duplicate Financial Document or consume a second number;
- later configuration changes do not mutate historical document truth.

## 19. Product Truth requirement

The existing static institutional-search placeholder is outside the first Finance readiness implementation and must not be silently absorbed into this slice. It remains separately tracked for Product Truth remediation.

No new placeholder may be presented as if it were backend-derived readiness or institutional state.

## 20. Migration/integration constraint

Finance/main migration-order collisions are already known and remain an independent P0 integration concern.

This slice should prefer a derived readiness projection with no new schema. If repository-fit proves a schema change is truly required, implementation must STOP for migration adjudication before creating a new migration.

No migration renumbering, merge, rebase, or cross-module integration is authorized by this design.

## 21. Implementation strategy

Preferred implementation order after plan approval:

1. repository-fit and exact contract reconciliation;
2. Finance readiness query/application service RED/GREEN;
3. tenant/capability negative tests;
4. minimal HTTP read boundary if not already present;
5. guided configuration client/UI over existing fiscal-config/series endpoints;
6. contextual remediation from Finance operational screens;
7. persistence/restart verification;
8. real end-to-end UAT through receipt issuance and artifact retrieval;
9. full regression and remote checkpoint.

Do not widen scope when a prerequisite or conflict is discovered. Classify as IN-SCOPE DEFECT, BLOCKER, PREREQUISITE or FUTURE SCOPE according to the canonical roadmap.

## 22. Definition of Done

`INSTITUTIONAL-READINESS-01` is DONE only when all applicable evidence is fresh and proves:

- Finance readiness is derived from canonical authorities;
- no duplicate configuration authority was created;
- readiness does not grant authorization;
- central/configuration and contextual remediation UX are operational;
- an authorized administrator can complete the missing Finance configuration through the product;
- Finance changes from incomplete to ready based on real data;
- a real confirmed Payment can produce one official Financial Document through the normal browser flow;
- official artifact is privately accessible;
- refresh/logout-login/runtime restart preserve truth;
- cross-tenant and capability-negative tests pass;
- idempotent double-click/retry behavior passes;
- existing F7 Financial Document invariants remain green;
- Foundation, lint and build pass;
- worktree is clean and remote parity matches;
- Human UAT passes.

## 23. Stop rules

STOP before implementation expansion if:

- a new persisted readiness authority appears necessary;
- a new capability taxonomy appears necessary;
- series lifecycle semantics beyond current authority are required;
- a schema migration becomes necessary while migration-order collision remains unresolved;
- a cross-module Documents/IAM ownership change becomes necessary;
- a jurisdiction-specific legal rule must be invented;
- current canonical Finance authorities cannot express the required configuration safely.

## 24. Open decisions intentionally deferred

Not required for this first slice:

- generic readiness contract for every Nexus module;
- persisted onboarding progress model;
- full series lifecycle taxonomy;
- institution-wide readiness database;
- jurisdiction-specific production adapter behavior;
- Product Truth remediation of the static institutional-search placeholder;
- Finance/main migration integration adjudication.

These remain separate future decisions unless implementation evidence proves one is a strict prerequisite.
