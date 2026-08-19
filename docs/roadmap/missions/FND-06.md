# FND-06 — CI vNext Gate

**State:** PREPARATION.

## Objective
Make remote CI prove the foundation that future modules depend on.

## Origin
AUD-CI-001 and uneven domain test maturity.

## IN
Migration clean-DB proof, TypeScript/build, Identity/Membership, tenant-negative tests, Academic Year, Enrollment intake/idempotency, registration/relationships, document policy/files, validation and atomic activation, plus regressions introduced by FND-01–05.

## DONE
- remote CI executes the agreed foundation suites;
- failures block integration;
- test names/output make the protected invariant identifiable;
- no critical suite is documented as passing when it was not executed;
- branch/PR evidence is attached to mission closeout.

## Stop rules
Do not hide flaky or failing critical tests by removing them from the gate. Diagnose or explicitly block the mission.
