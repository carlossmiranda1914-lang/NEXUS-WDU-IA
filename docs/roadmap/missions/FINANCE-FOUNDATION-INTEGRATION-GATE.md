# FINANCE FOUNDATION — Integration Sync Gate

**State:** READY_FOR_EXECUTION
**Branch:** `codex/finance-foundation-01`
**Accepted Finance exact HEAD:** `95dd350c872229a222eead5d88d79a13776c5955`
**Current main HEAD at authorization:** `e7ab85a1382cd8ac042a344d574ec25e967e80d9`

## Mission

Reconcile the accepted Finance Foundation branch with the current `main`, then re-run the minimum blocking Foundation/integration gates on the synchronized result. This is an integration-preparation gate only.

Do not add new Finance product behavior, do not start upper Finance, and do not merge to `main` automatically.

## Required method

1. Start from the existing clean `worktrees/finance-foundation-01` on `codex/finance-foundation-01`.
2. `git fetch origin --prune`.
3. Verify `origin/main` is exactly the current upstream main before synchronizing.
4. Merge `origin/main` into `codex/finance-foundation-01` with a normal merge commit. Do **not** rebase published history and do not force-push.
5. If there are conflicts, classify them before editing:
   - purely governance/documentation conflict: reconcile to current truth while preserving Finance accepted status;
   - code/schema/test conflict touching Finance authority or shared runtime behavior: STOP and report exact files/semantics before resolution.
6. If merge succeeds cleanly or only bounded governance reconciliation is needed, run fresh blocking gates.
7. Commit any bounded reconciliation, push normally, prove remote/local coherence, and STOP for final Product Owner integration decision.

## Required fresh gates

```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npm run test:finance:foundation
npm run test:migrations:isolated
npm run test:fnd01:cp2:local
npm run test:fnd03
npm run lint
npm run build
git diff --check
```

If merge changes files that are covered by another canonical regression gate and that gate is clearly affected, run that affected gate once. Do not launch a broad unrelated regression campaign without concrete reason.

## Protected invariants

- Finance Foundation accepted HEAD semantics remain unchanged unless a real integration conflict proves otherwise.
- P0=0 / P1=0 status remains provisional until synchronized gates pass.
- Legacy HTTP E2E remains an adjudicated residual risk, not a new implementation task.
- No new migration.
- No migration rewrite.
- No new Finance tables/domains.
- No Payment, Allocation, Reconciliation, provider, fiscal/reporting or Finance UI.
- No force push.
- No merge to `main` from this mission.

## STOP conditions

STOP before conflict resolution if:
- `origin/main` changed again after authorization in a way not captured by preflight;
- any merge conflict touches Finance authority code, migration chain, tenant/auth context, DB initialization or shared runtime semantics;
- synchronized Finance aggregate fails;
- migration/checksum regression fails;
- FND03 tenant isolation fails;
- lint/build fails for a change attributable to the synchronization;
- resolving the issue requires product or architecture work beyond bounded integration reconciliation.

## DONE definition

Integration Sync Gate is DONE only when:
- current `main` has been merged into the Finance branch without history rewrite;
- all required fresh gates PASS;
- exact synchronized HEAD is committed and pushed;
- remote branch matches local HEAD;
- worktree is clean;
- no unresolved P0/P1 was introduced by synchronization;
- no merge to `main` occurred;
- upper Finance remains not started.

After DONE: STOP for final integration/PR decision.
