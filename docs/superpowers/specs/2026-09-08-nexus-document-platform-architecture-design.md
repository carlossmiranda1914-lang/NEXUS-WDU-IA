# Nexus Edu IA — Document Platform Architecture Design

**Status:** PRODUCT OWNER APPROVED ARCHITECTURE — NOT IMPLEMENTATION AUTHORITY  
**Date:** 2026-09-08  
**Scope:** Cross-platform document authority, preview, storage-provider boundary and Microsoft 365 integration boundary.  
**Implementation authorization:** NO. A separate implementation plan and execution approval are required.

## 1. Purpose

Nexus requires a coherent document experience without making Microsoft 365, a browser file URL, or a storage provider the authority for institutional access. This design establishes a provider-neutral document platform that supports ordinary editable Office files, generated institutional documents and immutable official financial/fiscal documents while preserving tenant isolation and domain authority.

The product goal is a common Nexus document experience: users find and preview documents in Nexus, while the actions available depend on document class, state and server-authorized capability. Office editing is an explicit secondary action for eligible editable files; it is never a universal document capability.

## 2. Architectural decision

Nexus adopts a hybrid/provider-neutral model:

`Nexus PostgreSQL metadata/context authority -> storage provider abstraction -> Nexus preview and specialized external editing`

Microsoft 365 is a supported provider/integration and specialized editing environment, not Nexus authority and not a mandatory platform dependency.

## 3. Authority boundaries

### 3.1 Nexus authority

Nexus PostgreSQL owns the canonical institutional document metadata needed to answer at least:

- logical Nexus document identity;
- owning institution/tenant;
- document classification and state;
- authorized domain/source relationship;
- access and action policy references;
- version/provenance relationship;
- configured storage-provider identity;
- external provider document/version references when applicable;
- integrity/evidence metadata required by the owning domain.

A provider object identifier, public-looking URL, Office link or browser state never grants Nexus access.

### 3.2 Storage authority

Binary content storage is abstracted behind a provider contract. The architecture must support Nexus-managed object storage and Microsoft 365/SharePoint/OneDrive-style providers without embedding one provider into the canonical document domain.

A future provider contract should cover only provider responsibilities such as storing/reading content, version identity, provider metadata, integrity/evidence support and authorized external-open targets. Exact interfaces are an implementation-plan decision after repository-fit review.

### 3.3 Authorization authority

Institutional context and document action authorization are server-derived. Provider permissions may add defense in depth but never replace Nexus Membership/capability authorization. Cross-tenant document, version, provider-object and artifact access fail closed.

## 4. Canonical document classes

### 4.1 GENERAL_EDITABLE_DOCUMENT

Examples: `.docx`, `.xlsx`, `.pptx` and other explicitly supported editable institutional files.

Allowed behavior when authorized:

- preview in the Nexus document experience;
- open in the appropriate specialized editor;
- preserve a trackable version relationship after editing;
- expose history/provenance appropriate to the document type.

For Microsoft 365 integrations, `.docx`, `.xlsx` and `.pptx` may route respectively to Word, Excel and PowerPoint online editing when the institution has a valid integration and the user is authorized.

### 4.2 GENERATED_INSTITUTIONAL_DOCUMENT

Examples include declarations, certificates and reports generated from Nexus domain data.

Editability is controlled by explicit document-type policy. Generated does not automatically mean editable or immutable. The owning domain remains authority for the data from which the document was generated.

### 4.3 OFFICIAL_FINANCIAL_DOCUMENT

Examples include jurisdiction-supported invoice, receipt, invoice-receipt and corrective fiscal documents.

Official issued financial documents are immutable evidence of established Finance truth. They may be viewed, downloaded, printed, inspected for provenance/history and corrected only through the authorized fiscal workflow supported by policy. Arbitrary Office editing is forbidden.

The Finance domain remains financial/document issuance authority; the common Document Platform must not reinterpret, recalculate or mutate Finance truth.

## 5. Common preview experience

Nexus Preview is the common entrypoint for document inspection. Preview and editing are separate actions.

Conceptually:

`select document -> server authorization -> resolve class/state -> Nexus Preview -> expose only allowed actions`

Preview is never authority for underlying domain facts. For official financial documents it is strictly read-only.

The product must not automatically send every document to an external editor. An authorized editable Office document may expose `Open in Word`, `Open in Excel` or `Open in PowerPoint`; an issued fiscal document must never expose those actions.

## 6. Microsoft 365 boundary

Microsoft 365 integration is institution-scoped and optional. A future institutional integration profile may identify connection status, tenant/domain context, SharePoint site/document library or equivalent provider configuration, and whether supported external editing is enabled.

Rules:

- `MICROSOFT_365_REQUIRED_FOR_NEXUS=NO`
- `MICROSOFT_365_CONFIGURATION=INSTITUTION_SCOPED`
- `MICROSOFT_365=SUPPORTED_PROVIDER_NOT_CORE_AUTHORITY`
- country, jurisdiction or currency must never silently enable Microsoft 365;
- absence of Microsoft 365 must not make the Nexus platform unusable;
- provider connection and user document authorization are distinct decisions.

