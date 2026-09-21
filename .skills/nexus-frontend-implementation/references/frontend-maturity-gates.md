# Nexus frontend maturity gates

Use these gates for substantial frontend work. Apply only the gates relevant to the changed surface.

## Gate A — Information architecture
- Can the user state what object/process they are looking at?
- Is the primary task obvious without reading every control?
- Are related facts grouped by business meaning rather than database shape?
- Can a selected record expose its context without forcing tab-hopping?
- Are important relationships visible or directly navigable?

## Gate B — Domain clarity
- Distinct domain concepts remain distinct in language and layout.
- Status labels explain operational meaning when raw state names are ambiguous.
- Internal IDs are secondary to user-meaningful labels.
- Derived summaries can be traced to authoritative records.

## Gate C — Action discipline
- One clear primary action per context where practical.
- Secondary actions are contextual, not permanently scattered across every row.
- Dangerous actions expose scope/consequence.
- Disabled controls do not masquerade as authorization.

## Gate D — Product truth
- Every success state has real backend evidence.
- No local/demo placeholder is presented as institutional data.
- Loading, empty, denied, unavailable and error states are visually/semantically distinct.
- Read-back reflects authoritative state after mutation.

## Gate E — Visual system
- Existing Nexus tokens/components are reused where suitable.
- Hierarchy relies first on type, spacing, alignment and grouping.
- Avoid gratuitous gradients, glass, nested cards, badge inflation and one-off component styling.
- Dense operational screens optimize scanning, not decoration.

## Gate F — Responsive and accessibility
- Representative desktop and narrow/mobile widths are inspected.
- Critical actions/content are reachable without accidental horizontal overflow.
- Keyboard path works for the core task.
- Focus is visible and logical.
- Labels, errors and status do not rely on color alone.

## Gate G — Evidence
- Targeted tests cover changed behavior/contracts.
- Visual inspection is explicitly recorded.
- Human UAT is required for important operational workflows before closure.
- Unverified claims remain marked unverified.
