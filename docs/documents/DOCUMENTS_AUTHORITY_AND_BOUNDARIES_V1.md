# Documents Foundation — Authority & Domain Boundaries v1.0

**Status:** APPROVED  
**Parent authority:** `DOCUMENTS_FOUNDATION_MASTER_SPEC_V1.md`

## Authority rule

Documents owns documentary technical truth. It does not absorb the business authority of the process that uses documentary evidence.

| Concern | Canonical authority | Documents role |
|---|---|---|
| Identity, membership, institution context | IAM / InstitutionalContext | consume trusted server context |
| Enrollment process and enrollment evidence decision | Enrollment | store/reference documentary evidence through future contract |
| Attendance absence-justification decision | Attendance | store/reference evidence; never accept/reject absence itself |
| Financial obligations, payments, allocations, fiscal truth, ledger | Finance | documentary representation/reference only |
| Academic meaning/decision | Academic | documentary representation/reference only |
| Document identity/version/provenance/technical state | Documents | canonical authority |
| Storage reference/integrity/technical verification | Documents | canonical authority |
| Generic document retention/hold/deletion evidence | Documents + governed policy | enforce approved mechanism |

## Mandatory boundaries

1. Documents must not introduce a parallel IAM or trust client-supplied tenant authority.
2. Documents must not write Finance business truth.
3. Documents must not convert Enrollment metadata/decisions opportunistically.
4. Documents must not decide Attendance or Academic business outcomes.
5. Other domains must not bypass Documents contracts by writing its repositories/tables directly.
6. `DocumentAssociation` expresses purpose/linkage; it does not transfer authority.
7. `BusinessDecisionReference` records a fact owned elsewhere; it is not a duplicated decision engine.

## Existing repository boundary

The audited repository baseline already distinguishes:

- `enrollment_documents`: canonical Enrollment metadata/decision lifecycle; preserve until explicit integration mission.
- `uploaded_documents`: transitional generic writer; preserve with no new consumers until a canonical Documents metadata+storage command exists.
- AI document-generation writes into legacy `uploaded_documents`: transitional; no new authority may be inferred from them.
- browser/local document lists: prototype only; never evidence of durable submission.

These surfaces are migration dependencies, not permission to modify them during I1.

## Interinstitutional rule

Cross-institution access is denied by default. A permitted transfer or interinstitutional access flow requires an explicit contract containing source, destination, purpose, scope, duration/basis where applicable, authorization and audit evidence. Updating the original document's institution to simulate transfer is forbidden.

## STOP conditions

Stop the active mission and require a formal decision if implementation would require:

- changing another domain's canonical authority;
- changing Finance outside an authorized Finance integration mission;
- modifying IAM/InstitutionalContext semantics;
- mutating Enrollment document truth outside an authorized integration mission;
- using `uploaded_documents` as the new canonical Documents model;
- creating a direct cross-domain table-write shortcut;
- weakening institution isolation or audit requirements.
