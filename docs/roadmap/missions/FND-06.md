# FND-06 — CI vNext Gate

**State:** PREPARATION. Implementation is not authorized until FND-05 is DONE and this Mission Pack passes DoR.

## Objective
Make remote CI enforce the actual foundation invariants that all later Nexus domains depend on, with identifiable failures and no documented PASS for suites that did not run.

## Origin
AUD-CI-001, uneven domain test maturity, Definition Ready/Done/Evidence v2, and the Foundation risks closed by FND-01 through FND-05.

## Dependency
FND-06 integrates the proven regression contracts from FND-01–05. It must not compensate for unfinished foundation defects by weakening, skipping or relabeling tests.

## Preserve
- existing useful CI jobs and isolated migration verification;
- deterministic PostgreSQL-backed tests;
- existing TypeScript/build checks;
- focused domain suites whose protected invariant remains valid;
- clear distinction between PASS, FAIL, BLOCKED and NOT RUN.

## IN
Remote CI coverage for the supported foundation surface, including:
- canonical migration clean-DB/bootstrap and checksum/ledger behavior from FND-01;
- write-authority/fence regressions from FND-02;
- cross-tenant negative coverage from FND-03;
- product-truth critical regressions from FND-04;
- audit-truth critical regressions from FND-05;
- Person / Identity / Membership foundation;
- Academic Year;
- Enrollment intake/idempotency;
- registration/relationships;
- document policy/files;
- enrollment validation/state transitions;
- atomic activation;
- TypeScript/build and other existing mandatory foundation checks.

## OUT
- solving unrelated test debt across future domains;
- hiding flaky/failing critical tests by removing them from the gate;
- marking optional/manual checks as automated PASS;
- broad CI platform migration unless required by a proven blocker;
- adding duplicate suites that protect no distinct invariant.

## Required preflight / evidence
Before modifying CI:
- enumerate current jobs/commands and which invariants they actually protect;
- map every required Foundation invariant to an executable repository command/test suite;
- identify gaps, duplicates, hidden setup dependencies and tests that currently do not run remotely;
- establish expected failure behavior for each required gate;
- keep database/service prerequisites deterministic and isolated from production data.

## Acceptance criteria
- **AC01 Foundation gate matrix:** each required Foundation invariant maps to a remote CI job/step and evidence reference.
- **AC02 Migration gate:** migration-only clean bootstrap, checksum/ledger integrity and fail-closed schema behavior run remotely against disposable PostgreSQL.
- **AC03 Authority gate:** critical FND-02 write-fence regressions run remotely and block integration on failure.
- **AC04 Tenant gate:** critical cross-tenant negative tests run remotely and block integration on failure.
- **AC05 Product/audit truth gate:** selected critical FND-04/FND-05 regressions run remotely where they protect Foundation behavior.
- **AC06 Core foundation gate:** Identity/Membership, Academic Year, Enrollment, document and atomic-activation suites required by the roadmap run remotely.
- **AC07 Failure visibility:** job/step/test output makes the failed protected invariant identifiable without treating a skipped/not-run suite as PASS.
- **AC08 Integration blocking:** required Foundation gate failure prevents integration according to repository branch/PR governance.
- **AC09 Determinism:** CI does not depend on production data, secrets not required by the tested contract, or hidden local-only bootstrap authority.
- **AC10 Evidence closeout:** the mission records the actual remote run/PR evidence for every required gate.

## Required tests / evidence
The CI workflow itself is proved by:
- successful remote run with all required jobs executed;
- controlled evidence that a representative required test failure produces a failing gate, where safe/practical during implementation;
- PostgreSQL service/bootstrap logs sufficient to prove disposable DB use;
- test output identifying suites/invariants;
- TypeScript/build results;
- branch/PR check evidence;
- Foundation gate matrix with AC-to-evidence references.

## DONE
FND-06 is DONE only when AC01–AC10 are PASS, every required Foundation invariant has a real remote gate, critical failures block integration, and no required suite is represented as passing when skipped or not executed.

## Stop rules
Stop and return to BLOCKED/PREPARATION if:
- a required Foundation invariant has no executable test contract yet;
- CI can pass while a critical required suite is skipped/not run;
- making CI green would require weakening/removing a critical regression;
- CI requires production/shared data or unsafe secrets;
- the blocker belongs to an unfinished FND-01–05 implementation rather than CI configuration.
