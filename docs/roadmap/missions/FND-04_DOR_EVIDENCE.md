# FND-04 — Definition of Ready Evidence

**Decision:** READY — awaiting explicit implementation authorization.
**Prepared from:** `944e2bc7df9ebe54a3a22d83f08c05159a05f50c` on branch `codex/fnd-04-product-truth`.
**Implementation performed:** none.

## Evidence boundary

The repository is the technical authority. This DoR used the Mission Pack, Project State, canonical roadmap, FND-02 write-authority matrix, FND-03 tenant matrix, InstitutionalContext ADR and directly mounted/client product surfaces. No Drive contract was referenced by the repository and therefore no external product authority was required.

FND-01, FND-02 and FND-03 are recorded DONE in the Project State. Their preservation contracts are locked: migration authority; Firebase Identity → Person → Membership → Institution; server-derived InstitutionalContext; canonical Enrollment/StudentProfile and Enrollment Documents; modular tenant-safe School Tasks; and all FND-02/FND-03 fences/removal gates.

## Product-truth conclusions

1. Canonical truth is narrow and testable: Enrollment/StudentProfile, Enrollment Documents metadata/policy and modular School Tasks have server authority and factual read paths.
2. FND-02/FND-03 intentionally made generic Documents, destructive reset, legacy Students/Users/Teachers, AI chat and other unsafe paths unavailable. Their UI must now stop presenting them as usable operations.
3. LocalStorage, simulated workflows, sample portals, signatures, dashboard narratives, client-side sync and browser Google Sheets are not institutional persistence or external delivery.
4. Finance, generic Documents, Communication and Automations contain transitional records or browser presentation, but none may claim a stronger canonical effect than the actual command/read-back proves.
5. Teacher, Financial and Predictive AI analysis (PT-23) has mounted callers and authenticated handlers but no persistent mutation; it is a prototype until CP1 characterizes its source/result/error presentation. That is not permission to implement an AI domain.

The authoritative row-by-row decision, caller/effect trace and removal gates are in `docs/audit/FND-04_PRODUCT_TRUTH_MATRIX.md`.

## Acceptance criteria and executable evidence

| AC | Measurable completion rule | Required evidence |
|---|---|---|
| AC01 — inventory | Every P0/P1 visible operational claim is in the matrix with caller, command, authority, effect/read-back, classification and treatment. | Matrix rescan plus CP1 confirmation; no unclassified P0/P1 row. |
| AC02 — no false success | A failed, absent, fenced, simulated or unconfigured effect cannot render a successful institutional result. | Focused direct-action tests covering 503/error/absence and rendered state. |
| AC03 — persistence truth | Browser/demo/local state is never called institutional persistence, synchronization or durable record. | UI tests/visual evidence for changed localStorage and sample flows. |
| AC04 — evidence truth | Signature, certificate, receipt, archive and document evidence must have a proven provider/record/effect or be unavailable/prototype. | Direct action, no-effect negative, and canonical Enrollment Documents regression. |
| AC05 — prototype isolation | Retained prototype/demo material is unmistakably labelled and excluded from operational authority/navigation where it can mislead. | UI route/navigation assertions and visual evidence. |
| AC06 — search and KPI truth | Results and metrics shown as institutional facts identify an authorized source, scope/calculation and freshness; otherwise they are limited/labelled. | Source characterization, same/cross-tenant presentation tests and read-back. |
| AC07 — integration truth | No sync/import/export/delivery is shown complete without the actual authorized external effect and factual result. | Connector/error contracts; no-effect/no-mutation tests. |
| AC08 — scope discipline | The work preserves canonical paths and does not create the missing Finance/Documents/IAM/AI/Workflow/connector domains. | Diff/scope review, canonical regressions and documented dependencies. |
| AC09 — authority truth | UI role/availability/error/refresh never overrides backend authorization, InstitutionalContext or FND-02/FND-03 fences. | Invalid-role/context, 503, stale-response and no-mutation contracts. |
| AC10 — closure quality | Evidence is repeatable, rollback/removal gates are recorded, and static/build/CI checks pass. | Focused suite, applicable canonical regressions, lint/build/diff and CI on the implementation PR. |

