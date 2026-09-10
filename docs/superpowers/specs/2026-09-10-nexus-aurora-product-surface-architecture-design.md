# Nexus Aurora Product Surface Architecture v1

**Status:** APPROVED DESIGN — pending written-spec human review
**Date:** 2026-09-10
**Scope:** Nexus Edu IA product-wide frontend/product-experience governance
**Implementation strategy:** progressive; new/touched surfaces first

## 1. Purpose

Nexus Aurora is the official product-surface architecture for Nexus Edu IA. It is not a decorative theme, a dashboard skin, or permission to alter domain behavior for visual convenience.

Its purpose is to make every important Nexus surface express real institutional work through one consistent chain:

**Contexto → Ação → Validação → Evidência → Resultado**

The interface must help a user understand where they are, what is happening, what requires attention, what they may do next, and what result has actually been confirmed.

Central principle: **CLAREZA ANTES DE DECORAÇÃO.**

Aurora must feel futuristic, premium, alive, professional, and human without becoming cyberpunk, neon-heavy, banking-generic, cold, childish, or visually aggressive.

## 2. Authority hierarchy

The canonical product-surface authority is:

```text
DOMAIN / SECURITY / BPM TRUTH
            ↓
PRODUCT EXPERIENCE GUIDANCE
            ↓
NEXUS SURFACE CONTRACT
            ↓
NEXUS AURORA DESIGN SYSTEM
            ↓
AURORA OPERATIONAL PATTERNS
            ↓
COMPONENTS / PRESENTATION
            ↓
REAL HUMAN UAT
```

Visual convenience never overrides domain, authorization, tenant, audit, persistence, or BPM truth.

Aurora represents truth; it does not create truth.

## 3. Documentation governance

The intended documentation set is:

1. `NEXUS_EXPERIENCE_GUIDANCE_MODEL_V1` — product behavior and user guidance.
2. `NEXUS_AURORA_DESIGN_SYSTEM_V1` — tokens, themes, geometry, typography, surfaces, states, components, accessibility.
3. `NEXUS_AURORA_OPERATIONAL_LAYOUT_SPEC_V1` — operational workspace composition and reusable layout rules.
4. `NEXUS_AURORA_INTERACTION_MOTION_V1` — loading, processing, transitions, confirmation, conflict, motion and reduced-motion behavior.
5. `NEXUS_SURFACE_CONTRACT` — mandatory contract for material screens and flows.

Existing canonical product/domain/security specifications retain authority over their own concerns.

## 4. Nexus Surface Contract

Before implementing a new material surface or materially changing an existing flow, the implementation must resolve the following contract from approved specifications and repository truth:

```text
PRODUCT_OUTCOME=
REAL_USER_FLOW=

SURFACE=
USER_ROLE=
JOB_TO_BE_DONE=

BPM_ENTRY_STATE=
BPM_EXIT_STATE=

DOMAIN_AUTHORITIES=
SERVER_CAPABILITIES=

DOMINANT_OPERATIONAL_MOMENT=
WHO_CAN_ACT=
PRIMARY_ACTION=

CRITICAL_STATES=
BLOCKED_STATES=
ERROR_STATES=
CONFLICT_STATES=

AUTHORITATIVE_DATA=
EVIDENCE_REQUIRED=
PERSISTED_RESULT=

AURORA_PATTERN=
RESPONSIVE_BEHAVIOR=
ACCESSIBILITY_REQUIREMENTS=

PROOF_OF_DONE=
HUMAN_UAT=
```

This contract applies to meaningful surfaces/flows, not individual buttons or trivial styling edits. If the information already exists in an approved specification, it is referenced/reused rather than re-litigated.

## 5. Visual identity

### 5.1 Official palette

```text
brand.void       = #031D18
brand.deep       = #064C3C
action.primary   = #0B8B62
accent.vivid     = #28C76F
accent.lime      = #9BEA4A

surface.canvas   = #F5FAF7
surface.raised   = #FFFFFF
surface.mint     = #DDF9E8

text.primary     = #102E27
border.default   = #D8E8E0

ai.primary       = #00A6A6
info             = #3478E5
success          = #15803D
warning          = #F2A93B
danger           = #E65362
```

