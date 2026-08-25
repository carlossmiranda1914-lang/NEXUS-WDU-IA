# FND-05 — Audit Truth

**State:** DONE. CP0–CP7 PASS.

## Objective
Make audit evidence factual, actor-correct, tenant-scoped and correlation-aware, while clearly distinguishing human commands, system actions and derived reconciliation without rewriting history or inventing business facts.

## Origin
AUD-AUDIT-001, AUD-DOC-AUDIT-001, AUD-PROCESS-001/002, Master Plan v2 evidence/history principles, and Architecture TO-BE v2 audit-truth contract.

## Dependency
- FND-02 must define surviving authoritative writes.
- FND-03 must establish tenant behavior for those writes.
- FND-04 must remove or isolate misleading operational presentation so audit presentation is not required to preserve fake product semantics.

## Preserve
- factual raw events already captured correctly;
- immutable historical evidence;
- existing correlation/request identifiers that are technically sound;
- domain-specific business events when their actor/action semantics are proven;
- distinction between raw audit evidence and user-friendly presentation mapping.

## IN
For critical surviving P0/P1 writes and system reconciliations:
- raw audit event contract;
- actor type and actor identifier semantics;
- tenant/institution context;
- action/event name;
- target/entity reference;
- result/outcome when appropriate;
- request/correlation identifiers;
- human vs system/reconciliation distinction;
- safe presentation mapping from raw facts to user language;
- document/admin mutations and process reconciliation called out by AUDIT-01.

## OUT
- rewriting historical audit rows to make them look consistent;
- designing a full analytics/BI event platform;
- adding fabricated receipt/signature/approval semantics;
- broad event-sourcing redesign;
- changing domain state machines unless required to record the already-authoritative action factually.

## Required preflight / evidence
Before editing an audit path:
- identify the authoritative write/use case that emits or should emit evidence;
- identify the real initiating actor or system process;
- trace current raw event and presentation behavior;
- reproduce any incorrect actor/action/presentation mapping;
- define the smallest factual contract change and backward-compatibility consequence.

## Acceptance criteria
- **AC01 Raw fact integrity:** audit storage records facts that actually occurred and does not derive fictional business events from presentation needs.
- **AC02 Actor correctness:** critical document/admin mutations record the actual human/system actor according to the executed command.
- **AC03 System distinction:** automated projection/reconciliation activity is explicitly distinguishable from human action.
- **AC04 Tenant context:** critical audit evidence is attributable to the correct institutional context without trusting client-only context.
- **AC05 Correlation:** critical writes expose usable request/correlation linkage where the application contract already requires it.
- **AC06 Presentation safety:** business-friendly labels may translate codes but cannot invent receipts, signatures, approvals, payments or other events absent from raw evidence.
- **AC07 Historical preservation:** existing historical anomalies are not silently rewritten; any known limitation is handled as historical evidence, not corrected fiction.
- **AC08 Critical coverage:** every critical surviving P0/P1 mutation changed by FND-02–04 has an explicit audit decision: factual event required and tested, or documented N/A with justification.

## Required tests / evidence
- actor-correctness tests for critical human mutations;
- system/reconciliation actor tests;
- tenant attribution tests;
- correlation/request-ID tests where applicable;
- presentation-mapping tests preventing invented business facts;
- regression tests for affected domain writes;
- persistence evidence for raw audit records;
- TypeScript/build and applicable CI gates;
- audit coverage matrix with AC-to-evidence references.

## DONE
FND-05 is DONE only when AC01–AC08 are PASS, critical surviving writes have explicit factual audit behavior, system actions are distinguishable from human commands, and no known presentation layer can manufacture business events not present in raw evidence.

## Definition of Ready

The bounded inventory and executable CP0–CP7 plan are in `docs/audit/FND-05_AUDIT_TRUTH_MATRIX.md` and `docs/roadmap/missions/FND-05_DOR_EVIDENCE.md`. AT-01–AT-12 classify every surviving P0/P1 producer and consumer with actor, institution, target, outcome, timing, persistence, reader, privacy and removal gate. No critical `UNKNOWN` remains. This does not authorize production changes, a schema/migration, historical rewriting, retention/compliance claims or FND-06 secret work.

