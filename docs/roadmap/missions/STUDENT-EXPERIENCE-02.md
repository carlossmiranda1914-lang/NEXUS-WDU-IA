# STUDENT-EXPERIENCE-02 — Student Record Clarity & Operational Refinement

**State:** DONE
**Branch:** `codex/student-experience-02-design`
**Baseline:** `f5b787789f61744ddb6c512ae5a0ab2c87f7c329`
**Dependencies:** STUDENT-EXPERIENCE-01 accepted foundation; canonical Enrollment, Academic Core and Student Context read authorities.

## Purpose

Refine the existing read-only Student Record only when an operational fact is backed by a canonical owner and explicit domain rule. The normal record remains quiet. This mission never creates a Student writer, browser-owned authority, cross-domain join, fake lifecycle or inferred exception.

## Product laws

1. **Quiet summary, contextual detail.** Any verified fact is contextual; it is not a dashboard.
2. **Attention requires canonical fact + explicit domain rule.** Absence/null alone cannot create attention.
3. **See here, resolve at the owner.** Student Record remains read-only; a route is shown only for a real owner use case with safe public navigation.

## Task 1 — Canonical Attention Rule Inventory

`SCHEMA_CHANGE_EXPECTED=NO`

`ATTENTION_RULES_ACCEPTED=NONE`

`ATTENTION_RULES_REJECTED=ENROLLMENT_NON_ACTIVE_LIFECYCLE,DOCUMENT_REQUIRED_NOT_READY,DOCUMENT_METADATA_STATUS,GUARDIAN_RELATIONSHIP_STATUS,MISSING_CURRENT_ACADEMIC_CONTEXT,UNAVAILABLE_DOMAIN`

### Acceptance rule

A candidate is accepted only when every link is factual:

`database/schema -> canonical owner/query -> explicit domain rule/test -> authorised Student Context HTTP boundary -> safe human meaning -> real owner action and safe route where an action is offered`.

No current candidate satisfies every link for an **active Student Record**. In particular, a missing/null value, a historical value, an unavailable domain, or a raw status without its owner rule cannot create attention.

| FACT | CANONICAL OWNER | SOURCE FIELD/STATE | DOMAIN RULE | USER MEANING | OWNING SECTION | REAL ACTION AVAILABLE? | SAFE ROUTE AVAILABLE? |
|---|---|---|---|---|---|---|---|
| Non-active enrollment lifecycle (`draft`, `under_review`, `awaiting_documents`, `validated`, `blocked`) | Enrollment | `enrollment_applications.status`; `EnrollmentOperationalStatus` | `enrollment-policy.ts` transitions; `enrollment-process-policy.ts` owns blockers/actions; `tests/secretariat-s03-process-policy.test.ts` proves process-stage/action semantics | REJECTED: the Student Context resolves an active `student_profiles` record and exposes current enrollment only where `e.status='active'`; historical lifecycle alone is not a current student exception | Enrollment process, not Student Record | Yes, in the authorised Enrollment Process for permitted roles | No safe opaque student-to-process route is currently exposed by Student Context; process uses the owner enrollment identifier |
| Active enrollment | Enrollment + Student | `enrollment_applications.status='active'`; `student_profiles.status='active'` | Canonical activation synchronises Enrollment and StudentProfile; `tests/enrollment-active-transition-policy.test.ts` prevents generic activation bypass | REJECTED: normal active state, not attention | Summary / Matrículas context | No exception action | N/A |
| Required document pending, submitted or rejected before validation | Enrollment Documents | `enrollment_documents.required`, `status`, `source_requirement_id` | `documentValidationGate` and `enrollment-document-policy.ts`; `tests/secretariat-s02-3-2-requirement-policy.test.ts` proves only verified required evidence satisfies readiness; `tests/secretariat-s03-process-policy.test.ts` proves owner actions | REJECTED: rule is authoritative for a mutable Enrollment Process, but Student Context intentionally projects only `{type,status,verifiedAt}` for an active enrollment and omits `required`/policy readiness. No semantic attention may be inferred from metadata | Enrollment Documents / Enrollment Process | Yes, only while the enrollment is mutable and role-authorised | No: current Student Context carries no public enrollment/process reference; exposing internal IDs would violate its contract |
| Document metadata status on an active enrollment | Enrollment Documents | Student Context query selects `document_type,status,verified_at` scoped by active current enrollment | `enrollment-document-policy.ts` permits document mutation only for `draft`, `under_review`, `awaiting_documents`, or `blocked`; active enrollment is outside mutable states | REJECTED: raw metadata is factual display data, but status alone is not an active-student attention rule or owner action | Documentos (read metadata) | No for an active enrollment | No |
| Guardian relationship status | Student relationships | `guardian_relationships.status` joined to `people` by institution/student | Student Context policy uses an active relationship only for parent read authorisation; no domain policy marks a relationship status as a Student Record exception | REJECTED: no explicit operational exception/action semantics | Encarregados | No proven action in this read-only mission | No |
| Missing current enrollment, placement, class, program or level | Student / Academic Core | nullable current fields in `loadStudentContext(...)` | No current canonical rule says absence is an exception; spec forbids null/absence heuristics | REJECTED: partial data remains partial/explicit, never an alert | Summary / Percurso académico | No inferred action | No |
| Finance, Assessment, Attendance and physical Documents unavailable | Respective future domains | `unavailableDomains` returns `not_yet_authoritative` | Student Context contract marks these domains non-authoritative | REJECTED: unavailable is neither empty nor attention | Not rendered as operational attention | No | No |

