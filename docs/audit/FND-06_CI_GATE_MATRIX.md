# FND-06 — CI Gate Matrix

**State:** READY for separately authorised implementation. Baseline `2c311679c039638453a0843315dfd52d23586a3f`.

| ID | Invariant / command | Current CI evidence | Class | Treatment / CP |
|---|---|---|---|---|
| CG-01 | migrations, ledger/checksum, rollback | `secretariat-ci.yml` isolated migrations + PostgreSQL service | PARTIAL | CP3/CP4 aggregate migration command |
| CG-02 | FND-02 write fences | local `test:fnd02`; not named CI step | LOCAL_ONLY | CP3 add required aggregate |
| CG-03 | FND-03 tenant isolation | local `test:fnd03`; partial CI domain coverage | PARTIAL | CP3 explicit gate |
| CG-04 | FND-04 Product Truth | local `test:fnd04` | LOCAL_ONLY | CP3 required gate |
| CG-05 | FND-05 Audit Truth | local `test:fnd05` | LOCAL_ONLY | CP3 required gate |
| CG-06 | Identity/Membership/Enrollment/Documents | CI PostgreSQL and contract steps | ENFORCED | preserve |
| CG-07 | School Tasks PostgreSQL/history | local CP4 PostgreSQL contract | LOCAL_ONLY | CP4 disposable CI gate |
| CG-08 | lint/build | named TypeScript/Production build CI steps | ENFORCED | preserve warnings, CP5 policy |
| CG-09 | diff/temporary artifacts | no named CI step | MISSING | CP5 deterministic gate |
| CG-10 | secret/configuration detection | no authoritative secret scanner; tracked development credential risk | UNSAFE | CP2 remediation and scanner |
| CG-11 | PR quality gate | `quality-gate`, PR/main triggers, concurrency, 20-min timeout | ENFORCED | CP6 settings/check characterization |
| CG-12 | Supabase Preview | skipped non-mandatory external preview | SKIPPED | never substitute for quality-gate |

CI PostgreSQL design: Ubuntu PostgreSQL 16 service, dedicated disposable `nexus_test`, loopback URL generated only in job environment, migration-led bootstrap, isolated schemas/fixtures and cleanup. Never load local `.env.test.local` or production/staging credentials. Logs must redact connection strings and `.env*` values.

Tracked credential-bearing development configuration is pre-existing and syntactically embedded; ownership, rotation, replacement environment and history-remediation decision must be explicitly authorised in CP2. Firebase browser configuration is public client configuration, not automatically a server secret: CP2 must validate restrictions/rules and absence of service-account material.
