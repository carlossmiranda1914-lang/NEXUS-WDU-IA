# NEXUS DESIGN SYSTEM — Accessibility, Interaction and Responsive Rules

**Status:** DRAFT — DS-P4/DS-P5 preparation.  
**Implementation authorisation:** No.  
**Source authority:** *Nexus Edu IA — Padrão Visual e Paleta Oficial v1.0*.

## 1. Non-negotiable accessibility

- Normal text has at least 4.5:1 contrast; large text and essential controls at least 3:1.
- Keyboard focus is visible at all times.
- Every essential workflow works without hover, right-click or precise pointer use.
- Critical state/permission uses icon + text label + colour.
- Dark-mode selection never depends only on brightness.
- All user-visible state is written in clear product language, not technical architecture vocabulary.
- Each screen is validated in Claro, Escuro and Tonal Nexus.

## 2. Keyboard and focus lifecycle

| Surface | Required behaviour |
|---|---|
| Page/workspace | Semantic main landmark, predictable heading order and direct keyboard path to primary action |
| Button/action | Reachable, visible focus, accessible name, disabled reason where needed |
| Field | Associated label/instruction/error; focus moves to first actionable error after failed submit where appropriate |
| Table/queue | Keyboard-reachable row/action paths; no hover-only detail/action |
| Dialog | Focus enters the dialog, remains within it while open, Escape closes only where safe, focus returns to invoker |
| Toast/notification | Announces significant result without stealing focus; critical error offers an accessible action route |
| Async state | Loading/processing/result state is announced and visibly distinguishable |

## 3. Responsive workflow rules

Responsive behaviour is a workflow decision, not a later visual adaptation.

| Range | Layout rule |
|---|---|
| Desktop | Supports dense institutional work: full table, persistent context, visible filters and contextual secondary actions |
| Tablet | Preserves task sequence; sidebar/context may condense; tables retain only decision-critical columns |
| Mobile | One task at a time; dense tables become accessible list/summary cards; actions remain reachable without horizontal maze |

At every width, the user must retain:

1. current context;
2. factual state;
3. primary permitted action;
4. error/conflict/retry information; and
5. evidence/source where relevant.

No mobile simplification may hide a requirement, permission boundary, pending decision or irreversible consequence.

## 4. Motion and feedback

- Motion explains an actual transition: opening context, processing, confirmed result or attention requirement.
- Respect reduced-motion preference.
- Do not use looping animation, aggressive glow or movement that competes with a decision.
- A state change remains understandable if animation is absent.
- Processing remains visibly pending until confirmed; success is never inferred from click/animation alone.

## 5. Appearance mode QA

Every changed/design surface must be checked in:

| Mode | Required check |
|---|---|
| Claro | Neutral canvas, controlled green action/selection, readable structural hierarchy |
| Escuro | Contrast, focus, selection distinction beyond brightness, no fluorescent overload |
| Tonal Nexus | Low-saturation mint canvas, white data/field surfaces, semantic-state clarity |
| Seguir dispositivo | Resolves to the correct current device mode without altering semantic meaning |

## 6. Design QA evidence

Before any screen can be accepted, the design pack must include:

- desktop, tablet and mobile evidence;
- Claro, Escuro and Tonal Nexus evidence;
- keyboard tab-path and visible-focus evidence;
- text/icon/colour critical-state evidence;
- loading, empty, processing, confirmed, error/conflict and unavailable states; and
- review against the Nexus Experience Guidance Model.