Target visual proportion: approximately 85% neutral surfaces, approximately 10% base greens, up to 5% vivid accents. Green must not saturate the interface.

### 5.2 Institutional gradient

`#064C3C → #0B8B62 → #9BEA4A`

Allowed only for login, onboarding, process cover, editorial message, or a special action. It is not a general page background and must not be applied to every card or multiple simultaneous buttons.

### 5.3 Prohibited visual outcomes

- generic banking/admin dashboard;
- card proliferation;
- excessive glow/neon;
- dominant green page backgrounds;
- gradients everywhere;
- meaningless icons;
- metrics without operational value;
- childish aesthetics;
- cyberpunk styling;
- state communicated only by color;
- local visual identities that compete with Nexus Aurora.

## 6. Token architecture

Aurora uses three token layers:

```text
PRIMITIVE TOKENS
      ↓
SEMANTIC TOKENS
      ↓
COMPONENT TOKENS
```

Components must consume semantic/component tokens rather than scattering physical hex, radius, shadow, or spacing values.

Examples:

```text
primitive.green.700
→ semantic.action.primary
→ button.primary.background
```

Required semantic families include surface, text, border, action, state, AI, spacing, radius, elevation, focus, and motion.

Theme changes occur through token aliases rather than component rewrites.

## 7. Official modes

### Light

`surface.canvas=#F5FAF7`, `surface.raised=#FFFFFF`. Intended for prolonged daily administrative work. Green is concentrated in action, selection, priority, and progress.

### Dark

`surface.canvas=#031D18`, `surface.raised=#0A2C24`. Uses soft light text and vivid greens only for action, focus, priority, and progress.

### Tonal Nexus

`surface.canvas=#EAF7F1`, `surface.raised=#FFFFFF`. More expressive brand mode using restrained mint surfaces while forms and dense data remain clean.

### Follow device

Resolves to Light/Dark from the system preference. It is not an independent token set.

## 8. Geometry and density

Spacing scale:

`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px`

Controls:

- buttons: 44–48px height, 12px radius;
- inputs: 14px radius, 1px border, soft green/turquoise focus halo;
- cards: 18–20px radius, subtle border, low diffuse shadow;
- modals: 28px radius.

High radius must not turn the entire application into capsules. Cards are not the default container. Large surfaces should prefer hierarchy and spacing over nested boxes.

## 9. Typography

Typography is semantic, not a collection of arbitrary local font sizes. Required roles include:

`display`, `page-title`, `section-title`, `body`, `body-strong`, `label`, `meta`, `caption`, `numeric`.

Page titles should communicate the user's situation/context where appropriate, not merely expose technical module names. Secondary text must remain readable during prolonged professional use.

## 10. Surfaces and materiality

Surface roles include:

`canvas`, `workspace`, `panel`, `elevated`, `interactive`, `dominant`, `overlay`.

A card must represent context, decision, state, evidence, or a meaningful next action. Cards must not be created merely to fill a page.

Each important page must have a clear center of gravity: the actual institutional work should dominate navigation chrome.

## 11. Mandatory interaction states

Applicable surfaces must deliberately support the relevant states, including:

`loading`, `empty`, `ready`, `processing`, `confirmed`, `blocked`, `error`, `conflict`, `stale/outdated`, `unavailable`, and where relevant `offline` or `sync-pending`.

Critical information never depends on color alone. State combines semantic color with icon/text/context as appropriate.

Success is never shown before authoritative confirmation.

Confirmed state must expose verifiable evidence when the operation produces authoritative evidence.

Errors/conflicts must communicate the safe reason and the next legitimate action/retry where one exists.

## 12. Motion and interaction

Motion explains a state change or a change of context; it is not decoration. It must respect reduced-motion preferences.

Indicative timing bands (implementation tokens, subject to accessibility/performance validation):

- 120–180ms: micro feedback;
- 180–240ms: state transition;
- 240–320ms: context change, drawer, modal.

The canonical behavior is more important than exact timing: click → processing → authoritative confirmation → evidence/result. Do not show optimistic success for operations that require server authority.

## 13. Accessibility and responsive behavior

Aurora requires:

- adequate contrast;
- visible keyboard focus;
- no critical meaning encoded only by color;
- essential actions not dependent only on hover;
- desktop, tablet, and mobile usability;
- responsive transformations that preserve context and actionability;
- tables preferred for dense desktop operations where appropriate;
- mobile list/card transformation only when it preserves essential context.

Accessibility is part of Definition of Done, not optional polish.

## 14. Core System strategy

Aurora is implemented progressively. Nexus does not stop feature delivery to build a speculative full component catalogue.

New/touched surfaces adopt the system first. Existing surfaces migrate when they are materially changed or when a dedicated migration is explicitly prioritized.

Initial primitive candidates include buttons, inputs/selects, state notices, page header, workspace shell, sections, data tables, modal/drawer, empty state, evidence, and progress/path primitives. Names are not implementation authorization; repository fit must be checked before creation.

Reuse before creation. If a primitive/pattern exists, consume it. If not, determine whether the need is reusable or a local composition of existing primitives. Domain-specific business rules must not be embedded in generic Aurora components.

## 15. Operational patterns

### 15.1 Operational Workspace

The module shell provides compact, unmistakable hierarchy and current location while maximizing work area. It must not degrade into an infinite horizontal tab strip or a giant navigation-card sitemap. Desktop may use a compact internal rail/sidebar or another approved composition; responsive modes preserve discoverability without horizontal-scroll dependence.

Rule: **navigation occupies little; work occupies much.**

### 15.2 Operational Overview

Answers quickly:

- what is happening;
- what requires attention;
- what work comes next;
- what recent evidence/result matters.

It is not permission to manufacture decorative KPIs. Metrics without operational purpose should be omitted.

### 15.3 Operational Collection

Used for dense work such as receipts, obligations, students, or enrollments. Desktop favors table/list density, visible filters, clear state, and contextual secondary actions. Institution/global blockers appear once at the correct contextual level; record-specific blockers appear on the affected record.

Do not repeat the same institutional warning on every row.

### 15.4 Guided Configuration

Configuration represents authoritative prerequisites, not raw technical forms. It shows:

- current status;
- what is missing;
- why it matters;
- whether the current user can resolve it;
- the legitimate action if one exists;
- what happens after resolution.

If no legitimate action exists, the UI says so rather than inventing a bypass.

### 15.5 Attention / Blocked

Experience categories distinguish configuration, policy, permission, record-state, conflict, and system blockers where the domain supports them. Server/domain safe reasons are translated into institutional language without changing their truth.

Do not show internal implementation language such as "server validation" to end users when a meaningful domain reason is available.

### 15.6 Evidence / Confirmation

Important operations terminate with evidence, not merely a green toast. Evidence may include an authoritative document reference, persisted status, timestamp, responsible context, or artifact where permitted by domain/security rules.

## 16. AI visual semantics

`ai.primary` is semantic, not decorative. Turquoise identifies a genuinely AI/automation-originated suggestion, prediction, or action when distinguishing that origin helps the user. Normal successful outcomes continue to use the semantic state color rather than AI color.

## 17. Frontend authority boundary

`BROWSER_AUTHORITY=NO` is a product invariant.

The browser may present, organize, translate allowlisted safe domain codes, and hold transient interaction state. It may not authoritatively decide institutional readiness, payment eligibility, membership authorization, document confirmation, enrollment activation, debt settlement, or workflow completion.

Those states derive from server-side canonical authorities.

## 18. Delivery governance

Once an approved spec + Surface Contract exists, normal safe implementation details do not require repeated Product Owner micro-approval.

The implementation agent may autonomously resolve:

- responsive composition within approved patterns;
- spacing using approved tokens;
- loading/processing/error presentation;
- accessibility defects;
- implementation-caused lint/type/build/test failures;
- refactors needed to consume existing approved primitives;
- regression fixes within approved scope.

It must stop for genuine decisions involving:

- product semantics;
- architecture/interface changes with broad consequences;
- security/authority changes;
- schema authority changes;
- new BPM semantics;
- a new Aurora pattern with broad product consequences;
- real external blockers.

A red test, spacing adjustment, runtime restart, or ordinary implementation bug is not a Product Owner blocker.

## 19. Test strategy

Automated tests verify deterministic product contracts, not subjective beauty.

Examples:

