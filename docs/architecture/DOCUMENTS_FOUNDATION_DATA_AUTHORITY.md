# DOCUMENTS-FOUNDATION — Data Authority and Decision Record

**Status:** DRAFT — preparation in progress; not implementation authority.  
**Scope:** Documentation only. No production code, schema, storage integration or Finance modification is authorised by this document.  
**Dependencies:** Institutional Context/IAM, Person and the originating process contracts.  
**Intended consumers:** Enrollment, Attendance, Academic and Finance, without ownership transfer of their business data.

## 1. Purpose and boundary

Documents Foundation is the reusable capability for controlled file handling in Nexus Edu IA. It owns file integrity, versions, controlled access, retention, legal hold, transfer provenance and auditability.

It is **not** an alternative source of truth for Student, Enrollment, Attendance, Academic or Finance. A business process remains owned and decided by its originating domain.

## 2. Confirmed product decisions

| Topic | Decision |
|---|---|
| First-cut categories | Enrollment/identity; attendance justifications; academic documents; administrative/financial documents |
| Process validity | The originating domain decides whether a document is valid evidence, under institutional policy |
| Retention and deletion | One global policy, whose category rules must respect mandatory jurisdictional requirements |
| Replacement | Behaviour depends on category |
| Sensitive access | Institutional-role based, within a valid institutional context |
| Re-upload to same process | Ask the user |
| Upload and administrative/financial viewers | Defined by institutional policy |
| File types | Depend on category |
| Usability after upload | A received file may be linked immediately; business review can follow |
| Pending verification | May be opened/downloaded with a visible warning; it is not automatically valid evidence |
| Verification failure | Quarantine and block opening/download |
| Legal hold | Actor is defined by institutional policy |
| Reuse in one institution | Permitted through independently tracked process links |
| Same hash in another authorised process | Ask the user; never reuse or link automatically |
| Version replacement effect | A formerly accepted version becomes pending and cannot serve as proof until a decision |
| Entity resolution | Documents resolves the entity from the source-process reference; it stores only an immutable minimal reference |
| Cross-institution transfer | Global policy defines category-specific eligibility and conditions; destination receives a controlled copy with immutable provenance |
| Audit | All actions, including denied access and quarantine |
| After final deletion | Keep only a minimal technical event: date/time, reason and pseudonymised identifier |
| Global-policy governance | Central platform governance approves and changes the global policy |
| Policy traceability | Every access, retention and transfer decision records the applicable policy version |
| Permission revocation | Future access is blocked immediately |
| Download | Separate permission from viewing; decided by category and institutional role |
| Early deletion | Defined by institutional policy where no legal hold exists |
| Transfer initiation | Only an authorised institutional role may initiate it |
| Learner/guardian self-submission | Allowed only where category policy permits |
| Pre-review self-submission visibility | Submitter and authorised institutional roles |
| Submitter withdrawal/replacement | Allowed only where category policy permits |

## 3. Authority model

| Information / decision | Authority |
|---|---|
| File bytes, content hash, technical verification, version lineage, retention state, legal hold, audit and transfer provenance | Documents Foundation |
| Entity details and lifecycle | Source domain |
| Business process, its state and responsible actor | Source domain |
| Document-as-evidence decision | Source domain under institutional policy |
| Institutional permissions by role/category/action | Institutional policy, evaluated in valid Institutional Context |

Documents Foundation receives a source-process reference and resolves/validates its entity reference through the integration contract. It must not copy complete entity records or reconstruct business authority.

## 4. Minimum conceptual entities

| Entity | Owned data | Explicit exclusions |
|---|---|---|
| `Document` | Logical document identity, institution, category, high-level lifecycle | Student/Enrollment/Attendance/Finance records |
| `DocumentVersion` | Immutable byte version, SHA-256 hash, size, declared/detected content type, verification state, secure storage locator | Business-validity conclusion |
| `DocumentLink` | Version-to-process reference, source-domain/process type/process identifier, immutable entity reference, link status | Process content and business state |
| `DocumentTransfer` | Origin, destination controlled copy, policy basis and immutable provenance | Silent cross-institution sharing |
| `DocumentLegalHold` | Hold status, authority, reason and lifecycle | Business-process decision |
| `DocumentAuditEvent` | Security and lifecycle event record | File bytes or business data |

