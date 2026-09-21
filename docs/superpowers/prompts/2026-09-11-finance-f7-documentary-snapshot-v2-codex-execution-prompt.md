# FINANCE-F7 Documentary Snapshot V2 — Codex Execution Prompt

Use this prompt as a single handoff to Codex/agent execution.

---

## MISSION

You are executing a **bounded, high-risk FINANCE/FISCAL migration of documentary snapshot semantics** for Nexus Edu IA.

Your goal is to implement the canonical **Documentary Snapshot V2** contract for all new FINANCE-F7 issuances and corrective issuances **without rewriting historical V1 documents, without weakening existing Finance authorities, without inventing fiscal semantics, and without treating a documentation branch as the execution baseline**.

This mission is not complete because code compiles or tests are green. It is complete only when the V2 contract is implemented on the authoritative current FINANCE-F7 baseline with traceable evidence, real PostgreSQL proof, regression proof, and no unresolved P0/P1.

## CANONICAL AUTHORITIES — READ FIRST

Read these documents completely before changing production code:

1. `docs/superpowers/specs/2026-09-08-finance-f7-financial-documents-design.md`
2. `docs/superpowers/specs/2026-09-11-finance-f7-documentary-snapshot-v2-canonical-contract.md`
3. `docs/superpowers/plans/2026-09-08-finance-f7-implementation-plan.md`
4. applicable Finance constitution / guardrail / handoff documents already authoritative in the repository.

Authority rule:

- The 2026-09-08 F7 design remains authoritative for Finance boundaries, tenant/IAM, issuance, numbering, artifacts and correction architecture.
- The 2026-09-11 V2 contract is the **single canonical authority for snapshot versioning, snapshot content, V1/V2 compatibility, monetary reconciliation boundaries, idempotent replay semantics and corrective snapshot construction**.
- Existing implementation is evidence of current state, not authority to weaken either specification.

## HARD STOP BEFORE CODE — BASELINE RECONCILIATION

The canonical V2 documentation currently exists on a documentation branch. **Do not implement from that documentation branch merely because it contains the newest spec.**

First reconcile the real execution baseline.

Inspect:

- current local branch and SHA;
- `origin/main` SHA;
- all current FINANCE-F7 implementation branches/remotes;
- the branch containing the latest accepted financial-document implementation and UAT fixes;
- whether that implementation is already merged into `main`;
- worktree cleanliness and local/remote parity.

Record exactly:

```text
CURRENT_BRANCH=<value>
LOCAL_SHA=<value>
ORIGIN_MAIN_SHA=<value>
F7_IMPLEMENTATION_BRANCH=<value>
F7_IMPLEMENTATION_SHA=<value>
F7_IMPLEMENTATION_MERGED_TO_MAIN=YES|NO
WORKTREE_CLEAN=YES|NO
LOCAL_REMOTE_PARITY=PASS|FAIL
CANONICAL_V2_SPEC_PRESENT_ON_EXECUTION_BASELINE=YES|NO
```

Then choose the execution baseline using evidence:

1. If accepted FINANCE-F7 implementation is in `main`, branch from current `origin/main`.
2. If accepted FINANCE-F7 implementation is not yet in `main`, branch from the exact accepted F7 implementation SHA after proving remote parity.
3. Bring the V2 canonical spec/plan into the execution branch by a safe non-destructive method if they are not already present.
4. Never force-push, reset shared history, discard uncommitted work, or merge a stale documentation branch wholesale into current implementation merely to obtain the spec.

**STOP and report `BASELINE_BLOCKED`** if the authoritative accepted FINANCE-F7 implementation cannot be uniquely identified.

Required gate before production edits:

```text
BASELINE_PARITY=PASS
WORKTREE_CLEAN=YES
AUTHORITATIVE_F7_BASELINE_IDENTIFIED=YES
V2_SPEC_AVAILABLE_ON_EXECUTION_BRANCH=YES
UNKNOWN_IMPLEMENTATION_PATHS=0
```

## REQUIRED SUPERPOWERS WORKFLOW

Use the installed Superpowers methodology where supported:

1. `using-git-worktrees` before isolated implementation work.
2. `test-driven-development` for each behavioral change.
3. `systematic-debugging` for any unexpected failure; do not patch by guesswork.
4. `requesting-code-review` at meaningful implementation checkpoints.
5. `verification-before-completion` before any final DONE/CLOSED claim.

