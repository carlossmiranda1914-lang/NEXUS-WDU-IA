# NEXUS DESIGN SYSTEM FOUNDATION — Preparation Record

**Status:** DRAFT — planning only.  
**Implementation authorisation:** No.  
**Scope:** Official cross-product design system. No Attendance UI, Finance UI, production code or styling changes are authorised by this record.

## 1. Decision

The official Nexus Design System is defined by the approved business source **Nexus Edu IA — Padrão Visual e Paleta Oficial v1.0 (August 2026)**. Repository work must align to it before detailed Attendance screen design begins. Attendance must consume this foundation; it must not create an independent visual language.

## 2. Audit baseline

The current repository contains:

- an experience-guidance model that is canonical for product behaviour;
- reusable visual tokens/components and light/dark implementation patterns;
- a current palette primarily based on blue/neutrals;
- an official business-source design document covering identity, modes, tokens, components, states and accessibility;
- no repository-aligned canonical design-system record yet; and
- visual drift: current code uses predominantly blue tokens and two themes, while the approved visual standard is green-led and has three modes.

Therefore existing code tokens are implementation evidence, not official design authority where they diverge from the approved standard.

## 3. Design-system boundary

The foundation must define:

1. brand expression Nexus Aurora and use of logo/mark;
2. approved theme model: Claro, Escuro, Tonal Nexus and optional Seguir dispositivo;
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
| DS-P0 | Visual baseline audit: official source and initial code drift captured; full component inventory remains for controlled adoption | In progress |
| DS-P1 | Source alignment: Nexus Aurora, approved mark/palette/theme strategy captured from official source | Complete |
| DS-P2 | Foundations: colour roles, typography, spacing, elevation, radii, grids and iconography | In progress — specification created; contrast/token mapping evidence pending |
| DS-P3 | Component system: buttons, fields, selection, navigation, cards, tables, dialogs, alerts, status and empty/error/loading states | In progress — specification created; approved visual component board pending |
| DS-P4 | Interaction and accessibility: focus, keyboard, screen reader, contrast, motion and feedback | In progress — rules created; contrast and interaction evidence pending |
| DS-P5 | Responsive/layout system: desktop, tablet and mobile behaviours | In progress — rules created; responsive visual evidence pending |
| DS-P6 | Operational patterns: workspace, queue, detail, review/decision, timeline/audit and reporting | In progress — specification created; design review pending |
| DS-P7 | Governance/adoption: tokens, versioning, migration rules, visual QA and module handoff | In progress — governance created; approval/evidence process pending |
| Gate A | DESIGN_SYSTEM_CLOSED | Not reached |
| Gate B | ATTENDANCE_DESIGN_READY | Blocked by Gate A |

## 6. Explicit constraints

- No implementation or stylesheet refactor begins from this record.
- Existing blue/neural tokens are not adopted as official merely because they exist.
- The system must work internationally and must not assume one jurisdiction, language or school model.
- Finance remains entirely outside scope.
- Attendance functional decisions remain valid; only its visual/product presentation waits for this foundation.

## 7. Approved DS-P1 direction

- **Direction:** Nexus Aurora — institutional, serene, technically precise, futurist through contrast/transitions/functional detail, but human and comfortable for long work.
- **Must not become:** cyberpunk, fluorescent/aggressive, cold/banking, infantilised or a decorative card dashboard.
- **Brand base:** deep green, emerald, vivid green, lime accent and neutral surfaces.
- **AI:** turquoise, visually distinct from the primary action.
- **Appearance:** Claro, Escuro and Tonal Nexus throughout the whole product, plus Seguir dispositivo; initial mode Claro.
- **Colour proportion:** 85% neutral surfaces, 10% deep/emerald green, up to 5% vivid/lime/turquoise accents.
- **Visual process signature:** Nexus Path — Context → Action → Validation → Evidence → Result, only where the workflow has real stages/responsibility.

## 8. Next priority

DS-P0–DS-P7 — complete the approved visual component board, three-mode contrast matrix, responsive evidence and Design System compatibility review. No styling implementation is authorised.
