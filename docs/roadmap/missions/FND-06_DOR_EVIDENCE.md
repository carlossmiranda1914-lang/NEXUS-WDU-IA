# FND-06 — Definition of Ready Evidence

**State:** IMPLEMENTING — CP0 PASS. Preparation and CP0 changed no workflow, secret, repository setting or production source.

## Locked checkpoints

| CP | Scope / PASS gate |
|---|---|
| CP0 | deterministic CI baseline and runner failure characterization |
| CP1 | complete gate matrix, every Foundation invariant classified |
| CP2 | tracked credential/configuration replacement, rotation authority, Firebase restrictions/rules, secret detection |
| CP3 | required FND-01–05 aggregate commands with missing-test/failure propagation |
| CP4 | isolated PostgreSQL service, migration-only bootstrap and disposable cleanup |
| CP5 | lint/build/diff/temporary/secret gates, safe logging and warning policy |
| CP6 | branch-protection, required-check and failure-characterization evidence |
| CP7 | final remote Foundation exit validation |

AC01–AC10 in the Mission Pack remain canonical. Required implementation evidence includes a controlled failing representative, stable `quality-gate` check name, isolated PostgreSQL, no production secrets, and actual PR/branch-protection evidence. Existing bundle-size and two direct-eval warnings are not suppressed in DoR; CP5 decides whether their evidence/policy needs change.

Stop if a critical local-only invariant cannot become a deterministic remote gate, credential ownership/rotation cannot be authorised, PostgreSQL isolation is unsafe, or branch-protection evidence requires an unavailable governance decision.
## CP0 evidence — PASS

`npm run test:fnd06` runs a deterministic aggregate that characterizes the current quality-gate without modifying it. The runner proves propagation for representative pass, non-zero exit, missing-file and timeout fixtures. The workflow characterization records the existing path-filtered PR trigger, PostgreSQL 16, Node 24, `npm ci`, concurrency, 20-minute timeout, lint and build steps. It also proves the present gaps: no `main` trigger, no direct FND-02–FND-05 aggregate commands, no `git diff --check`, and no authoritative secret scanner.
