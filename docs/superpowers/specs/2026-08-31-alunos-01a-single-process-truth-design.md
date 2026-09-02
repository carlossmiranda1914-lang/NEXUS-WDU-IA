# ALUNOS-01A — Single Process Truth Design Addendum

**Mission:** ALUNOS-01A — Enrollment-to-Student Continuity & Interaction
**Baseline:** `20cb0a998a16faf97914b9ed5ed9cd29cc9bb417`
**Status:** APPROVED DESIGN ADDENDUM

## Purpose

Remove the remaining cognitive duplication in Alunos & Matrículas without changing canonical domain ownership. The user must perceive one institutional journey, while Enrollment remains server-authoritative and the Process Drawer remains the detailed view of one selected process.

## Frozen product truth

```text
ONE_PRIMARY_LIFECYCLE=YES
LIFECYCLE_AUTHORITY=SERVER_PROCESS_PROJECTION
SECOND_CLIENT_LIFECYCLE=NO
METRIC_CARD_WALL=REMOVE_AS_PROCESS_SURFACE
PROCESS_DRAWER=DETAIL_OF_SELECTED_PROCESS
ACTIVE_STUDENT=RESULT_OF_ACTIVATION
STUDENT_RECORD=LONGITUDINAL_DESTINATION
ANIMATION_CAN_ADVANCE_STATE=NO
SCHEMA_CHANGE=NO
```

## Canonical human journey

`Entrada → Preparação → Documentos → Verificação → Decisão → Ativação → Aluno ativo → Registo do Aluno`

The first six labels are the human presentation of the Enrollment process. `Aluno ativo` is the institutional result of successful activation. `Registo do Aluno` is the longitudinal destination, not another Enrollment stage.

## 1. Single Process Truth

The Overview Journey Rail must derive from the same server-owned process projection used by the selected-process experience: `currentStage`, `stages`, `progress`, `blockers`, `nextAction`, and evidence.

`buildEnrollmentLifecyclePresentation(records, activeStudentCount)` may remain only as a compatibility adapter if it consumes canonical process projections. It must not infer process stages from broad Enrollment status counts as an independent authority.

The current synthetic `Preparação = count: 0` behavior is not an acceptable final representation.

## 2. Human terminology

Backend keys remain unchanged. The UI owns one approved human mapping:

- P01 / intake identity → **Entrada**
- P02 + P03 readiness → **Preparação**
- P04 requirements → **Documentos**
- review state/evidence → **Verificação**
- validated/readiness for decision → **Decisão**
- canonical activation command/result → **Ativação**
- active StudentProfile projection → **Aluno ativo**

Substage labels such as `Dados e relações` and `Oferta e contexto académico` may appear inside the drawer as details of **Preparação**, never as competing top-level journeys.

## 3. Overview composition

The Journey Rail is the only primary process representation.

The existing four large metric cards (`Entradas novas`, `Em andamento`, `Precisam de atenção`, `Prontas para decisão`) must cease to exist as a second process-navigation surface. Useful counts may be absorbed as compact contextual indicators in or adjacent to the Journey Rail, without introducing a second visual cycle.

Selecting a Journey stage filters/navigates to the corresponding factual process set. No stage may be selectable from invented client-only state.

## 4. Process Drawer

Preserve the existing drawer architecture, blockers, next action, evidence, version/concurrency behavior, document checklist and authorized actions.

The drawer must communicate:

1. selected process;
2. current human stage;
3. factual substeps/evidence;
4. blockers;
5. next authorized action.

It must not render a second top-level lifecycle competing with the Journey Rail.

## 5. Activation continuity

Canonical activation authority remains unchanged. A successful activation returns the existing opaque `studentRef` and may trigger a confirmed handoff to **Aluno ativo → Abrir registo do aluno**.

The browser must not correlate by name, class, year, offer or internal IDs.

## 6. Nexus motion and visual language

Motion is semantic and server-confirmed only:

- stage focus/selection;
- drawer enter/exit;
- server-confirmed process-state change;
- successful activation/handoff.

No decorative looping animation. Respect `prefers-reduced-motion`.

Visual direction: premium, calm, alive, minimal cognitive load; graphite depth in dark mode, Nexus green structural accents, selective deep/electric blue energy, semantic amber/red only for factual warnings/errors. Minimalism must not become visually flat.

## 7. Document continuity already frozen

The P0 document-requirements repair at `20cb0a9` is preserved:

- server-owned configuration;
- immutable per-enrollment snapshot;
- real checklist;
- `pending/submitted/verified/rejected` truth;
- fail-closed document gate;
- no physical upload/storage claim.

This tranche must not redesign or replace that authority.

## 8. Out of scope

- physical document upload/storage/versioning;
- post-activation student editing;
- guardian writes;
- academic movements;
- Finance;
- Assessment;
- Attendance;
- Communication;
- AI;
- Dashboard redesign;
- schema changes.

## Acceptance invariants

```text
PROCESS_TRUTH_SOURCE=SERVER_PROCESS_PROJECTION
ONE_PRIMARY_LIFECYCLE=YES
PREPARATION_IS_NOT_SYNTHETIC_ZERO=YES
METRIC_CARD_WALL_AS_PROCESS_SURFACE=NO
DRAWER_IS_PROCESS_DETAIL=YES
HUMAN_TERMINOLOGY_UNIFIED=YES
ACTIVATION_HANDOFF_USES_OPAQUE_STUDENT_REF=YES
SECOND_CLIENT_STATE_MACHINE=NO
MOTION_SERVER_CONFIRMED=YES
REDUCED_MOTION=YES
BACKEND_AUTHORITY_CHANGE=NO
SCHEMA_CHANGE=NO
```
