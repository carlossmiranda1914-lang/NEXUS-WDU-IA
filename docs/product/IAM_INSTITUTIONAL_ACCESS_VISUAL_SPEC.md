# Nexus Edu IA — Institutional Access Center — Implementation Visual Spec

**Status:** CLOSED AS IMPLEMENTATION SPECIFICATION — code authorization remains subject to the active IAM Mission/explicit owner authorization.  
**Visual ID:** V2-09 / IAM-UX — Institutional Access Center  
**Primary user:** authorized Institution Admin  
**Primary job:** administer institutional Membership access for the currently resolved institution without reintroducing legacy `users` authority.

## 1. Authority and reconciliation

This specification materializes the already-approved IAM direction; it does not create a parallel product or architecture.

Precedence for implementation:
1. `docs/roadmap/IMPLEMENTATION_PLAN_VNEXT_V2.md` and active IAM Mission/acceptance contract;
2. `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md` and accepted compatible ADRs;
3. canonical backend/query/command contracts and current schema/migrations;
4. CI/tests/quality gates and factual project state;
5. governed Visual Product Architecture (`Nexus_Visual_Product_Architecture_Spec_v1`) and Nexus Aurora visual contract;
6. this bounded implementation specification;
7. local component implementation choices.

If a higher authority changes materially, this spec returns to REVIEW REQUIRED for the affected section. Do not change architecture or backend semantics to make the screen easier to build.

## 2. Why this surface is next

The canonical roadmap orders `Foundation → IAM / institutional access lifecycle → Enrollment hardening → Academic Core → ...`. Foundation is the prerequisite trust layer; IAM is the first post-Foundation program. The governed Visual Product Architecture independently uses the same order and identifies V2 IAM before V3 Enrollment.

This surface is intentionally a bounded IAM closeout/validation slice, not permission-system expansion. Once its authorized read/mutation contract, states, responsive behavior and evidence are proven, do not opportunistically add policy builders, global permission matrices or future-domain administration.

## 3. Canonical product model

The UI manages **Membership relationships**, not generic user rows.

Required conceptual separation:
- Authentication/Identity answers who the account is.
- Person is the human identity record.
- Membership answers where and in which institutional role the Person acts.
- Institution is the server-resolved institutional scope.
- Platform Admin is separate from Institution Admin and is never an ordinary school role option.

Never use `users.role`, `dbRole`, local permission matrices, hidden buttons, browser-selected institution, or legacy `SystemConfigLegacy` state as IAM authority.

## 4. Backend contract boundary for this slice

The implementation must bind only to IAM endpoints/commands proven on the accepted implementation branch/baseline.

Expected already-authorized contract from the IAM handoff, to be reverified before code:
- `GET /api/iam/memberships?status=&role=&cursor=&limit=` — institution-scoped server-side read for Institution Admin;
- `PATCH /api/iam/memberships/:membershipId/role` — authorized role change;
- `POST /api/iam/memberships/:membershipId/revoke` — authorized revocation;
- `POST /api/iam/memberships/grants` — only where the active Mission contract proves the safe pending-Membership/validated-Intent activation path.

`BootstrapInstitutionAdmin` is internal-only and has no browser route.

Before frontend implementation, reverify exact request/response fields, status codes, version/concurrency field, role enum and last-admin error contract from code/tests. This document does not invent them.

## 5. Information architecture

### 5.1 Workspace header

Use the platform workspace-header pattern:
- breadcrumb/context: `Definições / Acessos institucionais` or the canonical route equivalent;
- title: **Acessos institucionais**;
- short description: **Gerir quem pode aceder a esta instituição e com que papel.**
- institution context must be identifiable from the resolved application context; never expose an editable `institutionId` authority control;
- no competing primary actions.

A grant/activation primary action appears only if the active IAM contract supports the safe lifecycle. Otherwise the page remains a complete read/manage-existing-access surface without a fake CTA.

### 5.2 Control row

