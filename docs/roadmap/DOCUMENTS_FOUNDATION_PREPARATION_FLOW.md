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

## 4. P1 — Generic source-domain integration contract — CLOSED

### 4.1 Upload-authorisation proof

Before an upload begins, the source domain validates the requested business process and issues a signed proof valid for **15 minutes**. Documents Foundation validates that proof and refuses the request without creating file data when the process is missing, expired, invalid, incompatible or outside the stated institution.

The proof must bind:

- institution;
- source process;
- entity reference;
- document category;
- acting actor;
- expiration.

Documents Foundation does not query, recreate or own the underlying business process.

### 4.2 Two-stage process relationship

The integration uses two distinct relationships:

1. **Provisional association** — created immediately after upload completion in `received_pending_review`, enabling the source process to receive and review the file.
2. **Evidence link** — created or activated only after the source domain confirms business validity.

A rejected document remains historical according to the applicable category-retention policy. Removing a provisional association while verification is pending cancels the upload and deletes pending bytes.

### 4.3 Business decision contract

The source domain is the only authority for evidence validity. It sends a signed, audited decision event to Documents Foundation. A valid decision must identify the institution, source process, entity reference, document version, decision, acting authority, applicable policy version, event timestamp, event identifier and causal/correlation identifier.

Documents Foundation records the decision and updates only its document-link/evidence status. It never interprets the business rule.

A correction creates a new immutable decision event; it does not overwrite prior history. The source-domain contract must provide ordering/version semantics so an older event cannot reverse a newer decision.

### 4.4 State-event contract

Documents Foundation publishes state events for received, verified, quarantined, expired and deleted outcomes.

- Delivery guarantee: **at least once**.
- Recipient duty: idempotent handling.
- Source-domain capability: receive events and query authoritative state.
- Event delivery failure: retry with audit; after repeated failure, place in a durable failure queue for operational resolution.
- Invalid, expired, incompatible or unverifiable signed events: reject without state mutation and notify the source domain.

### 4.5 P1 closure

```
GENERIC_SOURCE_INTEGRATION_CONTRACT_CLOSED = YES
SOURCE_SPECIFIC_INTEGRATION_CONTRACT_CLOSED = NO
IMPLEMENTATION_AUTHORIZED = NO
```

Every future consumer requires a source-specific contract derived from this generic contract. No consumer is automatically integrated by the existence of this document.

## 5. P2 — Jurisdiction and policy model — CLOSED

### 5.1 Jurisdiction selection and conflict

A document's primary jurisdiction is the institution's operational jurisdiction. When more than one mandatory jurisdiction applies, the system applies the most restrictive applicable profile.

The institution may propose a jurisdiction profile; the platform approves and publishes it. Institutions do not self-publish legal rules.

### 5.2 Profile lifecycle and applicability

Every central profile is versioned, approved, dated and auditable. A new or stricter profile applies to existing documents only where the legal obligation requires it; the historic profile/version supporting prior decisions remains recorded.

If no approved profile exists for the institution's operational jurisdiction, operations that require that profile are blocked. There is no temporary exception to a jurisdictional block: a new approved profile is required.

Changing an institution's operational jurisdiction requires platform approval and an approved new profile; it is not a direct institution setting change.

### 5.3 Cross-jurisdiction transfer

Before a permitted international transfer, the system must establish:

- compatible approved origin and destination profiles;
- a policy-authorised transfer basis;
- category eligibility;
- authorised initiating role;
- controlled destination copy with immutable provenance.

A transfer cannot rely merely on institutional request or individual consent where the required policy basis/profile is absent.

### 5.4 Re-evaluation of existing documents

When a new legal obligation applies to existing documents, the system marks affected documents and creates an auditable re-evaluation task. It never silently rewrites the historical policy record.

The concrete legal action remains governed by the approved jurisdiction-and-category profile and may include access restriction, retention adjustment, transfer block or other lawful lifecycle action.

### 5.5 P2 closure

```
JURISDICTION_POLICY_MODEL_CLOSED = YES
JURISDICTION_PROFILE_LEGAL_VALIDATION_COMPLETE = NO
IMPLEMENTATION_AUTHORIZED = NO
```

The data model and governance flow are closed. Actual jurisdiction profiles still require documented legal validation before they can be activated.

## 6. P3 — Security and operational design — CLOSED

### 6.1 Encryption and access

- File bytes are encrypted in transit and at rest.
- The platform manages encryption keys with isolation by institution.
- Open/download authority is evaluated at the moment of access; if it cannot be confirmed, access is denied.
- A successful open/download authorisation lasts **5 minutes**.
- No public URL, cached prior permission or browser-held claim can bypass current authorisation.

### 6.2 Tenant-boundary defence

A request targeting another institution is denied, recorded and alerted to central security. No response may disclose whether the target document exists.

Repeated denied access to sensitive documents is automatically classified by policy rules, subject to human review:

| Severity | Required response |
|---|---|
| Low | Temporary block with short automatic expiry |
| High / critical | Block remains until security review authorises reactivation |
| Cross-institution attempt | Deny, audit and alert central security; classify under incident rules |

### 6.3 Audit integrity and visibility

Audit records are append-only, integrity-verifiable and never edited. Corrections and later decisions are new events, not alterations of prior events.

Complete security/access audit is visible only to authorised institutional roles and central security. Audit access itself is auditable.

### 6.4 Incident operations

- Initial severity is assigned by automatic rules and reviewed by a human.
- A critical confirmed incident notifies central security and the authorised institutional contact.
- Technical details exposed to end users must be non-disclosing; the audit/incident system retains diagnostic evidence for authorised responders.
- Security and access-revocation events take precedence over convenience or availability.

### 6.5 Backup and restoration

Backup retention follows the approved global jurisdiction-and-category profile.

| Rule | Requirement |
|---|---|
| Restore request | Initiated by an authorised institutional role; request is audited |
| Restore approval | Central security approves against current policy |
| Restored bytes | Return to normal storage only after approval |
| Post-restore state | `received_pending_review`; current technical and policy verification is mandatory |
| Legally deleted / retention-expired bytes | Never restored from backup |
| Restore testing | Monthly, with evidence retained |

No administrator receives direct access to backup infrastructure.

### 6.6 Operational non-negotiables

The implementation package must prove:

- secret/key material never appears in client code, logs or audit views;
- upload/download grants are scoped, temporary and revocable;
- malware/quarantine controls cannot be bypassed by restoration;
- audit events use trusted server time and correlation identifiers;
- storage, verification, audit and event failures fail closed for privileged access;
- security alerts, blocked actors and failure queues have a documented operational owner.

### 6.7 P3 closure

```
SECURITY_OPERATIONAL_DESIGN_CLOSED = YES
THREAT_MODEL_REVIEW_GREEN = NO
OPERATIONAL_TEST_EVIDENCE_GREEN = NO
IMPLEMENTATION_AUTHORIZED = NO
```

The required security design is closed. A formal threat-model review and future operational test evidence remain mandatory before implementation authorisation.

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
