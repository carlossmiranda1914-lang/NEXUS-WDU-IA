# Visual quality gate

Before claiming UI work complete, verify the changed surface against this gate.

## Product truth
- Primary action performs a real authorized operation or is explicitly unavailable.
- Loading, empty, error, denied, disabled and success states are semantically distinct where applicable.
- No mock/demo/local-only state is presented as institutional truth.

## Hierarchy and consistency
- Primary task/action is visually clear.
- Typography, spacing, controls, radii and elevation follow existing tokens/components.
- No unnecessary nested cards, badges, borders or competing accent treatments.
- Copy is concise, specific and consistent with the domain language.

## Interaction
- Keyboard path works for the core task.
- Focus is visible and sensible.
- Destructive/high-impact actions communicate scope and consequence.
- Async mutations prevent accidental duplicate action and expose failure/retry safely.

## Responsive
- Inspect at a representative desktop width and a narrow/mobile width.
- No clipped critical content, unusable horizontal overflow or unreachable action.
- Priority reflows rather than simply shrinking.

## Evidence
Record what was inspected and which automated checks were run. Never label uninspected responsive/accessibility behavior PASS. If browser/E2E verification is unavailable, state that limitation explicitly.