Desktop/tablet:
- role filter;
- Membership status filter;
- optional reset when filters are active;
- no global person/email/UID search unless a later authorized query contract exists.

Filters change the authorized list query only. They never change tenant scope.

### 5.3 Dense administration table — desktop

Use a table because this is repetitive administrative work.

Columns are limited to fields actually returned by the safe read API. Preferred semantic order when supported:
1. Pessoa — safe display name/identifier supplied by the endpoint;
2. Papel institucional;
3. Estado de acesso/Membership;
4. Última alteração factual, only if returned by the authorized projection;
5. Ações.

Do not expose email, phone, Firebase UID, Identity internals, Intent code/hash, ledger/audit internals, SQL/version internals or foreign-tenant facts merely to make the table look complete.

If identity-binding state is not part of the safe read projection for this slice, omit it even though the broader V2 target model permits it when relevant.

### 5.4 Row actions

Use one clear contextual action/menu per row rather than a wall of buttons.

Allowed only when supported by backend policy:
- **Alterar papel**;
- **Revogar acesso**.

No permanent-delete action. Revoking Membership access does not delete the Person.

### 5.5 Pagination

Use cursor-based pagination matching the read API. The UI must not fabricate total pages/count when the API does not return a factual total. Controls should express safe next/previous behavior only to the extent supported by the query contract.

## 6. Interaction contracts

### 6.1 Change role

Preferred form: short modal/dialog.

Must show:
- Person context using only safe returned display data;
- current institutional role;
- target role options allowed by the canonical enum/policy;
- institution context when needed to prevent ambiguity;
- consequence-oriented confirmation copy.

Must not show Platform Admin as an assignable school role.

Flow:
`context → choose authorized target role → submit → server validation/command → confirmed response → authoritative list/detail refresh`.

No optimistic success. Disable duplicate submission while processing.

### 6.2 Revoke access

Use a destructive confirmation dialog.

Copy must explain that the person's institutional access will end; it must not imply deletion of identity/person/history.

Last-admin safety belongs to backend policy. The UI may explain a returned last-admin prohibition but must never calculate or decide it locally.

Flow:
`context → revoke intent → server validation → confirmed revocation or safe error → authoritative refresh`.

### 6.3 Grant/activate access

OUT unless the accepted IAM implementation baseline proves the constrained pending-Membership + validated-Intent flow described by the active Mission. Never add free global Person/email/UID lookup. Never create a synthetic user/identity. Never expose Bootstrap.

If authorized, implement as a separate bounded interaction using only server-provided eligible context; otherwise omit the action completely.

## 7. Conflict and concurrency

A `409` is a first-class **Conflict** state, not a generic failure.

Required behavior:
- do not silently retry;
- do not replace the expected version with a newer one and resubmit automatically;
- tell the user the access changed meanwhile;
- refresh/reload authoritative data;
- require a fresh explicit user decision before another mutation.

Version/concurrency data may be transported by the client when the API contract requires it, but it is implementation metadata, not a user-facing authority field.

## 8. System states

The surface must explicitly implement applicable states:

- **Loading:** skeleton/progress distinct from empty data.
- **Empty:** no Memberships match the current authorized scope/filters; offer reset filters when relevant.
- **Error:** factual load/mutation failure with safe retry/recovery.
- **No permission / 403:** neutral fail-closed state; no protected Membership details remain visible.
- **Conflict / 409:** concurrent/stale state; refresh and require a new decision.
- **Processing:** mutation in flight; no duplicate action.
- **Confirmed:** only after authoritative command success, followed by reconciliation/readback.
- **Unavailable dependency:** only when a required real service/contract is unavailable; never replace with mock data.

Do not leak stack traces, SQL, internal authorization reasons, Intent secrets/hashes, Firebase UID or PII not authorized by the read model.

## 9. Responsive contract

### Desktop
- dense table is primary;
- filters remain visible and compact;
- row actions contextual;
- dialogs remain bounded and keyboard accessible.

