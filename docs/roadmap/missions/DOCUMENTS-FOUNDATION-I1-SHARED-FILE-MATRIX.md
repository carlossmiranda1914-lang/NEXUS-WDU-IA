# DOCUMENTS FOUNDATION I1 — Shared-File Matrix

**Estado:** PREPARATION — proposed execution boundary  
**Baseline:** `main @ 02b7f0a454df922598b56660ce10216956539939`  
**Code authorization:** NO

## Decision

I1 is narrowed to a server/domain + PostgreSQL core. It deliberately exposes **no HTTP route** and no UI. This removes any need to change `server.ts`, route composition, frontend or existing module controllers.

## Exact matrix

| Classification | Path/area | I1 action | Decision |
|---|---|---|---|
| OWNED | `src/modules/documents/document-core.ts` and supporting files under `src/modules/documents/**` | Create | Documents owns the new domain. |
| OWNED | `tests/documents-core.test.ts` | Create | Pure policy/authority contract. |
| OWNED | `tests/documents-core-postgres.test.ts` | Create | Real PostgreSQL integrity and A→B negative proof. |
| OWNED (new file in shared migration directory) | `src/db/migrations/NNNN_documents_foundation_core.sql` | Create only | NNNN must be derived from the clean execution branch immediately before implementation; never assume or modify an existing migration. |
| CONSUMED, NOT MODIFIED | `src/auth/institutional-context.ts` | Import type/use its server-derived `institutionId` and `personId` | No change allowed. |
| CONSUMED, NOT MODIFIED | `src/db/index.ts` | Reuse canonical PostgreSQL pool/query conventions | No change allowed. |
| CONSUMED, NOT MODIFIED | migration runner `scripts/nexus-migrate.ts` | Reuse existing discovery/order/checksum mechanism | No change allowed. |
| FORBIDDEN | `server.ts`, composition of production routes | No route in I1 | Later HTTP mission only. |
| FORBIDDEN | `src/db/schema.ts` | No Drizzle representation in I1 | PostgreSQL migration is canonical; do not introduce a parallel schema path. |
| FORBIDDEN | `src/modules/enrollments/**`, `enrollment_documents` | No change | Matrícula retains process metadata/decision authority. |
| FORBIDDEN | `uploaded_documents`, legacy `/api/documents` routes | No change | Transitional surface remains fenced until a later migration mission. |
| FORBIDDEN | `src/modules/finance/**`, Finance migrations, fiscal document work | No change | Finance remains isolated. |

## I1 data boundary

I1 may create its own institution-scoped identities for:

- document;
- document version;
- immutable provenance event;
- opaque storage reference metadata.

It may not ingest bytes, generate preview URLs, issue share links, call a provider or attach a document to an Enrollment/Finance record.

## Proof matrix

| Invariant | Required evidence |
|---|---|
| tenant scope | PostgreSQL A/B attempts for document, version, provenance and storage reference all reject or return non-disclosing not-found |
| append-only | update/delete attempts against confirmed version/provenance are DB-constrained or rejected by repository contract |
| reference safety | opaque storage reference is never returned as an authorization decision |
| idempotency | same institution/operation/key/fingerprint replays canonical result; changed fingerprint fails closed |
| transaction | document/version/provenance/idempotency result roll back together under injected failure |
| boundary | static/contract test asserts no I1 import/change path into Finance, Enrollment, `server.ts` or `uploaded_documents` |
| migration | isolated fresh PostgreSQL migration chain applies in order and includes the new migration exactly once |

## Gate outcome

```text
BASELINE_PARITY=PASS
I1_SHARED_FILE_CHANGES_REQUIRED=NO
I1_SHARED_CONSUMPTION=APPROVED
I1_ROUTE_CHANGE=DEFERRED
I1_SCHEMA_TS_CHANGE=FORBIDDEN
I1_FINANCE_CHANGE=FORBIDDEN
I1_ENROLLMENT_CHANGE=FORBIDDEN
I1_LEGACY_DOCUMENT_CHANGE=FORBIDDEN
P0_OPEN=0
P1_OPEN=0
IMPLEMENTATION_AUTHORIZED=NO
NEXT_ACTION=PRODUCT_OWNER_REVIEW_AND_AUTHORIZE_DOCUMENTS_FOUNDATION_I1_CORE
```