Do not spawn unnecessary parallel subagents. Prefer one focused execution stream because Finance snapshot/versioning, issuance and correction share state and ordering constraints.

## PHASE 0 — REPOSITORY-FIT MAP

Before writing code, identify the exact current files/interfaces responsible for:

- Financial Document model/types;
- documentary snapshot type/schema;
- issuance command/service;
- issuance repository/transaction;
- Payment loading;
- Obligation loading;
- Allocation loading;
- adjustment/discount/component provenance;
- Financial Profile resolution;
- fiscal/jurisdiction policy resolution;
- fiscal configuration/series;
- idempotency command/result authority;
- correction command/service;
- renderer/PDF artifact generation;
- read/detail projections and client types;
- migrations/schema constraints;
- PostgreSQL harnesses;
- HTTP/IAM tests;
- Finance aggregate tests.

Produce a repository-fit table:

```text
CONCERN | CURRENT_PATH | CURRENT_SYMBOL/INTERFACE | V2_CHANGE_REQUIRED=YES|NO | NOTES
```

Search specifically for legacy behavior where a corrective document reuses/copies the original `documentary_snapshot`. If found, record exact path/symbol and classify it as:

```text
GAP_ID=F7-V2-CORRECTION-SNAPSHOT-REUSE
CURRENT_BEHAVIOR=<evidence>
CANONICAL_REQUIRED_BEHAVIOR=NEW_CORRECTIVE_V2_SNAPSHOT
SEVERITY=P1
```

Do not change code until the map has `UNKNOWN_IMPLEMENTATION_PATHS=0`.

## PHASE 1 — CHARACTERIZE V1 AND FREEZE COMPATIBILITY

Before introducing V2, write focused characterization tests for historical V1 behavior.

Must prove:

- existing V1 rows remain readable;
- existing V1 artifacts/rendering remain reproducible under current historical semantics;
- V1 rows are not rewritten during migration/startup/read;
- API/read projections expose or can deterministically derive snapshot version without guessing;
- a V1 original may later be corrected by a new V2 corrective document while the V1 original remains byte/semantic stable.

Run tests and capture RED/GREEN evidence as appropriate. Do not change historical values merely to make V1 look like V2.

## PHASE 2 — INTRODUCE EXPLICIT SNAPSHOT VERSIONING

Implement explicit version discrimination.

Canonical law:

```text
SNAPSHOT_V1=HISTORICAL_READ_COMPATIBILITY
SNAPSHOT_V2=CANONICAL_NEW_WRITE_FORMAT
V1_NEW_WRITES_AFTER_CUTOVER=FORBIDDEN
SILENT_FALLBACK_TO_V1=FORBIDDEN
```

Requirements:

- introduce repository-appropriate discriminated types (`DocumentarySnapshotV1`, `DocumentarySnapshotV2`, union/decoder as appropriate);
- V2 must carry `snapshotVersion = 2` explicitly;
- historical V1 decoder must remain supported;
- read model/renderer must dispatch by version explicitly;
- additive schema/migration only unless current storage already supports versioned JSON without schema change;
- no in-place rewrite/backfill of historical V1 issued documents.

Use TDD: failing tests first, then minimal implementation.

## PHASE 3 — BUILD V2 FROM AUTHORITATIVE FINANCE FACTS

Implement one server-side V2 builder. Browser payload must never authoritatively supply V2 monetary/fiscal truth.

The builder must freeze, where applicable to document type/policy:

- document type, issued time, currency;
- issuer;
- recipient;
- beneficiary / billing party / payer when distinct;
- operation context;
- each represented obligation;
- obligation components;
- each component's provenance when rule/version backed;
- confirmed payment identity/state/time/method/reference as allowed;
- canonical `allocations[]`;
- `before`, `movement`, `after` for each allocation;
- unallocated amount when relevant;
- totals;
- tax;
- jurisdiction;
- legal mentions;
- correction metadata when applicable;
- policy provenance: Financial Profile version, jurisdiction policy/adapter version, fiscal configuration version, series identity/version and materially relevant discount/adjustment/rule versions.

Do not invent source components, obligations, allocations, discounts, fees or tax classifications to force reconciliation.

