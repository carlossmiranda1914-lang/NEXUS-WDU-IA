# NEXUS DESIGN SYSTEM — Governance and Adoption

**Status:** DRAFT — DS-P7 preparation.  
**Implementation authorisation:** No.

## 1. Authority order

1. Approved business visual standard: *Nexus Edu IA — Padrão Visual e Paleta Oficial v1.0*.
2. This repository design-system record and its approved future revisions.
3. Module-specific design packs, which may extend but never contradict the system.
4. Implementation tokens/components, which must map to approved design tokens.

A structural visual change is valid only when its business/design source, repository specification and implementation plan are updated consistently.

## 2. Versioning rule

Every design-system change must record:

- motivation/problem;
- affected tokens/components/patterns;
- source authority and approver;
- mode/accessibility impact;
- module migration impact;
- visual QA evidence; and
- whether the change is additive, deprecating or breaking.

No visual value is silently introduced in a module component.

## 3. Module adoption gate

Before a module begins detailed screen design, it must:

1. name the Design System version it consumes;
2. map each screen to operational patterns;
3. use semantic token/component names only;
4. define all required modes and product states;
5. define responsive/accessibility behaviour; and
6. receive Design System compatibility review.

Before visual implementation, it must additionally provide token/component mappings, QA scenarios and explicit Product Owner approval under the module governance process.

## 4. Visual QA gate

A changed component or screen is accepted only with evidence for:

- Claro, Escuro and Tonal Nexus;
- desktop, tablet and mobile;
- contrast/focus/keyboard;
- loading, empty, processing, confirmed, error/conflict, stale and unavailable states where relevant;
- no colour-only critical information;
- product/action hierarchy; and
- no regression of authorised task, evidence or history visibility.

## 5. Controlled adoption of existing code

Existing code can be assessed as a migration candidate, but existing styles are not assumed compliant.

A controlled adoption plan must:

- inventory current colour/type/spacing/component use;
- map approved semantic tokens to actual usage;
- identify visual drift and compatibility risk;
- migrate one bounded visual unit at a time;
- preserve product authority and existing accepted behaviour;
- visual-test all three modes and responsive widths; and
- retain evidence in the repository.

No global stylesheet rewrite is authorised merely by this plan.

## 6. Attendance handoff condition

Attendance may begin its detailed design pack only when:

- DS-P2 foundation mapping is complete;
- DS-P3 components/states are approved;
- DS-P4/DS-P5 accessibility/responsive rules are approved;
- DS-P6 operational patterns are approved; and
- the Design System gate is explicitly marked DESIGN_SYSTEM_CLOSED.

Until then, Attendance functional planning may continue, but no Attendance visual screen is DESIGN_READY.