## Evidence trace

- **Schema/data owner:** `enrollment_applications`, `enrollment_documents`, `student_profiles` and `guardian_relationships` are institution-scoped canonical tables; Task 1 adds no schema or writes.
- **Authorised query:** `src/modules/student-context/student-context-api.ts` resolves opaque `studentRef` inside InstitutionalContext, filters current enrollment and placement to active records, and returns document metadata without internal IDs.
- **HTTP boundary:** `src/modules/student-context/student-context.controller.ts` enforces `requireAuth`; the backend returns 401/403/404 fail-closed and does not expose an enrollment/process identifier.
- **Enrollment action boundary:** `src/modules/enrollments/enrollment-process-policy.ts` and `src/modules/enrollments/enrollment-document-api.ts` own explicit action/state semantics. They are not imported or recreated in React/Student Context.
- **Safe user meaning:** no approved semantic code is emitted because all candidate facts lack at least one required link above. The existing Student Record remains calm and factual.

## Scope

**IN:** this inventory, its governance contract test, and evidence-backed rule codes only.

**OUT:** Student Context operational projection; Active Students/UI changes; schema/migration; writes; document lifecycle; photographs; guardian writes; Finance; Assessment; Attendance; Communication; AI; internal-ID routing.

## Task 1 verification

- `npx tsx tests/student-experience-02-attention-rules-contract.test.ts`
- `git diff --check`
- relevant existing domain policy tests for Enrollment and Documents.

## Stop rule

Task 2 is not authorised by this Task 1 result. A later task may only add an attention projection after a new candidate meets every acceptance link above; it must not reinterpret `NONE` as permission to infer attention from absence or raw metadata.

## Task 3 — Contextual Owner-Routing Readiness Audit

`INTERNAL_ID_ROUTING=NO`

`FAKE_ACTIONS_ADDED=NO`

`ROUTABLE_SECTIONS=NONE`

### Acceptance rule

The Student Record is a read-only contextual projection. A section is `ROUTABLE` only when the owner has a real use case, a browser-safe public reference, an actual route that accepts that reference, and server-side InstitutionalContext authorisation. An existing controller that accepts an internal UUID is not a safe route.

