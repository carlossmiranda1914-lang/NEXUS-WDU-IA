# DOCUMENTS-FOUNDATION-01 — Mission Pack

**Status:** DRAFT — preparation complete enough for review; implementation not authorised.  
**Mission type:** Cross-cutting document capability.  
**Scope:** Documents Foundation only.  
**Out of scope:** Any work in other active modules, production code, migrations, infrastructure provisioning, deployment and credentials.

## 1. Authority and purpose

This Mission Pack converts the approved Documents Foundation design into future implementation units. It is governed by:

- `docs/architecture/DOCUMENTS_FOUNDATION_DATA_AUTHORITY.md`
- `docs/roadmap/DOCUMENTS_FOUNDATION_PREPARATION_FLOW.md`
- canonical project architecture, security, tenancy and implementation workflow documentation.

The module owns document bytes, technical lifecycle, versions, integrity, access enforcement, retention, transfer provenance and audit. Source domains retain their business processes, entities and business-validity decisions.

## 2. Readiness boundary

```
DESIGN_CLOSED = PENDING_FINAL_REVIEW
IMPLEMENTATION_READY = PENDING_EXTERNAL_GATES
IMPLEMENTATION_AUTHORIZED = NO
```

This file cannot authorise implementation. It is a plan for the authorised future mission only.

## 3. Hard invariants

- Valid Institutional Context is mandatory for every operation.
- Browser/client never owns institution, business process, validity decision or storage authority.
- No public object URLs, unscoped storage grants, client-owned hash authority or bypass of quarantine.
- Source-process validity remains in the source domain through signed, auditable events.
- Access fails closed whenever current authorisation cannot be confirmed.
- Audit is append-only, integrity-verifiable and non-editable.
- A document deleted by legal obligation or retention expiry cannot return from backup.
- No cross-institution transfer without applicable approved profiles and policy basis.

## 4. Future implementation units

| Unit | Objective | Depends on | Required evidence before next unit |
|---|---|---|---|
| DF-01-A — Domain metadata foundation | Logical document/version/link/audit lifecycle with immutable identifiers and server-side hash contract | Authorised schema/change plan | Version lineage, audit append-only and tenant isolation tests |
| DF-01-B — Private resumable upload | Scoped 15-minute upload grants, private storage and 24-hour resumability/idempotency | DF-01-A | No public access, expiry, cancel/resume/duplicate tests |
| DF-01-C — Verification and quarantine | Actual-type, size, hash and malware pipeline; retry and 24-hour quarantine deadline | DF-01-A/B | Mismatch, malware, outage, quarantine and notification tests |
| DF-01-D — Access and secure retrieval | Role/category enforcement, five-minute access grants, immediate revocation and audit | DF-01-A | Allowed/denied/revoked/cross-tenant non-disclosure tests |
| DF-01-E — Source-domain contract adapter | Signed proof, provisional association, signed business decision events and durable state events | DF-01-A/C/D | At-least-once/idempotent events, invalid-event rejection and failure-queue tests |
| DF-01-F — Retention, hold, restore and transfer | Jurisdiction/category policy evaluation, legal hold, deletion, controlled transfer and revalidated restore | DF-01-A/C/D/E and approved profiles | Retention/hold/deletion/backup/transfer tests |
| DF-01-G — Product and accessibility layer | States, notifications, review queue, language and accessibility contract | DF-01-B/C/D/E | Sender/institution/security manual validation and accessibility evidence |
| DF-01-H — End-to-end acceptance and review | Full regression, threat-model review, UAT and evidence packaging | DF-01-A through G | All P5 scenarios green; no P0/P1 |

No unit may be merged merely because a dependent user interface appears functional.

## 5. Unit execution rule

For every unit, the future implementer must produce:

1. explicit scope and exclusions;
2. AS-IS verification before change;
3. minimal change plan;
4. automated, integration, security and manual evidence;
5. synthetic/anonymous test data only;
6. tests for at least two institutions including negative access;
7. regression result: critical suite per change, full suite before unit acceptance;
8. documented P2 decision if any P2 remains; no P0/P1;
9. repository-versioned/referenced evidence with no personal data;
10. Product Owner acceptance before the next gate.

## 6. External gates before implementation authorisation

All items must be true:

- `GENERIC_SOURCE_INTEGRATION_CONTRACT_CLOSED = YES`
- `JURISDICTION_POLICY_MODEL_CLOSED = YES`
- `SECURITY_OPERATIONAL_DESIGN_CLOSED = YES`
- `UX_ERROR_CONTRACT_CLOSED = YES`
- `ACCEPTANCE_PACKAGE_CLOSED = YES`
- concrete jurisdiction profiles have documented legal validation;
- threat-model review is green;
- implementation environment, storage provider, key management and operational ownership are selected and reviewed;
- this Mission Pack receives Product Owner approval;
- an explicit authorisation changes `IMPLEMENTATION_AUTHORIZED` to `YES`.

## 7. Prohibited shortcuts

- Do not introduce localStorage/DataURL as document storage.
- Do not declare a document valid from technical verification alone.
- Do not use a shared global storage key or public download address.
- Do not infer cross-institution access or transfer from a matching hash.
- Do not overwrite version, decision or audit history.
- Do not restore legally deleted content from backup.
- Do not use real personal data in testing/evidence.

## 8. Definition of done for the future mission

The mission is DONE only when all units are accepted, all required evidence is green, operational recovery tests are completed, accessibility/manual validation includes required personas, and the Product Owner accepts the final evidence package.

## 9. Current action

Remain in documentation/review state. No implementation work is authorised until the external gates and explicit Product Owner authorisation are complete.
