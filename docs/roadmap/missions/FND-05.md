# FND-05 — Audit Truth

**State:** PREPARATION.

## Objective
Make audit evidence factual, actor-correct and distinguish human commands from system-derived reconciliation.

## Origin
AUD-AUDIT-001, AUD-DOC-AUDIT-001, AUD-PROCESS-001/002.

## IN
Raw audit event contract, actor identity, system actor semantics, business-friendly presentation mapping, correlation/request IDs and critical domain events.

## DONE
- raw audit evidence is immutable/factual;
- presentation never invents receipts, signatures, approvals or other actions;
- actual actor is recorded for document/admin mutations;
- automatic projection reconciliation is distinguishable from human action;
- audit tests cover actor, tenant, action, result and correlation for critical writes.

## Stop rules
Do not rewrite historical evidence to make it look cleaner. Historical anomalies are documented; new writes follow the corrected contract.
