# FINANCE-FOUNDATION-05 — Canonical Command Idempotency + Concurrency

**State:** READY_FOR_EXECUTION
**Branch:** `codex/finance-foundation-01`
**Accepted predecessor HEAD:** `2a84191c22abe31adb39af1e15748b0b48b4e9c8`
**Spec:** `docs/superpowers/specs/2026-09-03-finance-foundation-implementation-design.md`
**Plan:** `docs/superpowers/plans/2026-09-03-finance-foundation-implementation.md`
**Execution record:** `.superpowers/sdd/2026-09-03-finance-foundation/progress.md`

## Mission

Implement only Task 5 from the approved Finance Foundation plan: canonical command identity, deterministic request fingerprinting, replay-safe result recovery and real PostgreSQL concurrency semantics.

Tasks 1–4 are accepted predecessors. Do not start Task 6 reversal behavior.

## Critical predecessor note

Task 4 intentionally created only structural command-result linkage. Its Journal repository currently uses `commandId` as the temporary `request_fingerprint` value when persisting `finance_command_results`. Task 5 owns the final canonical fingerprint/idempotency semantics and must replace or integrate that provisional behavior cleanly. Do not create a second competing command-result authority.

## Required interface

```ts
export interface FinanceCommandIdentity {
  institutionId: string;
  operationNamespace: string;
  idempotencyKey: string;
  canonicalFingerprint: string;
}

export async function executeIdempotentFinanceCommand<T>(input: {
  pool: import('pg').Pool;
  identity: FinanceCommandIdentity;
  execute: (
    client: import('pg').PoolClient,
  ) => Promise<{ resultRef: string; result: T }>;
  loadResult: (
    client: import('pg').PoolClient,
    resultRef: string,
  ) => Promise<T>;
}): Promise<{ replayed: boolean; result: T }>;
```

A helper for canonical fingerprint construction is authorized inside `finance-command.ts` if needed. It must hash deterministic server-canonical JSON with SHA-256 and must never depend on insertion-order accidents, locale formatting or raw user lexical Money representation.

## Authorized files

Create:
- `src/modules/finance/finance-command.ts`
- `tests/finance-idempotency-concurrency-postgres.test.ts`

May modify only as required to remove Task 4's provisional fingerprint behavior and route canonical command identity through one authority:
- `src/modules/finance/journal-repository.ts`
- `src/modules/finance/journal-model.ts` only if the approved Task 5 handoff requires a narrowly-scoped signature/contract adjustment
- `tests/finance-journal-postgres.test.ts` only for corresponding regression updates
- `.superpowers/sdd/2026-09-03-finance-foundation/progress.md`
- `package.json` only for a narrow Task 5 test alias if useful

No migration is authorized by default. The existing unique constraint `(institution_id, operation_namespace, idempotency_key)` is the intended final database arbiter.

## Canonical identity laws

- Identity scope is exactly `(institutionId, operationNamespace, idempotencyKey)`.
- `canonicalFingerprint` represents the canonical semantic request, not the response and not a timestamp/random value.
- Equivalent lexical Money values must produce identical canonical fingerprint material.
- Object key ordering must be deterministic.
- Same identity + same fingerprint => replay existing result; do not create a second economic fact.
- Same identity + different fingerprint => conflict/fail closed; do not create a second economic fact.
- Different idempotency keys with otherwise identical command content => distinct legitimate commands and may both commit.
- Database uniqueness is the final arbiter under concurrency. A pre-read may optimize but can never be the sole protection.
- On unique conflict: reload the persisted row. Matching fingerprint => replay. Different fingerprint => conflict.
- Lost-response recovery must return the previously committed result without recreating Journal authority.
- No in-memory mutex, process-local map or browser state may be authoritative idempotency protection.

## Canonical fingerprint requirements

Use SHA-256 over server-canonical JSON assembled from stable command fields. At minimum:
- normalized exact Money serialization;
- canonical currency code;
- stable journal/operation semantics;
- stable institution-bound command fields that materially change economic meaning.

Never include:
- request arrival time;
- random UUIDs generated during execution;
- presentation locale;
- non-authoritative UI state.

