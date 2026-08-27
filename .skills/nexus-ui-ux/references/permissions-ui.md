# Permissions UI

Use for Membership, institutional role, capability and permission-management surfaces.

## Mental model
- Make clear **who** is being changed, **within which institution/context**, **what access changes**, and **when it becomes effective** when the backend contract supports that information.
- Do not present global identity attributes as institutional permissions.
- Keep Platform Admin semantics visually and conceptually separate from Institution Admin semantics.

## Display
- Prefer human-readable role/capability names with concise descriptions of consequence.
- Distinguish inherited/effective access from directly editable assignments when the data model makes that distinction.
- Do not expose raw internal permission identifiers as the primary user language.
- Make current/effective state scannable before offering edit controls.

## Editing
- Never use client-side hiding/disablement as authorization enforcement.
- High-impact grants/revocations require explicit consequence and affected scope.
- Guard against accidental self-elevation and accidental removal of required administrative access according to backend policy.
- When an action is denied, explain the user-actionable reason without leaking protected authorization internals.
- After mutation, reconcile from backend truth rather than permanently trusting optimistic local state.

## States
Design explicit loading, no-membership/no-access, denied, stale/conflict, validation error, mutation failure and success/reconciled states where applicable.

## Audit awareness
If the product exposes change history, show only canonical durable audit/history data. Never manufacture a local activity log to imply auditability.
