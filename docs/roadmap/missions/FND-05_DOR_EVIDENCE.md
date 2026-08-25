# FND-05 — Definition of Ready Evidence

**State:** READY. Preparation only: no production, schema or historical-data change was made.

## Checkpoints

| CP | Objective / surfaces | RED evidence and allowed treatment | PASS gate / stop |
|---|---|---|---|
| CP0 | deterministic audit harness | fixture proves event ordering and no-success-on-error | focused tests run without production credentials |
| CP1 | complete AT-01–AT-12 producer/consumer matrix | caller-to-reader trace; fence false/prototype paths | no critical UNKNOWN |
| CP2 | actor, Membership and institution | tampered actor/institution and missing membership | server-derived actor/context or factual fence |
| CP3 | success, failure and transaction truth | failed/rolled-back/rejected action must not write success | committed effect precedes factual outcome |
| CP4 | snapshots, before/after, correlation | stale/retry/snapshot mismatch | factual minimized snapshot and explicit correlation source |
| CP5 | scoped reads, privacy and redaction | cross-tenant read and sensitive-field probe | role/tenant denial, no secret/token/password/payload duplication |
| CP6 | background, realtime, integrations and transitional producers | async event/connector cannot claim durable audit | system/reconciliation distinction or fence/isolate |
| CP7 | aggregate evidence closure | AC matrix, scope/rollback review | focused tests, applicable lint/build/CI, clean diff |

## Acceptance evidence

AC01–AC08 in the Mission Pack remain canonical. Completion additionally requires: zero critical UNKNOWN; server-derived actor/institution; transaction-aligned outcomes; factual/minimized snapshots; tenant-scoped authorized reads; no sensitive leakage; accurate rejection/failure evidence; canonical path preservation; deterministic tests; lint/build/CI and rollback evidence. AT-01–AT-12 map each requirement to producer, reader and checkpoint.

## Privacy and secret boundary

Audit payloads exclude passwords, tokens, credential-bearing URLs, request bodies, unnecessary personal data and duplicated connector payloads. Retention, immutability, export restrictions and compliance status are dependencies until authoritative code/decision exists. Keep the FND-06 mandatory gate for the pre-existing tracked credential-bearing development configuration, rotation if active, Firebase restrictions/rules and CI secret detection; do not expose or rotate values here.

## Test plan and stop conditions

Future RED/GREEN evidence covers committed success, rejection and rollback, actor/institution tampering, cross-tenant denial, sensitive-field absence, snapshot/version fidelity, retry behavior, authorized history reads and canonical regressions. Stop if a P0 producer/consumer cannot be traced, retention/compliance needs an unapproved decision, runtime contradicts authority, or a correct audit contract requires schema/domain redesign.

## CP0 deterministic audit baseline — PASS

`scripts/run-fnd05-baseline.mjs` is derived from the established FND-04 runner pattern: local TSX CLI, `shell: false`, explicit readable-file validation, ordered child execution, 60-second timeout, first-failure exit propagation and no external service dependency. `tests/fnd05-baseline-runner.test.mjs` proves pass, failure, missing-file and timeout behavior with synthetic fixtures. `npm run test:fnd05` passes the runner self-test plus request-audit, InstitutionalContext, realtime bridge, Enrollment lifecycle/Documents/process contracts, and FND-02/FND-03 fences. No PostgreSQL contract is selected because CP0 proves harness behavior and existing static/unit evidence only; no persistent institutional data is mutated. Test fixtures and output contain no credentials, request bodies or unnecessary personal data. CP1 is next.

## CP1 complete audit surface characterization — PASS

`tests/fnd05-audit-surface-characterization.test.ts` maps AT-01–AT-12 to their actual source boundaries without invoking server runtime or persistent services. It asserts only present AS-IS facts: event insertion markers, task history tenant parameter, realtime refresh-without-task-data, route-pattern-only request details, server-side task context, fences, unavailable presentation, auth denial source and legacy log endpoint. The matrix records unproven rollback, durable rejection audit, scoped `/api/logs`, retention, role/redaction, correlation and connector/AI guarantees as CP2–CP6 work. CP2 is next.

## CP2 actor and institutional context — PASS

`tests/fnd05-audit-actor-attribution.test.ts` proves that canonical Enrollment Documents, lifecycle and process event emitters use `context.personId`/`context.institutionId`, while `requireAuth` derives context from Firebase UID and active Membership and fails closed for foreign/ambiguous selection. It also proves client document inputs contain no attribution fields. This focused contract does not claim system/unauthenticated actor semantics or CP3 outcome behavior. CP3 is next.
