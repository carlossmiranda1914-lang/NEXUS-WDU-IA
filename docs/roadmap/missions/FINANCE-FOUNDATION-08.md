# FINANCE-FOUNDATION-08 — Legacy Authority Fence + Aggregate Foundation Gate

**State:** READY_FOR_EXECUTION
**Branch:** `codex/finance-foundation-01`
**Accepted predecessor HEAD:** `ff5b91e40d756dcf9f2363c487386f08c972c9e5`
**Spec:** `docs/superpowers/specs/2026-09-03-finance-foundation-implementation-design.md`
**Plan:** `docs/superpowers/plans/2026-09-03-finance-foundation-implementation.md`
**Execution record:** `.superpowers/sdd/2026-09-03-finance-foundation/progress.md`

## Mission

Execute only Task 8 from the approved Finance Foundation plan: prove the legacy authority fence, build one deterministic aggregate Finance Foundation gate over the already accepted Tasks 1–7, and produce the exact-HEAD evidence needed for independent review.

This task is a **closure/verification task**, not a new Finance feature slice. It must not expand into Payments, Allocation, Reconciliation, provider, fiscal/reporting, UI or new economic semantics.

Tasks 1–7 are accepted predecessors. Do not reopen them unless fresh Task 8 evidence proves a concrete regression.

## Primary objective

At the end of Task 8, the branch must answer one question truthfully:

> Does the complete Finance Foundation implementation satisfy the approved F0–F4 authority, persistence, tenant-isolation, exactness, concurrency, recovery and legacy-fence contracts as one coherent system?

A GREEN answer requires fresh aggregate evidence, not a collection of old verbal claims.

## Authorized files

Create:
- `tests/finance-foundation-authority-fence.test.ts`
- `scripts/run-finance-foundation.mjs`

May update:
- `package.json` only to add/normalize narrow Finance test aliases and `test:finance:foundation`;
- `.superpowers/sdd/2026-09-03-finance-foundation/progress.md`;
- existing legacy adapter/service file **only if** a RED proves that an existing mutable legacy Finance field can currently alter canonical Finance position through an approved runtime path and the smallest explicit fence can be applied without introducing new product semantics.

Read-only by default:
- all accepted Finance production modules;
- migrations `0027`–`0030`;
- existing legacy finance/student fee fields and routes;
- canonical migration/startup/tenant safety helpers;
- governance/spec/plan records.

No new migration is authorized. No new Finance domain table or product behavior is authorized.

## Legacy authority fence laws

Legacy mutable values such as `outstandingFees`, fee totals, student convenience balances or equivalent pre-Foundation fields may exist for backward compatibility, display or unrelated legacy flows, but they are **not canonical Finance balance authority**.

Task 8 must prove at minimum:

1. Canonical Foundation position is derived only from confirmed Finance Journal authority.
2. Mutating a legacy balance/convenience field does not change `readFoundationPosition()` or rebuild output.
3. Legacy fields are not imported/read by Finance Journal, command, reversal, projection or outbox authority code to establish economic truth.
4. No browser/client-supplied legacy balance can bypass the server-authoritative Journal command boundary.
5. If an existing legacy runtime endpoint currently writes only the legacy field, that write may remain legacy behavior, but must not create/update/delete Finance Journal facts or `finance_position_projection` as independent authority.
6. No migration or Task 8 code may reinterpret legacy mutable balances into confirmed Journal history.

A source/import fence may supplement the behavioral proof, but it cannot substitute for the runtime/read-model proof where a concrete legacy write path exists.

## Mandatory authority-fence RED/GREEN

Before implementation of the fence test/helper, create `tests/finance-foundation-authority-fence.test.ts` and observe a valid RED for missing test contract/helper/aggregate wiring.

The test must discover the actual legacy balance field/path from repository evidence; do not invent a fictitious endpoint merely to satisfy the test.

Required proof pattern:

```text
establish canonical Finance Journal position for institution/student context
=> record canonical projection/read result

mutate the discovered legacy outstandingFees/equivalent field through the narrowest real repository/service/runtime path available
=> legacy value changes if that path still exists
=> confirmed Journal count/economic facts unchanged
=> rebuilt/read canonical Finance position unchanged

scan/import fence
=> accepted Finance authority modules do not depend on legacy mutable balance as economic input
```

If no executable legacy write path exists anymore, prove that absence from repository/runtime authority and perform the strongest available persistence/read-model negative proof. Do not create a legacy path for testing.

If legacy mutation currently **does** alter canonical Finance position or confirmed Journal authority, STOP after reproducing the RED and report the exact path. Do not silently patch multiple modules.

## Aggregate Finance Foundation gate

Create `scripts/run-finance-foundation.mjs` as a deterministic fail-fast runner. It must execute the approved Finance proof set in a stable order and stop on first failure while preserving the child exit code.

