# FND-06 — CI Gate Matrix

**State:** CP1 PASS — AS-IS characterization only. Baseline `2c311679c039638453a0843315dfd52d23586a3f`.

`Secretariat Quality Gate` / job `quality-gate` is the sole current workflow evidence. It runs on a filtered `pull_request` and on two historical feature-branch push patterns, not `main`; it has a 20-minute timeout, concurrency cancellation, PostgreSQL 16 and Node 24. No current remote required-check/branch-protection evidence has been collected.

| ID | Protected invariant | Local executable evidence | Workflow / current class | Owner | Decision, RED evidence and rollback |
|---|---|---|---|---|---|
| CG-01 | FND-01 ordered migrations, ledger, checksum and rollback | `tests/migration-runner.test.ts`; `test:migrations:isolated` | non-PostgreSQL runner/policy aggregate runs; disposable DB remains CP4 — PARTIAL | CP4 | synthetic checksum mismatch/migration error; remove CP4 workflow step |
| CG-02 | FND-02 write authority | `test:fnd02` and its eight contracts | Foundation aggregate invokes it — ENFORCED (filtered PR only) | CP3 | synthetic forbidden-write contract; remove aggregate invocation |
| CG-03 | FND-03 tenant isolation | `test:fnd03` and InstitutionalContext/resource contracts | Foundation aggregate invokes it — ENFORCED (filtered PR only) | CP3 | cross-tenant synthetic fixture; remove aggregate invocation |
| CG-04 | FND-04 Product Truth | `test:fnd04` runner/contracts | Foundation aggregate invokes it — ENFORCED (filtered PR only) | CP3 | factual-claim fixture; remove aggregate invocation |
| CG-05 | FND-05 Audit Truth | `test:fnd05` runner/contracts | Foundation aggregate invokes it — ENFORCED (filtered PR only) | CP3 | audit failure fixture; remove aggregate invocation |
| CG-06 | Identity, Person, Membership, InstitutionalContext, Enrollment/StudentProfile and Enrollment Documents | Foundation aggregate FND runners plus explicit FND-01 policy | Foundation aggregate invokes it — ENFORCED (filtered PR only) | CP3 | synthetic ownership/access fixture; revert invocation only |
| CG-07 | School Tasks PostgreSQL history/snapshots | `test:fnd01:cp4:postgres` | local only — LOCAL_ONLY | CP4 | disposable PostgreSQL gate; transaction/snapshot failure fixture; remove service step |
| CG-08 | lint and production build | `lint`; `build` | both named workflow steps — ENFORCED (filtered PR only) | CP5 | preserve warnings until policy; deliberate type/build fixture on temporary branch; revert policy/step |
| CG-09 | diff/whitespace and temporary/generated artifacts | `test:diff`; `test:artifacts` | both run in Foundation workflow — ENFORCED (filtered PR only) | CP3 | whitespace, missing-base and forbidden-artifact fixtures; remove steps |
| CG-10 | secrets/configuration boundary | `test:secrets` deterministic scanner | scanner runs in `quality-gate`; current-tree credentials removed, external rotation unverified — PARTIAL | CP2 | synthetic sentinel only; remove scanner/configuration change |
| CG-11 | stable mandatory PR quality gate and trigger coverage | `test:fnd06` AS-IS contract | path-filtered PR; no `main`; remote required status unknown — PARTIAL | CP5 | broaden trigger safely; excluded-path temporary branch; revert trigger change |
| CG-12 | non-mandatory external preview must not represent quality | Supabase preview is external | skipped/non-mandatory — SKIPPED | CP6 | record status independently; controlled required-check failure after governance approval; restore prior setting |

## Exact current invocation and bypass analysis

