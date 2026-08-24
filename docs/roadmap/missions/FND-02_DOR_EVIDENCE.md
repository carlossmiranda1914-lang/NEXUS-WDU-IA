# FND-02 — DoR Evidence

**Mission:** FND-02 — Legacy Write Authority & Fences  
**State:** PREPARATION  
**Baseline:** `main` / `80a0d1e30b264145393206e0e69242c0bb79b5ea`  
**Preparation branch:** `codex/fnd-02-write-authority-dor`

## Scope and invariants

This preparation covers discovery, classification, characterization design and a deterministic fence sequence. It does not authorize any fence, route/controller/service/repository/UI/schema change, push, PR, merge or deployment.

The preserved invariants are server-derived institutional context, Person/Identity/Membership authority, vNext Enrollment transaction/idempotency policy, the FND-01 migration authority, and the tenant-safe School Tasks repository/service path. A legacy capability with no proven replacement remains TRANSITIONAL rather than being removed.

## Baseline evidence

- FND-01 is DONE through merge commit `80a0d1e30b264145393206e0e69242c0bb79b5ea`; `eb4d850` is an ancestor of `main`.
- `npm run nexus:preflight`: READY, zero blockers. Environment/database checks were skipped because `DATABASE_URL` was absent; this is not an implementation result.
- Route, persistence, client-caller and module-registration searches were performed only against this checkout.
- Full current inventory is [FND-02 authority matrix](../../audit/FND-02_AUTHORITY_MATRIX.md).

## Locked checkpoint proposal

| Checkpoint | Objective / IN | OUT | Required proof and stop condition | Predecessor |
|---|---|---|---|---|
| CP0 | Freeze baseline and run preflight | Production change | clean branch, origin alignment; stop on baseline drift | FND-01 DONE |
| CP1 | Close inventory and caller graph for every P0/P1 row | Fences | route-stack traces, AI tool enumeration, document partition; stop on unclassified write | CP0 |
| CP2 | Fence P0 AI direct-write tools by denial/delegation only after command policy exists | New AI capability | RED direct API/tool no-mutation, canonical regression, tenant/role/ID tests, rollback | CP1 |
| CP3 | Resolve duplicate School Tasks route authority | Task feature redesign | exact dispatch trace, modular API regression, direct legacy endpoint no-mutation, realtime/audit proof, rollback | CP1 |
| CP4 | Fence IAM legacy administration only when transitional onboarding contract is approved | IAM implementation | unusable-user/divergence characterization, direct API and role escalation negative tests | CP1 |
| CP5 | Classify/fence product-truth local/external persistence claims | Domain replacement work | UI/API no-false-success proof; stop if only operational writer | CP1 |
| CP6 | Finance, Communication, Documents, Teachers, Automations, Approvals decisions | Finance/Academic/etc. implementation | each is transitional or replacement-proven; stop on sole operational writer | CP1 |
| CP7 | AC01–AC08 evidence, lint/build/CI design and factual state | New functionality | all matrix rows closed and each future fence has rollback/tests | CP2–CP6 |

## Fence test contract

Every implementable fence must supply: a RED characterization of the pre-fence write; direct API denial; role, cross-tenant and manipulated-ID negatives; database row-count/fingerprint no-mutation evidence; a canonical-path regression; UI truth/error evidence; rollback verification; lint/build and CI inclusion. UI concealment alone is not evidence.

## Red-team result

Critical answers remain open: AI handler side effects are not fully enumerated; generic documents have not been partitioned into canonical versus transitional targets; and static registration order does not prove all legacy School Task routes are unreachable. These are factual gaps, not implementation failures, and prevent AC01/AC02/AC04 from closing.

## DoR decision

**PREPARATION.** The mission cannot be READY while P0 paths remain incompletely classified. The next authorized action is read-only/characterization evidence that closes CP1; it is not fence implementation.