## Future RED/GREEN contract

For every implementation slice, write the RED contract before a production edit:

1. invoke the direct user action on the real mounted path;
2. assert the exact command/API call and backend authority decision;
3. assert real persistence/external effect plus reload/read-back, **or** explicit unavailable/failure state;
4. assert no optimistic success, unauthorized mutation, audit-success or event after denial;
5. verify the rendered UI reflects that factual result;
6. run the preserved canonical regression for the affected capability.

Allowed GREEN treatments are only correct claim, connect to an existing canonical command, disable/hide, fail factually, or visibly isolate a prototype. A future real replacement needs its own authorized domain mission.

## Dependency and rollback ledger

| Area | Current factual treatment | Dependency / removal gate | Reversible change |
|---|---|---|---|
| Generic Documents and signatures | Unavailable/prototype where generic storage, ownership, archive/send or legal evidence is not proven | General Document and signature/provider authority | Revert the focused UI truth commit; do not restore an unsafe backend writer |
| Finance and finance export/sync | Transitional legacy records/local presentation, not canonical ledger/delivery | Finance Core ledger, report/export and connector contracts | Revert presentation change only; retain FND-02/03 fences |
| Parent/Matricula portals | Prototype or canonical-flow handoff only | Authorized portal consumer and GuardianRelationship contract | Restore isolated prototype label only, never fabricate persistence |
| Communications/Automations/Workflows | Transitional stored records or browser simulation; no delivery/execution claim without proof | Communication/Automation/Workflow authority and durable event policy | Revert copy/navigation treatment without granting authority |
| Google Sheets/Supabase | Prototype/unavailable; browser OAuth or configuration is not a Nexus integration | Separate credentials plus tenant-audited connector/import command | Revert factual UI treatment, not the identity boundary |
| AI | `/api/chat` unavailable; read/generation surfaces require CP1 source characterization | Canonical AI Gateway, policy, confirmation and audit | Revert a UI treatment only; preserve the FND-03 fence |
| Dashboards/search/local state | Noncanonical source must not be presented as institutional fact | Canonical authorized read projection/metric/search contracts | Revert only scoped presentation change |

## Stop conditions

Implementation stops (and returns to PREPARATION/BLOCKED) only when a concrete affected surface proves one of the following:

- its P0 effective mounted runtime path cannot be traced;
- repository evidence and a required canonical product contract contradict each other;
- a required external provider/product authority is missing;
- correcting/removing a claim would remove an essential capability without an approved factual fallback; or
- a checkpoint needs a product decision that changes canonical domain authority.

Fixture, import, TypeScript, test and build faults are implementation defects to diagnose, not stop conditions.

## DoR checklist

- [x] matrix is complete for bounded P0/P1 visible claims;
- [x] each P0 has a deterministic treatment; PT-23 has an executable CP1 characterization;
- [x] checkpoints CP0–CP7 and test evidence are locked;
- [x] canonical preservation scope, rollback and removal dependencies are explicit;
- [x] no production implementation occurred;
- [x] no missing external contract was referenced by the repository.

## CP0 baseline and harness — PASS

**Command:** `npm run test:fnd04`.

**Inventory and matrix relationship:**

| Baseline contract | Claims preserved |
|---|---|
| InstitutionalContext, multi-tenant and institution-resource ownership | PT-01–PT-03 and every later treatment must retain server-derived institution, membership and foreign-resource denial. |
| Person resolution/access; Enrollment intake/API/UI | PT-01 canonical Enrollment/StudentProfile flow. |
| Enrollment Document service/policy | PT-02 canonical policy and metadata behavior. |
| School Tasks single mounted mutation authority | PT-03 canonical modular Tasks, PT-04 duplicate legacy presentation boundary. |
| FND-02 system/student, browser, generic-document and Google fences | PT-05–PT-10 and PT-18–PT-19 unavailable/prototype truth. |
| FND-03 transitional API, teacher/profile, generic-document and AI/background fences | PT-08, PT-13, PT-15, PT-22 and PT-24 stay bounded by their existing authority decisions. |

