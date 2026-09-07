# FINANCE-F5-01 — Obligation-linked Adjustment v1

## Human UAT fixture

Use one open EUR Obligation originally issued at 100. Confirm an Allocation of 40. Register a decrease of 20 and confirm that an attempted decrease of 50 is rejected because the effective due cannot move below covered value. Register an increase of 10 and confirm the derived values are original 100, net adjustment -10, effective due 90, covered 40 and remaining coverable 50. A linked, opposite-direction partial compensation is optional and is capped cumulatively by its root Adjustment.

## Safety boundaries

Adjustment is an immutable fact. It never updates the original Obligation, Payment or Allocation facts. The same server-side position authority is used for Adjustment validation, Allocation validation and operational reads. Mutation requires institution_admin or financial; director is read-only.
