# FND-06 — Definition of Ready Evidence

**State:** IMPLEMENTING — CP0–CP3 repository gates PASS; CP2 external rotation BLOCKED. No history rewrite, external credential action, repository setting or production source change occurred.

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

## CP1 evidence — PASS

The executable CP1 characterization parses the package manifest, FND runner paths and current workflow. It proves the existing FND-01 aggregate absence, FND-02–FND-05 non-invocation, missing `main`, absent diff/secret gates, PostgreSQL presence and the excluded path classes. The canonical CG-01–CG-12 matrix assigns every non-enforced item to exactly one CP2–CP6 owner, with synthetic controlled-failure, rollback and remote completion evidence plans. CP2 is next; no workflow, credential, PostgreSQL CI or repository-setting change occurred.

## CP2 evidence — repository remediation PASS; external rotation BLOCKED

Tracked credential-bearing development example values were replaced with placeholders, while local secret files remain ignored. `npm run test:secrets` proves URL, private-key, tracked-env, clean, public Firebase and disposable PostgreSQL cases without echoing a synthetic sentinel, then scans tracked/staged files. The existing `quality-gate` invokes it with no additional permissions or secret environment. No private-key/service-account marker was found in the inspected current tree; Firebase client configuration remains classified as public browser configuration pending external restrictions/rules/IAM validation.

Current-tree removal cannot erase any historical exposure. Rotation is blocked pending authorised external provider owners for potentially active database, connector/API and SMTP categories; required action is provider-side rotation/revocation, replacement in approved local/CI secret storage, and verification without disclosing values. History rewrite remains prohibited without separate authorization. CP3 can proceed independently after this blocker is recorded.

## CP3 evidence — PASS

`test:foundation` proves manifest/script/file validation, deterministic ordering, first-failure stop, missing script/file handling, child failure propagation and timeout handling. Its non-PostgreSQL scope is FND-01 migration runner/runtime policy, FND-02 through FND-06; PostgreSQL CI coverage remains CP4. `test:diff` requires an authoritative valid base and rejects committed whitespace; `test:artifacts` rejects tracked local env, temporary/log/dump, recovery and editor/system artifacts by path/rule only. Controlled synthetic failures and clean fixtures pass. The stable `quality-gate` invokes the aggregate, diff and artifact gates with full checkout history; CP5 retains broad trigger redesign. CP4 is next.

## CP4 Definition of Ready

The authorised base is `26443b9`. CP4 uses only canonical `0001`–`0018` migrations, PostgreSQL 16 created per CI job, an identifiable CI-only role/database, `TEST_DATABASE_CONFIRMATION`, per-process timeout and job-service disposal. The aggregate must bootstrap from migrations, prove ledger/checksum rollback, tenant isolation, School Tasks history/snapshots, Enrollment/StudentProfile, Enrollment Documents and applicable process reconciliation. It must never load `.env.test.local`, use production/staging/Supabase credentials, or run locally without explicit `TEST_DATABASE_LOCAL_AUTHORIZED=true`.

## CP5 CI trigger and warning policy

The canonical workflow runs on every `push` and every `pull_request`; it has no branch, `paths`, or `paths-ignore` filter. Therefore client/server code, scripts, migrations, tests, workflows, package manifests/lockfiles and contract, security or operational documentation all invoke `npm run quality-gate`. No path is deliberately excluded: this is the narrowest fail-closed policy that avoids a path-classification bypass.

`npm run lint` is blocking and currently emits no warnings. `npm run build` is blocking; its existing direct-`eval` and chunk-size warnings are accepted temporarily because they do not change the command exit status, but they are not suppressed. Owner: application maintainers. Removal condition and deadline: eliminate direct `eval` and split/size the affected production chunks before the next release that changes the affected frontend bundles, and no later than 2026-09-30. Node `DEP0190` warnings from existing runners using `shell: true` are likewise accepted temporarily, not suppressed; owner: CI maintainers; removal condition and deadline: replace the affected child-process invocation with argument-safe spawning before CP6 remote-policy evidence, and no later than 2026-09-30. New lint errors, build errors, secret/artifact findings and non-zero gate exits block immediately.

## CP7 Foundation Exit — PASS

CP0–CP6 evidence is reconciled on `codex/fnd-06-ci-gate`. CP0–CP1 establish the deterministic CI baseline and gate matrix; CP2 has repository secret remediation plus confirmed external least-privilege IAM, Google-managed service-account keys, authorised OAuth origins/redirects and restricted browser-key referrers/APIs; CP3 restores the canonical fail-closed gate; CP4 proves disposable PostgreSQL migration, rollback, tenant-isolation and teardown contracts; CP5 removes trigger/path bypasses and records warning ownership; and CP6 proves Linux secret scanning, a controlled tracked-artifact rejection, and a final green remote workflow.

Final local evidence: `quality-gate`, lint, build and `git diff --check` all pass. The accepted residual risk is that advanced `main` branch-protection settings could not be verified or enabled because of the GitHub plan/visibility limitation; this does not weaken the implemented fail-closed workflow and remains a governance follow-up. No merge, deployment or production change is part of this exit.
