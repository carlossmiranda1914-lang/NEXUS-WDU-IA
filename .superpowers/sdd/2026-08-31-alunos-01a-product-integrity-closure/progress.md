# SDD ledger — ALUNOS-01A.3 Product Integrity & Closure

## Task 1 — Post-Activation Integrity

- Status: GREEN — independently reviewed.
- Scope: close only the unsafe generic `active -> cancelled` Enrollment transition; preserve every pre-activation cancellation path.
- RED: `npx tsx tests/alunos-01a3-post-activation-integrity.test.ts` exited `1` because the generic policy allowed `institution_admin` to cancel an active Enrollment.
- GREEN: policy/action contracts pass; `TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/enrollment-generic-transition-http-operational.test.ts` proves an active-to-cancelled generic HTTP attempt is `403`, with Enrollment and StudentProfile still `active` and no `status_changed` event.
- Protected: no StudentProfile write, schema change, activation API change or new post-activation lifecycle capability.
- Independent review: PASS. The reviewer required and then approved the real router/persistence assertion; no source, tenant, activation-authority or pre-activation cancellation regression remains.

## Task 2 — Async and Stale-State Safety

- Status: GREEN — independently reviewed.
- Baseline: `529c9d6b00b55e90edac86db2c1c98bc7eeba8f8` on `codex/alunos-01a-design`; preflight `READY` with zero blockers.
- RED: `npx tsx tests/alunos-01a3-stale-state-contract.test.ts` exited `1` because Student Record had no request authority outside render state. A strengthened pre-effect ownership assertion also exited `1` before opaque-ref/error ownership was added.
- GREEN: Student Record and Process Drawer now abort superseded reads, use monotonic latest-request guards for success/error/loading, invalidate on unmount, clear old authoritative objects before replacement reads, and bind rendered content/errors to the current opaque `studentRef` or selected Enrollment id.
- Write truth: process actions still await the server transition and then reload `/process`; no optimistic `setProcess` exists in the write path.
- Focused/static evidence: `npx tsx tests/alunos-01a3-stale-state-contract.test.ts`, Student Record contracts, Student Experience truth/product contracts, Student Context policy, system-student write fence, Active Students, Enrollment workspace, registration privacy, single Journey, drawer interaction/continuity and document drawer contracts all PASS.
- Static evidence: `npm run lint` PASS. No schema, backend, authorization, cache, visual redesign or internal-reference change.
- Independent review: PASS. The reviewer confirmed that A→B content and errors remain bound to the current opaque reference, superseded success/error/finally paths cannot win, refresh failure leaves no action-enabled Process Drawer state, writes remain server-confirmed, and no backend/schema/authority boundary changed.

## Task 3 — Authorized Activation Continuity

- Status: GREEN — independently reviewed.
- RED: `npx tsx tests/alunos-01a3-activation-product-continuity.test.ts` exited `1` because the server-owned Enrollment context did not declare activation capability and the product exposed no canonical activation/handoff path.
- Minimal change: `/api/enrollments/context` now returns only the server-derived `permissions.canActivateEnrollment` capability; the Enrollment read model supplies server-issued lifecycle/registration versions; the Process Drawer invokes the existing canonical `/activate` command with those versions plus a stable retry idempotency key. It waits for the response, refreshes Enrollment and Active Students, then enables `Abrir Registo do Aluno` using only the returned opaque `studentRef`.
- Authority/privacy: the UI never calculates eligibility from role or advances domain state optimistically; Secretariat receives no activation action and canonical API authorization remains Administration/Direção only. No internal Person/StudentProfile identifier enters activation navigation.
- GREEN: focused continuity contract, canonical activation HTTP/PostgreSQL integration (including Secretariat `403`, idempotent replay, same opaque handoff, single active projection and tenant/privacy checks), Active Students PostgreSQL/HTTP, Active Students UI, Enrollment Operations UI, stale-state contract, active-transition policy, Student Context policy, lint and `git diff --check` all PASS.
- Environment note: the standalone `enrollment-activation-postgres.test.ts` remains host-blocked because its configured `nexus_test_runner` DB hostname cannot resolve here; no configuration was changed. The focused HTTP integration uses the authorized local disposable PostgreSQL target and passed.
- Scope: no schema migration, activation service/controller semantic change, client-owned eligibility, post-activation mutation, or Task 4 work.
- Independent review: PASS. The reviewer reran the focused continuity and operations contracts plus authorized local activation HTTP/PostgreSQL, Active Students and TypeScript checks; no P0/P1/P2 finding remained.

## Task 4 — Journey Partial-Failure Resilience

