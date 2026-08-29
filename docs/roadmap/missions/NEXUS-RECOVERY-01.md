# NEXUS-RECOVERY-01 — Canonical Execution Baseline Recovery

**State:** BLOCKED  
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

Run UAT bootstrap twice, verify target/migrations/fixture facts, prove real Firebase login, run contract/secret/diff gates. **Current blocker:** the canonical local target was reset to repair its stale `0023` checksum, and the real Firebase UAT UID is not available in external local configuration to re-establish the canonical Identity → Person → Membership chain. Set `NEXUS_UAT_FIREBASE_UID` outside the repository, then run `npm run uat:bootstrap` twice. Stop if config, approved target or canonical Firebase UAT identity is unavailable, or if a change needs new product/domain authority.
