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
