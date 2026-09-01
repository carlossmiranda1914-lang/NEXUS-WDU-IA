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
