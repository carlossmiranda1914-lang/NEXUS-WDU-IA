# STUDENT-360-UI-01 — Definition of Ready Evidence

**State:** READY — STUDENT-360-UI-01  
**Baseline:** `main @ f413d61381a6f9edb54a0ce1138e9c49fb49dd9b`

| Prerequisite | Factual evidence | Result |
| --- | --- | --- |
| Backend authority | `src/modules/student-context/student-context.controller.ts` registers authenticated `GET /api/student-context/:personRef`; PR #84 is merged | PASS |
| Response semantics | `student-context-api.ts` returns current/history/documents/unavailable with cursor pagination and no internal IDs | PASS |
| Server authorization | Existing controller uses `requireAuth` and `req.institutionalContext`; no browser institution selector exists | PASS |
| Shell integration point | `src/App.tsx` already hosts an authenticated Nexus shell and `EnrollmentOperationsWorkspace` uses Firebase bearer requests | PASS |
| AS-IS gap | No client component imports/calls `/api/student-context/:personRef`; no Student 360 screen exists | PASS — this mission closes only this UAT gap |
| Scope authority | User explicitly authorized this UI-only mission and froze Finance/Assessment/Attendance/physical Documents | PASS |

## Implementation boundary

The page uses the existing Firebase `auth.currentUser.getIdToken()` request pattern. It accepts an opaque reference supplied by the selected student context and renders only the server response. It does not trust `users.role`, browser role simulation or any client-provided institution field.

**READY — STUDENT-360-UI-01**
