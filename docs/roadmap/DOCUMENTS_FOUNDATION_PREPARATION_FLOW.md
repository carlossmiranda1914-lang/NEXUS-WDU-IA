# DOCUMENTS-FOUNDATION — Preparation and Future Implementation Flow

**Status:** DRAFT — planning authority only.  
**Scope:** Documents Foundation preparation.  
**Implementation authorisation:** Not granted.  
**Code, schema and infrastructure changes:** Forbidden under this document.

## 1. Purpose

This flow turns the confirmed Documents Foundation decisions into an implementation-ready package without mixing domain authority, starting production work, or expanding into other modules.

The normative data and policy decisions are in:

- `docs/architecture/DOCUMENTS_FOUNDATION_DATA_AUTHORITY.md`

This flow governs the work still required to close preparation. It does not supersede the data-authority record.

## 2. Scope lock

### Included

- Documents Foundation design, contracts, security and operational preparation.
- Reusable integration boundaries for future source domains.
- Requirements, acceptance evidence, mission packaging and review gates.

### Excluded

- Product-code implementation.
- Database migrations, cloud-storage setup, secrets or deployment.
- Changes to any existing domain module or active external implementation.
- Reopening closed decisions unless a contradiction or legal requirement is proven.

## 3. Required sequence

| Phase | Deliverable | Exit condition |
|---|---|---|
| P0 — Scope lock | Confirmed decision register and exclusions | No scope ambiguity; no competing authority |
| P1 — Integration contracts | Source-domain request/state/event contract | Documents never owns source-process or entity authority |
| P2 — Jurisdiction and policy package | Central global policy model with jurisdiction/category profiles | Retention, deletion, transfer and access have a lawful configuration route |
| P3 — Security and operational design | Threat model, key/URL rules, audit and failure handling | Tenant isolation, least privilege, quarantine and deletion rules are testable |
| P4 — Product and UX contract | User states, warnings, retries, notifications and recovery | Every pending, failed, quarantined and revoked case has an understandable outcome |
| P5 — Acceptance package | Positive, negative, tenancy and regression criteria | Requirements are objectively testable |
| P6 — Mission pack | Ordered implementation units, dependencies, evidence plan and rollback limits | `DESIGN_CLOSED=YES` and `IMPLEMENTATION_READY=YES` |
| P7 — Authorisation gate | Explicit Product Owner implementation approval | `IMPLEMENTATION_AUTHORIZED=YES` only after all prior gates are green |

No later phase can be marked complete by assuming the result of an earlier phase.

## 4. P1 — Source-domain integration contract

For each future consumer, the implementation package must specify:

1. **Create/upload intent**: source-process reference, institution context, entity reference, category and acting role.
2. **Link rule**: exactly which immutable document version is linked to which source process.
3. **Business-validity boundary**: source domain owns accept/reject/replace-as-evidence decisions.
4. **State query**: source can query authoritative technical state without duplicating document metadata.
5. **Events**: received, verified, quarantined, expired and deleted, with idempotent delivery and correlation identifiers.
6. **Removal**: withdrawing a pending link cancels and deletes pending data; historical evidence follows category policy.
7. **Failure handling**: source behaviour when document is pending, quarantined, unavailable, expired or deleted.

A source-domain integration cannot be scheduled until its contract is reviewed against this list.

## 5. P2 — Jurisdiction and policy package

Central governance must publish a versioned policy structure containing:

- jurisdiction profile;
- category;
- minimum classification;
- permitted safe formats;
- central file-size ceiling;
- permitted institutional lower limit;
- retention rule;
- legal-hold rule;
- transfer eligibility and conditions;
- role/action bounds;
- notification requirements;
- policy version and effective date.

Institutional configuration is valid only when it is within the applicable central global policy version. Any stricter mandatory local legal rule takes precedence and must be represented by a jurisdiction profile, not an undocumented institutional exception.

## 6. P3 — Security and operational design

The preparation package must prove these invariants:

- every request has validated Institutional Context;
- storage bytes are private; no public object URL exists;
- upload authorisation is scoped and expires after 15 minutes;
- resumable uploads expire after 24 hours;
- server calculates the final SHA-256 hash;
- actual type, limits and malware detection are required before technical availability;
- verification unavailability retries for no more than 24 hours, then quarantines;
- quarantined bytes cannot be opened or downloaded;
- future access is denied immediately after permission revocation;
- audit is complete, while post-deletion evidence is minimised and pseudonymised;
- transfers create a controlled destination copy with immutable provenance when policy permits.

## 7. P4 — Product and UX contract

The design must define, at minimum:

| Situation | Required user outcome |
|---|---|
| Upload begins | Clear progress, category and process context |
| Connection interruption | Clear resume option for up to 24 hours |
| Authorisation expiry | Re-authorise only the valid upload session; never expose storage directly |
| Upload completed | Pending-verification warning; not evidence-valid automatically |
| Verification successful | Immediate sender notification; source receives state event |
| Verification unavailable | Pending status with retry indication |
| Verification deadline exceeded | Quarantine status and notifications |
| Quarantine | No access; explain next permitted action without exposing security internals |
| Re-submission | Only if category policy allows; create new auditable attempt |
| Access revoked | Immediate future-access denial |
| Deleted document | No file access; minimal audit trace only |

## 8. P5 — Acceptance package

The future mission pack must include evidence for:

- allowed versus prohibited format;
- actual type mismatch;
- malware detection result;
- size ceiling and institution lower limit;
- interrupted, resumed, cancelled and duplicate upload;
- expired temporary authorisation;
- server hash persistence;
- verification retry and 24-hour quarantine deadline;
- access by allowed role, disallowed role and revoked role;
- tenant-isolation attempts;
- source-event delivery and idempotent replay;
- legal hold and deletion;
- permitted and denied transfer;
- audit completeness and post-deletion minimisation.

## 9. P6/P7 implementation-control gate

Before a future implementation mission is opened, all conditions below must be true:

```
DATA_AUTHORITY_CONFIRMED = YES
CATEGORY_POLICY_MATRIX_CLOSED = YES
UPLOAD_VERIFICATION_CONTRACT_CLOSED = YES
SOURCE_INTEGRATION_CONTRACTS_CLOSED = YES
JURISDICTION_POLICY_VALIDATED = YES
SECURITY_AND_THREAT_REVIEW_GREEN = YES
ACCEPTANCE_PACKAGE_COMPLETE = YES
DESIGN_CLOSED = YES
IMPLEMENTATION_READY = YES
IMPLEMENTATION_AUTHORIZED = explicit Product Owner decision
```

Without all required values, only documentation preparation may continue.

## 10. Future implementation order, after authorisation

The future implementation must be split into independently verifiable units:

1. private upload session and resumability;
2. immutable metadata, version and audit foundation;
3. verification/quarantine pipeline;
4. permission evaluation and secure download;
5. source-domain link/query/event contract;
6. retention, legal hold, deletion and transfer;
7. end-to-end acceptance and independent review.

Each unit requires its own tests/evidence and may not be integrated merely because a user interface appears complete.

## 11. Current next action

Proceed with **P1 — source-domain integration contract**, starting from a generic source contract and only then specialising it for the next authorised consumer. No implementation work begins.
