# DOC-AUDIT-01 — Documentation Register

**Status:** active consolidation register  
**Rule:** classification precedes deletion.

## 1. Canonical / keep and evolve

| Path | Decision | Reason |
|---|---|---|
| `docs/README.md` | CREATE / CANONICAL | single entrypoint and authority hierarchy |
| `docs/product/NEXUS_MASTER_PLAN_V2.md` | CREATE / CANONICAL | current market-informed product direction |
| `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md` | CREATE / CANONICAL | current target architecture |
| `docs/audit/AUDIT_01_TECHNICAL_BASELINE.md` | CREATE / CANONICAL | factual AS-IS planning baseline |
| `docs/audit/LEGACY_REPLACEMENT_MAP.md` | CREATE / CANONICAL | capability-by-capability migration authority |
| `docs/roadmap/IMPLEMENTATION_PLAN_VNEXT_V2.md` | CREATE / CANONICAL | ordered execution strategy |
| `docs/roadmap/missions/FND-01.md` … `FND-06.md` | CREATE / ACTIVE | first executable tranche; implementation remains gated |
| `docs/DEFINITION_READY_DONE_EVIDENCE.md` | KEEP / UPDATE | strong gates; replace Codex-specific wording with tool-neutral agent/implementation language over time |
| `docs/ARCHITECTURE_V4.md` | KEEP / MERGE LATER | strong principles; TO-BE V2 becomes primary, V4 remains supporting until reconciled line-by-line |
| `docs/operations/ENGINEERING_PLAYBOOK.md` | KEEP / UPDATE | general engineering process remains useful |
| `docs/operations/PROJECT_STATE.md` | UPDATE | must reflect frozen checkpoint, AUDIT-01 and current documentation phase |

## 2. Duplicate / conflicting identifiers

| Path | Decision | Reason |
|---|---|---|
| `docs/architecture/ADR-001-institutional-context.md` | RENUMBER or MERGE | shares ADR-001 identifier with another distinct ADR |
| `docs/architecture/ADR-001-institutional-identity-membership.md` | KEEP CONTENT / RENUMBER SET | substantial identity decision; duplicate numbering makes references ambiguous |

No ADR is deleted until references are checked. Establish a unique ADR sequence during the archival pass.

## 3. Historical mission material

The following are evidence of prior implementation and should not govern the new roadmap directly:

- `docs/MISSION_01_EXECUTION_PACK.md`
- `docs/missions/MISSION_01_CLOSEOUT.md`
- `docs/missions/MISSION_01_READINESS.md`
- `docs/missions/MISSION_03_EXECUTION_PLAN.md`
- `docs/missions/MISSION_03_PROGRESS_2026-08-11.md`
- `docs/missions/MISSION_04_PERSISTENCE_VALIDATION.md`
- `docs/missions/MISSION_05_REALTIME_ISOLATION.md`
- `docs/missions/MISSION_06_AUDIT_OBSERVABILITY.md`
- `docs/missions/MISSION_07_FOUNDATION_BASELINE.md`
- `docs/missions/MISSION_08_EXECUTION_LOG.md`
- `docs/missions/MISSION_08_MATRICULA_STUDENT_360.md`

**Decision:** ARCHIVE after verifying no active workflow depends on the path. Their evidence remains valuable for audit/history.

## 4. Product Mission 08A/08B documents

`docs/product/` contains the Student360 blueprint, multiple D01–D06 identity decisions, Person Resolution contract, ready-gate review and T4/T5/T6 micro-gate/evidence templates.

**Decision:**

- preserve substantive identity decisions and Person Resolution contract as SUPPORTING/ADR material;
- Student 360 blueprint remains PROTOTYPE/BLUEPRINT, not implemented product authority;
- move completed micro-gates/evidence templates to archive after extracting any still-canonical rule;
- do not let `MISSION_08*` naming imply they remain the active implementation roadmap.

## 5. Planning documents

| Path | Decision | Reason |
|---|---|---|
| `docs/product/NEXUS_MASTER_PLANNING_V1.md` | SUPERSEDE → ARCHIVE | valuable prior plan, but market/audit/roadmap updates now require v2 |
| `docs/product/NEXUS_OPERATIONAL_MAP_V1.md` | SUPPORTING / REVIEW | retain operational flows that remain valid; reconcile against Master Plan v2 |
| `docs/product/NEXUS_CANONICAL_SOURCES.md` | MERGE into `docs/README.md` then ARCHIVE | avoid competing source-of-truth hierarchies |
| `docs/product/NEXUS_ENROLLMENT_VERTICAL_VNEXT_CONSTITUTION.md` | SUPPORTING | valuable vertical constitution; cannot override platform TO-BE |
| `docs/product/NEXUS_EXPERIENCE_GUIDANCE_MODEL_V1.md` | SUPPORTING / UPDATE | reconcile with benchmark-derived Task-First/Context-First rules |

## 6. Codex-specific workflow documents

| Path | Decision | Reason |
|---|---|---|
| `docs/WORKFLOW_CODEX.md` | SUPERSEDE / ARCHIVE after extraction | current project cannot depend on Codex availability; principles remain valid but workflow must be tool-neutral |
| `docs/MISSION_CODEX_TEMPLATE.md` | SUPERSEDE | replaced by canonical Mission Pack format |
| `docs/templates/CODEX_PROMPT_TEMPLATE.md` | ARCHIVE | historical/tool-specific helper |
| `docs/operations/AGENT_TRAINING_AUTOMATION.md` | REVIEW / likely ARCHIVE | not part of immediate canonical implementation governance |

## 7. Small execution artifacts

Examples such as `docs/operations/S02_3_2_DOCUMENT_REQUIREMENTS_GATE.md` and `MISSION_08B1_T*_MICRO_GATE/EVIDENCE_TEMPLATE.md` should be moved to mission-specific historical evidence rather than remain mixed with canonical product/operations documentation.

## 8. Readiness/status documents

`docs/MVP_READINESS_SCORECARD.md` must be re-evaluated against AUDIT-01. Any old score that predates the new findings cannot be treated as current release readiness.

## 9. Delete policy

At this stage DOC-AUDIT-01 authorizes **no destructive deletion of historically meaningful files**. First create the canonical set and archive map. Permanent deletion can occur in a second documentation PR only for exact duplicates, generated/transient artifacts or files proven to have no evidentiary value.
