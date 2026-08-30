# NEXUS-RECOVERY-01 — Canonical Execution Baseline Recovery

**State:** DONE
**Baseline/ref:** `main @ f413d61381a6f9edb54a0ce1138e9c49fb49dd9b`

## Outcome

Restore one factual operational baseline so a new session can locate scope, bootstrap the approved disposable UAT target, verify canonical identity/membership and resume without chat history.

## Scope and invariants

**IN:** state reconciliation, ACTIVE_MISSION, safe external-config linking, idempotent UAT bootstrap, documentation-only experience decision and `STUDENT-EXPERIENCE-01` preparation.
**OUT:** Finance, Assessment, Attendance, physical Documents, Student UI implementation, new Student writers, migrations and product refactors.

- Only merged `main` commits/migrations are canonical; open PRs are supporting.
- UAT targets only the approved disposable PostgreSQL instance; secrets stay external and ignored.
- Identity → Person → active Membership → InstitutionalContext is canonical; never `users.role`.
- Student Context remains read-only; no cache or Student 360 persistence.

## Evidence / stop rules

The external local Firebase UID and administrative email remain ignored and never enter Git. The approved disposable PostgreSQL target was reset, `npm run uat:bootstrap` passed twice, and the canonical Identity → Person → active Membership → InstitutionalContext chain plus a distinct Student fixture were verified. Three real browser resolutions were observed: initial login, logout/login repeat, and resolution after runtime restart; each produced Firebase authentication, UID match, `/api/profile` 200 and an institutional portal session. Contract, IAM HTTP, auth, lint, build, secret-scan and diff gates passed. No product authority, migration or Student UI was implemented by this recovery mission.
