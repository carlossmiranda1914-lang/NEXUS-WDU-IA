# STUDENT-360-UI-01 — Human UAT Surface

**State:** READY — STUDENT-360-UI-01  
**Baseline:** `main @ f413d61381a6f9edb54a0ce1138e9c49fb49dd9b`  
**Dependencies:** STUDENT-360-01 integrated in `main`; Firebase authentication and server-side InstitutionalContext remain authority.

## Outcome

Provide the smallest navigable, read-only Student 360 screen in the existing Nexus shell so a human can inspect the already-authoritative Student Context response. The browser receives only an opaque student reference and an authenticated bearer token; it never chooses an institution, evaluates permissions, reconstructs backend joins, persists the projection, or provides a fallback dataset.

## Scope

### In

- Typed client for `GET /api/student-context/:personRef`.
- One Student 360 page/route reached from an existing student-context surface.
- Current, historical paginated, safe Enrollment-document-metadata and unavailable-domain presentation.
- Loading, empty/partial, retry and safe 401/403/404/error presentation.
- Contract/component/security/pagination tests and real local UAT preparation.

### Out

- Student authority, schema, migrations, backend authorization, persistence, cache or localStorage projection.
- Browser-held Institution or role authority.
- Finance, Assessment, Attendance and physical Documents.
- UI redesign, mock fallback, historical reconstruction or unrelated shell refactors.

## Invariants

1. The existing Student Context backend remains the only authority; the UI calls it once per requested view and renders its safe shape.
2. The authenticated Firebase token is the only client credential; institutional context is resolved exclusively server-side.
3. `current` and `history` remain visibly distinct; history page controls pass only the approved cursor/limit query options.
4. `not_yet_authoritative` is rendered as unavailable, never as a zero, success or operational claim.
5. 401, 403 and 404 reveal no student, tenant, SQL, stack or internal identifiers.
6. The UI stores no projection data and performs no domain write.

## Acceptance evidence

| Area | Required proof |
| --- | --- |
| Client contract | Typed response mapping, bearer-token request and safe HTTP classification; no institution request field or fallback data |
| Display | Current/year/class/program/level/subjects, separate history, safe document metadata and unavailable domains |
| States | Loading, empty/partial, retry, 401, 403, 404 and generic safe error |
| Security | No UUID/contact/national-ID/SQL/stack rendering; denied/cross-tenant response shows only non-disclosing state |
| History | Deterministic next-page interaction for both Enrollment and Placement history |
| UX | Existing Nexus shell patterns; desktop/mobile and light/dark inspection |
| Operational UAT | Real portal at `http://localhost:3000`, real login/authenticated fixture and visible Student 360 page held open for human review |

## Stop rules

Stop if rendering requires a backend/schema/authority change, a browser-selected institution, a mock or fabricated UAT fact, an unapproved role rule, or Finance/Assessment/Attendance/physical-document data.

**READY — STUDENT-360-UI-01**
