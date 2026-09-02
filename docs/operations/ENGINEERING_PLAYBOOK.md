# NEXUS Engineering Playbook

This playbook defines the durable execution standard for engineering work in NEXUS.
It complements, rather than replaces, the existing architecture, mission, product, Engineering Operating System and Definition-of-Done documentation.

## 1. Operating principle

Every change must improve the product state, not just increase code volume.

The default execution loop is:

`diagnose -> scope -> invariant -> minimal implementation -> focused test -> regression -> static checks -> build -> user validation -> evidence -> commit`

If the diagnosis is incomplete, do not implement.
If the invariant is unclear, stop and define it.
If the smallest correct change is not known, investigate before editing.

## 2. Priority control

Before starting work, answer:

1. What user/business problem is currently blocked?
2. Is this the highest-value unresolved problem in the active vertical?
3. Is the problem a root cause or merely a symptom?
4. What evidence will prove it is solved?
5. What existing behavior must not regress?

Do not allow side suggestions to automatically become implementation tasks.
Do not start a later roadmap stage while the current release has a blocking defect in its core workflow.

## 3. Change sizing

Prefer:

- one functional objective per change set;
- small, reviewable diffs;
- reversible changes;
- explicit migrations;
- deterministic tests;
- separate policy/domain logic from HTTP/UI glue.

Avoid:

- broad rewrites while diagnosing a single defect;
- mixing unrelated cleanup with a functional fix;
- changing database contracts and UI contracts in one unbounded patch;
- introducing new abstractions without a present use case.

## 4. Critical-path release gate

Critical paths include identity, enrollment, academic-year governance, documents, student lifecycle and financial authority boundaries.

A critical-path change is releasable only when all applicable gates pass:

### Domain gate

- explicit allowed/forbidden transitions;
- authority/role checks;
- fail-closed behavior where required;
- no browser authority over server-owned identity or institution fields.

### Persistence gate

- PostgreSQL-backed test;
- institutional isolation;
- idempotency for retryable creates;
- duplicate prevention;
- transaction boundaries where partial state would be harmful;
- migration chain verified.

### API gate

- normal domain rejections return explicit non-500 responses;
- unexpected failures remain visible in logs and tests;
- no generic success after partial writes;
- request validation rejects malformed/unauthorized authority data.

### Regression gate

- focused test for the bug/feature;
- relevant previous-stage tests;
- migration isolation test where applicable;
- TypeScript/lint/static checks;
- production build when invalidated/required by the checkpoint.

### UX gate

For user-facing changes:

- real workflow exercised from the user's entry point;
- error/loading/success states visible and understandable;
- persistence confirmed after reload where applicable;
- desktop and mobile widths checked;
- no hidden dependency on manual database intervention.

## 5. Database and migrations

The operational application must never rely on an assumption that the database is current.

Rules:

- Migrations are the canonical schema evolution mechanism for vNext domains.
- Server startup logs are not proof of migration parity unless startup explicitly verifies it.
- A migration runner must fail clearly when prerequisites are absent.
- Never silently skip a failed migration and continue into operational traffic.
- Isolated migration tests must start from a clean schema and apply the complete ordered chain.
- Production/local operational checks should be read-only when diagnosing schema state unless migration action is explicit and reviewed.
- Migration filenames remain ordered and deterministic.
- Avoid BOM/encoding artifacts in SQL files.

## 6. Identity and enrollment safety

Identity/enrollment rules are non-negotiable:

- The server resolves Person identity; the browser does not authorize a Person UUID.
- New-student intake must not require an artificial search when the user knows the student is new.
- Existing-student intake must not silently create a new Person after `NO_MATCH` or ambiguous resolution without the intended workflow.
- Strong identifier conflicts require explicit review/decision policy.
- Local safe matches may be reused only under defined server rules.
- Cross-institution information must not leak through identity resolution.
- Enrollment creation is idempotent.
- Duplicate enrollment/student/person creation is a release blocker.
- Any normal existing-student flow returning a generic 500 is a release blocker.

## 7. Frontend implementation standard

- Keep the interface progressive: reveal complexity when the workflow needs it.
- Preserve established visual language unless a redesign is explicitly prioritized.
- Prefer one clear next action over multiple competing panels.
- Do not expose backend/internal terminology unnecessarily.
- Error messages should communicate what the user can do next without leaking sensitive data.
- Do not use UI validation as a substitute for backend enforcement.
- Validate actual rendered behavior, not only component contracts.

## 8. Git safety

Before writing:

- inspect current branch;
- inspect `git status`;
- identify unrelated modified/untracked files;
- verify remote relationship when relevant.

Never use without explicit authorization and a verified reason:

- `git reset --hard`
- `git clean`
- force push
- destructive checkout over local work
- deleting unknown untracked files

When local work and remote work diverge, prefer non-destructive reconciliation and preserve unrelated state.

## 9. CI standard

CI should test behavior, not merely syntax.

For critical verticals, prefer a gate containing:

- clean dependency install;
- focused policy/domain tests;
- integration contract tests;
- PostgreSQL test service;
- migration chain verification;
- relevant historical regressions;
- TypeScript/lint/static checks;
- production build.

Do not weaken CI to accept lockfile drift or skip a failing gate without documenting and resolving the cause.

## 10. Evidence and completion

Every completion statement must be backed by evidence.

Minimum evidence summary:

