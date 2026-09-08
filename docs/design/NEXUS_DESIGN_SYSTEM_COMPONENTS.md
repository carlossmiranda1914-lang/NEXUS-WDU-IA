# NEXUS DESIGN SYSTEM — Operational Components and States

**Status:** DRAFT — DS-P3 preparation.  
**Implementation authorisation:** No.  
**Source authority:** *Nexus Edu IA — Padrão Visual e Paleta Oficial v1.0*.

## 1. Component principle

A component exists to help a user understand or complete an authorised action. It is not decoration. Every component uses semantic tokens and has defined default, hover, focus, disabled, loading, error and unavailable behaviour where applicable.

## 2. Buttons and actions

| Variant | Purpose | Visual rule | State rule |
|---|---|---|---|
| Primary | One main authorised action in a zone | action.primary, white label, 44–48 px, 12 px radius | Disable/processing prevents duplicate action; confirmation follows actual result |
| Secondary | Supporting action | raised/transparent surface + border | Never compete with primary action |
| Tertiary | Low-emphasis contextual action | text/icon | Full accessible label and focus |
| Destructive | Irreversible/high-risk action | status.danger | Requires explicit consequence/confirmation where product rule requires |
| AI-assisted | Reviewable AI suggestion | ai.primary/turquoise context | Cannot impersonate primary authorised action |

Hover feedback is discreet: controlled colour/elevation change, never glow. An action must not look successful before server/business confirmation.

## 3. Inputs, filters and validation

- Input: 44–48 px effective target, 14 px radius, 1 px structural border.
- Focus: action.primary or AI-appropriate soft halo; visible by keyboard.
- Error: icon, short human explanation and correction instruction; never red border alone.
- Required/optional/conditional information must be distinguishable in text.
- Disabled state explains why when the reason is not obvious.
- Filters are visible on dense desktop tables; mobile uses an accessible compact filter pattern.

## 4. Navigation and context

- Sidebar uses brand.void or surface.raised according to mode.
- Active item: low-saturation background plus readable label and vivid-green indicator.
- Show at most 5–7 primary areas simultaneously.
- Buttons must not become a second navigation system.
- Breadcrumb/context header identifies where the user is and the current institution/process where relevant.

## 5. Decision cards, queues and tables

### Card

A card groups a decision. When relevant it exposes:

1. context;
2. state;
3. evidence/source;
4. next authorised action.

A priority card may use a vivid-green top/side indicator. It must not turn the screen into a card wall.

### Queue

A queue is the default for actionable institutional work. Each item has owner, reason, state, age/SLA when applicable and safe next action.

### Table

Desktop dense operations retain a 48–56 px table row with visible filters and secondary actions in contextual menu. Mobile transforms it to an accessible list/summary card. A table must expose data provenance/time where relevant, not just totals.

## 6. Dialogs and confirmation

- Modal radius: 28 px.
- Use only when interruption/explicit confirmation is necessary.
- Dialog has title, consequence, primary/cancel route, visible keyboard focus, Escape behaviour where safe and focus return to invoker.
- High-impact actions show the operational consequence and evidence created.

## 7. Required temporal/product states

| State | Expression | Rule |
|---|---|---|
| Loading | Discreet skeleton/progress | Never simulate final data |
| Empty | Discreet icon/illustration, explanation, permitted next action | State what belongs here/what can happen |
| Processing | Explicit temporal state | No premature success |
| Confirmed | Success icon, short statement, verifiable evidence | Make outcome/checkable reference clear |
| Error / conflict | Icon, clear text, reason and retry/correction where legitimate | Never disappear silently |
| Stale | Updated-at marker and refresh route | Show source/validity when relevant |
| Unavailable / forbidden | Human language, no technical leak, next legitimate route | Never imply access |

All states must work in Claro, Escuro and Tonal Nexus. Critical state distinction cannot rely on colour alone.

## 8. Data visualisation

- KPI includes period, source and path to detail.
- Trend: direct-labelled line/area.
- Distribution: bar, simple donut or ordered list.
- Queue/risk: reason explicit, never colour alone.
- Graphs use green as main series; turquoise/blue/amber only for comparison/category.
- No more than four data colours per graph; direct labels preferred.
- Nexus Path displays actual process stages, never invented percentages.

## 9. Component acceptance

Before a component is approved:

- semantic-token mapping is recorded;
- all modes are checked;
- keyboard/focus path is checked;
- loading, empty, processing, confirmed, error/conflict and unavailable states are defined when relevant;
- responsive transformation is defined; and
- its use does not hide authority, evidence, state or next action.

