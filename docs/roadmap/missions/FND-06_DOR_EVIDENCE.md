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