- Status: GREEN — independently reviewed.
- Baseline: `4af79857a03ac106b9af414ccb9311fe7d0a38f0`; preflight `READY` with zero blockers (database check skipped because `DATABASE_URL` is not configured; no DB change is in scope).
- Scope/ruling: client-only composition in `EnrollmentOperationsWorkspace`; existing per-Enrollment `/process` server projections remain the sole Journey authority. No schema, backend, role, tenant or process-policy change was required.
- RED: `npx tsx tests/alunos-01a3-journey-partial-failure.test.ts` exited `1`: no separate unresolved projection state existed, and the all-settled rejection branch erased every fulfilled process projection.
- Minimal implementation: retain fulfilled projections, track rejected request Enrollment references separately, leave the single Journey Rail visible with a bounded count-only warning and retry. Counts and exact selection continue to derive only from fulfilled server projections; no failed stage is inferred. An all-process failure safely renders zero confirmed process facts plus the warning; retry replaces the projection set, so recovered projections cannot duplicate.
- GREEN: focused partial-failure contract, Journey Rail, human-review lifecycle, drawer continuity/interaction, motion, Enrollment Operations UI, S03 process contract, Task 2 stale-state contract, `npm run lint`, and `git diff --check` PASS.
- Review correction (P1): the initial Task 4 delta did not establish latest-request ownership for whole-workspace process batches, so an older batch could overwrite a later retry. `load` now aborts its predecessor, carries a monotonic request sequence through context/list/students and process reads, and permits state writes/final loading completion only for the latest sequence.
- Review correction (P2): replaced the synchronous helper with the production-used asynchronous `createLatestEnrollmentJourneyBatchCommitter`. The focused test uses real deferred Promises: A starts and remains unresolved; B starts, resolves and commits; A then resolves and its awaited commit is rejected, retaining B's committed fulfilled/unresolved batch.
- Independent review: PASS. The reviewer verified the true deferred A→B race, abort/monotonic production guard, partial/all/retry composition, Journey and Drawer continuity, focused operations contracts and TypeScript lint; no P0/P1/P2 finding remains.

## Task 5 — Identity Review Continuity

- Status: BLOCKED — genuine prerequisite.
- Audit: `LOCAL_MATCH` and `NO_MATCH` already have direct safe next actions. `MULTIPLE_MATCHES`, `REVIEW_REQUIRED`, `RESTRICTED_POSSIBLE_MATCH` and `REUSABLE_MATCH` require institutional identity adjudication; the existing proposal and outcome commands are membership/tenant scoped but do not provide a safe product path for an independent authority.
- Blocking authority: a tenant-scoped, privacy-minimized identity-decision work-queue/read boundary with a browser-safe public reference and a server-confirmed approved-intake handoff is absent. The existing `POST /identity-decisions` only creates a proposal; `POST /identity-decisions/:id/outcome` requires an undiscoverable internal decision id, and there is no queue/read API or UI. `REVIEW_REQUIRED` is explicitly non-executable (`needs_more_information`).
- Safety ruling: no browser candidate/person selection, internal decision id, protected candidate disclosure or client-created Person/Student may be fabricated to bridge this gap. The partial Task 5 UI/API delta was discarded after independent review because it acknowledged a proposal as if it resolved the product journey.
- Additional privacy finding: `/person-resolution` currently serializes `candidatePersonId` for local/reusable outcomes. This must be addressed by the prerequisite boundary; hiding the field in a component is not a privacy proof.
- Independent review: FAIL by design of the current authority surface; no product checkpoint is created for Task 5.

## Task 5A — Public Identity Decision Boundary

- Status: GREEN — independently reviewed.
- Scope: the minimum server-owned prerequisite only; no Task 5 continuity UI, browser-owned person selection, new identity authority or Enrollment authority rewrite.
- RED: `tests/alunos-01a3-identity-decision-postgres-http.test.ts` first reproduced repeated `request_more_information` changing the public decision version; a second RED proved that the first narrow replay fix incorrectly prevented a later authorized rejection.
- GREEN: migration `0025_identity_decision_public_refs.sql` creates a CSPRNG public decision reference. The tenant-scoped director/institution-admin queue and read routes return privacy-minimized decision DTOs only. Outcome and approved intake use the opaque `decisionRef`; the server resolves internal IDs exclusively after tenant/role validation. Same terminal outcome and same `request_more_information` replay are idempotent, while a later leadership rejection remains available.
- Operational proof: authorized disposable PostgreSQL + actual HTTP router passes for public reference generation/resolution, leadership queue/read/outcome, Secretariat `403`, foreign-tenant and random-ref non-disclosing `404`, public payload privacy, replay idempotency, approved canonical intake by `decisionRef`, no duplicate Person/StudentProfile, and tenant isolation.
- Independent review: PASS after two P1 corrections. It confirmed the CSPRNG opaque migration, server-only internal resolution, privacy-minimized contract, role/tenant behavior, safe approved handoff and correct nonterminal `needs_more_information` semantics.

## Task 5 — Identity Review Continuity (post-T5A attempt)

