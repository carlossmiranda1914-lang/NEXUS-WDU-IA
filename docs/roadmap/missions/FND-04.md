# FND-04 — Product Truth Cleanup

**State:** IMPLEMENTING — CP0 PASS. FND-03 is DONE and the DoR evidence is recorded at baseline `944e2bc7df9ebe54a3a22d83f08c05159a05f50c`.

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

Each surface is classified `CANONICAL_REAL`, `TRANSITIONAL_REAL`, `FALSE_SUCCESS`, `FALSE_AVAILABILITY`, `STALE_OR_LOCAL_ONLY`, `PROTOTYPE`, or `UNKNOWN`, with its actual backing source and permitted treatment. The executable inventory is `docs/audit/FND-04_PRODUCT_TRUTH_MATRIX.md`.

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

## Locked implementation checkpoints

| Checkpoint | Objective and exact surfaces | RED evidence → permitted treatment | Required regressions / PASS evidence | Stop condition |
|---|---|---|---|---|
| CP0 | Establish the product-truth harness and fixture rules for changed UI claims. | A direct action proves the visible success/availability assertion and its API/command/result; no production GREEN before the RED contract. | Focused client/API characterization can run without production credentials; the harness distinguishes browser state from server read-back. | The existing client test boundary cannot invoke the mounted action without a new test architecture decision. |
| CP1 | Characterize PT-23 AI-analysis source/outcome presentation and verify matrix caller chains. | Trace mounted caller → endpoint/result/source/error. | PT-23 remains visibly prototype/read-only unless a factual source contract proves otherwise; no new P0/P1 UNKNOWN. | Product contract contradicts its runtime provider/source. |
| CP2 | Make fenced, unavailable, prototype and local-only actions factual: PT-04–PT-08, PT-10–PT-11, PT-16–PT-19, PT-22 and PT-24–PT-26. | RED proves a fenced/unavailable/prototype path can still look successful/actionable. Correct claim, disable/hide, label/isolate or fail factual. | No false green state after 503/unavailable; no local-only operation is presented as institutional; canonical entries remain reachable. | Removing a claim withdraws an essential capability without an approved factual fallback. |
| CP3 | Correct mutation success and read-back truth: PT-01, PT-03, PT-09, PT-12, PT-15 and PT-25. | RED proves an optimistic/simulated message precedes an authoritative read-back. Connect only to canonical command, correct the claim, or fail factual. | Direct action, command result, reload/read-back, denial/no-mutation and canonical regression. | The canonical product flow cannot represent the requested action without an unapproved domain decision. |
| CP4 | Correct dashboard, KPI, search and browser-state presentation: PT-13, PT-17, PT-20, PT-21 and PT-26. | RED identifies a displayed institutional value without source/calculation/freshness/authorization. Label, remove, scope or connect to proven source. | Same-tenant factual source; stale/local data cannot appear as institutional fact; no cross-tenant leak. | A product KPI needs a new canonical read model/metric definition. |
| CP5 | Correct uploads, downloads, imports, exports and external effects: PT-02, PT-08–PT-10, PT-14 and PT-19. | RED proves a claimed file/integration/delivery effect lacks physical/effective authority. Fail factual, disable or preserve only proven canonical behavior. | Actual effect or factual failure, no unauthorized mutation/file, Enrollment Documents regression. | A required physical storage or external provider authority is absent. |
| CP6 | Align role/authorization/errors/refresh: PT-01, PT-03, PT-05–PT-07, PT-15, PT-20, PT-22, PT-24 and PT-27. | RED proves frontend role/status/success contradicts backend authority or stale result. Treat backend as authority and refresh factual state. | Invalid role/context and 503/error paths; canonical Identity/Membership/InstitutionalContext and Tasks/Enrollment regressions. | Factual state requires an IAM or domain authority that cannot be represented without expanding scope. |
| CP7 | Aggregate validation and evidence closure. | Re-run only affected focused evidence and complete AC matrix. | Every AC maps to concrete code/test/read-back evidence; lint/build/diff/CI gate; rollback/removal gates documented. | Any P0 claim remains unknown or lacks a deterministic treatment. |

## Definition of Ready evidence

The DoR is executable because the product-truth matrix enumerates the bounded P0/P1 claims, every P0 has a deterministic permitted treatment, and PT-23 has a scoped CP1 presentation characterization—not an unbounded discovery task. No production code changed during DoR preparation. Detailed sources, future RED/GREEN contracts, dependencies, rollback and stop rules are in `docs/roadmap/missions/FND-04_DOR_EVIDENCE.md`.

## CP0 baseline and harness — PASS