- files/areas changed;
- invariant implemented;
- focused tests and result;
- regression tests and result;
- database/migration evidence if applicable;
- build/static result when applicable;
- visual validation result if applicable;
- known remaining risks.

If a known blocker remains, the task/mission is not DONE in the scope that blocker affects.

## 11. Session recovery and handoff

A new coding agent must be able to recover without old chat history.

Recovery procedure:

1. Read `AGENTS.md`.
2. Read `docs/README.md`.
3. Read `docs/operations/PROJECT_STATE.md`.
4. Read `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml`.
5. Read this playbook plus the applicable agent adapter.
6. Inspect current Git state and recent commits.
7. Read only the relevant architecture/product/mission/spec/plan docs for the active task.
8. Reconcile documented state with code reality.
9. Continue only the selected active priority.

Do not paste large historical conversations into prompts when the needed facts can be maintained in repository documentation.

## 12. Automation target

Automation should remove repetitive verification, not remove engineering judgment.

Good automation candidates:

- migration parity verification;
- isolated migration execution;
- critical PostgreSQL regression suites;
- TypeScript/lint/build gates;
- contract tests;
- branch/working-tree diagnostic scripts that are read-only by default;
- CI summaries/evidence generation.

Keep manual approval for:

- destructive Git operations;
- production data mutation;
- irreversible migrations;
- security/authority policy changes outside approved mission scope;
- release decisions with unresolved risk.

## 13. Senior review checklist

Before approving a critical change, ask:

- Did we fix the root cause?
- Can the same bug recur through another path?
- Is there a regression test that would catch it?
- Is the database contract explicit?
- Is institutional isolation preserved?
- Is retry behavior safe?
- Can partial failure leave inconsistent state?
- Does the user receive a meaningful outcome?
- Does CI exercise the real persistence boundary?
- Is the documentation state still truthful?

If any answer is unknown, investigate before release.

## 14. Canonical delivery pipeline

For relevant product/authority work use:

`Discovery -> Product Decision -> Design/Authority -> Mission Pack -> Implementation Plan -> Execution -> Independent Review -> Adversarial Product Review -> Human UAT -> Integration -> Project State Update`.

Do not use implementation to discover decisions that should have been resolved by product/architecture analysis when a bounded discovery can establish them first.

## 15. Four GREEN gates

Track applicable gates independently:

- `ENGINEERING_GREEN`: code/tests/build/security/tenant/regression evidence.
- `INTEGRITY_GREEN`: no contradictory state, authority or data semantics.
- `PRODUCT_GREEN`: supported workflow works end-to-end without scripts, devtools or hidden prerequisites.
- `HUMAN_UAT_GREEN`: observed and accepted real product behavior.

A technical task can be GREEN while the mission remains not PRODUCT_GREEN. `DONE` requires all applicable gates plus integration and truthful state documentation.

## 16. Resource and evidence invalidation

Use progressive context and evidence classes from `NEXUS_ENGINEERING_CONFIG.yaml`.

Do not reread/retest the entire project for every micro-change. Classify prior proof as:

- `FRESH` — required now;
- `REUSABLE` — current delta does not touch its authority;
- `INVALIDATED` — rerun because current delta may affect it.

Use the test-cost ladder:

`targeted RED/GREEN -> affected tests -> affected regressions -> checkpoint gate -> aggregate/final gate`.

This is a resource optimization rule, not permission to omit mandatory security/integrity/DoD evidence.

## 17. Multi-agent collaboration

Codex and Antigravity are complementary engineering agents. Every task names an owner and reviewer.

- Same code/authority: one implementer owner at a time.
- Parallelism: only independent work or a frozen shared contract.
- Reviewer starts read-only.
- Reviewer reports findings before modifying owner code.
- Ownership transfer is explicit.
- Implementer cannot be sole approver of its integration.

Use duplicate investigations only when independent verification materially improves confidence (for example a security/adversarial review).

## 18. Integration protocol

Distinguish:

1. **Technical task integration** — independently reviewed task checkpoint into its mission branch.
2. **Product integration** — mission/PR into `main` only after applicable aggregate gates, adversarial product review, Human UAT and PR review.

Every handoff identifies mission/task/owner/reviewer/base/head/branch, authority/schema impact, tests, limitations, clean-worktree state and next action.

A commit or push proves recoverability; it does not by itself prove GREEN, product acceptance or integration.

## 19. Canonical implementation prompt and proof selection

Every implementation prompt is a compact execution contract. It must state:

```text
MISSION=
TASK=
HEAD SHA=
WRITE_OWNER=
REVIEWER=
INVARIANTS=
RISK CLASS=
AUTHORIZED_SCOPE=
FORBIDDEN_SCOPE=
REQUIRED_PROOF=
STOP_CONDITIONS=
COMMIT/PUSH/MERGE AUTHORIZATION=
```

It also identifies evidence that is reusable and evidence invalidated by the proposed delta. A new finding never authorizes automatic scope expansion.

Proof is selected by risk: static contracts for structure, domain tests for policy, HTTP tests for authorization, PostgreSQL scenarios for persistence/concurrency, and ordered interaction or browser proof for stateful user workflows. Static/source tests are complementary only. They cannot be the sole proof for stateful critical flows. Stateful user flows require behavioral/state-transition proof that exercises the relevant ordered transitions; when automation is unavailable, the required manual/Human UAT evidence is explicit rather than inferred from CI.
