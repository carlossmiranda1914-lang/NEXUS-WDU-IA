# ATTENDANCE-01 — Institutional Policy Catalogue

**Status:** DRAFT — preparation only.  
**Implementation authorisation:** No.

## 1. Governance rule

Every setting below is institution-scoped, versioned and published only by an institutionally authorised role through audited approval. A setting is valid only within global and applicable jurisdictional limits. Session decisions retain the policy version effective at session initiation, except where a more restrictive global/jurisdictional obligation requires re-evaluation of pending work.

## 2. Configurable policies

| Key | Purpose | Confirmed permitted values / boundary |
|---|---|---|
| registration units | Units enabled for attendance | lesson/session, school day, school activity |
| operational timezone | Deadlines and school-day boundary | selected by institution within global rules |
| session confirmation deadline | Latest permitted confirmation | explicit institutional value |
| late-session handling | Consequence after deadline | automatic confirmed absence; or human decision route |
| human late-session authority | Resolves pending session | institutionally authorised policy actor |
| cancellation authority/conditions | Cancels OPEN session | institutional policy; reason mandatory |
| correction authority/conditions | Decides teacher correction proposal | institutional policy; teacher only proposes |
| correction decision deadline/escalation | Pending correction treatment | institutional deadline with alert/escalation |
| guardian justification eligibility | Submission availability | permitted/limited by policy |
| late justification eligibility | After unjustified deadline | permitted only if policy allows; new decision |
| justification coverage | Multiple absences | same learner, policy-defined interval and scope |
| justification delegation | Coordination delegation | allowed only by policy |
| justification decision authority | Approves/rejects proposals | authorised policy actor |
| unjustified deadline | Absence becomes unjustified | configurable institutional deadline |
| threshold inputs | What counts toward limit | absences, tardiness or configured combinations |
| threshold limits/action | Alert threshold and required human action | institution-configured |
| offline cache validity | Offline assignment validity | explicit per registration unit; server-signed expiry; no indefinite cache |
| offline conflict authority | Resolves synchronisation conflict | authorised policy actor |
| notification channels | Additional delivery channels | in-system mandatory; additional channels by policy |
| report summary availability | Institutional summary exports | only if policy permits |
| export scope | Permitted requested scope | individual learner, assigned class/activity, defined period; institutional summary if allowed |
| report requester role | Export requester | coordination or authorised institutional role |
| retention/erasure | Attendance/audit retention | institution configures only within global jurisdictional profile |
| historical migration | Migration permission | controlled/audited only; reconciliation, sample, institutional approval |

## 3. Fixed first-cut rules (not relaxable by institution)

- Teacher must have own active TeacherAssignment to initiate/confirm an assigned session.
- No recording in another teacher’s name.
- Online authorisation failure is denied, not deferred.
- A confirmed session remains historical; correction is revisioned.
- Guardian and learner access is limited to own learner/own record.
- Teacher, coordination and guardian receive initial threshold alert.
- Automatic confirmed absence notifies teacher, coordination and guardian immediately.
- In-system notification is mandatory.
- Offline cache is encrypted/OS-protected, minimum-only and deleted on sign-out.
- Non-compliant device blocks offline operation.
- Cross-institution access is denied.
- Report recipient requires OTP validation at every delivery; OTP lasts 5 minutes.
- Report export attachment is PDF/CSV by e-mail; no public URL; no generated-file copy retained after send.
- Technical file state remains in Documents Foundation.
- Historical migration needs reconciliation, validated sample and audited approval.

## 4. Remaining technical-definition fields

The following must be explicitly set during P3/P4 before implementation readiness can be requested:

- valid numeric/time ranges and safe defaults for each deadline/limit;
- policy inheritance/override precedence;
- exact policy evaluation request/response contract;
- policy publication effective-time scheduling and rollback semantics;
- actor/payload requirements for each policy transition;
- jurisdiction-profile mapping and retention executor; and
- change-impact/re-evaluation task contract.

No missing field may be silently defaulted in implementation.