| SECTION | OWNER | REAL OWNER USE CASE | SAFE PUBLIC REF | SAFE ROUTE | AUTHORISATION | CURRENTLY ROUTABLE? | PREREQUISITE |
|---|---|---|---|---|---|---|---|
| Resumo | Student Context read model, consuming Student/Academic authorities | Read the authorised current identity/status and academic context | Yes — `student_profiles.public_ref` (`studentRef`), resolved server-side by `(institution_id, public_ref)` | Yes — read-only `GET /api/student-context/:studentRef` | `requireAuth` → InstitutionalContext → `canReadStudentContext`; cross-tenant ref is non-disclosing | READ_ONLY_NO_ACTION | No mutable owner use case is approved for this section; it must remain factual read-only |
| Percurso académico | Academic Core, projected by Student Context | Read current placement and ordered historical placements | Yes — the same opaque `studentRef` | Yes — read-only `GET /api/student-context/:studentRef` | Same Student Context policy and tenant-scoped resolver | READ_ONLY_NO_ACTION | No approved Academic owner action is exposed from Student Record; history is context, not a command |
| Matrículas | Enrollment Process / Enrollment Registration | Inspect or progress a mutable enrollment process where the owner policy permits it | No — current owner APIs accept the internal `enrollment_applications.id`; Student Context deliberately omits it | No safe Student Record route — existing `GET /api/enrollments/:id/process` and registration/transition routes require internal `:id` | `requireAuth` + InstitutionalContext + owner-specific role/lifecycle/version checks | PREREQUISITE_REQUIRED | Add a separately approved opaque enrollment/process reference, institution-scoped resolver and Student Record-to-owner policy bridge; never route with `person_id` or enrollment UUID |
| Documentos | Enrollment Documents | Manage required document lifecycle only for a mutable Enrollment Process | No — documents and their owner APIs use internal enrollment/document UUIDs; Student Context exposes safe metadata only | No safe Student Record route — existing `/api/enrollments/:id/documents` and `:documentId/transitions` routes require internal IDs | `requireAuth` + InstitutionalContext + Enrollment Document policy and mutable lifecycle checks | PREREQUISITE_REQUIRED | Add a separately approved opaque owner reference and policy-safe process bridge before any document action; current metadata remains read-only |
| Encarregados | Student relationships, currently maintained through Enrollment Registration | Read factual guardian relationship name/relationship/status | Yes — the same opaque `studentRef` for projection only | Yes — read-only `GET /api/student-context/:studentRef`; no standalone guardian owner route is proven | Same Student Context policy; parent access is relationship-scoped server-side | READ_ONLY_NO_ACTION | A guardian write use case, public relationship reference and dedicated policy/route are not currently authoritative; do not infer them from registration internals |

### Audit evidence

- `src/modules/student-context/student-context.controller.ts` accepts only `studentRef`, then resolves it inside server-derived InstitutionalContext. It provides the safe read boundary for Resumo, Percurso académico, document metadata and guardian relationship metadata.
- `src/modules/student-context/student-context-api.ts` resolves `student_profiles.public_ref` to an internal person identifier only on the server and does not return enrollment, document, person or membership identifiers.
- `src/modules/enrollments/enrollment-process.controller.ts` exposes real process reads/assignment actions at `/api/enrollments/:id/process` and `/api/enrollments/:id/process/assignment`. Its `:id` is an internal enrollment identifier, not a browser-safe reference.
- `src/modules/enrollments/enrollment-document.controller.ts` exposes real document lifecycle routes at `/api/enrollments/:id/documents` and `/api/enrollments/:id/documents/:documentId/transitions`. Both identifiers are internal and owner-policy/lifecycle guarded.
- `src/modules/enrollments/enrollment-registration.controller.ts` similarly accepts an internal enrollment `:id`; it is not a guardian-route contract.

### Task 3 verification

- `npx tsx tests/student-experience-02-owner-routing-contract.test.ts`
- `git diff --check`

### Stop rule

Task 3 adds no route, button, alias, schema, write or UI. Matrículas and Documentos remain `PREREQUISITE_REQUIRED` until a separate approved owner-routing contract supplies opaque references and server-side policy. This result must not be used to expose internal identifiers or fake disabled actions.

## Task 6 — Product Hardening Gate

`ATTENTION_RULES_ACCEPTED=NONE` remains frozen. Task 6 measures the existing read path and state semantics only: it adds no attention UI, route, write, schema or backend authority.

### Product hardening evidence contract

| Interaction / state | Measured contract | Result |
|---|---|---|
| Open Active Students | Existing workspace load batch has three fixed HTTP reads (`/api/enrollments/context`, `/api/enrollments`, `/api/active-students`); the Active Students endpoint occurs once and never per row | PASS — bounded, no request storm |
| Open Student Record | One authorised `GET /api/student-context/:studentRef` | PASS — one opaque-ref request feeds all five sections |
| Switch any of five sections | Changes local `section` presentation state only | PASS — zero Student Context refetches |
| Retry / reload | Explicit retry invokes exactly one new Student Context request; changed opaque ref invokes the same safe load boundary | PASS |
| PostgreSQL query shape | One public-ref resolver + current-context query + bounded parallel history/document/guardian batch | PASS — existing PostgreSQL proof asserts six queries for an institutional administrator, independent of history row count; no N+1 |
| Polling/materialisation | No interval, polling or browser storage | PASS |
| Loading / retryable read error | Explicit loading surface and safe retryable error surface | PASS — distinct from empty |
| Partial/no current placement | Explicit authorised partial-context message | PASS — partial is not empty or attention |
| No history / documents / guardians | Separate factual empty states in their owning sections | PASS — empty is not error |
| 401 / 403 / 404 / cross-tenant ref | `requireAuth` and Student Context controller return 401, 403 or non-disclosing 404; PostgreSQL/HTTP contract proves foreign-tenant opaque ref is 404 | PASS |
| Terminology/dates | Visible text uses concise school-administration Portuguese; technical names remain code-only; verified document date formatter uses `pt-AO` | PASS |