The aggregate validates its selected test list before starting, runs each with the repository-local TSX CLI and `shell: false`, stops on the first failed child, reports its path/status, and exits non-zero. Its runner contract uses disposable pass/fail/missing-file fixtures to prove success, non-zero propagation and failure of an absent test. The per-child timeout is 60 seconds; no server, socket, timer or child is retained by the runner.

**Fixture/database boundary:** synthetic deterministic identities and institutional IDs only; no credentials, production target, Docker/WSL/PowerShell dependency, DDL, reset or PostgreSQL mutation. PostgreSQL regressions are intentionally excluded from CP0 because the selected contracts are non-PostgreSQL and no Product Truth production path changed.

**Executed results:**

- `npm run test:fnd04`: PASS — all 20 selected contracts; runner self-contract PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `git diff --check`: PASS.

**Known build warnings:** existing chunk-size warning for the main bundle; two existing `direct-eval` warnings in `server.ts` lines 98–99. Neither is changed by CP0.

**Next action:** CP1 characterizes PT-23 read-only AI presentation and confirms the affected product-truth caller chains. FND-04 is not DONE.

## CP1 PT-23 AI presentation characterization — PASS

`tests/fnd04-ai-presentation-characterization.test.ts` characterizes five mounted `/api/chat` callers and the effective fence without invoking an external AI service. It proves the route returns `503 CANONICAL_AI_AUTHORITY_REQUIRED` before `db.select` or `generateContentWithRetry`; no tool, institutional query/mutation, audit-success/event or external effect is reachable. It also proves prompt-only bodies and Firebase identity headers: client-supplied tenant/institution/context does not select server authority.

The current UI outcome is a CP2 defect, not a backend authority defect. `AIAssistant` ends loading but inserts fictional analytical findings after the 503; retry repeats the request. Four `AutomationsSection` simulations create local success logs/previews before firing an ignored best-effort request. They can therefore present delivery, OCR archive, access provisioning or institutional intelligence without an effect. CP2 must replace those operational claims with a factual unavailable state or visibly isolated prototype and must preserve the FND-03 fence.

**Executed results:**

- `node --import tsx tests/fnd04-ai-presentation-characterization.test.ts`: PASS;
- `npm run test:fnd04`: PASS (21 selected contracts);
- `npm run lint`: PASS;
- `git diff --check`: PASS.

No external AI service, database, persistent institutional record or temporary artifact was used. CP2 is next; FND-04 is not DONE.

## CP2 factual availability — PASS

The CP2 interaction contract proves that user actions on the Copilot and each AI Automation simulation show a factual unavailable state before any network request, timer, local success log, notification preview or institutional-state mutation. It also proves the removed fictional Copilot fallback, accessible `role="status"` state, no seeded execution/delivery fixtures, factual Google integration treatment, legacy configuration treatment and preserved Academic Year navigation.

The implementation deliberately does not expose `CANONICAL_AI_AUTHORITY_REQUIRED` as primary product copy. It uses concise Portuguese unavailable text and preserves the server fence unchanged. Generic Document, signature, workflow, parent, Google and teacher legacy entry points are no longer mounted as operational screens; their panels state that no data was sent, changed, archived, signed or provisioned. Canonical Enrollment Documents remain accessible through Enrollment.

**CP2 validation:** focused AI/factual-unavailability contracts, `npm run test:fnd04`, lint, build and `git diff --check` must all pass after the final UI change. CP3 is next. FND-04 is not DONE.
