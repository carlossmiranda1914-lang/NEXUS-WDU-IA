# FND-02 — Legacy Write Authority & Fences

**State:** IMPLEMENTING — CP7 validation found remaining reachable P0 fence candidates; see the final validation record in `FND-02_DOR_EVIDENCE.md`.

**Current evidence:** `docs/roadmap/missions/FND-02_DOR_EVIDENCE.md` and `docs/audit/FND-02_AUTHORITY_MATRIX.md`. The 2026-08-24 CP1 characterization closes AI tool effects, document-target partitioning and overlapping School Tasks dispatch. CP2–CP6 are implemented locally; CP7 cannot close while the stated P0 fence candidates below remain reachable.

## Objective
Produce a complete, evidence-backed map of persistent write authority for current P0/P1 capabilities and prevent legacy paths from competing with canonical vNext sources without deleting still-required operational behavior.

## Origin
AUD-IAM-001/003, AUD-DUPLICATE-ROUTES-001, legacy Student/Finance/Document findings, `docs/audit/LEGACY_REPLACEMENT_MAP.md`, Master Plan v2 backend-authority principle, and Architecture TO-BE v2 domain-authority boundaries.

## Dependency
- FND-01 must be DONE before any fence that depends on stable schema/runtime authority is implemented.
- If a candidate legacy write has no proven canonical replacement, FND-02 may classify and constrain it but must not invent that replacement inside this mission.

## Preserve
- canonical Person / Identity / Membership authority;
- vNext Enrollment and StudentProfile invariants;
- tenant-safe School Tasks repository/service behavior;
- current operational capability that has no safe replacement yet, only as explicitly transitional authority;
- factual compatibility reads needed during migration.

## IN
Inventory every active persistent mutation path for:
- identity/users and institutional access;
- students / StudentProfile / enrollment activation;
- teachers and academic-context writes that currently exist;
- finance;
- documents/files;
- School Tasks;
- communication;
- configuration and other P0/P1 operational paths discovered during preflight.

For each mutation path record:
1. user/UI/API entrypoint;
2. route/controller/application service;
3. repository/storage target;
4. persistent objects changed;
5. actor and tenant-context source;
6. current callers;
7. canonical domain owner;
8. classification: `CANONICAL`, `TRANSITIONAL`, `DUPLICATE`, `PROTOTYPE`, or `DEAD`;
9. treatment: `PRESERVE`, `READ-ONLY`, `FENCE`, `REPLACE-LATER`, or `REMOVE`;
10. prerequisite/reconciliation dependency and rollback consequence.

Fences may include route removal, write denial, server-side guard, feature disablement, or delegation to the canonical command, but only when the replacement path and regression coverage are proven.

## OUT
- implementing missing IAM, Academic Core, Finance Core, Communication or general Documents redesign;
- repository-wide refactor;
- deletion of legacy reads solely for code cleanliness;
- data migration that cannot be proven additive/safe within the active capability;
- changing canonical domain ownership established by Architecture TO-BE v2.

## Required preflight / evidence
Before code changes:
- inventory must identify all known write entrypoints and callers for the targeted capability;
- canonical owner and replacement status must be explicit;
- duplicate authority must be reproduced by test or traceable code evidence;
- affected data/schema dependencies must be known;
- the proposed fence must have an immediate negative/regression test and rollback path.

## Acceptance criteria
- **AC01 Authority inventory:** every active P0/P1 persistent write path is classified with owner, callers, target data and treatment.
- **AC02 No undocumented dual writes:** no P0/P1 capability retains two undocumented authoritative mutation paths.
- **AC03 Canonical preservation:** canonical vNext paths continue to satisfy their existing invariants and tests.
- **AC04 Fence enforcement:** every path classified `FENCE` or `READ-ONLY` is proven unable to regain persistent write authority through direct API invocation.
- **AC05 Transitional safety:** any retained legacy write is explicitly `TRANSITIONAL`, has a named replacement dependency, and is not consumed by new features.
- **AC06 Tasks convergence:** duplicate School Tasks/server mutation authority is resolved without breaking the tenant-safe repository/service path.
- **AC07 IAM boundary:** legacy user administration cannot silently supersede canonical Person/Identity/Membership authority.
- **AC08 No invented replacement:** missing future-domain functionality is returned as a prerequisite/blocker rather than implemented opportunistically.

## Required tests / evidence
- focused tests for each changed fence/delegation;
- direct API negative tests for fenced writes;
- tenant and authorization regressions where the path is institution-scoped;
- persistence proof showing the prohibited path produces no unauthorized mutation;
- existing canonical-domain regressions for every affected capability;
- TypeScript/build and applicable CI gates;
- authority matrix with AC-to-evidence references.

## DONE
FND-02 is DONE only when AC01–AC08 are PASS, no critical caller is unclassified, every changed write path has executable negative/regression proof, and the remaining transitional authorities are explicit dependencies for later missions rather than hidden competitors.

## Stop rules
Stop and return to BLOCKED/PREPARATION if:
- a persistent write caller or data owner cannot be classified;
- removing/fencing a path would destroy the only operational implementation of a required capability;
- safe fencing requires implementing an unrelated future domain;
- data reconciliation ownership is ambiguous;
- the change would alter tenancy, IAM or domain authority beyond the canonical architecture.
