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
