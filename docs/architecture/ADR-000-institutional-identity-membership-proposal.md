# ADR-000 — Historical Proposal: Institutional Identity, Membership and Authorization Boundary

**Status:** SUPERSEDED PROPOSAL / HISTORICAL  
**Original date:** 2026-08-09  
**Original filename:** `ADR-001-institutional-identity-membership.md`

## Why this document exists

The repository previously contained two different documents numbered `ADR-001`. This file preserves the earlier, extensive identity/membership proposal without allowing its duplicate identifier or `Proposed` status to compete with the later accepted ADR.

The accepted decision is `ADR-001-institutional-context.md` (2026-08-10). Current target architecture is `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md`.

## Preserved decision content

The proposal established the conceptual chain:

`Identity → Person → Membership → Institution → Institution-owned Resources`.

It distinguished authentication from institutional authorization; placed operational role on Membership rather than a global user role; separated Platform Admin from Institution Admin; allowed multiple institutional roles/relationships; required domain relations such as GuardianRelationship and TeacherAssignment; defined active institutional context as server-validated; required institution ownership checks for sensitive resources; extended the same trust boundary to WebSocket, jobs, audit and AI; and prohibited client-supplied tenant identifiers from granting authority.

These principles were subsequently absorbed and strengthened by the accepted institutional-context ADR, vNext implementation, Architecture v4 and Architecture TO-BE v2.

## Historical value

Keep this proposal because it records the reasoning that led to the accepted model. It must not be cited as a separate accepted `ADR-001`.

## Authority

This historical proposal cannot override:

1. accepted ADRs;
2. `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md`;
3. current product/roadmap sources.