## PHASE 4 — MONEY AND ALLOCATION RECONCILIATION

Use existing exact Money / exact-decimal authority. Never introduce binary floating point into canonical Finance calculations.

Implement explicit reconciliation tests for:

### A. Partial payment

For every allocation under the repository's chosen signed convention:

```text
before - movement = after
```

or the exact equivalent already established by Finance. Use one convention only and document it in tests.

### B. One payment across multiple obligations

A single confirmed Payment allocated across N obligations must produce N canonical allocation entries. Do not collapse them into one synthetic obligation.

### C. Unallocated payment value

Where payment value exceeds represented allocations and policy permits/needs the residual:

```text
sum(allocation movement) + unallocated = represented payment amount
```

The residual must stay explicit. Do not fabricate an allocation to make it disappear.

### D. Obligation component totals

Document totals must reconcile from the frozen authoritative component set according to the document type and jurisdiction policy.

Any mismatch fails closed.

## PHASE 5 — FOUR VALIDATION BOUNDARIES

Implement/identify four explicit validations. They may be separate functions/services or clear stages in an existing service, but tests must prove them independently.

1. **Structural validation** — version/shape, required identifiers, currency consistency, duplicate/ambiguous relation rejection, internal allocation coherence.
2. **Financial reconciliation validation** — V2 candidate against authoritative reloaded Obligation/Payment/Allocation/component truth.
3. **Document-type validation** — selected document type is eligible for source state and type-required V2 fields exist.
4. **Jurisdiction validation** — adapter/policy validates required fiscal fields, series restrictions, tax/document rules, legal mentions and correction eligibility.

Required law:

```text
STRUCTURAL_PASS != FINANCIAL_PASS != DOCUMENT_TYPE_PASS != JURISDICTION_PASS
```

Write a failing test for each boundary that proves the specific failure blocks issuance.

## PHASE 6 — VALIDATE BEFORE DEFINITIVE NUMBER

Reconcile with existing transaction/lock ordering without weakening concurrency safety.

Required semantic order:

```text
intent
-> server institution/capability
-> idempotency lookup
-> effective profile/policy/config
-> reload authoritative Finance facts
-> build V2 candidate
-> structural validation
-> financial reconciliation
-> document-type validation
-> jurisdiction validation
-> canonical transaction/locks
-> allocate definitive number
-> persist document + V2 snapshot + provenance + audit/outbox atomically
-> commit
-> authoritative read
```

Prove with tests that structural, financial, document-type and jurisdiction failures do **not** consume a definitive number.

Preserve existing F7 concurrency/lock invariants. Do not move critical reads outside safe concurrency control simply to satisfy the textual ordering; if current architecture requires lock-protected reload/revalidation, preserve that and document the exact safe ordering.

## PHASE 7 — IDEMPOTENT REPLAY MUST NOT REBUILD

Canonical rule:

```text
IDEMPOTENT_REPLAY_REBUILDS_SNAPSHOT=NO
```

Test sequence:

1. issue valid V2 document;
2. capture exact persisted V2 snapshot;
3. legitimately change live source/profile/config data afterward;
4. replay same accepted idempotency identity;
5. prove returned canonical document references the original persisted snapshot exactly;
6. prove no second document/number was created;
7. prove no V2 rebuild occurred from current live data.

Mismatched idempotency fingerprint must follow existing Finance rejection semantics.

## PHASE 8 — CORRECTION MUST BUILD NEW V2 SNAPSHOT

This phase is mandatory even if current correction tests pass.

Canonical rule:

```text
CORRECTION_REWRITES_ORIGINAL=NO
CORRECTION_REUSES_ORIGINAL_SNAPSHOT_AS_NEW_TRUTH=NO
CORRECTION_NEW_V2_SNAPSHOT=REQUIRED
```

Implement TDD for both cases:

### A. V1 original -> V2 correction

- original V1 remains unchanged;
- corrective command reloads current authoritative corrective facts;
- corrective document gets its own V2 snapshot;
- V2 correction carries first-class relationship/provenance to original V1;
- renderer/read model can navigate original -> correction and correction -> original.

### B. V2 original -> V2 correction

- original V2 remains unchanged;
- correction gets a distinct V2 snapshot built for the correction itself;
- do not byte-copy or semantic-copy the original snapshot as the correction's current truth;
- only legitimate original references/provenance are carried forward.