### Tablet
- preserve Person, role, status and action semantics;
- lower-priority factual metadata may collapse before core semantics;
- touch targets remain usable.

### Mobile
Do not compress the desktop table horizontally. Convert each Membership to a compact record/card/list item containing:
- safe Person display;
- role;
- status;
- one contextual action/menu.

Filters may use a compact control/sheet, but active filters remain understandable. Institution context, access state, dangerous-action consequence and conflict/no-permission truth may never disappear because of viewport size.

## 10. Accessibility and language

Target WCAG AA for the implemented surface.

Mandatory:
- semantic table/list/dialog controls;
- visible keyboard focus;
- logical heading and tab order;
- dialog focus containment/restoration;
- accessible names for icon controls;
- status is never communicated by color alone;
- errors are associated with the action/control that caused them;
- reduced-motion respected;
- practical touch targets;
- Portuguese professional product language, concise and consequence-oriented.

Avoid developer vocabulary in user copy (`membershipId`, `expectedVersion`, `Intent`, `UID`, SQL, stack trace).

## 11. Nexus Aurora visual contract for this surface

The governed visual specification defines **Nexus Aurora** as institutional, premium, human, calm, precise and technologically current. Avoid cyberpunk, excessive fluorescence, childish styling and cold banking aesthetics.

Canonical visual tokens for new/changed IAM UI:
- `brand.void` `#031D18`
- `brand.deep` `#064C3C`
- `action.primary` `#0B8B62`
- `accent.vivid` `#28C76F`
- `accent.lime` `#9BEA4A`
- `surface.canvas` `#F5FAF7`
- `surface.mint` `#DDF9E8`
- `text.primary` `#102E27`
- `ai.primary` `#00A6A6`
- `info` `#3478E5`
- `success` `#15803D`
- `warning` `#F2A93B`
- `danger` `#E65362`

Recommended distribution: ~85% neutral surfaces, ~10% structural greens, <=5% vivid accents. Lime is not dominant. AI turquoise is not the primary action color.

Modes in the visual contract: Light default, Dark, Tonal Nexus, and Follow device.

### Current-code reconciliation

Current `src/index.css` still defines a blue/indigo primary (`#2563EB`) and dark-first body fallback. This is AS-IS evidence, not authority to redesign IAM in blue.

For this slice:
- introduce/reuse **semantic Nexus Aurora tokens** through the smallest safe design-system/theme layer needed by the new surface;
- do not perform a repository-wide class-by-class recolor as part of IAM;
- do not globally remap every existing `indigo-*` utility to green, because that could alter unrelated transitional screens;
- preserve current typography baseline (Inter, readable 14/16/20/24/30 hierarchy) unless a higher canonical design source supersedes it;
- implement Light and Dark behavior for the new surface using semantic tokens; Tonal Nexus may be wired only if the application already has an authoritative mode mechanism. Do not invent a parallel theme switcher inside IAM.

The target is convergence by semantic tokens, not cosmetic mass replacement.

## 12. Component semantics

Use:
- Workspace Header — context/title/one dominant action;
- Table — dense desktop administration;
- Compact Record/List — mobile equivalent;
- Modal/Dialog — short role edit and destructive confirmation;
- Status badge/text — factual Membership state;
- Inline/system feedback — processing/error/conflict/confirmed;
- Pagination controls — cursor navigation.

Avoid:
- nested card dashboards;
- KPI counters without a real operational question/source;
- decorative permission matrices;
- role heatmaps;
- large hero areas;
- gradients as default decoration;
- permanent toast-only critical feedback;
- animation that does not clarify state.

## 13. Explicit non-goals / stop rules

Do not implement in this slice:
- legacy `SystemConfigLegacy` user administration;
- Platform Admin management;
- permission-policy builder/capability matrix editor;
- global Person/email/Firebase UID search;
- same-institution multi-role switcher or union-of-permissions semantics;
- access-request/invite lifecycle beyond the exact authorized IAM command/query contract;
- email-verification state machine redesign;
- audit-history UI unless a safe canonical read API is separately authorized;
- general app-shell/navigation redesign;
- repository-wide visual migration;
- Figma-driven product changes.

