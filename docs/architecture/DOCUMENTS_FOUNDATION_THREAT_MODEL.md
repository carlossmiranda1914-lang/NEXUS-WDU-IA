# DOCUMENTS-FOUNDATION — Threat Model

**Status:** DRAFT — design threat model complete; independent security review pending.  
**Scope:** Documents Foundation only.  
**Not implementation authority.**

## 1. Security objective

Protect document confidentiality, integrity, availability and accountable lifecycle across institutions while preserving source-domain authority for business decisions.

## 2. Protected assets

- document bytes and derived preview/download representations;
- document/version/link identifiers and hashes;
- institutional context, role/action authorisation and temporary grants;
- source-domain signed upload proofs and decision events;
- audit trail, legal-hold, retention and transfer records;
- backup material, encryption keys and operational incident evidence.

## 3. Trust boundaries

| Boundary | Main risk | Required control |
|---|---|---|
| Browser → application | Forged actor, category or process context | Server validates Institutional Context and signed source proof |
| Application → private storage | Grant replay, target substitution or public exposure | Scoped 15-minute upload / five-minute retrieval grant; private storage only |
| Application → verification service | Unverified or malicious bytes become usable | Server hash, actual type, size and malware checks; quarantine on failure |
| Documents → source domain | Forged/replayed/out-of-order validity event | Signed events, correlation ID, ordering, idempotency and rejection of invalid events |
| Institution A → Institution B | Cross-tenant discovery or improper transfer | Fail-closed tenancy, non-disclosing denial and profile/basis-controlled transfer |
| Primary storage → backup/restore | Resurrection of deleted or unsafe content | Approved restore, current re-verification and no restoration after legal/retention deletion |

## 4. Threats and controls

| Threat | Consequence | Mandatory control | Evidence required |
|---|---|---|---|
| Tenant-context spoofing | Cross-institution disclosure | Server-derived Institutional Context; deny/non-disclose; alert central security | Negative test using two institutions |
| Temporary-grant replay/substitution | Unauthorized upload/download | Short expiry, single scoped target, current authorisation check | Expiry, replay and wrong-target tests |
| Malicious or disguised file | Malware/unsafe opening | Actual-type, size, hash and malware validation; quarantine | Type-mismatch and malware tests |
| Stale authorisation | Access after revocation | Five-minute retrieval grant; immediate re-evaluation/fail closed | Revocation and unavailable-authorisation tests |
| Business-validity forgery | Invalid evidence accepted | Source-signed 15-minute proof and signed decision event | Invalid/expired/replayed event tests |
| Audit manipulation | Loss of accountability | Append-only, integrity-verifiable events; no edits | Tamper-detection test |
| Backup resurrection | Reappearance of deleted data | Profile-controlled retention; no restore after legal/retention deletion | Deletion/restore negative test |
| Privileged-role misuse | Excessive access/export | Role/category actions, audit and anomaly blocking/escalation | Denied-role and repeated-denial tests |
| Verification outage | Unverified content persists indefinitely | Automatic retry for 24 hours, then quarantine and notice | Timeout/quarantine test |
| Event-delivery failure | Source/process state divergence | At-least-once delivery, recipient idempotency, failure queue | Replay and failure-queue tests |
| Availability / large-upload abuse | Resource exhaustion | Central category ceilings, institutional lower limits, resumable-session expiry | Limit, cancellation and resume tests |

## 5. Incident severity model

- **Low:** policy-classified repeated denial; short automatic block.
- **High/critical:** block persists until security review authorises reactivation.
- **Cross-institution attempt:** deny, audit and alert central security; classify under incident rules.
- **Critical confirmed incident:** notify central security and authorised institutional contact with non-disclosing user communication.

## 6. Residual risks and non-negotiable external checks

| Residual risk | Required gate |
|---|---|
| Actual legal basis, retention and transfer requirements vary by jurisdiction | Approved jurisdiction profile after qualified legal review |
| Hosting, key management and verification vendors may introduce provider-specific risk | Vendor/security architecture review before selection |
| Human institutional-role misuse cannot be eliminated technically | Role governance, audit and incident response validation |
| Implementation can diverge from this design | Independent security/threat-model review plus P5 evidence |

## 7. Security-review checklist

An independent reviewer must verify:

1. all trust boundaries and threats above remain represented in implementation;
2. no public URL or client-owned authority exists;
3. tenant separation is fail-closed and non-disclosing;
4. grant scope/expiry/revocation is enforced server-side;
5. quarantine and restore cannot bypass verification;
6. signed-event verification, ordering and idempotency are proven;
7. audit tamper resistance and post-deletion minimisation are tested;
8. backup, key, incident and failure-queue owners are named;
9. no P0/P1 security finding remains.

## 8. Status

```
THREAT_MODEL_DOCUMENTED = YES
INDEPENDENT_THREAT_MODEL_REVIEW_GREEN = NO
IMPLEMENTATION_AUTHORIZED = NO
```

This document closes internal threat-model design. It does not replace independent security review or legal profile validation.