No state above creates attention: `ATTENTION_RULES_ACCEPTED=NONE` remains frozen.

### Future visual refinement debt

> Minimalist does not mean visually flat/simple. Future Student Experience visual polish may increase depth, contrast, composition and Nexus identity while preserving premium-serene simplicity and existing architecture.

This is documentation-only debt. It does not authorise UI changes in Task 6.

## Task 7 — Human UAT checkpoint

`HUMAN_UAT=ACCEPTED`

Task 7 did not add product capability. It prepared the local disposable UAT target and recorded the evidence required for human acceptance. Human UAT was accepted; the official mission state is now `DONE` for this bounded mission.

### Canonical UAT data

- **Student A** and **Student B** are two distinct fictitious StudentProfiles prepared only through the canonical local UAT bootstrap on the approved disposable PostgreSQL target.
- Both have an active profile, active enrollment, active placement, factual history, metadata-only document data and a guardian relationship. Their current class/programme, history, document type and guardian relationship differ materially.
- The administrative UAT identity remains external and ignored. No email, UID, password, token, internal identifier or public student reference is recorded in this Mission Pack.
- Bootstrap is idempotent: it was executed twice and each run reported the approved target, verified migrations, canonical institutional context and `fixtures: 2`.

### Human path and matrix

`http://localhost:3000` → **Alunos & Matrículas** → **Alunos ativos** → **Abrir registo** → **Resumo** → **Percurso académico** → **Matrículas** → **Documentos** → **Encarregados** → voltar à lista → abrir o outro aluno.

The human acceptance checks desktop, 768px and 390px; light and dark themes; keyboard focus; back navigation; one-person/one-row; A/B replacement without stale data; header status; current/history separation; metadata-only Documents; read-only Encarregados; no identifiers, technical language, fake actions or attention UI; and no Student Record fatal console error or unexpected failed Student Record request.

### Final evidence and human acceptance

- Tasks 1–6 governance/product contracts: PASS.
- Active Students, opaque public references and Student Context PostgreSQL/HTTP: PASS, including tenant isolation, 401/403/404, privacy and read-only purity.
- Enrollment, Academic Core and document-metadata regressions: PASS.
- Migration isolation: PASS for ledger `0001–0024`.
- UAT A/B PostgreSQL fixture proof and bootstrap idempotence: PASS.
- Fresh closeout TypeScript/lint, production build, secret scan, diff check and compatible aggregate quality gate: PASS.
- Machine path check: PASS. The authenticated local portal served HTTP 200; A and B each opened all five read-only sections; A→B carried no stale A content; no Student Record console error was observed. The portal is left at Student B → Encarregados for human acceptance.
- **Human UAT: ACCEPTED.** The five-section student record, two-fixture A/B replacement, responsive/theme/focus/back-navigation behaviour and safe quiet states were visually accepted.

### Deferred prerequisites and known non-blocking warnings

- `ATTENTION_RULES_ACCEPTED=NONE`; no alert, score, warning or placeholder is authorised.
- Enrollment and Document owner actions remain `PREREQUISITE_REQUIRED`: no safe opaque owner route exists from Student Record, so no action is presented.
- Physical document lifecycle, Finance, Assessment, Attendance, Communication, AI and guardian writes remain out of scope.
- Photograph/identity media and a cross-domain timeline remain separate future work; this mission neither creates nor implies either capability.
- Existing non-Student-Record integration warnings (notice, chat, finance and teacher integrations) may return 503 in local visual inspection; they are not treated as Student Record evidence or silently fixed here.
- Future visual refinement debt remains: “Minimalist does not mean visually flat/simple. Future Student Experience visual polish may increase depth, contrast, composition and Nexus identity while preserving premium-serene simplicity and existing architecture.”

### Closeout rule

This bounded mission is `DONE`: its accepted scope is the read-only Student Record clarity and operational refinement described above. This does not prevent future Student Experience missions. Integration remains a separate PR-review and merge gate; do not merge without approval.
