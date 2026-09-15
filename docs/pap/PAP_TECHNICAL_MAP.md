# PAP Technical Map

This document explains the real Nexus architecture in human terms. It is an explanatory map, not a replacement for canonical architecture documents.

## 1. End-to-end request path

Use this model when explaining significant capabilities:

```text
User
-> Frontend surface
-> Client/API call
-> HTTP route
-> Authentication + institutional authorization
-> Domain/service authority
-> PostgreSQL persistence
-> Readback/presentation model
-> UI result
```

## 2. Frontend

Record the main user-facing workspaces/components, what information they display and what user intentions they collect. The frontend may request and present actions, but it does not become authority for tenant, role, eligibility or authoritative state transitions.

## 3. Client/API boundary

Explain how browser clients call backend routes, which inputs are user intent versus authoritative server context, and how errors/readiness are returned.

## 4. Backend

Explain the services/repositories/commands that own business rules. For each major capability identify the authoritative command or service and the invariants it protects.

## 5. Identity and institutional context

Explain the separation between authentication identity and institutional Membership/context. Institutional scope and permissions are resolved server-side.

## 6. PostgreSQL

Explain PostgreSQL as durable authority for vNext institutional/domain state where defined by the architecture. Show important relationships and immutable/history rules rather than only listing tables.

## 7. Documents and file storage

For document/upload capabilities, explain both metadata authority and binary/file storage behavior, including ownership, authorization, persistence, retrieval and failure boundaries. Never describe a UI-selected filename as proof of stored content.

## 8. Integrations

Record external integrations only when actually implemented or explicitly classified as planned/blocked. Examples may include Microsoft 365 or external fiscal/identity providers.

## 9. Major modules

Maintain concise maps for significant modules such as IAM, Students, Enrollment, Academic, Finance and Documents. Each module explanation should answer:

```text
WHAT_PROBLEM_DOES_IT_SOLVE=
WHO_USES_IT=
MAIN_AUTHORITIES=
MAIN_PERSISTENCE=
MAIN_UI=
KNOWN_LIMITATIONS=
```

## 10. Scale notes

For modules where volume/concurrency matters, reference the relevant `SCALE_PROFILE` and explain pagination, bounded queries, transactions, storage or concurrency controls in plain language.