If the exact set of command fields cannot be determined from the approved Task 4/5 contracts without inventing new product semantics, STOP and report the ambiguity instead of guessing.

## Mandatory TDD / PostgreSQL proof

1. Run DB safety preflight first.
2. Write `tests/finance-idempotency-concurrency-postgres.test.ts` before Task 5 production code.
3. Observe valid RED for missing canonical command implementation/semantics.
4. Implement minimum canonical command boundary.
5. Prove sequential replay, conflict, concurrency and lost-response recovery on real disposable PostgreSQL.

Required cases:

```text
same identity + same fingerprint, sequential retry
=> one command result + one Journal fact; second call returns replayed=true

same identity + different fingerprint
=> conflict; still one command result + one Journal fact

two concurrent calls, same identity + same fingerprint
=> exactly one committed command result + exactly one Journal fact; the other returns replay of persisted result

two concurrent calls, same identity + different fingerprints
=> exactly one winner; loser conflicts; no second Journal fact

two distinct idempotency keys, identical Money/semantic request
=> both commit independently

lost response after successful commit
=> later retry reloads persisted result and does not create another Journal fact

canonical fingerprint stability
=> semantically equal Money such as 1.0 EUR and 1.00 EUR hashes identically

canonical fingerprint sensitivity
=> a material economic field change changes fingerprint
```

Do not accept source-string/AST tests as substitutes for concurrency/state proof.

## Integration with Task 4 Journal

Task 5 may refactor the provisional Task 4 command-result insertion only enough to establish one canonical ownership boundary. The end state must be unambiguous:

- either `executeIdempotentFinanceCommand` owns command-result persistence and invokes Journal within its transaction boundary;
- or Journal receives canonical command identity/result linkage through an explicit contract without creating competing semantics.

Whichever minimal design is chosen, there must be exactly one authoritative row per scoped idempotency identity and no duplicate insertion race between Task 4 and Task 5 layers.

Do not weaken Task 4 atomicity: Journal fact, required audit/outbox and command-result authority must still commit atomically for the foundation command.

## Transaction/concurrency rules

- Use real PostgreSQL uniqueness as final arbiter.
- Do not hold network/provider calls inside DB transaction.
- Do not use process-global locks as correctness mechanism.
- Do not swallow unique-constraint conflicts; adjudicate by persisted fingerprint.
- Keep result loading tenant-scoped through the persisted `result_ref` and caller-provided loader.
- Preserve exact Money; no JavaScript `number` monetary authority.

## Required commands

Preflight:
```bash
git status --short
powershell -ExecutionPolicy Bypass -File scripts/bootstrap-local-worktree.ps1 -ExpectedBranch codex/finance-foundation-01
```

RED/GREEN:
```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-idempotency-concurrency-postgres.test.ts
```

Final proof:
```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-idempotency-concurrency-postgres.test.ts
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-journal-postgres.test.ts
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-foundation-schema-postgres.test.ts
npm run test:migrations:isolated
npm run test:fnd01:cp2:local
npm run test:fnd03
npm run lint
npm run build
git diff --check
```

## STOP conditions

STOP and report without workaround if:
- canonical idempotency cannot be integrated without creating a second command-result authority;
- Task 4 atomicity would be broken by the integration approach;
- database uniqueness is insufficient because required scope differs from the approved schema;
- a migration appears necessary;
- canonical fingerprint field set requires new product semantics not already approved;
- concurrency correctness would depend on process-local locking;
- result replay cannot be tenant-safe;
- a baseline PostgreSQL or quality gate fails outside Task 5 and cannot be safely classified.

## DONE definition

`FINANCE-FOUNDATION-05` is DONE only when:
- valid RED was observed and recorded;
- canonical fingerprint generation is deterministic and exact;
- sequential same-fingerprint replay passes;
- same-key/different-fingerprint conflict passes;
- same-identity concurrent race passes on real PostgreSQL;
- distinct-key concurrent/parallel legitimacy passes;
- lost-response recovery passes;
- Task 4 atomicity regressions remain GREEN;
- schema/migration regressions remain GREEN;
- lint/build/diff gates PASS;
- worktree is clean after commit;
- exact commit SHA is pushed and recorded;
- Task 6 has not started.
