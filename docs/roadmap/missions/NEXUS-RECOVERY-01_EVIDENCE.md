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
