# Accessibility

Treat accessibility as functional quality.

- Use semantic controls and native behavior before custom interaction primitives.
- Every interactive control needs an accessible name and visible purpose.
- Preserve logical heading structure, reading order and keyboard order.
- Provide visible focus; never remove it without an equivalent replacement.
- Ensure all core workflows are keyboard-operable, including dialogs, menus, tables and permission controls.
- Do not communicate status, permission or validation by color alone.
- Associate validation/help text with its field and move focus appropriately for blocking errors.
- Announce important asynchronous results where the component pattern requires it.
- Keep touch/click targets practical and avoid densely packed destructive actions.
- Respect user text scaling/zoom and reduced-motion preferences.
- Maintain sufficient text/control contrast under the project's chosen palette.
- In dialogs/drawers: manage initial focus, trap/contain focus as appropriate, support Escape where safe, and restore focus on close.

When an existing shared component violates these rules, prefer a focused shared fix if it is safe and in scope; otherwise record the inherited limitation rather than silently duplicating the component.