Stop and classify BLOCKED if implementation requires any of these to make the basic center work.

## 14. Acceptance contract

The implementation slice is acceptable only when all applicable items are proven:

**AC01 — Authority:** page is reachable only through the authorized application path and protected API remains backend-authoritative.

**AC02 — Read truth:** list, role/status filters and cursor pagination use the safe institution-scoped IAM read API; no legacy users data fills gaps.

**AC03 — Role change:** authorized change uses the canonical command/route; Platform Admin is not assignable; success appears only after server confirmation/readback.

**AC04 — Revocation:** authorized revoke uses the canonical command/route; last-admin protection is backend-decided; no Person/Identity deletion is implied or performed.

**AC05 — Conflict:** 409 never auto-retries with a new version; authoritative data is refreshed and a new explicit decision is required.

**AC06 — No leakage:** no forbidden PII/UID/Intent/SQL/stack/cross-tenant information is rendered or logged by the UI.

**AC07 — States:** loading, empty, error, no-permission, processing, confirmed and conflict are behaviorally distinct where applicable.

**AC08 — Responsive:** desktop table and mobile compact-record experience preserve the same authority/state semantics without critical horizontal overflow.

**AC09 — Accessibility:** core list/filter/change/revoke workflow is keyboard operable with visible focus, accessible dialogs/names and non-color-only state communication.

**AC10 — Visual parity:** new IAM surface uses semantic Nexus Aurora tokens and does not trigger an unrelated global redesign.

**AC11 — Regression:** relevant IAM negative tests plus repository-required lint/build/quality gates pass; skipped/not-run evidence is never called PASS.

**AC12 — Scope closure:** no legacy admin revival, policy builder, global lookup, multi-role semantic invention or future-domain expansion is included.

## 15. Implementation sequence

1. Reverify accepted IAM branch/PR/Mission and exact API contracts against current repository state.
2. Validate/integrate repository-local `nexus-ui-ux` and `nexus-code-review` Skills or apply their reviewed guardrails without treating them as higher authority.
3. Add the smallest semantic Nexus Aurora token/theme bridge needed for this surface.
4. Add Institutional Access feature/query layer and typed API mapping.
5. Implement workspace + filters + desktop table + cursor pagination.
6. Implement role-change dialog and authoritative reconciliation.
7. Implement revoke dialog, last-admin server error mapping and reconciliation.
8. Implement 403/409/error/loading/empty/confirmed states.
9. Implement mobile compact records and responsive filters.
10. Run accessibility/keyboard review.
11. Run `nexus-code-review` against architecture/security/product-truth invariants.
12. Run required targeted tests + lint/build/quality gate and record evidence.
13. Close the IAM UI slice when AC01–AC12 are proven; move to the next roadmap tranche rather than expanding IAM opportunistically.

## 16. Current reconciliation result

- Roadmap parity: **PASS** — IAM is explicitly the first post-Foundation program.
- Architecture parity: **PASS** — Membership/InstitutionalContext/backend authority preserved.
- Visual architecture parity: **PASS** — V2-09 already specifies Institution Admin, Membership administration, dense table, role/status filters and authorized actions.
- Current visual implementation parity: **TRANSITIONAL** — repository styling is still blue/dark-first and current SystemConfig intentionally fences legacy access administration.
- Implementation readiness of exact IAM UI API binding: **REVERIFY REQUIRED** — the transferred handoff reports CP3/CP3.1/CP3.2/IAM-UX-02 completion, but those exact post-Foundation IAM commits/branches were not visible on current remote `main` during this reconciliation.

Therefore this specification is closed as the implementation target, while code must start from the branch/baseline that actually contains the proven IAM command/read contracts. Do not recreate those contracts from this document.
