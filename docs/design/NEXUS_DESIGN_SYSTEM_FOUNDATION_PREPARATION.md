# NEXUS DESIGN SYSTEM FOUNDATION — Preparation Record

**Status:** DRAFT — planning only.  
**Implementation authorisation:** No.  
**Scope:** Official cross-product design system. No Attendance UI, Finance UI, production code or styling changes are authorised by this record.

## 1. Decision

The official Nexus Design System must be defined and approved before detailed Attendance screen design begins. Attendance must consume this foundation; it must not create an independent visual language.

## 2. Audit baseline

The current repository contains:

- an experience-guidance model that is canonical for product behaviour;
- reusable visual tokens/components and light/dark implementation patterns;
- a current palette primarily based on blue/neutrals;
- no complete official design-system specification covering identity, components, states, responsive rules and accessibility;
- acknowledged visual debt: the current identity/palette may feel generic.

Therefore existing code tokens are implementation evidence, not automatically official design authority.

## 3. Design-system boundary

The foundation must define:

1. brand expression and use of logo/mark;
2. theme model and background/surface hierarchy;
3. semantic colour roles and contrast requirements;
4. typography, spacing, grid and density;
5. components and their interactive states;
6. information hierarchy for operational work;
7. responsive behaviour;
8. accessibility;
9. motion/feedback rules; and
10. governance/versioning and module adoption.

It must not determine domain rules, permissions, retention, API contracts or database implementation.

## 4. Mandatory product principles

The system must support the approved Nexus experience model:

- show what requires attention, why, the next authorised action and consequence;
- make normal operational work fast and exceptions explicit;
- prefer one clear primary action per state;
- avoid decorative dashboards, card walls, excessive badges and meaningless metrics;
- keep automation invisible when successful and explicit when human attention is required;
- preserve factual status, history and accountability in UI;
- make mobile/responsive use part of workflow design;
- use understandable language rather than technical architecture vocabulary.

## 5. Preparation sequence

| Priority | Deliverable | Status |
|---|---|---|
| DS-P0 | Visual baseline audit: logo, current tokens, existing themes, component inventory and visual debt | In progress |
| DS-P1 | Brand direction: official visual character, mark usage, palette intent and theme strategy | Pending |
| DS-P2 | Foundations: colour roles, typography, spacing, elevation, radii, grids and iconography | Pending |
| DS-P3 | Component system: buttons, fields, selection, navigation, cards, tables, dialogs, alerts, status and empty/error/loading states | Pending |
| DS-P4 | Interaction and accessibility: focus, keyboard, screen reader, contrast, motion and feedback | Pending |
| DS-P5 | Responsive/layout system: desktop, tablet and mobile behaviours | Pending |
| DS-P6 | Operational patterns: workspace, queue, detail, review/decision, timeline/audit and reporting | Pending |
| DS-P7 | Governance/adoption: tokens, versioning, migration rules, visual QA and module handoff | Pending |
| Gate A | DESIGN_SYSTEM_CLOSED | Not reached |
| Gate B | ATTENDANCE_DESIGN_READY | Blocked by Gate A |

## 6. Explicit constraints

- No implementation or stylesheet refactor begins from this record.
- Existing blue/neural tokens are not adopted as official merely because they exist.
- The system must work internationally and must not assume one jurisdiction, language or school model.
- Finance remains entirely outside scope.
- Attendance functional decisions remain valid; only its visual/product presentation waits for this foundation.

## 7. Next decision

DS-P1 starts with the official visual character and theme model, before selecting individual colours or screen layouts.
