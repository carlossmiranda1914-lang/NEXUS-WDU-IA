# AUDIT-01 — Nexus Edu IA Technical Baseline

**Status:** CANONICAL factual audit baseline for planning  
**Mode:** read-only audit; no finding by itself authorizes a code change.

## 1. Executive conclusion

Nexus contains two generations at once. The legacy generation mixes large aggregates, client/localStorage state, simulations, manual IDs, direct AI writes and broad server routes. The vNext Enrollment/Identity generation introduces materially stronger patterns: Person/Identity/Membership, InstitutionalContext, transactions, row/advisory locks, idempotency, explicit state machines, database constraints, document snapshots and fail-closed policies.

The correct strategy is neither a full rewrite nor blind continuation. Preserve the strong vNext foundation, close structural authority gaps, then migrate capabilities domain by domain.

## 2. Gold foundation — PRESERVE

- Person / Identity / Membership boundary.
- InstitutionalContext derived from active Membership.
- Person Resolution with restricted cross-institution possible-match behavior.
- Academic Year lifecycle.
- Enrollment intake idempotency and transaction boundaries.
- Enrollment state machine and validation gates.
- Atomic enrollment activation synchronized with StudentProfile in the frozen checkpoint.
- GuardianRelationship as an explicit institutional relation.
- Document policy snapshots and immutable publication/versioning.
- Physical enrollment-file contract with hash/MIME/size/state/idempotency.
- Composite tenant integrity constraints introduced in later migrations.
- Enrollment Process projection and optimistic concurrency pattern.
- Authorized-students helper for student/guardian context.
- Tenant-safe School Tasks repository/service pattern.
- Realtime institutional isolation foundation.
- Request/correlation audit foundation.

## 3. Critical structural findings

| ID | Severity | Finding | Planning decision |
|---|---|---|---|
| AUD-DB-001 | P0 | Runtime DB initialization performs schema DDL alongside versioned migrations. | One schema authority; startup validation fail-closed. |
| AUD-DB-002 | P0 | Initialization can log failure yet continue to announce DB readiness. | Never convert unsafe initialization failure into success. |
| AUD-AI-AUTH-001 | P0 | Legacy `/api/chat` gives AI tools real write capability without proven granular per-tool policy. | Fence critical writes; later route AI through authorized application use cases. |
| AUD-AI-TENANT-001 | P0 | Legacy AI tools can resolve Student by global legacy ID before tenant-safe use. | Tenant-scope every AI tool/use case. |
| AUD-IAM-001 | P0 | Legacy user creation writes a `users` row but does not create the canonical authentication/Membership chain. | Replace admin identity provisioning path. |
| AUD-IAM-002 | P0 | Signup/profile/request-access flow can dead-end when no active Membership exists. | Design explicit onboarding/access-request lifecycle. |
| AUD-IAM-003 | P0/P1 | Legacy user status and Membership status compete as account/access semantics. | Membership becomes institutional authorization authority. |
| AUD-AUDIT-001 | P0 | Business-friendly log transformation can describe receipts/signatures/actions not proven by underlying event. | Preserve factual audit; presentation cannot invent history. |
| AUD-COMM-TENANT-001 | P0 | Legacy chat insert followed by `latest row` lookup creates concurrency/cross-tenant risk. | Use returned inserted identity and tenant-safe write contract. |
| AUD-FIN-004 | P0 | Legacy bank reconciliation can reuse stale in-memory invoice state within one request. | Replace with transactional/idempotent reconciliation and payment model. |
| AUD-FIN-005 | P0/P1 | Financial input validation permits semantically unsafe values and client-supplied denormalized identity. | Canonical validation/use cases. |
| AUD-DUPLICATE-ROUTES-001 | P0 | New tenant-safe Tasks routes coexist with legacy duplicate server routes. | Remove authority of duplicate legacy paths after proof. |
| AUD-INTEGRATION-IAM-001 | P0 | Google integration shares primary Firebase auth session; disconnect can sign out Nexus/change identity. | Separate external authorization from Nexus identity. |
| AUD-CONFIG-001 | P0 | Supabase/database “sync” helper returns success without real persistence. | Mark prototype/remove from operational UX. |
| AUD-PARENT-001 | P0 | Parent Portal contains hardcoded/demo relationships, payment simulation and fictitious operational data. | Treat as prototype; rebuild only on canonical sources. |
| AUD-DOC-PRODUCT-001 | P0 | General document examples can appear official/legal despite being demo content. | Remove from operational truth; keep fixtures clearly labeled. |

## 4. Important P1 findings

- Enrollment Process GET can reconcile/persist projection; reading may create an event attributed to the reader rather than a system actor.
- `last_progress_at` currently behaves more like projection-change time than guaranteed forward progress.
- Enrollment Process assignee validation checks active Membership but not a restricted operational role set; DB FK is not tenant-composite for assignee.
- Document requirement audit trigger can attribute mutation to policy creator rather than actual actor.
- Identity collision protection is stronger at intake than during later Person edits.
- Registration lacks optimistic concurrency comparable to Enrollment Process assignment.
- Closing an Academic Year blocks new intake correctly, but EnrollmentOffer may remain semantically `active`; future closure readiness gates are not yet modeled.
- `student_profiles.status` schema default can be more permissive than the explicit intake behavior.
- In-memory rate limiting is not distributed.
- Accessibility and full production deployment/DR readiness were not measured deeply enough to claim validation.

## 5. Product-truth / prototype findings

Capabilities that must not be treated as operational truth until rebuilt or explicitly labeled:

- Parent Portal demo flows/payment simulation.
- Supabase “sync” function that returns success without sync.
- Global Search projections synthesized from legacy arrays/hardcoded dates.
- client/localStorage school state treated as persistence.
- Google Sheets student import that ends in React state rather than canonical Enrollment.
- general school documents with demo/legal claims.
- AI-generated “certificate/signature” language without proven cryptographic/document issuance contract.
- UI permission/configuration controls that only affect client presentation while implying backend security.

## 6. Legacy aggregate problem

The legacy `students` concept carries responsibilities that belong to multiple future domains: identity, student institutional profile, academic assignment, attendance, grades, finance and documents. It must not be replaced table-for-table. Authority must be removed capability by capability.

See `LEGACY_REPLACEMENT_MAP.md`.

## 7. Test/CI assessment

The frozen checkpoint had a passing Secretariat quality gate, but the workflow coverage was uneven and did not explicitly protect every new S04 risk. Enrollment/Identity/Academic Year have materially stronger automated coverage than Finance, Teachers and several legacy modules. CI expansion is therefore part of Foundation convergence rather than evidence that the entire product is safe.

## 8. Readiness conclusion

The project is ready for **controlled foundation consolidation**, not broad feature expansion. Before new domain depth, close schema authority, legacy write authority, tenant sweep, product truth, audit truth and CI coverage. The vNext foundation should be the architectural reference for subsequent modules.
