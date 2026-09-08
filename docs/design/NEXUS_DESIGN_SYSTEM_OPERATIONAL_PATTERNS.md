# NEXUS DESIGN SYSTEM — Operational Experience Patterns

**Status:** DRAFT — DS-P6 preparation.  
**Implementation authorisation:** No.  
**Product authority:** Nexus Experience & Guidance Model v1 + Nexus Aurora visual standard.

## 1. Core pattern

Every operational surface must answer, in this order:

1. What needs attention?
2. Why does it need attention?
3. What can I do now?
4. What happens after I act?

The experience adapts density and priority to the user profile, but never changes factual authority or required evidence.

## 2. Operational Center

The Operational Center is not a passive dashboard. It presents role/institution-scoped work in three layers:

| Layer | Purpose | Required item content |
|---|---|---|
| Attention now | Exception, blocked or risk work | owner, reason, state, age/SLA when relevant, safe next action |
| Work today | Normal workload | task context, due/sequence, primary action |
| School state | Small number of decision-useful indicators | period, source, detail path and action implication |

Avoid decorative charts, vanity metrics and generic module tiles.

## 3. Workspace pattern

A module workspace uses:

1. **Context header** — title, institution/process context, time/source when relevant.
2. **Priority/action area** — one primary permitted action and current exceptions.
3. **Operational list/queue** — sortable/filterable work with factual state.
4. **Detail/review surface** — decision context, history/evidence, consequences and authorised action.
5. **Result/next step** — confirmed outcome or clear pending/error route.

Stable navigation is for orientation. Contextual actions are for execution; they must not duplicate one another.

## 4. Queue pattern

A queue item must visibly state:

- owner/responsible role;
- reason;
- factual/business status;
- priority or deadline where applicable;
- age/SLA where applicable;
- permitted next action; and
- source/evidence reference where relevant.

The UI cannot make an item vanish because it was recalculated, deferred or unavailable. It must state the current condition and legitimate next route.

## 5. Decision/review pattern

Use this pattern for approvals, conflicts, corrections and exceptions:

> Context → factual state → evidence/source → permitted choices → action consequence → recorded result

- Show only authorised choices.
- Explain the effect before a consequential action.
- Preserve original/history visible under authorisation.
- Clearly distinguish “pending”, “proposed”, “approved”, “rejected”, “failed” and “confirmed”.
- Never let a visual badge substitute evidence or decision detail.

## 6. Timeline/evidence pattern

A timeline is used when history changes meaning:

- order events by explicit time;
- show actor, action, state and evidence reference;
- distinguish device-recorded and server-confirmed time where relevant;
- label policy/version/source when it determines the result;
- do not use decorative progress percentage for non-linear/uncertain work.

## 7. Empty, unavailable and guided first use

| Situation | Required message |
|---|---|
| Empty | What belongs here and the legitimate first action |
| No permission | Human language explanation and contact/next permitted route |
| Dependency unavailable | What cannot be confirmed, whether work is blocked and retry/next action |
| First use | Progressive guidance for the next operation only |
| Critical action | Preview of consequence before confirmation |

## 8. Attendance application boundary

Attendance must later derive its teacher session workspace, coordination decision queue, guardian/learner history, alerts and report/export review from these patterns. It may not invent a separate dashboard/card language.

