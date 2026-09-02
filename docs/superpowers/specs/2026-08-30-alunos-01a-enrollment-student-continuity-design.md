# ALUNOS-01A — Enrollment-to-Student Continuity & Interaction

**Status:** DESIGN APPROVED — planning required before implementation
**Date:** 2026-08-30
**Baseline:** `main@f945fe43d72e9f86078a184d557691e1c32d4b63`
**Program position:** bounded prerequisite/refinement before Finance Core

## 1. Product decision

Nexus presents one principal **Alunos** experience to the institution. Enrollment remains the canonical temporal process and Student Record remains an authorized longitudinal read projection; the product must make them feel like one continuous school workflow without collapsing domain ownership.

The mission refines and complements the approved implementation. It is not a rewrite.

**Preserve first. Refine second. Add only where the real workflow requires it.**

## 2. Problem

The existing Alunos & Matrículas workspace already contains strong real process behavior, an operational drawer, canonical activation, Active Students and Student Record. However, the experience can still feel like adjacent views/cycles rather than one continuous lifecycle. Activation should become an explicit handoff from process to active student, and the existing visual/process language should become clearer, more alive and more coherent without inventing state or replacing approved behavior.

## 3. User mental model

One lifecycle:

`Entrada → Preparação → Documentos → Verificação → Decisão → Ativação → Aluno ativo → Registo do Aluno`

The first six stages describe the temporal enrollment process. **Aluno ativo is the institutional result, not a second competing pipeline stage.** Student Record is the longitudinal destination after activation.

Views such as Visão Operacional, Entradas, Matrículas and Alunos ativos are lenses over this lifecycle, not separate authorities.

## 4. KEEP — mandatory preservation

Preserve unless a proven defect requires a scoped correction:

- canonical Enrollment authority and lifecycle;
- existing atomic activation behavior and its audit/ledger guarantees;
- existing process projection, real blockers, next actions and stage evidence;
- existing operational drawer and its useful information architecture;
- Active Students as a distinct authorized projection rather than enrollment rows;
- opaque `studentRef` and current Student Record boundary;
- existing Student Record sections and read-only cross-domain model;
- PostgreSQL/backend authority, tenant isolation and authorization;
- existing negative/regression contracts;
- current approved human terminology where it remains accurate;
- light/dark support and responsive behavior.

No broad component replacement is authorized merely to obtain a new visual style.

## 5. REFINE — mission scope

### 5.1 One operational lifecycle

Replace competing/redundant visual cycle language with one clear lifecycle representation. The representation must derive from canonical backend facts already available to the workspace. It must help the operator answer:

1. where are processes now;
2. what requires attention;
3. what can legitimately happen next;
4. what has completed and become an active student.

Do not create a second source of progress in the browser.

### 5.2 Existing drawer

Retain the existing drawer as the detailed process workspace. Improve hierarchy, motion, stage transitions, feedback and Nexus visual depth where useful. The drawer must continue to expose real process facts and real available actions. Motion may explain a state change but may never manufacture one.

### 5.3 Activation handoff

After a successful canonical activation, the experience must make the transition explicit:

`process completed → active student exists → Student Record can be opened`

No duplicate Person/StudentProfile may be created. The user should not need to search the same person again merely because the process crossed the activation boundary.

### 5.4 Active Students continuity

Active Students remains a population/read view, not a second enrollment queue. It should naturally receive the result of activation through backend truth and provide the existing safe route to Student Record.

### 5.5 Search and navigation continuity

Where current safe identifiers permit it, preserve context when moving from an activated process to Active Students/Student Record. Never expose internal person IDs or create browser joins to simulate continuity.

## 6. Visual and interaction direction

Target: **professional, premium, alive, calm and distinctly Nexus**.

Minimalism means low cognitive effort, not flat visual design.

Use the existing Nexus/Aurora direction as the base. Strengthen controlled depth and composition with graphite/deep neutral surfaces, Nexus green as structural identity and selective deep/electric blue as technological energy, especially in dark mode. Amber and red remain semantic exception colors; green must not be sprayed over every successful surface.

Permitted refinements include:

- layered surfaces and clearer depth;
- restrained Aurora/blue light treatment;
- animated state transitions tied to confirmed backend changes;
- smooth drawer entry/exit and contextual transitions;
- count/progress changes that animate only after fresh server truth;
- subtle hover/focus/press feedback;
- coherent loading/skeleton states;
- responsive transitions and `prefers-reduced-motion` support.

Animation is functional communication, not decoration. Avoid constant movement, ornamental dashboards, fake progress, excessive gradients or attention competition.

