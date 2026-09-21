# Interaction patterns

## Forms
- Use explicit labels; placeholders are examples, not labels.
- Group related fields and keep optionality clear.
- Validate at useful moments without noisy validation before interaction.
- Preserve user input after recoverable server errors.
- Prevent duplicate submission while a mutation is in flight.

## Async states
- Loading must not look like empty data.
- Empty states explain the state and expose the next valid action when one exists.
- Errors state what failed and provide a safe recovery action when possible.
- Success is shown only after the authoritative operation succeeds.

## Tables/lists
- Keep the primary entity and important status scannable.
- Avoid horizontal action clutter; use a clear primary action and contextual secondary actions.
- Filters/search must expose active criteria and allow reset.
- Preserve useful state across non-destructive navigation when consistent with product behavior.

## Dialogs and destructive actions
- Use confirmation when impact is hard to reverse, security-sensitive or broad.
- Name the affected object/scope in user-safe language.
- Explain consequence, not implementation detail.
- Do not use generic `Are you sure?` as the only warning for high-impact changes.
- Disable/restrict repeated submission while processing, but enforce safety on the backend too.

## Feedback
- Put feedback near the initiating action or affected region.
- Do not rely solely on transient toast messages for information the user must retain or act upon.
