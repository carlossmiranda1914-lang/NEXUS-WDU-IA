# NEXUS-RECOVERY-01 — Factual Reconciliation Evidence

| Source | Claim | Repository fact | Consistent? | Action |
|---|---|---|---|---|
| `PROJECT_STATE.md` before recovery | IAM remained unmerged; Student 360 out of scope | `main` contains PR #78/#80/#81, ACADEMIC-01 and PR #84 Student Context integration | No | Replaced stale state with concise factual baseline. |
| `origin/main` | current integrated baseline | `f413d613…`, migrations `0001`–`0023`, including `0022`/`0023` | Yes | Retained as canonical baseline. |
| PR #76 | agent skills authority | GitHub state `OPEN`, no merge commit | No | Classified supporting only. |
| PR #77 | IAM visual-spec authority | GitHub state `OPEN`, no merge commit | No | Classified supporting only. |
| `ACTIVE_MISSION.md` before recovery | Student-360 backend was active | Student Context is merged; visual UAT is not accepted | No | Pointed active mission to recovery and recorded blocker. |
| local PostgreSQL ledger | final migration parity | first bootstrap found stale checksum for `0023`; canonical reset reapplied 23 migrations | Repaired | Never rewrote migration; reset approved disposable target. |
| Student visual UX | product-ready UI | non-merged UI/auth branch exists; no accepted human UAT | No | Kept UI out of this mission; prepared `STUDENT-EXPERIENCE-01`. |
| external ignored local configuration | canonical Firebase UAT identity can be restored without source persistence | `NEXUS_UAT_FIREBASE_UID` was present without being emitted or versioned | Yes | Used only through `npm run uat:bootstrap`. |
| `npm run uat:bootstrap` run 1 | canonical fixture bootstrap succeeds | approved target, ledger and canonical identity chain verified | Yes | PASS. |
| `npm run uat:bootstrap` run 2 | bootstrap is idempotent | repeat run produced the same safe completion result | Yes | PASS. |
| PostgreSQL aggregate verification | no duplicate canonical UAT authority and usable Student fixture | one Identity, one Person, one active admin Membership, one Institution, one active Enrollment, one active Placement, two historical Placements and 23 migrations | Yes | PASS. |
| `tests/local-uat-bootstrap-contract.test.ts` | bootstrap remains external-config and authority-safe | contract assertions passed | Yes | PASS. |
| `tests/iam-local-uat-provisioning-contract.test.ts` and `tests/iam-http-operational.test.ts` | canonical IAM provisioning and HTTP context resolution remain safe | isolated-schema/loopback IAM HTTP tests passed | Yes | PASS. |
| UAT identity separation | Student fixture must not be the administrative login identity | bootstrap requires external UID, exactly one active administrative context and a Student fixture person distinct from the administrator | Yes | contract test and bootstrap ×2 PASS. |
| visible login form / repository search | `student360.uat.20260829@example.test` must not be an application-owned admin default | value is not present in code/configuration; DOM fields have no application value/default | Yes | classified as external browser autofill, not a Nexus Student fixture authority. |
| Firebase Admin user lookup | configured UID must map to canonical admin email | Firebase Admin lookup returned safe `app/invalid-credential`; no remote user lookup credential is currently available | No | do not infer email; final browser authentication remains required. |
| real browser authentication | configured external administrative identity can enter the portal | Firebase email/password authentication, configured UID match, Identity, Person, active Membership, Institution and InstitutionalContext all resolved; `/api/profile` returned 200 | Yes | initial human login, logout/login repeat and post-restart resolution PASS; no password, token or UID was recorded. |
| `npm run test:auth` with explicit disposable environment | legacy auth regression remains executable without weakening test DB safety | CSP and 5/5 stabilization tests passed when `DATABASE_URL` used the approved disposable target with a distinct `application_name` | Yes | PASS; the initial bare invocation correctly failed because it inherited the CI-only hostname. |