## 7. Backend and data law

**Backend fact first; UI representation second.**

- Browser does not authorize tenant, stage, completion, activation or Student identity.
- A stage/progress animation can run only from a canonical response or subsequent refresh/revalidation.
- Active Students must continue to come from its authorized backend projection.
- Student Record must continue to resolve through its safe public reference.
- Missing/partial/unavailable data retains the established semantics: empty ≠ error; partial ≠ zero; unavailable ≠ absent.
- No fake/demo-only capability may be introduced.

## 8. Explicit OUT scope

ALUNOS-01A does **not** implement:

- post-activation Student maintenance/edit commands;
- a generic "Editar aluno" multi-domain writer;
- physical document/object-storage upload lifecycle;
- document replacement/versioning/reverification;
- guardian management writes;
- new Academic movement commands;
- Finance, Assessment, Attendance or Communication;
- new attention heuristics without explicit canonical domain rules;
- cross-domain history/timeline semantics;
- student photograph/media authority;
- Dashboard redesign.

These are not discarded. Student maintenance is intended for ALUNOS-01B; real document lifecycle for ALUNOS-01C, each subject to its own design/DoR.

## 9. Architecture boundaries

Integrated experience does not mean integrated writer.

- Enrollment owns enrollment process writes.
- Student Record remains an integrated read projection.
- Person/StudentProfile, Academic, Documents, Guardian and future Finance retain their own authority.
- No client-side join becomes authority.
- No schema migration is justified by visual continuity alone.
- If implementation discovers that safe continuity requires a new opaque bridge/API contract, classify it as a prerequisite/design change and stop rather than leaking internal IDs.

## 10. Failure and concurrency behavior

- UI must not optimistically display a canonical stage as completed before server success.
- Failed commands leave the visible process at the last confirmed server state and expose actionable human feedback.
- Refresh/retry must not duplicate activation or process mutations.
- Existing version/concurrency protections must remain intact.
- Partial failure of Active Students/Student Record must not falsify successful Enrollment facts; show unavailable/error state according to established semantics.

## 11. Acceptance contract

ALUNOS-01A is complete only when all of the following are proven:

1. existing enrollment backend/regression contracts remain green;
2. one lifecycle representation replaces confusing competing visual cycle language without changing canonical state semantics;
3. existing drawer remains functionally complete and gains approved interaction refinement without regression;
4. real enrollment state changes are reflected by the lifecycle after server confirmation;
5. canonical activation produces a visible, coherent handoff to the corresponding active student/Student Record without duplicate identity;
6. Active Students remains a distinct backend projection and one person appears once;
7. no internal Person/tenant authority leaks to browser navigation;
8. light/dark and desktop/tablet/mobile behavior are verified;
9. keyboard focus and reduced-motion behavior are verified;
10. no fake attention, progress, success, action or data is introduced;
11. lint, build, secret scan, diff check, targeted tests and relevant PostgreSQL/HTTP regressions pass;
12. human visual UAT approves the refined flow.

## 12. Human UAT scenario

Use fictitious fixtures but real application behavior. At minimum prove:

- open Alunos;
- start/inspect a real enrollment process through the existing operational flow;
- observe canonical stage/progress representation;
- open the existing drawer and inspect stages/actions;
- execute only actions actually available under backend rules;
- observe UI transition only after confirmed backend state;
- complete/inspect canonical activation in an authorized fixture;
- see the resulting active student without duplicate person;
- open the correct Student Record without a second manual search;
- repeat in light/dark and a narrow/mobile viewport;
- verify reduced motion does not remove essential state meaning.

No manual DB edit may be used to disguise a missing product path in the acceptance demonstration.

## 13. Stop rules

Stop and classify before implementation expands if any of these occur:

- safe process → Student Record navigation requires exposing an internal identifier;
- lifecycle truth cannot be derived from canonical server contracts;
- a requested visual state requires invented business semantics;
- existing approved Enrollment/Student authority would need replacement rather than refinement;
- a schema/write-authority change becomes necessary;
- physical file storage or post-activation editing becomes necessary to satisfy a 01A acceptance criterion;
- implementation would degrade an already approved Student Experience surface.

## 14. Definition of Done

Done means the existing real Enrollment and Student Experience have become one clearer, more professional and interactive operational journey **without weakening authority, truth, security, accessibility or previously accepted behavior**. Human UAT is mandatory. Finance does not begin merely because code compiles; ALUNOS-01A must be integrated and its acceptance evidence closed first.
