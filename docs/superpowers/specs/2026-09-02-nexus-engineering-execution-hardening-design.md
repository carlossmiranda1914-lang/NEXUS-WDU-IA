# Nexus Engineering Execution Hardening — Design

**Status:** APPROVED DESIGN
**Date:** 2026-09-02
**Scope:** harden existing Nexus engineering governance without replacing canonical product, architecture, Mission or evidence authorities.

## 1. Problem

Nexus already has strong canonical engineering governance in `AGENTS.md`, `NEXUS_ENGINEERING_OPERATING_SYSTEM.md`, `ENGINEERING_PLAYBOOK.md`, `DEFINITION_READY_DONE_EVIDENCE.md`, and separate Codex/Antigravity adapters. The ALUNOS-01A.3 closeout exposed a remaining weakness: green CI and static source-contract tests can coexist with unresolved stateful product defects and open review findings.

The failure mode is not absence of rules. It is insufficiently explicit coupling between risk, evidence type, tool/agent role, ownership transfer and merge eligibility.

The hardening must prevent the recurring loop:

`implementation -> apparent green -> late finding -> ad-hoc patch -> new late finding`.

It must instead enforce:

`risk classification -> proof design -> single-writer implementation -> independent review -> behavioral/stateful proof -> review adjudication -> integration`.

## 2. Non-goals

- Do not replace the existing engineering operating system.
- Do not create a second authority hierarchy.
- Do not change product architecture or ALUNOS behavior in this governance tranche.
- Do not create a new branch or PR for governance hardening.
- Do not permanently assign Antigravity to frontend or Codex to backend.
- Do not require expensive broad audits for every small change.

## 3. Core execution law: Risk -> Proof -> Tool -> DONE

Every executable task must declare at least one explicit risk/invariant and the proof that closes it.

Required mapping:

| Risk class | Minimum proof | Primary tool/evidence |
| --- | --- | --- |
| Pure structure / static contract | deterministic static contract | source/AST/static test |
| Domain policy | executable unit/domain test | unit/domain runner |
| Stateful UI workflow | ordered behavioral interaction proving state transitions | interaction/component/browser test or human UAT when automation is not available |
| HTTP boundary / authorization | real request/response including negative cases | HTTP integration test |
| Persistence / concurrency / idempotency | disposable PostgreSQL scenario | PostgreSQL integration test |
| Migration/schema | clean ordered chain + checksum/history integrity | isolated migration/bootstrap proof |
| Tenant/privacy boundary | same-tenant allow + cross-tenant/cross-role deny/non-disclosure | HTTP/PostgreSQL security regression |
| Operational documentation/governance | deterministic canonical-source consistency check | governance contract test + review |

A lower proof class may complement a higher one but may not substitute for it. Example: source-string presence cannot prove a stateful user path.

Every task report must state:

`RISKS, REQUIRED_PROOF, TOOLS, EVIDENCE_RESULT, RESIDUAL_RISK, DONE_ELIGIBLE`.

## 4. Single Writer / Independent Reviewer

One code or authority unit has exactly one writer at a time.

Default critical-path allocation:

- ChatGPT + Product Owner: planning, architecture coordination, adjudication, release decision.
- Codex: default implementation owner for approved product/domain/API/migration work unless config assigns otherwise.
- Antigravity: default independent reviewer/auditor for that unit unless config assigns otherwise.
- GitHub/CI: durable evidence and integration gate.

These are defaults, not permanent capability restrictions. Ownership is always task/config driven.

Reviewer mode is read-only until an explicit write transfer occurs.

Required write-lock header:

```text
MISSION=
TASK=
WRITE_OWNER=Codex|Antigravity|Human
REVIEWER=
BASE_SHA=
AUTHORIZED_HEAD=
BRANCH=
WRITE_SCOPE=
FORBIDDEN_SCOPE=
REVIEWER_MODE=READ_ONLY|WRITE_TRANSFERRED
```

If the reviewer discovers that a fix requires writing outside the currently authorized unit, it must stop and report `WRITE_TRANSFER_REQUIRED=YES` with evidence.

## 5. Codex <-> Antigravity conversation protocol

The agents communicate through Git/SHA-bound handoffs, not informal assumptions.

### Implementation handoff

```text
HANDOFF_TYPE=IMPLEMENTATION
MISSION=
TASK=
OWNER=
REVIEWER=
BASE_SHA=
HEAD_SHA=
BRANCH=
IMPLEMENTED=
RISKS_CLOSED=
PROOF_EXECUTED=
PROOF_NOT_RUN=
KNOWN_LIMITATIONS=
AUTHORITY_CHANGED=
SCHEMA_CHANGED=
WORKTREE_CLEAN=
REMOTE_SYNC=
REVIEW_TARGET=
```