## CP0 deterministic audit baseline — PASS

`npm run test:fnd05` runs a Windows-safe, non-mutating aggregate in fixed order. It validates each selected file, stops at the first child failure, propagates abnormal exits, enforces a 60-second child timeout and identifies the failed file. Synthetic pass/fail/missing/hanging fixtures prove these properties without identities, credentials, PostgreSQL, DDL or connectors. The baseline selects only existing non-PostgreSQL contracts: request observability, InstitutionalContext, task realtime isolation, Enrollment lifecycle/Documents/process contracts and FND-02/FND-03 no-mutation fences. CP1 matrix characterization is next; FND-05 remains IMPLEMENTING.

## CP1 complete audit surface characterization — PASS

All AT-01–AT-12 surfaces now have an effective producer/consumer classification and one CP2–CP6 owner. The focused AS-IS contract verifies source markers for Enrollment events, Tasks history, realtime refresh, observability privacy boundary, institutional context, fenced producers, unavailable prototype presentation and legacy audit retrieval. CP2 is next; no audit behavior was corrected.

## CP2 actor and institutional context — PASS

The canonical Enrollment event producers attribute actor and institution exclusively from resolved server InstitutionalContext. Firebase UID resolves through active Membership; selected multi-membership context supplies role/institution; client actor, person, tenant and institution fields are absent from document audit inputs and cannot override attribution. Missing or foreign Membership fails closed. No new actor model or audit persistence was introduced. CP3 is next.

## CP3 success, failure and transaction truth — PASS

Existing canonical Enrollment Documents and process PostgreSQL contracts pass against the approved disposable target. They prove committed mutation/event behavior and their exercised failure/rollback paths without schema or production changes. The reachability incident was dotenv precedence, not hostname, credentials, migrations or CP3 logic; `.env.test.local` is loopback, ignored, and used with explicit dotenv override for the focused contracts. CP4 is next.

## CP4 snapshot, correlation and retry fidelity — PASS

The existing School Tasks disposable PostgreSQL contract proves factual committed snapshots/version history, rollback on snapshot failure, tenant isolation and concurrent version uniqueness. Realtime emits only a tenant-scoped refresh payload. Correlation/request fields are optional existing metadata; no new tracing or idempotency contract is claimed. CP5 is next.

## CP5 tenant-scoped retrieval, privacy and redaction — PASS

The legacy `/api/logs` reader lacked a proven canonical audit-reader authority and safe projection contract. It is now fenced before any query with `CANONICAL_AUDIT_AUTHORITY_REQUIRED`; no data is rewritten and no replacement client audit view exists. Canonical Enrollment/Documents/Tasks history paths remain preserved. CP6 is next.

## CP6 transitional and asynchronous producers — PASS

Realtime remains a tenant-scoped refresh channel, not durable audit history. Request observability records final status and route pattern rather than body/query payloads. Background/SLA and AI remain fenced before effect with their canonical unavailable codes; no connector, prompt, response, external delivery or institutional success evidence is introduced. CP7 is next.

## CP7 aggregate validation and evidence closure — PASS

AT-01–AT-12 are closed with canonical, bounded transitional, fenced/no-effect or isolated-prototype treatment. AT-09 is explicitly operational observability: final status, route pattern and timing are factual; it is not durable institutional audit, retention/integrity/compliance evidence or a success-domain event. AC01–AC08 pass with the CP0–CP6 contracts recorded in the audit matrix. FND-05 is DONE; Foundation is not DONE. FND-06 DoR/decision is next.

## Stop rules
Stop and return to BLOCKED/PREPARATION if:
- the real actor cannot be determined from the authoritative command path;
- historical data would need destructive rewriting;
- a correct audit event requires inventing a business action that did not occur;
- fixing audit semantics requires redesigning an unrelated domain/state machine;
- tenant ownership of the audited target is ambiguous.
