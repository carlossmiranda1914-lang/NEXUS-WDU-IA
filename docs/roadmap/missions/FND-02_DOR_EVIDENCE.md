# FND-02 — DoR Evidence

**Mission:** FND-02 — Legacy Write Authority & Fences
**State:** READY — awaiting explicit implementation authorization.
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
| CP2 | Resolve duplicate School Tasks route authority | Task feature redesign | exact dispatch trace, modular API regression, direct legacy endpoint no-mutation, realtime/audit proof, rollback | CP1 |
| CP3 | Fence only AI task writes that can delegate to TASK-01; retain other AI writes as transitional | New AI/Finance/Document capability | RED direct tool no-mutation, canonical task regression, tenant/role/ID tests; stop if any tool lacks a replacement | CP2 |
| CP4 | Fence IAM legacy administration only when transitional onboarding contract is approved | IAM implementation | unusable-user/divergence characterization, direct API and role escalation negative tests | CP1 |
| CP5 | Classify/fence product-truth local/external persistence claims | Domain replacement work | UI/API no-false-success proof; stop if only operational writer | CP1 |
| CP6 | Finance, Communication, Documents, Teachers, Automations, Approvals decisions | Finance/Academic/etc. implementation | each is transitional or replacement-proven; stop on sole operational writer | CP1 |
| CP7 | AC01–AC08 evidence, lint/build/CI design and factual state | New functionality | all matrix rows closed and each future fence has rollback/tests | CP2–CP6 |

## Fence test contract

Every implementable fence must supply: a RED characterization of the pre-fence write; direct API denial; role, cross-tenant and manipulated-ID negatives; database row-count/fingerprint no-mutation evidence; a canonical-path regression; UI truth/error evidence; rollback verification; lint/build and CI inclusion. UI concealment alone is not evidence.

## CP1 closure evidence

- **AI:** all function declarations and dispatcher branches were traced. Read tools write `operational_logs`; write tools directly mutate legacy tables, without per-tool institutional authorization, transaction or human confirmation. The three other AI endpoints have no persistent write effect in the static baseline.
- **Documents:** Enrollment Document is canonical metadata/state evidence only; it has server tenant policy and transactions but no binary storage/MIME/hash/size model. Generic documents are the only operational generic writer and remain transitional; local/browser and Google paths are prototypes.
- **Tasks:** `npx tsx tests/fnd02-school-tasks-dispatch-characterization.test.ts`: PASS. A real Express app/router registered the real modular routes before duplicate handlers. Overlapping POST/PUT requests reached the modular service; a cross-tenant header was blocked pre-service; a manipulated task ID carried the caller tenant; duplicate handlers received no request.

## Red-team result

No discovered P0/P1 write remains unclassified; no AI tool has an unknown persistent effect; each document path has an owner/treatment or explicit transitional dependency; effective Task dispatch is characterized for the overlapping mutation paths. No planned fence removes a sole operational generic-document, teacher, finance, communication, automation or approval writer. Future fences are constrained to denial/delegation/read-only only where their canonical/treatment contract is proved.

## DoR decision

**READY — awaiting explicit implementation authorization.** CP1 closes the inventory/authority decision required for DoR. Implementation remains prohibited until separately authorized; the first implementation slice is CP2 (School Tasks duplicate-authority fence) only after its stated replacement/delegation decision is explicitly authorized.

## CP6 closure

CP6 classifies all remaining P0/P1 writers as canonical or explicitly transitional. No remaining sole writer is removed: Teachers requires Academic Core; Finance requires ledger authority; Communication requires recipient/delivery authority; generic Documents requires its storage contract; Automations/Approvals require authorized workflow authority; and the SLA worker requires a modular scheduler. This closes AC05 and AC08 for FND-02 without inventing those domains.
