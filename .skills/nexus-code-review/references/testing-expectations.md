# Testing expectations

- Map each changed invariant to the smallest executable proof that actually exercises it.
- Prefer characterization/regression tests for fixed defects and negative authorization/tenant tests for access-sensitive work.
- For persistence changes, require deterministic database-backed evidence when the contract depends on PostgreSQL behavior.
- For UI work, test user-observable state and authorization truth; do not rely solely on snapshots for behavioral claims.
- Keep build, lint/type checks and existing mandatory quality gates intact.
- Distinguish PASS, FAIL, BLOCKED and NOT RUN exactly.
- Never call a suite PASS because its command exited successfully if the required tests were skipped, filtered out or never discovered.
- Do not demand duplicate tests that protect no distinct invariant.
- Completion claims must name the commands/evidence actually run; residual unverified areas remain explicit.