## 5. Lifecycle and version rules

| State | Access | Evidence status |
|---|---|---|
| `uploading` | No | No |
| `received_pending_review` | Authorised access with warning | No |
| `verified_available` | Authorised access | Only if accepted by the source process |
| `quarantined` | Blocked | No |
| `superseded` | Category/policy controlled historical access | No automatic validity |
| `retained_legal_hold` | Authorised policy-controlled access | Process-dependent; deletion blocked |
| `expired` | No | No |
| `deleted` | No | No |

A replacement never updates existing process evidence silently. While replacement is awaiting the responsible decision, the previously accepted version is pending and is not proof. The source domain decides whether a concrete version becomes valid evidence.

## 6. Integrity, access and audit

- Every version requires a cryptographic SHA-256 content hash, byte size and declared versus detected content type.
- No public object URLs, browser-owned authority, local-only storage or untracked DataURL is acceptable.
- Access decisions are role/category/action based and require a valid institutional context.
- Technical verification and business validity are separate. Documents can verify the former, never decide the latter.
- Audit covers upload, verification, view, download, access denial, link/unlink, replacement, decision receipt, transfer, hold, quarantine, expiration and deletion.
- Final deletion removes file bytes and functional/content metadata. The retained audit event is limited to timestamp, reason and pseudonymised identifier.

## 7. Permission and policy-governance contract

### 7.1 Policy hierarchy

Central platform governance owns approval and change of the single global policy. The global policy is versioned and establishes mandatory boundaries, including category eligibility, retention, transfer controls and non-negotiable security rules.

Institutional policy may configure roles and permitted actions only within those global boundaries. Every access, retention and transfer decision must retain the exact global-policy version that applied when it was made.

### 7.2 Action rules

| Action | Rule |
|---|---|
| View | Authorised by institutional role and category, in valid Institutional Context |
| Download | Independent of view; authorised by role and category |
| Upload | Institutional roles by policy; learner/guardian direct submission only for permitted categories |
| Pre-review view of learner/guardian submission | Submitter and authorised institutional roles |
| Replace or withdraw own submission | Only when category policy permits and before source-process decision |
| Delete before retention end | Institutional policy, unless legal hold or mandatory retention prevents it |
| Initiate cross-institution transfer | Authorised institutional role only |
| Change global policy | Central platform governance only |
| Revoke access | Future access is blocked immediately |

No permission is inferred from a prior download, a previously generated link or a browser session. Each future file access must be evaluated against the current valid permission and institutional context.

## 8. Global category-policy matrix

### 8.1 Global safe-format catalogue

The initial global safe catalogue is:

- PDF;
- JPG;
- PNG;
- modern Office documents without macros.

Institutions select allowed formats for each category only from this catalogue. Executables, archives, legacy/unknown binary formats and macro-enabled Office files are outside the first cut. A file whose detected type differs from its declared type or extension is quarantined and blocked from access.

### 8.2 Initial category rules

| Category | Minimum classification | Allowed formats | File-size policy | Retention | Default transfer rule |
|---|---|---|---|---|---|
| Enrollment / identity | Restricted | Institution selects from global safe catalogue | Per category and institution, within central global ceiling | Global jurisdiction-and-category profile | Blocked until explicitly permitted |
| Attendance justification | Confidential | Institution selects from global safe catalogue | Per category and institution, within central global ceiling | Global jurisdiction-and-category profile | Blocked until explicitly permitted |
| Academic documents | Confidential | Institution selects from global safe catalogue | Per category and institution, within central global ceiling | Global jurisdiction-and-category profile | Blocked until explicitly permitted |
| Administrative / financial | Restricted | PDF, JPG, PNG and modern Office without macros, subject to institutional category policy | Per category and institution, within central global ceiling | Global jurisdiction-and-category profile | Blocked until explicitly permitted |