At minimum the aggregate must include:

```text
1. finance-money-model.test.ts
2. finance-financial-context.test.ts
3. finance-foundation-schema-postgres.test.ts
4. finance-journal-postgres.test.ts
5. finance-idempotency-concurrency-postgres.test.ts
6. finance-reversal-concurrency-postgres.test.ts
7. finance-projection-recovery-postgres.test.ts
8. finance-foundation-authority-fence.test.ts
```

For tests requiring PostgreSQL, the runner must inherit the already-approved `TEST_DATABASE_LOCAL_AUTHORIZED=true` / `TEST_DATABASE_URL` environment and must not manufacture or weaken safety authorization.

The aggregate runner must not:
- hide failing stdout/stderr;
- continue after a blocking failure and still return success;
- convert non-zero child exit to zero;
- run tests in parallel when shared disposable DB state or evidence ordering could become ambiguous;
- bypass the canonical DB safety gate.

Add package aliases consistent with the plan, including:

```text
test:finance:money
test:finance:context
test:finance:schema
test:finance:journal
test:finance:idempotency
test:finance:reversal
test:finance:recovery
test:finance:authority
test:finance:foundation
```

Do not duplicate implementation logic in the runner.

## Fresh final proof matrix

Task 8 must execute fresh evidence sufficient to close the Foundation, including:

- exact Money normalization/arithmetic and persistence envelope;
- Financial Context fail-closed behavior;
- canonical migration bootstrap/checksum/history integrity;
- tenant-safe schema negatives;
- atomic Journal confirmation and rollback failure injection;
- idempotency sequential/concurrent replay and conflict;
- append-only reversal + over-reversal concurrency;
- projection destroy/rebuild + historical reproducibility;
- durable outbox restart/retry/concurrent lease recovery;
- legacy authority fence;
- FND03 tenant-isolation regression;
- lint;
- build;
- `git diff --check`.

Where the repository already has a canonical aggregate migration/FND gate, reuse it rather than adding a duplicate runner.

## Final required commands

Preflight:
```bash
git status --short
powershell -ExecutionPolicy Bypass -File scripts/bootstrap-local-worktree.ps1 -ExpectedBranch codex/finance-foundation-01
```

Task 8 RED/GREEN:
```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-foundation-authority-fence.test.ts
```

Aggregate:
```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npm run test:finance:foundation
```

Repository regressions / quality:
```bash
npm run test:migrations:isolated
npm run test:fnd01:cp2:local
npm run test:fnd03
npm run lint
npm run build
git diff --check
```

If the aggregate already covers a command exactly, do not rerun it merely for duplication unless the mission explicitly requires independent evidence.

## Evidence record

Update the progress record with:
- exact starting SHA;
- RED observed;
- legacy field/path actually discovered;
- whether the path is executable, read-only, absent or fenced;
- exact aggregate command and result;
- each blocking gate result;
- warnings that are preexisting/non-blocking;
- final commit SHA and remote coherence.

Do not call the Finance Foundation integrated merely because this branch passes. `main` remains integrated authority until merge.

## STOP conditions

STOP and report without workaround if:
- a real legacy mutation path can change canonical Finance Journal/projection authority;
- fixing the legacy fence requires broad refactor, product semantics or migration not authorized here;
- aggregate Finance tests reveal a regression in Tasks 1–7;
- clean migration/bootstrap/checksum behavior regresses;
- tenant isolation regresses;
- startup/quality gate reveals a blocking defect attributable to the Finance branch;
- final evidence depends on weakening/removing a test or safety gate;
- production changes beyond a single narrowly-proved legacy fence become necessary;
- any new Payment/Allocation/Reconciliation/provider/fiscal/UI scope is required.

## DONE definition

`FINANCE-FOUNDATION-08` is DONE only when:
- valid Task 8 RED is recorded;
- legacy authority fence is behaviorally proved against the real repository/runtime path available;
- Finance authority modules are fenced from legacy mutable balance truth;
- deterministic `test:finance:foundation` aggregate exists and fails closed;
- aggregate Finance Foundation proof passes fresh;
- migration/checksum/FND03 regressions pass;
- lint PASS;
- build PASS;
- `git diff --check` PASS;
- exact implementation HEAD is committed and pushed;
- worktree is clean and remote HEAD matches;
- no unresolved P0/P1 is known from Task 8 execution;
- independent READ-ONLY exact-HEAD review has **not yet been self-declared** by Codex; that remains the next governance action after the implementation checkpoint.

## After DONE

STOP. Do not merge to `main`, do not open upper Finance domains and do not update the project to `INTEGRATED` automatically.

The next step after a clean Task 8 implementation checkpoint is **independent exact-HEAD Foundation review**, followed by Product Owner/integration adjudication.
