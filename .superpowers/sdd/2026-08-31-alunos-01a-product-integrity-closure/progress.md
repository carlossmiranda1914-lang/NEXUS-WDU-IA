# SDD ledger — ALUNOS-01A.3 Product Integrity & Closure

## Task 1 — Post-Activation Integrity

- Status: GREEN — independently reviewed.
- Scope: close only the unsafe generic `active -> cancelled` Enrollment transition; preserve every pre-activation cancellation path.
- RED: `npx tsx tests/alunos-01a3-post-activation-integrity.test.ts` exited `1` because the generic policy allowed `institution_admin` to cancel an active Enrollment.
- GREEN: policy/action contracts pass; `TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/enrollment-generic-transition-http-operational.test.ts` proves an active-to-cancelled generic HTTP attempt is `403`, with Enrollment and StudentProfile still `active` and no `status_changed` event.
- Protected: no StudentProfile write, schema change, activation API change or new post-activation lifecycle capability.
- Independent review: PASS. The reviewer required and then approved the real router/persistence assertion; no source, tenant, activation-authority or pre-activation cancellation regression remains.