If current implementation literally reuses `original.documentary_snapshot`, replace that behavior with the canonical builder path and prove the regression.

## PHASE 9 — RENDERER AND READ-MODEL COMPATIBILITY

Renderer requirements:

- explicit version dispatch;
- V1 continues to render historically;
- V2 renders authoritative values from the immutable V2 snapshot/provenance only;
- V2 renderer does not reload mutable Payment/Obligation/Allocation/profile/config values to recalculate official totals;
- official financial documents remain read-only and expose no Office editing path.

Read/API requirements:

- expose `snapshotVersion` or an equally explicit versioned projection;
- preserve tenant-safe/non-disclosing access;
- preserve source and correction navigation without leaking foreign-tenant IDs/data.

## PHASE 10 — POSTGRESQL / ROLLBACK / RESTART PROOF

Run real PostgreSQL tests proving:

- V2 persistence survives restart exactly;
- failed issuance leaves no partial document/snapshot/provenance/audit/outbox state;
- failed pre-number validation consumes no definitive number;
- transaction failure after number lock/allocation follows the already approved F7 series-gap policy and does not fabricate document success;
- tenant A cannot reference/read tenant B V2 source, provenance, original/correction or artifact identifiers;
- historical V1 remains unchanged after migrations and restart.

Do not weaken DB constraints merely to allow both versions.

## PHASE 11 — REQUIRED TEST MATRIX

At minimum prove all of the following with exact command/result evidence:

```text
V2_NEW_ISSUANCE=PASS
V1_HISTORICAL_READ=PASS
V1_HISTORICAL_RENDER=PASS
V1_NOT_REWRITTEN=PASS
V2_PARTIES=PASS
V2_OBLIGATION_COMPONENTS=PASS
V2_COMPONENT_PROVENANCE=PASS
PARTIAL_PAYMENT_BEFORE_MOVEMENT_AFTER=PASS
MULTI_OBLIGATION_PAYMENT=PASS
UNALLOCATED_VALUE=PASS
STRUCTURAL_VALIDATION=PASS
FINANCIAL_RECONCILIATION=PASS
DOCUMENT_TYPE_VALIDATION=PASS
JURISDICTION_VALIDATION=PASS
PRE_NUMBER_FAILURE_NO_CONSUMPTION=PASS
IDEMPOTENT_REPLAY_NO_REBUILD=PASS
V1_TO_V2_CORRECTION=PASS
V2_TO_V2_CORRECTION=PASS
ORIGINAL_IMMUTABILITY=PASS
V2_RENDER_FROM_SNAPSHOT_ONLY=PASS
ROLLBACK_ATOMICITY=PASS
RESTART_PERSISTENCE=PASS
TENANT_ISOLATION=PASS
```

Then run the relevant existing FINANCE-F7 tests, Finance aggregate regression, Foundation regression, lint, build and `git diff --check`.

Use the repository's canonical test commands discovered during Phase 0. Do not invent duplicate aggregate runners if one already exists.

## PHASE 12 — CHANGE BOUNDARIES

Allowed changes are only those required for V2 snapshot semantics and their direct tests/migrations/projections/rendering.

Do not opportunistically refactor:

- Payment authority;
- Obligation authority;
- Allocation authority;
- Journal authority;
- Finance Money primitives;
- IAM framework;
- InstitutionalContext;
- generic Documents Foundation;
- unrelated Finance UX;
- Microsoft 365 integration;
- legacy modules unrelated to the proven V2 path.

If a required V2 invariant cannot be implemented without changing one of those authorities, **STOP** and report the architectural conflict before editing it.

## PHASE 13 — COMMITS

Prefer small reviewable commits following TDD boundaries. Suggested sequence, adjusted only to exact repository fit:

```text
test(finance): characterize documentary snapshot v1 compatibility
feat(finance): add documentary snapshot v2 model
feat(finance): build v2 snapshot from authoritative finance facts
feat(finance): validate v2 documentary reconciliation before numbering
fix(finance): preserve issued snapshot on idempotent replay
fix(finance): build independent v2 snapshot for corrections
feat(finance): render versioned financial document snapshots
test(finance): prove v2 postgres persistence and isolation
```

