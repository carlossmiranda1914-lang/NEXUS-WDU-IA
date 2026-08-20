# FND-04 — Product Truth Cleanup

**State:** PREPARATION. Implementation is not authorized until FND-03 is DONE and this Mission Pack passes DoR.

## Objective
Ensure that every user-visible P0/P1 operational capability truthfully represents its real persistence, integration, authority and execution state; mocks, simulations, hardcoded institutional data and client-only state must never present themselves as completed institutional operations.

## Origin
AUD-CONFIG-001, AUD-PARENT-001, AUD-DOC-PRODUCT-001, GlobalSearch/localStorage/import findings, Master Plan v2 evidence-over-appearance principle, and Architecture TO-BE v2 backend/persistence boundaries.

## Dependency
- FND-02 defines which mutation paths are authoritative/transitional.
- FND-03 proves tenant behavior for surviving institutional paths.
- FND-04 may remove, isolate, relabel or fail-closed a misleading surface; it must not implement the future real feature merely to preserve the surface.

## Preserve
- genuinely operational vNext capabilities and their proven backend contracts;
- clearly isolated development/test fixtures;
- prototypes or demos that remain useful when unmistakably labeled and excluded from production authority/navigation;
- explicit loading, error, forbidden and unconfigured states instead of simulated success.

## IN
Inventory user-visible claims involving:
- persistence/synchronization;
- payments/financial state;
- signatures, certificates and institution-issued evidence;
- search/results sourced from institutional records;
- document storage/upload;
- security/authentication/authorization status;
- external integrations;
- parent/student/staff portals or dashboards;
- AI or automation execution;
- hardcoded/sample institutional data;
- localStorage/client-only state presented as durable institutional state.

Each surface is classified `REAL`, `PROTOTYPE`, `DEMO`, `BROKEN`, or `UNKNOWN`, with its actual backing source and permitted treatment.

## OUT
- building real replacements for every prototype;
- broad UX redesign unrelated to truthfulness;
- changing canonical product scope because a prototype exists;
- deleting useful historical/test fixtures that are not exposed as operational truth;
- inventing backend persistence solely to make an existing screen appear complete.

## Required preflight / evidence
Before changing a surface:
- identify the exact user-visible claim;
- trace its actual data/integration/execution source;
- establish whether the path is production-operational, prototype/demo or broken;
- identify the least-invasive truthful treatment: preserve, fail-closed, relabel/isolate, hide/remove from operational navigation, or defer to a future mission;
- define the failure/error behavior and regression proof.

## Acceptance criteria
- **AC01 Truth inventory:** every identified P0/P1 surface has classification, actual backing source, user claim and treatment.
- **AC02 No fake success:** failed, absent, simulated or unconfigured backend/integration states cannot render operational success.
- **AC03 Persistence truth:** client/localStorage/demo state is never described as institutional persistence.
- **AC04 Evidence truth:** demo/signature/certificate/receipt content cannot be mistaken for institution-issued evidence.
- **AC05 Prototype isolation:** retained prototypes/demos are unmistakably labeled and excluded from operational authority/navigation where confusion is possible.
- **AC06 Search truth:** search/results presented as institutional facts are backed by real authorized sources or explicitly marked non-operational.
- **AC07 Integration truth:** simulated sync/connectivity cannot be presented as a completed external integration.
- **AC08 Scope discipline:** desired but non-operational capabilities are deferred to a proper future mission rather than implemented opportunistically.

## Required tests / evidence
- focused tests for critical failure-to-success transitions;
- tests proving unconfigured/failed integrations show failure or unavailable states;
- persistence/source tracing for each changed surface;
- manual/visual evidence for changed user-facing states;
- desktop/tablet/mobile checks only for surfaces materially changed by this mission;
- existing functional/tenant regressions for affected real capabilities;
- TypeScript/build and applicable CI gates;
- truth inventory with AC-to-evidence references.

## DONE
FND-04 is DONE only when AC01–AC08 are PASS, no known P0/P1 operational surface claims success or institutional evidence without a real backing fact, and every retained prototype/demo is visibly and architecturally separated from production authority.

## Stop rules
Stop and return to BLOCKED/PREPARATION if:
- the actual backing source of a critical surface cannot be established;
- truthfulness can only be achieved by implementing an unrelated future domain;
- product intent is genuinely ambiguous between prototype and committed operational capability;
- changing the surface would alter canonical workflow/domain authority beyond this mission.