## 7. External editing and version continuity

For an eligible editable Office document, the conceptual flow is:

`Nexus document -> authorize -> resolve institution provider -> resolve external object -> open authorized edit target -> provider edit -> preserve trackable Nexus/provider version relationship`

The architecture must preserve enough relationship data to correlate a logical Nexus document with provider document/version identity. Exact synchronization semantics, conflict handling and webhook mechanisms are deferred to the dedicated Documents implementation design.

Normal product flow must not create untracked/orphan external copies as a substitute for versioning.

## 8. Generated templates

Future editable institutional templates may be edited through an authorized Office integration. Template presentation is not authority for protected Nexus domain data. A template must not be able to override server-authoritative financial values, tenant context or legally mandatory immutable content.

Template editing is not part of FINANCE-F7.

## 9. Finance integration boundary

FINANCE-F7 consumes this architecture only as a boundary constraint:

- `F7_FINANCIAL_PREVIEW=READ_ONLY`;
- `ISSUED_FISCAL_DOCUMENT_OFFICE_EDITING=FORBIDDEN`;
- official financial artifacts may appear in a common Document Workspace;
- artifact storage may later use the common provider abstraction;
- Finance retains financial issuance, snapshot, provenance and correction authority;
- the Document Platform may not recalculate financial values or create fiscal corrections;
- full Microsoft 365 integration is outside FINANCE-F7.

This prevents F7 scope expansion while avoiding a future architectural dead end.

## 10. Security and tenant invariants

1. Nexus server-derived institutional context is authoritative.
2. Every document and provider reference is institution-scoped.
3. Knowing a Nexus document ID, provider object ID or storage URL grants no access.
4. External editing requires explicit server authorization.
5. Cross-tenant document/version/artifact/provider-object access is forbidden.
6. Storage objects are private by default unless a separately approved sharing capability exists.
7. Normal browser state is never authorization authority.
8. Provider callbacks/webhooks, if later supported, must be authenticated, tenant-resolved and idempotent before changing Nexus metadata.
9. Official financial artifacts remain governed by Finance immutability and provenance rules.

## 11. Product behavior matrix

| Class | Nexus preview | Office editing | Download | History | Correction |
|---|---|---|---|---|---|
| General editable document | Yes | When type/integration/permission allow | When allowed | Yes | Not fiscal correction |
| Generated institutional document | Yes | By document-type policy | When allowed | Yes | By owning-domain policy |
| Official financial document | Read-only | **No** | Authorized PDF/artifact | Yes | Fiscal workflow only |

## 12. Explicit non-goals

This architecture does not authorize or implement:

- Microsoft Graph/API integration;
- SharePoint/OneDrive provisioning;
- OAuth/token storage;
- embedded Office editor sessions;
- synchronization/webhooks;
- generalized collaborative editing;
- document template designer;
- public file sharing;
- FINANCE-F7 Microsoft 365 support;
- provider-specific schemas in the core domain.

Those require dedicated repository-fit analysis, threat modeling, implementation planning and UAT.

## 13. Approved decisions

- `DOCUMENT_METADATA_AUTHORITY=NEXUS_POSTGRESQL`
- `CONTENT_STORAGE_PROVIDER=ABSTRACTED`
- `MICROSOFT_365=SUPPORTED_PROVIDER_NOT_CORE_AUTHORITY`
- `MICROSOFT_365_CONFIGURATION=INSTITUTION_SCOPED`
- `MICROSOFT_365_REQUIRED=NO`
- `DOCUMENT_CLASSIFICATION=REQUIRED`
- `GENERAL_EDITABLE_DOCUMENT_OFFICE_EDITING=ALLOWED_WHEN_AUTHORIZED`
- `GENERATED_DOCUMENT_EDITABILITY=TYPE_POLICY_CONTROLLED`
- `OFFICIAL_FINANCIAL_DOCUMENT_EDITABILITY=FORBIDDEN`
- `NEXUS_PREVIEW=COMMON_ENTRYPOINT`
- `OFFICE_EDITING=EXPLICIT_SECONDARY_ACTION`
- `EXTERNAL_EDIT_PERMISSION=SERVER_AUTHORIZED`
- `EXTERNAL_DOCUMENT_ID_DOES_NOT_GRANT_NEXUS_ACCESS=YES`
- `OFFICE_EDIT_CREATES_TRACKABLE_VERSION_RELATIONSHIP=YES`
- `ORPHAN_EXTERNAL_COPIES_AS_NORMAL_FLOW=NO`
- `COMMON_DOCUMENT_WORKSPACE_CAN_INCLUDE_FINANCIAL_DOCUMENTS=YES`
- `FINANCIAL_AUTHORITY_REMAINS_IN_FINANCE=YES`

## 14. Implementation gate

This document is architecture authority only. Before implementation, the Documents mission must inspect existing repository document/storage/IAM patterns, define concrete provider interfaces and threat model, decompose implementation into independently testable slices, create a TDD implementation plan and obtain explicit Product Owner implementation approval.

`DOCUMENT_PLATFORM_ARCHITECTURE=APPROVED`  
`IMPLEMENTATION_AUTHORIZED=NO`
