# Documents Foundation — Security & Privacy v1.0

**Status:** APPROVED

## Authorization

All authorization is server-side and institution-scoped. IDs, filenames, URLs, hashes, external references and storage locators never grant authority.

Permissions are action-specific: metadata view, content open, download, upload, replace, withdraw, review, decision-reference handling, audit and administration are distinct capabilities. Role alone is insufficient; category, sensitivity, relationship, purpose and policy may further constrain access.

Revocation applies immediately to new operations. Caches and temporary grants must be compatible with revocation requirements.

## Tenant isolation

Institution A must not view, infer, download, mutate, associate or enumerate Institution B's documents except through an explicitly authorized interinstitutional contract. Cross-tenant A->B negative tests are mandatory for every sensitive operation.

Unauthorized/not-found responses must avoid revealing whether another tenant owns the referenced object.

## Content access

Normal content access is mediated by Documents. Future temporary open/download authorization target is 5 minutes. Permanent public links are forbidden. Provider-specific signed URLs, if used internally, are an adapter detail and must not become the public domain identity.

## Security events and quarantine

Repeated denied access, cross-tenant attempts, malware/integrity failures and unauthorized privileged operations generate appropriate security evidence/alerts. Low-risk temporary blocking may be automated under policy; high/critical unlock requires human review.

Quarantined content is unavailable for normal preview/download/operational consumption. A normal administrator cannot bypass quarantine. Any future privileged release requires special permission, justification, reviewed/new assessment and audit.

## Encryption and secrets

Encryption in transit and at rest is required. Architecture must allow per-institution cryptographic isolation or equivalent control without coupling the domain model to one provider.

Secrets, credentials, tokens, signed URLs and binary content must never be written to normal logs/audit records.

## Privacy by design

- minimize collected/stored metadata;
- record purpose through associations/contracts;
- do not assume consent is the universal legal basis;
- preserve applicable consent evidence where consent is the actual basis;
- consent withdrawal triggers policy evaluation, not automatic destruction of every record;
- minor/guardian authority is consumed from canonical relationship sources;
- administration is not unrestricted content access;
- sensitive/special-category data may require stronger controls.

## Data subject rights

Rights are controlled workflows, not direct CRUD. A deletion request follows identity/authority verification, policy/jurisdiction evaluation, approved/partial/denied decision and controlled execution. Correction preserves historical evidence rather than rewriting it silently.

Authorized export must be contextual and may require third-party review/redaction. It is not an automatic dump of an entire institutional repository.

## AI and derived processing

Storage does not authorize AI processing. OCR, extraction, classification, embeddings, semantic indexing, model training or AI retrieval require an explicit authorized purpose/capability. Derived data inherits applicable privacy, authorization and retention requirements.

## Non-production

Real personal documents must not be copied into development/test environments for convenience. Tests use synthetic/anonymized data and must not weaken production authorization paths.

## Privacy/security invariant

`Possession != authorization`  
`Access != right to reuse`  
`Consent != universal legal basis`  
`Storage != AI authorization`  
`Deletion request != automatic deletion`  
`Administration != unrestricted content access`
