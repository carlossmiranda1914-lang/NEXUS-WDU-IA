# FND-04 — Product Truth Cleanup

**State:** PREPARATION.

## Objective
Ensure no mock, simulation, hardcoded institutional data or client-only state is presented as a real operational capability.

## Origin
AUD-CONFIG-001, AUD-PARENT-001, AUD-DOC-PRODUCT-001, GlobalSearch/localStorage/import findings.

## IN
Inventory user-visible capabilities that claim persistence, synchronization, payment, signature, certificate, search, security or institutional records. Classify REAL, PROTOTYPE, DEMO, BROKEN or UNKNOWN.

## DONE
- production/operational paths never report fake success;
- prototypes are clearly isolated/labeled or removed from operational navigation;
- demo/legal content cannot be mistaken for institution-issued evidence;
- client localStorage is not described as institutional persistence;
- tests cover critical failure-to-success misrepresentation.

## Stop rules
Do not turn every prototype into a real feature in this mission. If product still wants it, create a future domain mission with proper contracts.