- Status: BLOCKED — genuine missing adjudication authority.
- RED/GREEN source contract covered visible waiting/review states and opaque queue usage, but independent review rejected the implementation: the only browser-reachable proposal is `REVIEW_REQUIRED`, which policy correctly makes `needs_more_information` and non-approvable. Repeating the same proposal replays its existing case key; it cannot accept new evidence or become an approved reuse/create authorization.
- Blocking authority: a server-owned, tenant-scoped command to amend/re-adjudicate an unresolved identity decision with newly captured canonical evidence and either select/resolve the Person entirely server-side or explicitly reject it. The current T5A public queue/outcome boundary intentionally exposes no candidate and no such command exists.
- Safety ruling: do not add browser candidate selection, internal IDs, protected candidate disclosure, fake “approved” state, or client-created Person/Student to bridge the gap. The uncommitted Task 5 UI attempt is not a valid checkpoint and must not be committed or published.

### Authority-closure audit (independently reviewed)

- Complete-lifecycle ruling: the existing authority closes `resolution → proposal → public queue/read → outcome`, but `request_more_information` only leaves the decision in `needs_more_information`; no command accepts evidence, re-runs canonical resolution, creates an eligible revision or restores an approval path. The `(institution_id, case_key)` uniqueness constraint deliberately rejects a changed re-proposal as `DECISION_CASE_CONFLICT`, so replay cannot be misrepresented as re-adjudication.
- Single prerequisite proposed: add one tenant-scoped, server-owned **submit evidence and re-resolve identity decision** capability, addressed solely by the existing opaque `decisionRef`. It must persist append-only evidence/revision facts, re-run `resolvePersonForInstitution` inside the server, derive `REUSE_PERSON` only from one server-confirmed plausible Person or keep the case unresolved, and derive `CREATE_PERSON` only under the existing high-risk creation policy. The browser submits evidence/identity input only; it never receives or selects a candidate Person.
- Authority and safety: active Secretariat, Director or Institution Admin may submit allowlisted evidence; final approval/rejection remains governed by the existing policy and its independent/Institution Admin requirements. The command must lock/version the decision, fingerprint submissions for idempotent replay, preserve tenant-scoped non-disclosing lookups, emit an append-only audit/revision trail, and leave approved intake to the existing opaque `decisionRef` handoff.
- Schema ruling: YES. Existing `evidence_types` is only an unversioned proposal snapshot and there is no evidence/revision/audit persistence or input snapshot sufficient for reproducible canonical re-resolution. Historical migrations `0009` and `0025` remain immutable.
- Independent architecture review: PASS. It additionally confirmed that local ambiguous reuse cannot be safely reached through the current public controller because it rejects `candidatePersonId`; restricted singleton reuse is the only current server-derived selection. The proposed prerequisite closes that gap by server re-resolution, while a future Task 5 continuity UI is still required only after the authority exists.

## Task 5B — Identity Evidence Revision & Server Re-resolution

- Status: GREEN — independently reviewed.
- RED: the prior authority stopped at `needs_more_information`: it retained no original server intake binding, could not append evidence or re-run canonical resolution, and therefore could not produce a safe approval handoff after the case key changed.
- Minimal authority: additive migration `0026_identity_decision_evidence_revisions.sql` persists the original server-validated offer/input binding on new decisions and an append-only, fingerprinted revision trail with prior/derived case keys, actor/time/correlation, normalized evidence, server resolution result and server-only resolved Person reference. Historical `0009` and `0025` are untouched.
- Re-resolution: evidence is addressed only by opaque `decisionRef`, role/tenant checked server-side, and runs `resolvePersonForInstitution` within the transaction. No safe match derives `CREATE_PERSON`; exactly one safe local match derives `REUSE_PERSON`; ambiguous/restricted outcomes remain `needs_more_information`. Final approval continues to use the existing independent authority, and intake revalidates the current server-derived `(institution, offer, case_key)` binding.
- Binding and concurrency: the intake offer is resolved as active within the current institution before it can be persisted. The derived case key is advisory-locked and collision-checked before the revision insert, so a competing normalized case returns a controlled conflict without a partial revision. Replayed evidence is fingerprint-idempotent; stale/concurrent distinct versions fail closed.
- Operational proof: authorized local disposable PostgreSQL plus the real HTTP router proves CREATE and REUSE revised paths, approved opaque-ref handoff, current-binding rejection of stale/wrong offer input, role `403`, foreign decision `404`, no public/internal candidate IDs, legacy-unbound fail-closed, restricted continuity, replay/no duplicate Person/StudentProfile/Enrollment, and stale/concurrent/case-collision safety.
- Focused regressions: identity unit and public-boundary contracts, intake API contract and PostgreSQL integration, T5B PostgreSQL/HTTP contract, `npm run lint`, and `git diff --check` all PASS.
- Independent review: PASS after a P0 offer-binding correction and P1 derived-case collision/no-duplicate-proof corrections. No P0/P1 authority, tenancy, privacy or migration-additivity finding remains.
