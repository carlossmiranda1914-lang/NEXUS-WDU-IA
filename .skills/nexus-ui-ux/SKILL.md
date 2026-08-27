---
name: nexus-ui-ux
description: Design, implement and review Nexus Edu IA application UI/UX for dashboards, IAM/permissions, secretariat, finance, enrollment, onboarding and other institutional workflows. Use when creating or changing screens, components, navigation, forms, tables, dialogs, responsive behavior, interaction states or visual design. Enforces Nexus product truth, accessibility and design consistency while remaining subordinate to canonical architecture, backend contracts, missions and tests.
---

# Nexus UI UX

Create institutional software that is calm, efficient, trustworthy and operationally real. Optimize task completion and comprehension before decoration.

## Authority order

Use this order when requirements conflict:
1. Canonical ADRs/architecture and backend authorization/data contracts.
2. Active authorized Mission Pack and acceptance criteria.
3. Existing canonical design tokens/components/patterns in the repository.
4. Accessibility and product-truth requirements.
5. This skill's aesthetic guidance.

Never invent backend capability, permissions, persistence or successful state to improve a screen.

## Workflow

1. Inspect the existing screen, neighboring flows, design tokens/components and backend/API contract before designing.
2. Identify the primary user, institutional context, primary task, dangerous actions and required states.
3. Reuse canonical components/tokens where they satisfy the need; extend deliberately instead of creating near-duplicates.
4. Design the information hierarchy and interaction flow before decorative detail.
5. Implement all relevant loading, empty, error, denied, disabled, success and destructive-confirmation states.
6. Verify keyboard use, focus, labels, contrast, responsive layout and clear feedback.
7. Verify product truth: every visible capability and success message corresponds to real authorized behavior.
8. Review at desktop and narrow/mobile widths appropriate to the surface.

Load `references/design-principles.md` for any new/changed screen.
Load `references/accessibility.md` for interactive UI.
Load `references/interaction-patterns.md` for forms, tables, dialogs, destructive actions and async states.
Load `references/permissions-ui.md` for IAM, role, membership, capability or permission screens.
Load `references/visual-quality-gate.md` before claiming a visual change complete.

## Nexus visual direction

Prefer restrained institutional SaaS over fashionable spectacle: strong hierarchy, generous but efficient spacing, legible typography, restrained elevation, consistent radii, clear grouping and purposeful emphasis. Avoid gratuitous gradients, glassmorphism, excessive animation, ornamental cards, dashboard clutter and one-off visual languages.

Use motion only to clarify state, continuity or feedback. Respect reduced-motion preferences.

## Product-truth rules

- Never hide missing backend behavior behind optimistic UI.
- Never derive authorization solely from client-held role/capability state.
- A disabled control must not be the only security boundary.
- Distinguish unavailable, denied, loading, empty and failed states.
- Confirm dangerous permission/data changes with consequences expressed in user language.
- Prefer immediate factual feedback after successful mutation, then reconcile from backend truth.

## Completion

Do not call a screen complete because it looks polished. Completion requires behavioral truth, relevant responsive states, accessibility basics, and the repository's required tests/gates. State explicitly what was visually inspected, what was executed, and what remains unverified.