`npm run test:fnd04` is the deterministic, Windows-safe baseline aggregate. `scripts/run-fnd04-baseline.mjs` validates every selected file before execution, invokes the local TSX CLI without `npm.cmd`/shell spawning, stops at the first non-zero child result, applies a 60-second child timeout and propagates the exact failing file/status. `tests/fnd04-baseline-runner.test.mjs` proves pass, non-zero propagation and missing-file failure with disposable fixtures.

The selected non-PostgreSQL contracts preserve InstitutionalContext, Person resolution/access, Enrollment intake/API/UI flow, Enrollment Document service/policy, modular Tasks route authority, relevant FND-02 visible fences, FND-03 transitional/document/AI-background tenant fences and institution-resource ownership. They use synthetic fixtures only and perform no database reset, DDL or persistent institutional mutation. CP1 is next; no Product Truth UI, API or persistence change was made in CP0.

## CP1 AI presentation characterization — PASS

PT-23 is now closed as a factual `FALSE_SUCCESS` presentation finding. Five mounted callers reach the same FND-03 `/api/chat` 503 fence: the Copilot send/quick-action handler and four Automation simulation handlers. The fence occurs before institutional queries, tool execution, audit/event and external AI work. The current client behavior is not safe presentation: the Copilot inserts a fictional local analytical response after the 503, while Automation simulations create success logs/previews and ignore the rejected request. CP2 is locked to disable/hide the operational entries with a factual unavailable state; it must not reactivate AI or create an AI Gateway.

## CP2 factual availability — PASS

CP2 removes false operational availability at the client boundary without changing backend authority. The Copilot now makes no `/api/chat` request and gives a factual unavailable response without loading or fabricated analysis. Automation simulation handlers return before any request, timer, local execution increment, success log or notification preview. Generic Documents, legacy configuration/reset/user controls, signature, workflow, parent portal, Google Sheets and legacy teacher administration are replaced by accessible factual unavailable panels. Canonical Enrollment/StudentProfile, Enrollment Documents, Academic Year and modular Tasks remain outside these treatments. CP3 is next.

## CP3 mutation success and authoritative read-back — PASS

Canonical School Tasks now display a result only after its command succeeds and a tenant-scoped authoritative read confirms it. Create uses POST→GET, update PUT→GET, archive confirms the deleted scoped read, and restore confirms the active scoped read; pending mutation state prevents double-submit. Command failures retain the prior visual state and show factual error feedback. The non-authoritative Communications surface is unavailable in the mounted shell because no command/read-back can establish send, scheduling or delivery. Canonical Enrollment and Enrollment Documents regressions remain green. CP4 is next; FND-04 remains IMPLEMENTING.

## CP4 dashboard, KPI, search and browser-state truth — PASS

The Dashboard and GlobalSearch had no authorized server projection with a defined calculation, freshness and Membership-derived tenant scope. They are now factual unavailable before their client aggregation/indexing runs; no unsupported zero, metric, trend, sync state, result count or direct-ID result is shown. Operational `nexus_*` browser keys are neither restored nor written and existing values are left untouched; the device-local theme preference is preserved. CP5 is next; FND-04 remains IMPLEMENTING.

## CP5 files, imports, exports and external effects — PASS

Enrollment Documents retains only its proven metadata evidence path: authorized reference/status transitions plus scoped read-back. It does not claim physical upload, object storage or download. Generic Documents, signatures, Finance external effects and Google Sheets import/export are unavailable before their legacy handlers mount, so no file, connector request, delivery or local import result is fabricated. CP6 is next; FND-04 remains IMPLEMENTING.

## CP6 authorization, error and refresh alignment — PASS

Client role simulation no longer changes presentation role or calls the fenced role API. Before the backend profile/context resolves, UI is non-privileged; logout, suspension and context/profile failure clear institutional presentation state while preserving device-local theme. Backend Membership/InstitutionalContext and tenant middleware remain the authorization authority, and fenced actions remain unavailable after a presentation role change. CP7 is next; FND-04 remains IMPLEMENTING.

## DONE
FND-04 is DONE only when AC01–AC08 are PASS, no known P0/P1 operational surface claims success or institutional evidence without a real backing fact, and every retained prototype/demo is visibly and architecturally separated from production authority.

## Stop rules
Stop and return to BLOCKED/PREPARATION if:
- the actual backing source of a critical surface cannot be established;
- truthfulness can only be achieved by implementing an unrelated future domain;
- product intent is genuinely ambiguous between prototype and committed operational capability;
- changing the surface would alter canonical workflow/domain authority beyond this mission.
