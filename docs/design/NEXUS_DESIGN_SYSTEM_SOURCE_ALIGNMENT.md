# NEXUS DESIGN SYSTEM — Official Source Alignment

**Status:** DESIGN SOURCE ALIGNMENT COMPLETE  
**Implementation authorisation:** No.  
**Business source:** *Nexus Edu IA — Padrão Visual e Paleta Oficial v1.0*, August 2026.  
**Repository role:** technical mirror and adoption record; the approved business document remains the visual authority.

## 1. Official direction

**Nexus Aurora**: technology premium, alive and human. The interface is institutional, serene and technically precise; futurism comes from contrast, limited motion and functional detail, never visual aggression.

It must not become cyberpunk, fluorescent, cold/banking, childish, mascot-led, or a dashboard made of decorative cards.

The Nexus Path is used where a real accountable process has stages:

> Context → Action → Validation → Evidence → Result

## 2. Appearance modes

| Mode | Canvas | Raised surface | Product rule |
|---|---:|---:|---|
| Claro | #F5FAF7 | #FFFFFF | Default; administration, reading, tables and daily work |
| Escuro | #031D18 | #0A2C24 | Low light/prolonged use; soft white text, controlled vivid green |
| Tonal Nexus | #EAF7F1 | #FFFFFF | Branded light alternative; data/fields remain white |

Every user can select Claro, Escuro, Tonal Nexus or **Seguir dispositivo**. The choice is persistent and applies to navigation, cards, tables, forms, modals, charts, notifications and AI surfaces. Default is Claro unless a saved/device preference applies.

## 3. Core visual tokens

| Token | Value | Role |
|---|---:|---|
| brand.void | #031D18 | Dark navigation, premium headings, dark mode |
| brand.deep | #064C3C | Identity, native navigation, titles, low-emphasis borders |
| action.primary | #0B8B62 | Primary action, selection, priority links |
| accent.vivid | #28C76F | Progress, energy, hover/micro-highlight |
| accent.lime | #9BEA4A | Nexus spark, markers, special detail only |
| surface.canvas | #F5FAF7 | Claro canvas |
| surface.mint | #DDF9E8 | Positive/soft selection/Tonal treatment |
| text.primary | #102E27 | Primary text |
| border.default | #D8E8E0 | Low-emphasis structural separation |
| ai.primary | #00A6A6 | Nexus AI, separate from primary action |
| info | #3478E5 | Auxiliary neutral information |
| success | #15803D | Verified completion |
| warning | #F2A93B | Actionable attention/deadline |
| danger | #E65362 | Error, risk, block, destructive action |

Usage distribution: 85% neutral surfaces, 10% deep/emerald greens and at most 5% vivid/lime/turquoise accents. The institutional gradient #064C3C → #0B8B62 → #9BEA4A is restricted to login, onboarding, process cover, editorial message and special action; never normal cards, tables, global canvases or multiple buttons on one screen.

## 4. Typography and geometry

- Typography must remain readable; reorganise content before reducing type.
- Body: 16 px desktop/mobile.
- Labels: 13–14 px desktop; 14 px mobile.
- Caption: 12 px.
- H1: 36–40 px desktop / 30–34 px mobile.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48 and 64 px.
- Buttons: 44–48 px height; 12 px radius; no heavy shadow.
- Inputs: 14 px radius, 1 px border, soft green/turquoise focus halo.
- Cards: 18–20 px radius, discreet border, low diffuse shadow.
- Modals: 28 px radius; high elevation only when they interrupt a task.

## 5. Component/state requirements

- One dominant primary action per zone.
- Cards group decisions, not arbitrary content; where applicable show context, state, evidence and next action.
- Desktop dense operations preserve tables (48–56 px rows, visible filters, contextual secondary actions); mobile turns them into list/summary cards.
- Critical state uses icon + label + colour. No colour-only meaning.
- Required state treatments in every mode: loading, empty, processing, confirmed, error/conflict and stale.
- AI uses a very-light turquoise surface and shows source, confidence/limit, available action and review option.
- Critical actions must not depend on hover, right-click or pointer precision.

## 6. Accessibility and visual acceptance

- Minimum contrast: 4.5:1 normal text; 3:1 large text and essential controls.
- Keyboard focus always visible.
- In dark mode, selection cannot be indicated through luminosity alone.
- Test every screen in all three modes before approval.
- Design, Figma and code must use the same token/state names.
- Logo keeps protection zone and must never be redrawn/deformed.

## 7. Observed repository drift — no remediation in this document

| Area | Current repository evidence | Official requirement |
|---|---|---|
| Primary palette | Blue primary (#2563EB) in current stylesheet | action.primary green #0B8B62 |
| Modes | Light/dark implementation pattern | Claro, Escuro, Tonal Nexus and Seguir dispositivo |
| Token ownership | Colour aliases are embedded in current stylesheet | Semantic brand → semantic → mode → component token structure |
| Foundations | Some visual values are global overrides | Official component/state rules and modes applied consistently |
| Adoption | No repository design-system canonical record | This alignment record and future DS specification govern adoption |

This drift is an audit finding, not permission to refactor code.

## 8. Attendance implication

Attendance screen design must use Nexus Aurora, all three appearance modes, Nexus Path only for genuine attendance workflows, and required state/accessibility treatments. It cannot introduce a separate palette or component language.