Do not combine unrelated cleanup with these commits.

## PHASE 14 — REVIEW GATES

After each material phase, inspect the diff for these forbidden outcomes:

- V1 historical rewrite;
- browser-authored financial truth;
- float-based money arithmetic;
- synthesized allocations/components;
- snapshot rebuilt during replay;
- original snapshot reused as correction truth;
- definitive number allocated before failed validations that can occur pre-number;
- current profile/config substituted for historical provenance;
- renderer reading mutable live Finance data for official values;
- tenant scope derived from browser input;
- weakening of existing F7 immutability/idempotency/concurrency guarantees.

Any occurrence is P0/P1 depending on impact and blocks completion.

## PHASE 15 — FINAL EVIDENCE REPORT

Before claiming completion, run fresh verification and output exactly this structure with real values, commands and SHAs — never placeholders or inferred PASS:

```text
MISSION=FINANCE-F7-DOCUMENTARY-SNAPSHOT-V2
EXECUTION_BRANCH=<branch>
BASE_SHA=<sha>
FINAL_SHA=<sha>
REMOTE_SHA=<sha>
REMOTE_PARITY=PASS|FAIL
WORKTREE_CLEAN=YES|NO

CANONICAL_V2_CONTRACT=PASS|FAIL
V1_HISTORY_PRESERVED=PASS|FAIL
V2_NEW_WRITE_ONLY=PASS|FAIL
V2_AUTHORITATIVE_BUILDER=PASS|FAIL
V2_PARTIES=PASS|FAIL
V2_OBLIGATION_COMPONENTS=PASS|FAIL
V2_COMPONENT_PROVENANCE=PASS|FAIL
PARTIAL_PAYMENT_MODEL=PASS|FAIL
MULTI_OBLIGATION_ALLOCATION=PASS|FAIL
UNALLOCATED_VALUE_PRESERVED=PASS|FAIL
STRUCTURAL_VALIDATION=PASS|FAIL
FINANCIAL_RECONCILIATION=PASS|FAIL
DOCUMENT_TYPE_VALIDATION=PASS|FAIL
JURISDICTION_VALIDATION=PASS|FAIL
VALIDATION_BEFORE_NUMBERING=PASS|FAIL
IDEMPOTENT_REPLAY_NO_REBUILD=PASS|FAIL
V1_TO_V2_CORRECTION=PASS|FAIL
V2_TO_V2_CORRECTION=PASS|FAIL
ORIGINAL_DOCUMENT_IMMUTABLE=PASS|FAIL
V1_RENDER_COMPATIBILITY=PASS|FAIL
V2_RENDER_FROM_IMMUTABLE_SNAPSHOT=PASS|FAIL
POSTGRESQL_AUTHORITY=PASS|FAIL
ROLLBACK_ATOMICITY=PASS|FAIL
RESTART_PERSISTENCE=PASS|FAIL
TENANT_ISOLATION=PASS|FAIL
FINANCE_F7_REGRESSION=PASS|FAIL
FINANCE_REGRESSION=PASS|FAIL
FOUNDATION_REGRESSION=PASS|FAIL
LINT=PASS|FAIL
BUILD=PASS|FAIL
DIFF_CHECK=PASS|FAIL

UNPROVEN_REQUIREMENTS=<integer>
P0_OPEN=<integer>
P1_OPEN=<integer>

FILES_CHANGED:
- <exact path>

TEST_EVIDENCE:
- <exact command> => <result>

BLOCKERS:
- NONE
```

Final success is allowed only if:

```text
UNPROVEN_REQUIREMENTS=0
P0_OPEN=0
P1_OPEN=0
REMOTE_PARITY=PASS
WORKTREE_CLEAN=YES
```

If any one is false, do not output DONE. Output `MISSION_STATUS=BLOCKED` or `MISSION_STATUS=INCOMPLETE` with direct evidence and the smallest next action.

## ABSOLUTE EXECUTION RULE

**Do not ask the Product Owner to decide implementation details already resolved by the canonical V2 contract. Do not guess unresolved legal or architectural facts. Work until every resolvable requirement is implemented and verified; stop only for a genuine authority conflict, legal-evidence gap, inaccessible dependency, or ambiguous baseline that cannot be resolved from repository evidence.**

---

End of single execution prompt.