| Surface | Test exists | Aggregate exists | Workflow executes it | Blocks filtered PR if run fails | Runs on `main` | Path/filter consequence |
|---|---:|---:|---:|---:|---:|---|
| FND-01 migration ordering/ledger/checksum/rollback | yes | partial | migrations only | yes | no | migration paths included; runner-only edits may bypass |
| FND-02 / FND-03 / FND-04 / FND-05 | yes | yes (except FND-01) | no | no | no | `tests/fnd0*` and runner edits bypass |
| Identity/Enrollment/Documents | yes | partial | selected tests | yes | no | broad `src/**` and generic `tests/**` are excluded |
| School Tasks PostgreSQL | yes | yes | no | no | no | scripts/tests outside named filters bypass |
| lint / build | yes | yes | yes | yes | no | source outside enrollment paths and `server.ts` can bypass |
| diff / temporary artifacts | local command / no aggregate | no | no | no | no | all changes can bypass this gate |
| secret/configuration | no authoritative scanner | no | no | no | no | all changes can bypass this gate |

Current PR filters include `src/modules/enrollments/**`, `src/components/Enrollment*`, enrollment/secretariat-named tests, migrations, two named scripts, manifest/lockfile and this workflow. They exclude generic `src/**`, `server.ts`, generic `scripts/**`, generic `tests/**`, other workflows and Foundation documentation; documentation that changes executable gate declarations can therefore bypass CI today. The current environment is job-local PostgreSQL 16 (`TEST_DATABASE_URL`), `NODE_ENV=test`; no environment-name secret should be logged. Setup is migration-led; teardown is job/container disposal, with no explicit workflow cleanup step and no artifact upload step.

## CP3 aggregate and mechanical-gate evidence

`npm run test:foundation` validates its JSON manifest, required scripts/files, runs FND-01 non-PostgreSQL migration/policy contracts, FND-02, FND-03, FND-04, FND-05 and FND-06 in that stable order, stops at the first failure and enforces individual and total timeouts. PostgreSQL migration/bootstrap and School Tasks history/snapshot coverage remain explicitly deferred to CP4.

`npm run test:diff -- --base <base>` requires a resolvable ancestor and checks `<base>...HEAD`; the workflow uses the authoritative PR base SHA (or the event's previous SHA for its existing push triggers) and full checkout history. It fails rather than falling back to an empty comparison. `npm run test:artifacts` checks tracked/staged filenames only for local env files, logs/temp/dumps, recovery helpers and editor/system artifacts; it reports path/rule only and never deletes. CP3 adds exact workflow paths for its scripts/tests where possible; the remaining generic source, server, scripts, tests and documentation bypass boundary is CP5.

## Remote completion evidence (CP6/CP7)

Before FND-06 can be DONE, retain the PR check-run URL/identifier, stable `quality-gate` name, successful complete run, controlled failed run, proof a failed required check blocks merge, a `main` run after merge, redacted PostgreSQL service evidence, branch-protection configuration evidence and proof that no mandatory job was skipped.

## Secret boundary (CP2)

`npm run test:secrets` runs deterministic synthetic scanner tests then scans tracked and staged files. It reports only file path and rule, fails closed if its script is missing, detects private-key markers, credential-bearing URLs, credential-like assignments and tracked `.env*` violations, and permits only loopback PostgreSQL in the dedicated local-example or workflow contexts. Its sole source allowlist is the exact synthetic scanner test file, which contains non-authenticating sentinels and no real value. The scanner is now a `quality-gate` step with no added permissions or secrets.

The tracked development configuration has been replaced by non-secret environment placeholders; local secret files remain ignored. Historical exposure is not erased by this change. Potentially active external categories require provider-owner-authorised rotation and verification before CG-10 can be ENFORCED; history rewrite is prohibited without separate authorization and would affect clones, branches and tags. Firebase browser configuration is public client configuration rather than automatically a server secret; no private key/service-account marker was found in the inspected current tree. External validation of allowed domains, API restrictions, Firebase rules and service-account IAM remains required. Do not print, stage or copy credential-bearing configuration.
