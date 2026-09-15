# PAP Database Guide

This guide explains the Nexus database model in human terms for study and presentation. It is not schema authority; migrations, current code and canonical architecture remain authoritative.

## 1. Why the database is structured by domain

Nexus separates different business truths instead of storing everything in one generic user or school table. Important examples include identity, institutional Membership, students/enrollments, finance, documents and audit history.

For each important concept explain:

```text
CONCEPT=
WHY_IT_EXISTS=
PRIMARY_RELATIONSHIPS=
AUTHORITATIVE_TABLES=
IMPORTANT_INVARIANTS=
HISTORY_OR_IMMUTABILITY_RULES=
```

## 2. Identity and institutional context

Explain why authentication identity is not the same as a Person, why roles belong to institutional Membership, and why institutional scope is resolved server-side.

## 3. Tenant ownership

Explain why institutional tables carry institution ownership and why reads/writes must include tenant-safe conditions. A valid record ID by itself is never enough to authorize cross-institution access.

## 4. Finance concepts

When documenting Finance, explain concepts rather than only names:

- `FinancialAccount` — institutional financial context for a debtor/party;
- `Obligation` — amount that is owed;
- `Payment` — money received;
- `Allocation` — how received money is applied to obligations;
- `FinancialDocument` — issued documentary truth such as invoice/receipt/credit note;
- correction linkage — a correction creates a new document and preserves the original history.

## 5. Documents and files

Explain the distinction between metadata/state in PostgreSQL and actual file/binary storage where applicable. Cover ownership, retrieval, authorization and persistence boundaries.

## 6. Versioning and history

For tables that use versions, snapshots, effective dates or immutable rows, explain why historical truth must remain reproducible and why editing an old record in place can be unsafe.

## 7. Transactions and concurrency

For critical multi-write operations, explain which changes must succeed or fail together and how transaction/locking/idempotency behavior protects against partial or duplicate outcomes.

## 8. Diagrams for the PAP

When diagrams are created, derive them from current repository truth and label them by scope/version. Prefer focused diagrams per domain over one unreadable full-schema diagram.

## 9. Learning checklist

For every PAP-relevant database area, the author should be able to answer:

```text
What does this entity represent?
Why is it separate from related entities?
Which entity owns the relationship?
How is institution ownership enforced?
What can change and what must remain historical?
What happens if the same operation is retried?
```
