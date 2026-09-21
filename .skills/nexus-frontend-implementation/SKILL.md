---
name: nexus-frontend-implementation
description: Implement and mature Nexus Edu IA frontend surfaces from an approved UI/UX plan or existing product flow. Use when Codex must build, refine, reconcile, or review Nexus screens, tables, drawers, forms, navigation, dashboards, responsive states, or cross-entity workflows. Enforces plan-first execution, information architecture, product truth, existing design-system reuse, one-layer-at-a-time changes, visual/behavioral gates, and evidence-based completion without inventing backend capability or creating page-specific generic UI.
---

# Nexus Frontend Implementation

Implement approved Nexus UI/UX deliberately. Treat the frontend as a product surface over authoritative domain contracts, not as a place to invent behavior or decorate missing capability.

## Authority

When guidance conflicts, use this order:
1. canonical architecture, schema, backend and authorization contracts;
2. active authorized mission and acceptance criteria;
3. approved UI/UX plan or reconciled information architecture;
4. canonical Nexus design tokens, components and patterns;
5. `nexus-ui-ux` guidance;
6. this skill.

Never change a higher authority merely to make the frontend easier to implement.

## Operating model

Use this sequence:

`observe -> map -> plan -> approve -> implement one surface -> verify -> integrate -> human UAT`

Do not jump directly from a vague request to JSX/CSS.

## 1. Observe before editing

Inspect only the changed surface and its immediate neighbors. Identify:
- primary user and task;
- entity or workflow being represented;
- authoritative backend/API data already available;
- existing shared components/tokens/patterns;
- loading, empty, denied, error, success and destructive states;
- desktop and narrow/mobile behavior;
- cross-entity relationships the user must understand.

If a relationship is unclear, prove whether it exists in domain/API before designing around it.

## 2. Map the product flow

For a workflow spanning multiple entities or screens, write a compact flow map before implementation:

`source entity -> action/event -> relationship -> resulting entity/document -> next valid action`

Example for Finance:

`Obligation -> Invoice -> Payment -> Allocation -> Receipt -> Financial Document`

The map is about business meaning, not route names or component names.

For each relationship classify:
- `DOMAIN_PRESENT`
- `API_PRESENT`
- `UI_PRESENT`
- `UI_UNCLEAR`
- `MISSING_CONTRACT`

Do not solve `MISSING_CONTRACT` with frontend state.

## 3. Create an implementation plan, not three speculative designs

Use the approved Nexus product direction. Do not generate multiple visual concepts by default.

For each changed region specify:
- purpose;
- information hierarchy;
- primary action;
- contextual secondary actions;
- states;
- existing component/token to reuse;
- affected layer: UI only, wiring, API, or domain;
- verification method.

If the user has not approved the flow or hierarchy, stop before code and request approval of the compact plan.

## 4. Prefer contextual structure over generic UI

Do not turn every problem into cards, badges, tabs, modals, or action menus.

Prefer:
- table/list for scanning many records;
- contextual detail panel/drawer/page for one selected record;
- explicit relationship blocks for related entities;
- progressive disclosure for secondary metadata;
- dedicated workspace for long or high-impact workflows;
- concise labels in user language rather than internal IDs or implementation terminology.

A table row should not accumulate unrelated buttons. Expose one clear primary action and move contextual actions into the selected entity context when possible.

## 5. Preserve business meaning

Keep concepts visually distinct when they are distinct in the domain.

Examples:
- payment is not receipt;
- payment confirmation is not allocation;
- invoice is not obligation;
- financial document is not the financial event itself;
- role display is not authorization authority.

Use grouping, headings and explanatory microcopy only where needed to make these distinctions understandable.

## 6. Implement one layer at a time

Default to one affected layer.

If UI already has authoritative data, change UI only.
If data exists in domain but is not exposed, stop and classify the gap before changing API.
If both backend/API and frontend must change under one explicit contract, state:

`CROSS_LAYER_CHANGE_REQUIRED=YES`

Then execute sequentially:

`contract/backend -> verify -> API/wiring -> verify -> frontend -> verify`

Never perform speculative backend and frontend refactors in parallel.

## 7. Reuse before creating

Before adding a component, search for an existing canonical Nexus equivalent.

Create a new shared component only when:
- at least two real surfaces need the same semantic pattern, or
- the existing shared component cannot satisfy the approved contract safely.

Do not create a new local design system inside a feature folder.
Do not fork spacing, radii, colors or typography without an approved reason.

## 8. Required states

For every changed interactive surface, implement only applicable states, but never omit a required one:
- loading;
- empty;
- filtered empty;
- denied/forbidden;
- unavailable;
- validation error;
- server error/retry;
- in-flight mutation;
- success/read-back;
- stale/conflict state when the contract supports versioning;
- destructive confirmation when applicable.

Success must reconcile from backend truth where the operation is authoritative.

## 9. Visual maturity gate

Before claiming completion, compare the implementation against the approved hierarchy and neighboring Nexus surfaces.

Check:
- primary task is obvious;
- related information is grouped by business meaning;
- no unnecessary nested cards/borders/badges;
- actions are not cluttered across rows;
- typography and spacing create hierarchy before decoration;
- dense administrative data remains scannable;
- long workflows are not trapped in small modals;
- desktop and narrow widths are both usable;
- focus/keyboard/accessibility basics work;
- no mock/demo state appears as institutional truth.

Load `references/frontend-maturity-gates.md` when implementing or reviewing a substantial screen or workflow.

## 10. Verification order

Use the cheapest high-signal checks first:
1. targeted component/contract test;
2. affected client/wiring test;
3. relevant integration test if data flow changed;
4. type/lint/build checks required by the project;
5. visual inspection at representative desktop + narrow viewport;
6. Human UAT for the real workflow.

Do not rerun unrelated green suites.

## Completion report

Keep the report compact:

- `IMPLEMENTED=` what changed;
- `AUTHORITY_PRESERVED=` yes/no;
- `UI_PLAN_MATCH=` pass/fail;
- `PRODUCT_TRUTH=` pass/fail;
- `RESPONSIVE=` pass/fail/unverified;
- `ACCESSIBILITY=` pass/fail/unverified;
- `TARGETED_TESTS=` pass/fail;
- `HUMAN_UAT_READY=` yes/no;
- `OUT_OF_SCOPE_FINDINGS=` factual findings only.

Do not call the frontend mature because it looks polished. Mature means the user can understand the business state, complete the task, recover from failure, and trust that visible results correspond to authoritative system behavior.