- blocked state → forbidden action absent;
- missing capability → command action absent;
- processing → confirmed evidence absent until server confirmation;
- confirmed → required evidence present;
- safe server/domain error → correct human state;
- keyboard operation/focus contract;
- responsive critical information preserved;
- theme/token contract where machine-verifiable.

Human UAT judges hierarchy, clarity, density, professional quality, comfort, flow comprehension, and visual coherence.

## 20. Definition of Done

For a critical institutional surface/flow, completion is evaluated across applicable gates:

```text
DOMAIN_TRUTH
+
AUTHORIZATION
+
TENANT_ISOLATION
+
PERSISTENCE
+
OPERATIONAL_FLOW
+
ERROR/CONFLICT STATES
+
AURORA_SURFACE
+
ACCESSIBILITY
+
RESPONSIVE
+
REGRESSION
+
REAL_HUMAN_UAT
```

A rendered component + endpoint + green build is not sufficient.

Human UAT must distinguish at least:

`DOMAIN_TRUTH=PASS|FAIL`
`OPERATIONAL_FLOW=PASS|FAIL`
`AURORA_EXPERIENCE=PASS|FAIL`
`PERSISTENCE_EVIDENCE=PASS|FAIL`

## 21. Finance as first Reference Vertical

Finance is the first reference implementation, not a special visual fork.

Mapping:

```text
FinanceWorkspace
→ Operational Workspace

Situação Financeira
→ Operational Overview

Obrigações Financeiras
→ Operational Collection

Recebimentos
→ Operational Collection
  + Attention/Blocked
  + Evidence

Documentos Financeiros
→ Operational Collection
  + Evidence

Catálogo de Emolumentos
→ Configuration Collection / appropriate operational pattern

Configuração Financeira
→ Guided Configuration
  + Attention/Blocked
```

Aurora must consume the real Finance readiness, capability, eligibility, persistence, and documentary authorities. It must not invent compliance or unblock issuance where no approved jurisdiction adapter exists.

The absence of an evidenced production jurisdiction adapter is a legitimate blocked product state, not permission to use synthetic UAT authority in production-facing UX.

## 22. Productivity rule

A Nexus change creates value when it improves a real institutional flow or the reusable foundation required for those flows.

Implementation should be driven by:

```text
PRODUCT_OUTCOME
→ REAL_USER_FLOW
→ DOMAIN_AUTHORITIES
→ SURFACE_CONTRACT
→ AURORA_PATTERN
→ IMPLEMENTATION
→ MACHINE_VERIFICATION
→ REAL_UAT
```

This replaces component-driven delivery and reduces cycles of implementation → late UAT discovery → local patch → repeated redesign.

## 23. Non-goals

This design does not:

- authorize a full immediate frontend rewrite;
- authorize redesign of every existing Nexus module;
- alter Finance/domain/security authority;
- create or enable a jurisdiction adapter;
- change tenant isolation or authorization rules;
- authorize fictitious/demo product behavior;
- require every screen to use every Aurora pattern;
- require every local composition to become a global component.

## 24. Acceptance criteria for the architecture

The architecture is successfully adopted when:

1. official Aurora tokens/themes exist and are consumed semantically;
2. material new/touched surfaces use an approved Surface Contract;
3. frontend states derive from authoritative server/domain truth;
4. reusable Aurora patterns replace local dashboard improvisation;
5. critical states have deterministic automated contracts;
6. Human UAT separately evaluates domain truth, operational flow, Aurora experience, and persistence evidence;
7. Finance becomes the first coherent Reference Vertical without changing its domain truth for visual convenience;
8. future modules can reuse the same foundation rather than inventing a parallel visual language.

## 25. Approved design decisions

The Product Owner approved:

- product-wide Aurora governance rather than a Finance-only redesign;
- a progressive Core System rather than a speculative full component catalogue;
- Operational Workspace, Overview, Collection, Guided Configuration, Attention/Blocked, and Evidence patterns;
- mandatory Surface Contracts for material surfaces/flows;
- backend/BPM authority above presentation;
- semantic tokens and official Light/Dark/Tonal/System modes;
- accessibility and responsive behavior as Definition-of-Done concerns;
- Finance as the first Reference Vertical;
- autonomous safe implementation after design approval, with escalation only for genuine product/architecture/security/schema/BPM decisions.
