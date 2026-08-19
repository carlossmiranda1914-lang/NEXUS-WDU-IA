# DOC-AUDIT-01 — Documentation Register

**Status:** active consolidation register — second rigorous pass  
**Rule:** classify → reconcile → preserve authority/evidence → archive/retire → only then consider permanent deletion.

## 1. Current canonical authority

| Path | State | Decision |
|---|---|---|
| `docs/README.md` | CANONICAL | single repository entrypoint/hierarchy |
| `docs/product/NEXUS_MASTER_PLAN_V2.md` | CANONICAL | market-informed product direction |
| `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md` | CANONICAL | target architecture |
| `docs/architecture/ADR-001-institutional-context.md` | ACCEPTED ADR | institutional-context decision |
| `docs/audit/AUDIT_01_TECHNICAL_BASELINE.md` | CANONICAL | factual AS-IS planning baseline |
| `docs/audit/LEGACY_REPLACEMENT_MAP.md` | CANONICAL | capability migration authority |
| `docs/roadmap/IMPLEMENTATION_PLAN_VNEXT_V2.md` | CANONICAL | implementation order |
| `docs/roadmap/missions/FND-01.md` … `FND-06.md` | PREPARATION | planned first tranche; no code authority yet |
| `docs/templates/MISSION_PACK_TEMPLATE.md` | CANONICAL TEMPLATE | tool-neutral traceable mission format |
| `docs/operations/IMPLEMENTATION_WORKFLOW.md` | CANONICAL | tool-neutral implementation workflow |
| `docs/operations/PROJECT_STATE.md` | CANONICAL FACTUAL STATE | reconciled to frozen #65/AUDIT-01/#66 |
| `docs/DEFINITION_READY_DONE_EVIDENCE.md` | CANONICAL GATES | retain; remove remaining tool-specific wording in later focused edit if present |

## 2. Supporting documents

| Path | State | Required reconciliation |
|---|---|---|
| `docs/ARCHITECTURE_V4.md` | SUPPORTING | strong established principles; TO-BE v2 prevails on conflict; later line-by-line absorption can retire V4 |
| `docs/operations/ENGINEERING_PLAYBOOK.md` | SUPPORTING | compatible with tool-neutral workflow; avoid duplicate authority |
| `docs/product/NEXUS_OPERATIONAL_MAP_V1.md` | SUPPORTING | preserve valid operational flows; Master Plan v2 prevails |
| `docs/product/NEXUS_ENROLLMENT_VERTICAL_VNEXT_CONSTITUTION.md` | SUPPORTING DOMAIN CONSTITUTION | Enrollment-specific detail cannot override platform TO-BE |
| `docs/product/NEXUS_EXPERIENCE_GUIDANCE_MODEL_V1.md` | SUPPORTING | reconcile with Task-First/Context-First benchmark decisions |
| Student 360 blueprint | PROTOTYPE/BLUEPRINT | design input only until canonical domains/read model exist |
| Person Resolution/identity D01–D06 decisions | SUPPORTING | preserve substantive identity reasoning; accepted/current architecture prevails |

## 3. Resolved authority conflicts in this pass

### Duplicate ADR-001
Resolved. `ADR-001-institutional-context.md` remains the accepted ADR. The earlier 2026-08-09 identity/membership proposal is preserved as `ADR-000-institutional-identity-membership-proposal.md` with SUPERSEDED PROPOSAL status. The ambiguous duplicate `ADR-001-institutional-identity-membership.md` path was retired.

### Codex-specific workflow authority
Resolved. `docs/WORKFLOW_CODEX.md` was retired from the active tree after its durable rules were incorporated into `docs/operations/IMPLEMENTATION_WORKFLOW.md`. An archive marker exists under `docs/archive/tooling/` and full text remains in Git history.

### Codex mission template
Resolved. `docs/MISSION_CODEX_TEMPLATE.md` was retired and replaced by `docs/templates/MISSION_PACK_TEMPLATE.md`; archive marker retained.

### Competing canonical-source hierarchy
Resolved. `docs/product/NEXUS_CANONICAL_SOURCES.md` was retired because it still elevated old planning/architecture/Codex sources as canonical peers. Durable invariants and Drive-reference rules were preserved in the new hierarchy/archive marker.

### Master Planning v1 claiming canonical status
Resolved. Active path retired; superseded marker placed under `docs/archive/planning/`. Master Plan v2 is authoritative.

### Project state
Resolved. `PROJECT_STATE.md` no longer presents S03/#62 as the active priority; it records frozen #65, AUDIT-01, DOC-AUDIT-01/#66 and Foundation convergence as planned but not authorized.

## 4. Historical mission material — next archival batch

These remain historically valuable but must not stay mixed with active mission authority:

- `docs/MISSION_01_EXECUTION_PACK.md`;
- `docs/missions/MISSION_01_CLOSEOUT.md`;
- `docs/missions/MISSION_01_READINESS.md`;
- `docs/missions/MISSION_03_EXECUTION_PLAN.md`;
- `docs/missions/MISSION_03_PROGRESS_2026-08-11.md`;
- `docs/missions/MISSION_04_PERSISTENCE_VALIDATION.md`;
- `docs/missions/MISSION_05_REALTIME_ISOLATION.md`;
- `docs/missions/MISSION_06_AUDIT_OBSERVABILITY.md`;
- `docs/missions/MISSION_07_FOUNDATION_BASELINE.md`;
- `docs/missions/MISSION_08_EXECUTION_LOG.md`;
- `docs/missions/MISSION_08_MATRICULA_STUDENT_360.md`.

Decision: move/archive only after checking repository references so links/evidence are not silently broken.

## 5. Product 08A/08B evidence

Preserve substantive Person Resolution/identity decisions. Reclassify Student 360 as blueprint, not implemented capability. Move completed micro-gates/evidence templates to historical evidence after confirming no current doc links depend on their active path.

## 6. Tooling/automation docs still requiring review

- `docs/templates/CODEX_PROMPT_TEMPLATE.md` → likely archive after reference check;
- `docs/operations/AGENT_TRAINING_AUTOMATION.md` → review against current governance; likely historical/tooling unless an active workflow still consumes it.

## 7. Readiness/status

`docs/MVP_READINESS_SCORECARD.md` cannot represent current pilot/release readiness until recalculated against AUDIT-01 P0/P1 findings and Foundation convergence. It must be explicitly marked historical/stale or replaced by a new scorecard; do not silently reuse the old score.

## 8. Delete policy

This pass performed only **authority-retiring deletions from active paths after preserving the historical meaning in Git history/archive markers**. No substantive historical evidence was destroyed. Permanent deletion of full historical evidence remains restricted to exact duplicates, generated/transient artifacts or content proven to have no evidentiary value.

## 9. Remaining DOC-AUDIT-01 closure criteria

Before declaring documentation consolidation DONE:

1. reference-check and archive historical Mission 01–08 files;
2. classify/archive remaining 08B micro-gates/evidence templates;
3. resolve Codex prompt/agent-training remnants;
4. reassess `MVP_READINESS_SCORECARD.md`;
5. reconcile `ARCHITECTURE_V4.md` and Definition gates for duplicate/tool-specific authority;
6. verify internal links after moves;
7. review PR #66 diff for accidental implementation/code changes — expected result: documentation only;
8. keep PR draft until this register and canonical index match the actual tree.