### Review handoff

```text
HANDOFF_TYPE=REVIEW
REVIEWED_HEAD=
P0=
P1=
P2=
OBSERVATIONS=
FALSE_POSITIVES=
CONFIRMED_FINDINGS=
DISPROVED_FINDINGS=
TEST_GAPS=
AFFECTED_RISK_CLASS=
MERGE_SAFE=YES|NO
```

### Adjudication handoff

```text
HANDOFF_TYPE=ADJUDICATION
REVIEWED_HEAD=
ACCEPTED_FINDINGS=
REJECTED_FINDINGS=
AUTHORIZED_FIX_SCOPE=
WRITE_OWNER=
REQUIRED_REGRESSION_PROOF=
STOP_CONDITIONS=
```

A reviewer must review the new `HEAD_SHA` after a correction. Previous PASS evidence is reusable only when the new delta cannot invalidate it.

## 6. Review and merge gate

For critical-path product work, merge eligibility requires all applicable conditions:

- applicable local/remote quality gates PASS;
- current HEAD reviewed, not an earlier SHA;
- unresolved P0 = 0;
- unresolved P1 = 0;
- P2 adjudicated and either fixed or explicitly accepted/backlogged according to Definition of Done;
- no unresolved review thread that represents an unadjudicated product/integrity/security/data/governance finding;
- stateful product flows proved behaviorally when risk is stateful;
- Project State / Engineering Config / Mission state are mutually consistent;
- historical applied migrations remain immutable;
- Human UAT remains valid or is rerun when the delta invalidates it.

CI green alone never implies `MERGE_SAFE=YES`.

## 7. Stateful proof rule

For a stateful critical flow, a static source contract may only prove implementation structure. It cannot be the sole release proof.

Examples requiring ordered proof when affected:

- registration save -> server versions refresh -> activation;
- activation -> active status -> Student Record handoff;
- document metadata/policy interactions -> validation gate;
- identity resolution -> review -> evidence revision -> approval/rejection -> intake resume;
- retry/idempotency -> exactly-one persisted outcome;
- cross-tenant direct access -> fail closed/non-disclosing result.

The test must exercise the sequence or the mission must carry an explicit manual/Human UAT proof for that sequence.

## 8. Prompt contract

Implementation prompts must be compact execution contracts, not historical narratives.

Required sections:

1. mission/task and objective;
2. current authoritative SHA/branch;
3. write owner and reviewer mode;
4. risk/invariants;
5. authorized and forbidden scope;
6. required RED/GREEN proof by risk class;
7. evidence that may be reused vs invalidated;
8. stop conditions;
9. commit/push/merge authorization boundaries;
10. exact final handoff schema.

Prompts must not authorize automatic expansion after a new finding.

## 9. Tool discipline

- Brainstorm/design before behavior or architecture changes.
- TDD/contract-first before implementation where applicable.
- Systematic root-cause debugging before patching unexpected failures.
- Independent review before merge.
- Verification-before-completion before claiming PASS/DONE.
- Finishing-development-branch only after current HEAD is actually merge-safe.
- Subagents only for independent uncertainty that materially improves confidence.
- Expensive tests run progressively: targeted -> affected -> aggregate/final.

## 10. Governance consistency

`NEXUS_ENGINEERING_CONFIG.yaml` must always describe the real current mission/task/gate. A stale selector is a release-blocking governance defect for active work because it can redirect future agents into completed implementation.

Canonical documentation must distinguish:

- current authoritative state;
- historical evidence;
- next authorized action.

Contradictory completion claims are not permitted.

## 11. Enforcement

The hardening must be enforced by both prose authority and a deterministic governance contract test that checks the canonical documents for the required concepts/templates. This test is appropriate because the governed artifact is itself textual policy.

The governance contract test does not prove product behavior; it only proves the repository still contains the mandatory operating rules.

## 12. Success criteria

The hardening is complete when:

- existing canonical governance files contain the Risk -> Proof -> Tool -> DONE rule;
- Codex and Antigravity adapters contain explicit single-writer, read-only reviewer and SHA-bound handoff/write-transfer rules;
- merge gate explicitly requires review-thread adjudication and behavioral proof for stateful risks;
- prompt contract is canonicalized;
- a deterministic governance contract test passes;
- lint/build/secret scan remain green;
- no product, migration or ALUNOS runtime file is changed by this governance tranche;
- the new standard is immediately usable to conduct the final ALUNOS-01A.3 hardening pass.
