# NEXUS DESIGN SYSTEM — Foundations Specification

**Status:** DRAFT — DS-P2 preparation.  
**Implementation authorisation:** No.  
**Source authority:** *Nexus Edu IA — Padrão Visual e Paleta Oficial v1.0*.  
**Scope:** Design-system specification only; no CSS or component refactor.

## 1. Token architecture

All design adoption follows this hierarchy:

> Brand tokens → semantic tokens → mode aliases → component tokens

No component may use a raw hexadecimal colour where an approved semantic token exists. A mode changes aliases, not the meaning of an action or state.

## 2. Brand tokens

| Token | Value | Guardrail |
|---|---:|---|
| brand.void | #031D18 | Premium dark/navigation; never long dark-on-dark text |
| brand.deep | #064C3C | Identity/title/navigation; do not overfill large surfaces |
| brand.emerald | #0B8B62 | Primary operational action |
| brand.vivid | #28C76F | Progress, hover, micro-highlight; never global canvas |
| brand.lime | #9BEA4A | Spark/special marker; never small text or long tables |
| brand.ai | #00A6A6 | AI identity; never replaces primary action |

## 3. Semantic tokens

| Token | Source | Meaning |
|---|---|---|
| action.primary | brand.emerald | Main authorised user action |
| action.primary.hover | brand.vivid | Controlled primary interaction feedback |
| action.secondary | mode-surface + border | Supporting non-destructive action |
| action.destructive | danger | Destructive/irreversible action |
| status.success | #15803D | Verified/confirmed completion |
| status.warning | #F2A93B | Actionable attention/deadline |
| status.danger | #E65362 | Error, risk, block |
| status.info | #3478E5 | Auxiliary information |
| text.primary | #102E27 in light/tonal | Main readable content |
| text.secondary | mode-defined | Supporting content |
| border.default | #D8E8E0 in light/tonal | Structural separation, not visual grid |
| focus.ring | action.primary / brand.ai | Visible keyboard focus; component/state dependent |

A semantic status always needs a text label and icon in critical flows. Status colour never substitutes factual state, permission or required action.

## 4. Mode aliases

| Alias | Claro | Escuro | Tonal Nexus |
|---|---:|---:|---:|
| surface.canvas | #F5FAF7 | #031D18 | #EAF7F1 |
| surface.raised | #FFFFFF | #0A2C24 | #FFFFFF |
| surface.selection | #DDF9E8 | approved low-saturation green equivalent | #DDF9E8 |
| text.primary | #102E27 | soft white with required contrast | #102E27 |
| border.default | #D8E8E0 | approved low-emphasis dark border | #D8E8E0 |

The precise dark-mode secondary/selection/border values require a colour-contrast validation sheet before code adoption. No value may be guessed in a component.

## 5. Typography

| Role | Desktop | Mobile | Use |
|---|---:|---:|---|
| Display | 48–56 px | 36–42 px | Login, onboarding, key messages |
| H1 | 36–40 px | 30–34 px | Page title |
| H2 | 28–32 px | 24–28 px | Decision section |
| H3 | 22–24 px | 20–22 px | Subsection/component |
| Body | 16 px | 16 px | Content/form |
| Label | 13–14 px | 14 px | Fields, filters, buttons |
| Caption | 12 px | 12 px | Metadata, source, update |

Readability prevails over compression: reorganise content before shrinking type. Use the approved sans-serif product font; a later implementation token sheet must map the exact font stack.

## 6. Geometry and density

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px.
- Button height: 44–48 px; radius 12 px.
- Input: radius 14 px; 1 px border; soft focus halo.
- Card: radius 18–20 px; discreet border; low diffuse shadow.
- Modal: radius 28 px; high elevation only when it interrupts work.
- Desktop table row: 48–56 px.
- Keep generous breathing room; do not create card walls or a heavy visual grid.

## 7. Elevation, gradient and motion

- Elevation communicates task interruption, not decoration.
- Use low/diffuse shadow for raised cards; use high elevation only for modal interruption.
- Approved gradient (#064C3C → #0B8B62 → #9BEA4A) is limited to login, onboarding, process cover, editorial message and special action.
- Motion must clarify a state/action result. Avoid glow, continuous animation or effects that compete with content.

## 8. Contrast and quality gate

- Text contrast: at least 4.5:1.
- Large text/essential controls: at least 3:1.
- Keyboard focus must always be visible.
- Critical distinction requires icon + label + colour.
- Every component must work in Claro, Escuro and Tonal Nexus.
- No code/visual adoption until each component maps to this specification and passes contrast review.

## 9. DS-P2 open evidence

Before marking DS-P2 complete, produce:

1. contrast matrix for all semantic token/mode combinations;
2. font-stack mapping and type-scale implementation mapping;
3. dark-mode alias values, validated rather than inferred; and
4. design-token naming table ready for design/Figma/code adoption.

