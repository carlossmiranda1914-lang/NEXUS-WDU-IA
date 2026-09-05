# Finance Execution Guardrails

Status: ACTIVE
Scope: Nexus Edu IA — Finance module

## Purpose

These rules govern Finance implementation and validation from FINANCE-F2 onward. They exist to prevent repeated remediation loops, stale-runtime UAT failures, silent scope expansion, and false GREEN conclusions.

## 1. Canonical source of truth

Finance work must be grounded in:

1. the current authoritative branch/worktree;
2. the current remote HEAD SHA;
3. canonical Finance architecture/spec/mission documents;
4. PostgreSQL migrations and authoritative persistence;
5. fresh test evidence against the final code state.

Conversation summaries or agent reports never override repository evidence.

## 2. Preserve closed verticals

A closed Finance vertical becomes a consumed dependency.

- Do not reopen FINANCE-F1 Fee Catalogue merely to satisfy a later feature.
- Later features reference existing authorities instead of duplicating them.
- Any required contract change to a closed vertical must be explicit, evidence-backed, and separately adjudicated.

## 3. One bounded objective at a time

Each mission must have:

- one clear business capability;
- explicit in-scope and out-of-scope boundaries;
- defined authority and persistence model;
- targeted tests;
- aggregate regression gates;
- Human UAT criteria.

Do not expand a failing test into unrelated refactoring, redesign, or another module.

## 4. Root cause before remediation

For any bug, UAT failure, or unexpected behavior:

1. reproduce the exact failure;
2. capture the real boundary where it fails;
3. compare the running runtime to the intended branch/SHA;
4. identify root cause before changing code;
5. apply the smallest correct fix;
6. add a regression proof for the exact failure boundary.

Do not guess and do not patch symptoms.

## 5. Mandatory runtime parity before every Human UAT

Before any Human UAT is considered valid, prove that the browser and backend are executing the same intended code state.

Required evidence:

- expected Finance branch;
- expected HEAD SHA;
- server working directory;
- server branch;
- server HEAD SHA;
- current migrations applied to the intended UAT database;
- no stale Nexus dev/test process serving an older Finance worktree.

A Human UAT performed against a stale frontend or backend is INVALID evidence.

If frontend/backend parity is not proven, stop UAT and recover runtime only. Do not change product code until parity is established.

## 6. Database safety and migration law

- PostgreSQL remains the canonical Finance persistence authority.
- Never patch canonical schema manually when a migration is required.
- Applied migrations are append-only and must not be rewritten.
- UAT database must be bootstrapped through the canonical migration runner.
- Never expose database credentials in commands, logs, reports, approval dialogs, committed artifacts, or documentation.

## 7. Evidence before GREEN

No Finance mission is GREEN because an agent says it is GREEN.

Before declaring completion, run fresh final-state evidence for the relevant mission and required regressions.

At minimum, use the mission aggregate plus relevant Finance Foundation, tenant-isolation, lint, build, diff, secrets, and artifact gates defined by that mission.

A passing targeted test does not replace a required aggregate or Human UAT.

## 8. Human UAT is product evidence

Human UAT validates the real school workflow, not only technical correctness.

A flow is not approved if:

- it exposes UUIDs or implementation terms as normal operational UX;
- it requires users to understand repository/domain internals;
- its sequence is ambiguous;
- critical choices are silently preselected;
- it duplicates data already owned by another Nexus authority;
- the browser behaves differently from the tested backend contract.

Operational clarity is part of the Finance contract.

## 9. No fake maturity

Do not implement future financial states or capabilities merely to make the module look complete.

Examples:

- do not mark obligations as paid before Payment + Allocation authority exists;
- do not create fake reconciliation, invoice, settlement, or provider behavior;
- do not duplicate Student/Person/Enrollment authority inside Finance.

Implement each economic authority in sequence.

## 10. Runtime-change rule

Whenever a commit changes a frontend/backend contract, route, request payload, response projection, migration, or UAT-visible behavior:

1. stop any stale Nexus server for that worktree;
2. restart from the intended final HEAD;
3. prove frontend/backend SHA parity;
4. only then start Human UAT.

This rule is mandatory.

## 11. Finance baselines currently established

### FINANCE-F1 — Fee Catalogue

Treat Fee Catalogue as the canonical definition of what may be charged. Later Finance capabilities consume its item UUID, applied version, Money, lifecycle, and Fee Type authority. They do not reinterpret or duplicate it.

### FINANCE-F2 — Financial Account + Financial Obligation Core

Treat Financial Account as the institution-scoped unit of financial responsibility and Financial Obligation as the canonical record of an amount legitimately due. Catalogue-backed obligation Money is an immutable economic snapshot at issuance.

Payment, Allocation, Reconciliation, fiscal documents, and automatic Enrollment-to-Finance integration remain separate later capabilities unless explicitly opened by a later mission.

## 12. Advancement rule

Advance to the next Finance priority only when all three conditions are true:

1. final code-state technical evidence is complete;
2. runtime parity is proven;
3. Human UAT for the current vertical passes the defined real workflow.

When those conditions are met, freeze the vertical and move forward. Do not start another abstract improvement pass.