A category classified Confidential or Restricted never gains inter-institutional transfer merely by default. The earlier general default of transfer for non-restricted future categories does not apply to the four first-cut categories.

### 8.3 Retention and size governance

There is one global policy, approved centrally and versioned. It contains mandatory jurisdiction-and-category retention profiles. Institutions cannot independently choose retention periods.

For file size, central governance defines a safe maximum ceiling for each category. Institutions may select a lower limit by category, but cannot exceed that ceiling. Exact numeric ceilings remain a centrally governed configuration decision, not a hard-coded domain rule.

## 9. Upload, verification and quarantine contract

### 9.1 Private resumable upload

- File bytes are sent directly to private storage through a scoped, temporary upload authorisation; no public URL is created.
- An authorisation lasts 15 minutes and may be renewed only for a valid resumable-upload session.
- The storage target is bound to the authorised institution, actor, category, intended process reference and upload session. It cannot be reused for another target.
- Interrupted uploads may resume for 24 hours.
- If the user explicitly cancels, retention of partial bytes is decided by institutional policy within a centrally governed limit; partial data must be deleted automatically when its allowed resume window ends.
- Repeated client requests are idempotent and must not create duplicate uploads or links.

### 9.2 Completion and technical verification

After receipt completes, the server calculates the definitive SHA-256 hash and creates a process link in `received_pending_review` state with a visible warning. The source process may continue, but cannot treat that version as automatically valid evidence.

Before a version reaches `verified_available`, all of these checks are mandatory:

1. server-side hash and integrity calculation;
2. detected content type versus declared extension/type;
3. category and institution size limits;
4. malware detection.

A type mismatch, malware detection or other verification failure moves the file to `quarantined` and blocks access. If verification infrastructure is unavailable, the file remains pending and retries automatically for up to 24 hours; after that it is quarantined and the sender plus authorised institutional roles are notified.

### 9.3 Cancellation, recovery and re-submission

If the source-process link is removed while a file is pending verification, the upload is cancelled and pending file data is deleted. No unlinked verified asset remains from that attempt.

After quarantine, a sender may submit a new version to the same process only where the category policy permits it. This creates a new auditable version/attempt; it never reactivates the quarantined bytes.

### 9.4 State propagation and notifications

Documents Foundation publishes a durable state event for received, verified, quarantined, expired and deleted outcomes. The source domain receives the event and may also query the authoritative document state.

The sender is notified immediately when a file becomes technically available. Quarantine notifies the sender and authorised institutional roles. These notifications do not imply business acceptance or validity as evidence.

## 10. Transfer rule

Transfer is not sharing an original across institutions. When the global policy permits a category transfer, Documents Foundation creates a controlled destination copy and preserves immutable provenance to its origin. The policy must state the eligible category, actor, legal basis, destination condition and audit requirements.

## 11. Non-goals

- No document validity engine for Enrollment, Attendance, Academic or Finance.
- No parallel student, guardian, enrollment, financial or academic datastore.
- No generic workflow engine.
- No automatic cross-process reuse merely because hashes match.
- No implementation authorisation.

## 12. Remaining preparation work before implementation readiness

1. Complete the global category-policy matrix: file types, size limits, retention, replacement and transfer rules.
2. Define source-domain integration contracts and acceptance criteria.
3. Validate international legal/jurisdictional requirements for retention, deletion, transfer and access policies.
4. Produce the mission pack, implementation plan and obtain explicit implementation authorisation.

## 13. Readiness marker

```
DESIGN_CLOSED = NO
IMPLEMENTATION_READY = NO
IMPLEMENTATION_AUTHORIZED = NO
```

This record is the durable, version-controlled authority for decisions confirmed to date. It must be extended through the remaining preparation work before any implementation mission can rely on it.
